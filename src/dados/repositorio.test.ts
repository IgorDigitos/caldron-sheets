import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { testarRepositorio } from './suiteRepositorio';
import { RepositorioDexie } from './dexie';
import { RepositorioMemoria } from './memoria';
import type { RepositorioFichas } from './repositorio';
import Dexie from 'dexie';
import { aplicar, criarFicha, type Ficha } from '../dominio/ficha';
import { SKAR } from '../rules/fixtures/skar';

// A mesma suíte (suiteRepositorio.ts) roda aqui em Dexie e memória, e no Firestore em
// repositorio.nuvem.test.ts (emulador).
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

for (const [nome, criar] of implementacoes) testarRepositorio(nome, criar);

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

  it('ficha da versão 2 ganha a carteira vazia e as tabelas novas funcionam', async () => {
    const nome = `teste-${crypto.randomUUID()}`;
    const v2 = new Dexie(nome);
    v2.version(1).stores({ fichas: 'id, nome, atualizadoEm' });
    v2.version(2).stores({ fichas: 'id, nome, atualizadoEm' });
    const antiga: Partial<Ficha> = criarFicha({ nome: 'Skar', ...SKAR });
    delete antiga.carteira;
    await v2.table('fichas').put(antiga);
    v2.close();

    const repo = new RepositorioDexie(nome);
    abertos.push(repo);
    const lida = await repo.obter(antiga.id!);
    expect(lida!.carteira.moedas.ouro).toBe(0);
    expect(lida!.carteira.alma).toBe(0);
    expect(lida!.alteracoes).toEqual(antiga.alteracoes);
    expect(await repo.listarItens(antiga.id!)).toEqual([]);
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
