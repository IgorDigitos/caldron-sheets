// Repositório na nuvem (Firestore) com cache local persistente.
//
// Duas regras de ouro do Firestore offline:
// 1. Escrita NUNCA espera o servidor: `setDoc` só resolve quando o servidor confirma, o que sem rede
//    pode levar horas. Gravamos no cache local (instantâneo), devolvemos na hora e acompanhamos a
//    confirmação em segundo plano — é isso que alimenta o indicador "sincronizado / pendente".
// 2. Leitura sem rede vai direto ao cache, para não esperar o timeout do SDK.
//
// Coleções no topo (`personagens`, `itens`, `imagens`, `journal`), cada documento com `fichaId`,
// para a interface do repositório continuar só com ids.

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromCache,
  getDocs,
  getDocsFromCache,
  query,
  setDoc,
  waitForPendingWrites,
  where,
  writeBatch,
  type DocumentReference,
  type DocumentSnapshot,
  type Firestore,
  type Query,
  type QuerySnapshot,
} from 'firebase/firestore';
import type { Ficha } from '../dominio/ficha';
import type { Item } from '../dominio/inventario';
import type { EntradaJournal } from '../dominio/journal';
import type { Skill } from '../dominio/skills';
import type { Imagem } from '../midia/imagem';
import { resumir, type PacoteFicha, type RepositorioFichas, type ResumoFicha } from './repositorio';

export const COLECOES = {
  fichas: 'personagens',
  itens: 'itens',
  imagens: 'imagens',
  journal: 'journal',
  skills: 'skills',
} as const;

export interface EstadoSync {
  /** Escritas feitas aqui que o servidor ainda não confirmou. */
  pendentes: number;
  /** Escritas que ainda estão sendo gravadas no próprio aparelho (milissegundos). */
  gravando?: number;
  /** Último erro de sincronização (ex.: escrita recusada pelo servidor). */
  erro?: string;
}

type Ouvinte = (estado: EstadoSync) => void;

/** Lote do Firestore aceita até 500 operações e ~10MB; imagens pesam, então cortamos antes. */
const MAX_OPS_LOTE = 400;
const MAX_BYTES_LOTE = 4 * 1024 * 1024;

