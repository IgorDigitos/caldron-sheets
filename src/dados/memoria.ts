import type { Ficha } from '../dominio/ficha';
import type { Item } from '../dominio/inventario';
import type { EntradaJournal } from '../dominio/journal';
import type { Imagem } from '../midia/imagem';
import { resumir, type PacoteFicha, type RepositorioFichas, type ResumoFicha } from './repositorio';

const copia = <T>(v: T): T => structuredClone(v);
const deFicha = <T extends { fichaId: string }>(m: Map<string, T>, fichaId: string) =>
  [...m.values()].filter((v) => v.fichaId === fichaId).map(copia);

/** Repositório em memória, para testes de tela. */
export class RepositorioMemoria implements RepositorioFichas {
  private readonly fichas = new Map<string, Ficha>();
  private readonly itens = new Map<string, Item>();
  private readonly imagens = new Map<string, Imagem>();
  private readonly journal = new Map<string, EntradaJournal>();

  async listar(): Promise<ResumoFicha[]> {
    return [...this.fichas.values()].sort((a, b) => b.atualizadoEm - a.atualizadoEm).map(resumir);
  }

  async obter(id: string): Promise<Ficha | undefined> {
    const f = this.fichas.get(id);
    return f && copia(f);
  }

  async salvar(ficha: Ficha): Promise<void> {
    this.fichas.set(ficha.id, copia(ficha));
  }

  async excluir(id: string): Promise<void> {
    this.fichas.delete(id);
    for (const m of [this.itens, this.imagens, this.journal] as Map<string, { fichaId: string }>[]) {
      for (const [k, v] of m) if (v.fichaId === id) m.delete(k);
    }
  }

  async listarItens(fichaId: string): Promise<Item[]> {
    return deFicha(this.itens, fichaId);
  }

  async salvarItem(item: Item): Promise<void> {
    this.itens.set(item.id, copia(item));
  }

  async excluirItem(id: string): Promise<void> {
    this.itens.delete(id);
  }

  async obterImagem(id: string): Promise<Imagem | undefined> {
    const i = this.imagens.get(id);
    return i && copia(i);
  }

  async salvarImagem(imagem: Imagem): Promise<void> {
    this.imagens.set(imagem.id, copia(imagem));
  }

  async excluirImagem(id: string): Promise<void> {
    this.imagens.delete(id);
  }

  async listarJournal(fichaId: string): Promise<EntradaJournal[]> {
    return deFicha(this.journal, fichaId);
  }

  async salvarEntrada(entrada: EntradaJournal): Promise<void> {
    this.journal.set(entrada.id, copia(entrada));
  }

  async excluirEntrada(id: string): Promise<void> {
    this.journal.delete(id);
  }

  async obterPacote(fichaId: string): Promise<PacoteFicha | undefined> {
    const ficha = await this.obter(fichaId);
    if (!ficha) return undefined;
    return {
      ficha,
      itens: deFicha(this.itens, fichaId),
      imagens: deFicha(this.imagens, fichaId),
      journal: deFicha(this.journal, fichaId),
    };
  }

  async gravarPacote(p: PacoteFicha): Promise<void> {
    await this.excluir(p.ficha.id);
    await this.salvar(p.ficha);
    p.itens.forEach((i) => this.itens.set(i.id, copia(i)));
    p.imagens.forEach((i) => this.imagens.set(i.id, copia(i)));
    p.journal.forEach((e) => this.journal.set(e.id, copia(e)));
  }
}
