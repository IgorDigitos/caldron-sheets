import Dexie, { type EntityTable } from 'dexie';
import type { Ficha } from '../dominio/ficha';
import { carteiraVazia, type Item } from '../dominio/inventario';
import type { EntradaJournal } from '../dominio/journal';
import type { DefRecurso } from '../dominio/recursos';
import type { Skill } from '../dominio/skills';
import type { Imagem } from '../midia/imagem';
import { resumir, type PacoteFicha, type RepositorioFichas, type ResumoFicha } from './repositorio';

class BancoCaldron extends Dexie {
  fichas!: EntityTable<Ficha, 'id'>;
  itens!: EntityTable<Item, 'id'>;
  imagens!: EntityTable<Imagem, 'id'>;
  journal!: EntityTable<EntradaJournal, 'id'>;
  skills!: EntityTable<Skill, 'id'>;
  recursos!: EntityTable<DefRecurso, 'id'>;

  constructor(nome: string) {
    super(nome);
    this.version(1).stores({
      // Só o que é consultado vira índice; o resto da ficha vai junto no documento.
      fichas: 'id, nome, atualizadoEm',
    });
    // v2: histórico de alterações de nível/atributos.
    this.version(2)
      .stores({ fichas: 'id, nome, atualizadoEm' })
      .upgrade((tx) =>
        tx
          .table('fichas')
          .toCollection()
          .modify((f: Partial<Ficha>) => {
            f.alteracoes ??= [];
          }),
      );
    // v3: inventário, imagens, journal e carteira.
    this.version(3)
      .stores({
        fichas: 'id, nome, atualizadoEm',
        itens: 'id, fichaId',
        imagens: 'id, fichaId',
        journal: 'id, fichaId',
      })
      .upgrade((tx) =>
        tx
          .table('fichas')
          .toCollection()
          .modify((f: Partial<Ficha>) => {
            f.carteira ??= carteiraVazia();
          }),
      );
    // v4: skills.
    this.version(4).stores({
      fichas: 'id, nome, atualizadoEm',
      itens: 'id, fichaId',
      imagens: 'id, fichaId',
      journal: 'id, fichaId',
      skills: 'id, fichaId',
    });
    // v5: catálogo de recursos personalizados.
    this.version(5).stores({
      fichas: 'id, nome, atualizadoEm',
      itens: 'id, fichaId',
      imagens: 'id, fichaId',
      journal: 'id, fichaId',
      skills: 'id, fichaId',
      recursos: 'id',
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
    const { fichas, itens, imagens, journal, skills } = this.db;
    await this.db.transaction('rw', [fichas, itens, imagens, journal, skills], () => this.excluirTudo(id));
  }

  private async excluirTudo(id: string): Promise<void> {
    await this.db.fichas.delete(id);
    await this.db.itens.where('fichaId').equals(id).delete();
    await this.db.imagens.where('fichaId').equals(id).delete();
    await this.db.journal.where('fichaId').equals(id).delete();
    await this.db.skills.where('fichaId').equals(id).delete();
  }

  listarItens(fichaId: string): Promise<Item[]> {
    return this.db.itens.where('fichaId').equals(fichaId).toArray();
  }

  async salvarItem(item: Item): Promise<void> {
    await this.db.itens.put(item);
  }

  async excluirItem(id: string): Promise<void> {
    await this.db.itens.delete(id);
  }

  obterImagem(id: string): Promise<Imagem | undefined> {
    return this.db.imagens.get(id);
  }

  async salvarImagem(imagem: Imagem): Promise<void> {
    await this.db.imagens.put(imagem);
  }

  async excluirImagem(id: string): Promise<void> {
    await this.db.imagens.delete(id);
  }

  listarJournal(fichaId: string): Promise<EntradaJournal[]> {
    return this.db.journal.where('fichaId').equals(fichaId).toArray();
  }

  async salvarEntrada(entrada: EntradaJournal): Promise<void> {
    await this.db.journal.put(entrada);
  }

  async excluirEntrada(id: string): Promise<void> {
    await this.db.journal.delete(id);
  }

  async listarRecursos(): Promise<DefRecurso[]> {
    return (await this.db.recursos.toArray()).sort((a, b) => a.criadoEm - b.criadoEm);
  }

  async salvarRecurso(def: DefRecurso): Promise<void> {
    await this.db.recursos.put(def);
  }

  async excluirRecurso(id: string): Promise<void> {
    await this.db.recursos.delete(id);
  }

  listarSkills(fichaId: string): Promise<Skill[]> {
    return this.db.skills.where('fichaId').equals(fichaId).toArray();
  }

  async salvarSkill(skill: Skill): Promise<void> {
    await this.db.skills.put(skill);
  }

  async excluirSkill(id: string): Promise<void> {
    await this.db.skills.delete(id);
  }

  async obterPacote(fichaId: string): Promise<PacoteFicha | undefined> {
    const { fichas, itens, imagens, journal, skills } = this.db;
    return this.db.transaction('r', [fichas, itens, imagens, journal, skills], async () => {
      const ficha = await fichas.get(fichaId);
      if (!ficha) return undefined;
      return {
        ficha,
        itens: await itens.where('fichaId').equals(fichaId).toArray(),
        imagens: await imagens.where('fichaId').equals(fichaId).toArray(),
        journal: await journal.where('fichaId').equals(fichaId).toArray(),
        skills: await skills.where('fichaId').equals(fichaId).toArray(),
      };
    });
  }

  async gravarPacote(p: PacoteFicha): Promise<void> {
    const { fichas, itens, imagens, journal, skills } = this.db;
    await this.db.transaction('rw', [fichas, itens, imagens, journal, skills], async () => {
      await this.excluirTudo(p.ficha.id);
      await fichas.put(p.ficha);
      await itens.bulkPut(p.itens);
      await imagens.bulkPut(p.imagens);
      await journal.bulkPut(p.journal);
      await skills.bulkPut(p.skills);
    });
  }

  fechar(): void {
    this.db.close();
  }
}
