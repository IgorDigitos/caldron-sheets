import Dexie, { type EntityTable } from 'dexie';
import type { Ficha } from '../dominio/ficha';
import { resumir, type RepositorioFichas, type ResumoFicha } from './repositorio';

class BancoCaldron extends Dexie {
  fichas!: EntityTable<Ficha, 'id'>;

  constructor(nome: string) {
    super(nome);
    this.version(1).stores({
      // Só o que é consultado vira índice; o resto da ficha vai junto no documento.
      fichas: 'id, nome, atualizadoEm',
    });
  }
}

export class RepositorioDexie implements RepositorioFichas {
  private readonly db: BancoCaldron;

  constructor(nomeBanco = 'caldron-sheets') {
    this.db = new BancoCaldron(nomeBanco);
  }

  async listar(): Promise<ResumoFicha[]> {
    const todas = await this.db.fichas.orderBy('atualizadoEm').reverse().toArray();
    return todas.map(resumir);
  }

  obter(id: string): Promise<Ficha | undefined> {
    return this.db.fichas.get(id);
  }

  async salvar(ficha: Ficha): Promise<void> {
    await this.db.fichas.put(ficha);
  }

  async excluir(id: string): Promise<void> {
    await this.db.fichas.delete(id);
  }

  fechar(): void {
    this.db.close();
  }
}
