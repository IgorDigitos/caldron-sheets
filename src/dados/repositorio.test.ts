import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { RepositorioDexie } from './dexie';
import { RepositorioMemoria } from './memoria';
import type { RepositorioFichas } from './repositorio';
import Dexie from 'dexie';
import { aplicar, criarFicha, type Ficha } from '../dominio/ficha';
import { SKAR } from '../rules/fixtures/skar';

// A mesma suíte roda em todas as implementações (na etapa 4 entra a do Firestore).
const abertos: RepositorioDexie[] = [];
const implementacoes: [string, () => RepositorioFichas][] = [
  [
    'Dexie',
    () => {
      const r = new RepositorioDexie(`teste-${crypto.randomUUID()}`);
      abertos.push(r);
      return r;
    },
  ],
  ['Memória', () => new RepositorioMemoria()],
];

afterEach(() => {
  abertos.splice(0).forEach((r) => r.fechar());
});

describe.each(implementacoes)('Repositório %s', (_nome, criar) => {
  it('começa vazio', async () => {
    expect(await criar().listar()).toEqual([]);
  });

  it('salva e lê a ficha inteira', async () => {
    const repo = criar();
    const f = aplicar(criarFicha({ nome: 'Skar', ...SKAR }), 'VIDA', 'dano', 8);
    await repo.salvar(f);
    expect(await repo.obter(f.id)).toEqual(f);
  });

  it('obter de id inexistente devolve undefined', async () => {
    expect(await criar().obter('nada')).toBeUndefined();
  });

  it('salvar de novo sobrescreve', async () => {
    const repo = criar();
    const f = criarFicha({ nome: 'Skar', ...SKAR });
    await repo.salvar(f);
    await repo.salvar(aplicar(f, 'VIDA', 'dano', 10));
    expect((await repo.obter(f.id))!.atuais.VIDA).toBe(35);
    expect(await repo.listar()).toHaveLength(1);
  });

  it('lista a mais recente primeiro, só com o resumo', async () => {
    const repo = criar();
    await repo.salvar(criarFicha({ nome: 'Antiga', classe: 'Mago' }, 1000));
    await repo.salvar(criarFicha({ nome: 'Nova' }, 2000));
    const lista = await repo.listar();
    expect(lista.map((r) => r.nome)).toEqual(['Nova', 'Antiga']);
    expect(lista[1]).toEqual({
      id: expect.any(String),
      nome: 'Antiga',
      nivel: 1,
      raca: '',
      classe: 'Mago',
      atualizadoEm: 1000,
    });
  });

  it('exclui', async () => {
    const repo = criar();
    const f = criarFicha({ nome: 'X' });
    await repo.salvar(f);
    await repo.excluir(f.id);
    expect(await repo.obter(f.id)).toBeUndefined();
    expect(await repo.listar()).toEqual([]);
  });

  it('o objeto salvo não muda se a ficha em memória mudar depois', async () => {
    const repo = criar();
    const f = criarFicha({ nome: 'X' });
    await repo.salvar(f);
    f.atuais.VIDA = -999;
    expect((await repo.obter(f.id))!.atuais.VIDA).not.toBe(-999);
  });
});

describe('Dexie migra fichas antigas', () => {
  it('ficha salva na versão 1 ganha a lista de alterações vazia', async () => {
    const nome = `teste-${crypto.randomUUID()}`;
    const v1 = new Dexie(nome);
    v1.version(1).stores({ fichas: 'id, nome, atualizadoEm' });
    const antiga: Partial<Ficha> = criarFicha({ nome: 'Skar', ...SKAR });
    delete antiga.alteracoes;
    await v1.table('fichas').put(antiga);
    v1.close();

    const repo = new RepositorioDexie(nome);
    abertos.push(repo);
    const lida = await repo.obter(antiga.id!);
    expect(lida!.alteracoes).toEqual([]);
    expect(lida!.atuais.VIDA).toBe(45);
  });
});

describe('Dexie persiste entre conexões', () => {
  it('reabrir o banco mantém os dados (fechar e abrir o app)', async () => {
    const nome = `teste-${crypto.randomUUID()}`;
    const a = new RepositorioDexie(nome);
    const f = aplicar(criarFicha({ nome: 'Skar', ...SKAR }), 'VIDA', 'dano', 8);
    await a.salvar(f);
    a.fechar();
    const b = new RepositorioDexie(nome);
    abertos.push(b);
    expect((await b.obter(f.id))!.atuais.VIDA).toBe(37);
  });
});
