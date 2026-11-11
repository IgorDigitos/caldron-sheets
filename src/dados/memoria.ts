import type { Ficha } from '../dominio/ficha';
import type { Item } from '../dominio/inventario';
import type { EntradaJournal } from '../dominio/journal';
import type { DefRecurso } from '../dominio/recursos';
import type { Skill } from '../dominio/skills';
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
  private readonly skills = new Map<string, Skill>();
  private readonly recursos = new Map<string, DefRecurso>();
  private readonly ouvintesFichas = new Set<(fichas: Ficha[]) => void>();

  async listar(): Promise<ResumoFicha[]> {
    return [...this.fichas.values()].sort((a, b) => b.atualizadoEm - a.atualizadoEm).map(resumir);
  }

  async obter(id: string): Promise<Ficha | undefined> {
    const f = this.fichas.get(id);
    return f && copia(f);
  }

  async salvar(ficha: Ficha): Promise<void> {
    this.fichas.set(ficha.id, copia(ficha));
    this.avisarFichas();
  }

  async excluir(id: string): Promise<void> {
    this.fichas.delete(id);
    for (const m of [this.itens, this.imagens, this.journal, this.skills] as Map<string, { fichaId: string }>[]) {
      for (const [k, v] of m) if (v.fichaId === id) m.delete(k);
    }
    this.avisarFichas();
  }

  observarFichas(ouvinte: (fichas: Ficha[]) => void): () => void {
    this.ouvintesFichas.add(ouvinte);
    ouvinte(this.todasFichas());
    return () => this.ouvintesFichas.delete(ouvinte);
  }

  private todasFichas(): Ficha[] {
    return [...this.fichas.values()].sort((a, b) => b.atualizadoEm - a.atualizadoEm).map(copia);
  }

  private avisarFichas(): void {
    if (this.ouvintesFichas.size === 0) return;
    const lista = this.todasFichas();
    this.ouvintesFichas.forEach((o) => o(lista));
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

  async listarRecursos(): Promise<DefRecurso[]> {
    return [...this.recursos.values()].map(copia).sort((a, b) => a.criadoEm - b.criadoEm);
  }

  async salvarRecurso(def: DefRecurso): Promise<void> {
    this.recursos.set(def.id, copia(def));
  }

  async excluirRecurso(id: string): Promise<void> {
    this.recursos.delete(id);
  }

  async listarSkills(fichaId: string): Promise<Skill[]> {
    return deFicha(this.skills, fichaId);
  }

  async salvarSkill(skill: Skill): Promise<void> {
    this.skills.set(skill.id, copia(skill));
  }

  async excluirSkill(id: string): Promise<void> {
    this.skills.delete(id);
  }

  async obterPacote(fichaId: string): Promise<PacoteFicha | undefined> {
    const ficha = await this.obter(fichaId);
    if (!ficha) return undefined;
    return {
      ficha,
      itens: deFicha(this.itens, fichaId),
      imagens: deFicha(this.imagens, fichaId),
      journal: deFicha(this.journal, fichaId),
      skills: deFicha(this.skills, fichaId),
    };
  }

  async gravarPacote(p: PacoteFicha): Promise<void> {
    await this.excluir(p.ficha.id);
    await this.salvar(p.ficha);
    p.itens.forEach((i) => this.itens.set(i.id, copia(i)));
    p.imagens.forEach((i) => this.imagens.set(i.id, copia(i)));
    p.journal.forEach((e) => this.journal.set(e.id, copia(e)));
    p.skills.forEach((s) => this.skills.set(s.id, copia(s)));
  }
}
