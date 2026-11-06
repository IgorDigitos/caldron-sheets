import type { Ficha } from '../dominio/ficha';
import { resumir, type RepositorioFichas, type ResumoFicha } from './repositorio';

/** Repositório em memória, para testes de tela. */
export class RepositorioMemoria implements RepositorioFichas {
  private readonly fichas = new Map<string, Ficha>();

  async listar(): Promise<ResumoFicha[]> {
    return [...this.fichas.values()].sort((a, b) => b.atualizadoEm - a.atualizadoEm).map(resumir);
  }

  async obter(id: string): Promise<Ficha | undefined> {
    const f = this.fichas.get(id);
    return f && structuredClone(f);
  }

  async salvar(ficha: Ficha): Promise<void> {
    this.fichas.set(ficha.id, structuredClone(ficha));
  }

  async excluir(id: string): Promise<void> {
    this.fichas.delete(id);
  }
}