function offline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export class RepositorioFirestore implements RepositorioFichas {
  private pendentes = 0;
  private gravando = 0;
  private erro: string | undefined;
  private readonly ouvintes = new Set<Ouvinte>();

  constructor(
    private readonly db: Firestore,
    private readonly traduzirErro: (e: unknown) => string = (e) => (e as Error).message,
    /** Jogador: só enxerga as fichas dele (as regras exigem esse filtro na consulta). */
    private readonly opcoes: { donoUid?: string } = {},
  ) {
    // Escritas que ficaram na fila de uma sessão anterior (app fechado sem rede) também contam.
    this.acompanhar(waitForPendingWrites(db));
  }

  // ---------- sincronização ----------

  observar(ouvinte: Ouvinte): () => void {
    this.ouvintes.add(ouvinte);
    ouvinte(this.estado());
    return () => this.ouvintes.delete(ouvinte);
  }

  estado(): EstadoSync {
    return { pendentes: this.pendentes, gravando: this.gravando, ...(this.erro ? { erro: this.erro } : {}) };
  }

  limparErro(): void {
    this.erro = undefined;
    this.avisar();
  }

  /** Espera o servidor confirmar tudo (testes e "sincronizar agora"). */
  sincronizado(): Promise<void> {
    return waitForPendingWrites(this.db);
  }

  private avisar(): void {
    const e = this.estado();
    this.ouvintes.forEach((o) => o(e));
  }

  private acompanhar(confirmacao: Promise<unknown>): void {
    this.pendentes++;
    this.avisar();
    confirmacao
      .catch((e: unknown) => {
        this.erro = this.traduzirErro(e);
      })
      .finally(() => {
        this.pendentes--;
        this.avisar();
      });
  }

  /**
   * Grava e devolve assim que a escrita estiver salva NO APARELHO (IndexedDB) — sem esperar o
   * servidor. A confirmação do servidor é acompanhada à parte.
   *
   * O SDK processa operações numa fila única: uma leitura do cache enfileirada depois da escrita só
   * termina quando a escrita já foi gravada localmente. Sem isso, fechar o app logo após editar
   * poderia perder a edição.
   */
  private async escrever(ref: DocumentReference, operacao: () => Promise<unknown>): Promise<void> {
    // Se o dado for inválido, `operacao()` lança aqui mesmo e a escrita nem entra na fila.
    const confirmacao = operacao();
    this.gravando++;
    this.acompanhar(confirmacao);
    try {
      await getDocFromCache(ref).catch(() => undefined);
    } finally {
      this.gravando--;
      this.avisar();
    }
  }

  // ---------- leitura ----------

  private async lerDoc<T>(ref: DocumentReference): Promise<T | undefined> {
    let snap: DocumentSnapshot;
    if (offline()) {
      try {
        snap = await getDocFromCache(ref);
      } catch {
        return undefined; // não está no cache
      }
    } else {
      try {
        snap = await getDoc(ref);
      } catch {
        snap = await getDocFromCache(ref).catch(() => undefined as unknown as DocumentSnapshot);
        if (!snap) return undefined;
      }
    }
    return snap.exists() ? (snap.data() as T) : undefined;
  }

  private async lerLista<T>(q: Query): Promise<T[]> {
    let snap: QuerySnapshot;
    if (offline()) snap = await getDocsFromCache(q);
    else {
      try {
        snap = await getDocs(q);
      } catch {
        snap = await getDocsFromCache(q);
      }
    }
    return snap.docs.map((d) => d.data() as T);
  }

  private daFicha(colecao: string, fichaId: string): Query {
    return query(collection(this.db, colecao), where('fichaId', '==', fichaId));
  }

  // ---------- fichas ----------

  async listar(): Promise<ResumoFicha[]> {
    const col = collection(this.db, COLECOES.fichas);
    const q = this.opcoes.donoUid ? query(col, where('donoUid', '==', this.opcoes.donoUid)) : col;
    const fichas = await this.lerLista<Ficha>(q);
    return fichas.sort((a, b) => b.atualizadoEm - a.atualizadoEm).map(resumir);
  }

  obter(id: string): Promise<Ficha | undefined> {
    return this.lerDoc<Ficha>(doc(this.db, COLECOES.fichas, id));
  }

  salvar(ficha: Ficha): Promise<void> {
    const ref = doc(this.db, COLECOES.fichas, ficha.id);
    return this.escrever(ref, () => setDoc(ref, ficha));
  }

  async excluir(id: string): Promise<void> {
    const refs = [doc(this.db, COLECOES.fichas, id)];
    for (const c of [COLECOES.itens, COLECOES.imagens, COLECOES.journal, COLECOES.skills]) {
      const q = this.daFicha(c, id);
      const snap = offline() ? await getDocsFromCache(q) : await getDocs(q).catch(() => getDocsFromCache(q));
      refs.push(...snap.docs.map((d) => d.ref));
    }
    for (let i = 0; i < refs.length; i += MAX_OPS_LOTE) {
      const lote = writeBatch(this.db);
      refs.slice(i, i + MAX_OPS_LOTE).forEach((r) => lote.delete(r));
      const ultimoRef = refs[Math.min(i + MAX_OPS_LOTE, refs.length) - 1]!;
      await this.escrever(ultimoRef, () => lote.commit());
    }
  }

  // ---------- itens, imagens, journal ----------

  listarItens(fichaId: string): Promise<Item[]> {
    return this.lerLista<Item>(this.daFicha(COLECOES.itens, fichaId));
  }

  salvarItem(item: Item): Promise<void> {
    const ref = doc(this.db, COLECOES.itens, item.id);
    return this.escrever(ref, () => setDoc(ref, item));
  }

  excluirItem(id: string): Promise<void> {
    const ref = doc(this.db, COLECOES.itens, id);
    return this.escrever(ref, () => deleteDoc(ref));
  }

  obterImagem(id: string): Promise<Imagem | undefined> {
    return this.lerDoc<Imagem>(doc(this.db, COLECOES.imagens, id));
  }

  salvarImagem(imagem: Imagem): Promise<void> {
    const ref = doc(this.db, COLECOES.imagens, imagem.id);
    return this.escrever(ref, () => setDoc(ref, imagem));
  }

  excluirImagem(id: string): Promise<void> {
    const ref = doc(this.db, COLECOES.imagens, id);
    return this.escrever(ref, () => deleteDoc(ref));
  }

  listarJournal(fichaId: string): Promise<EntradaJournal[]> {
    return this.lerLista<EntradaJournal>(this.daFicha(COLECOES.journal, fichaId));
  }

  salvarEntrada(entrada: EntradaJournal): Promise<void> {
    const ref = doc(this.db, COLECOES.journal, entrada.id);
    return this.escrever(ref, () => setDoc(ref, entrada));
  }

  excluirEntrada(id: string): Promise<void> {
    const ref = doc(this.db, COLECOES.journal, id);
    return this.escrever(ref, () => deleteDoc(ref));
  }

  listarSkills(fichaId: string): Promise<Skill[]> {
    return this.lerLista<Skill>(this.daFicha(COLECOES.skills, fichaId));
  }

  salvarSkill(skill: Skill): Promise<void> {
    const ref = doc(this.db, COLECOES.skills, skill.id);
    return this.escrever(ref, () => setDoc(ref, skill));
  }

  excluirSkill(id: string): Promise<void> {
    const ref = doc(this.db, COLECOES.skills, id);
    return this.escrever(ref, () => deleteDoc(ref));
  }

  // ---------- pacote (backup / migração) ----------

  async obterPacote(fichaId: string): Promise<PacoteFicha | undefined> {
    const ficha = await this.obter(fichaId);
    if (!ficha) return undefined;
    const [itens, imagens, journal, skills] = await Promise.all([
      this.listarItens(fichaId),
      this.lerLista<Imagem>(this.daFicha(COLECOES.imagens, fichaId)),
      this.listarJournal(fichaId),
      this.listarSkills(fichaId),
    ]);
    return { ficha, itens, imagens, journal, skills };
  }

  /**
   * Substitui tudo da ficha. Não é atômico quando passa de um lote (fotos grandes), mas cada lote é.
   * Apagar primeiro garante que itens que não estão no pacote somem.
   */
  async gravarPacote(p: PacoteFicha): Promise<void> {
    await this.excluir(p.ficha.id);
    const escritas: { ref: DocumentReference; dados: object; bytes: number }[] = [
      { ref: doc(this.db, COLECOES.fichas, p.ficha.id), dados: p.ficha, bytes: 0 },
      ...p.itens.map((i) => ({ ref: doc(this.db, COLECOES.itens, i.id), dados: i, bytes: 0 })),
      ...p.journal.map((e) => ({ ref: doc(this.db, COLECOES.journal, e.id), dados: e, bytes: 0 })),
      ...p.skills.map((s) => ({ ref: doc(this.db, COLECOES.skills, s.id), dados: s, bytes: 0 })),
      ...p.imagens.map((i) => ({ ref: doc(this.db, COLECOES.imagens, i.id), dados: i, bytes: i.dataUrl.length })),
    ];
    let lote = writeBatch(this.db);
    let ops = 0;
    let bytes = 0;
    let ultimaRef = escritas[0]!.ref;
    for (const e of escritas) {
      if (ops > 0 && (ops >= MAX_OPS_LOTE || bytes + e.bytes > MAX_BYTES_LOTE)) {
        const pronto = lote;
        await this.escrever(ultimaRef, () => pronto.commit());
        lote = writeBatch(this.db);
        ops = 0;
        bytes = 0;
      }
      lote.set(e.ref, e.dados);
      ultimaRef = e.ref;
      ops++;
      bytes += e.bytes;
    }
    const ultimo = lote;
    await this.escrever(ultimaRef, () => ultimo.commit());
  }
}
