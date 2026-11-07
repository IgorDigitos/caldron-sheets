// Regras de segurança (firestore.rules) contra o emulador.

import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { PORTAS_EMULADOR, PROJETO_EMULADOR } from './config';

let env: RulesTestEnvironment;
const MESTRE = 'uid-mestre';
const OUTRO = 'uid-outro';
const DATA_URL = 'data:image/webp;base64,AA==';

const ficha = (atualizadoEm: number) => ({ id: 'f1', nome: 'Skar', atualizadoEm });
const item = (atualizadoEm: number) => ({ id: 'i1', fichaId: 'f1', nome: 'Corda', atualizadoEm });

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJETO_EMULADOR,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: PORTAS_EMULADOR.firestore },
  });
});

afterAll(async () => {
  await env.clearFirestore();
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc('campanha/config').set({ mestreUid: MESTRE, criadoEm: 1 });
    await ctx.firestore().doc('personagens/f1').set(ficha(1000));
    await ctx.firestore().doc('itens/i1').set(item(1000));
  });
});

const mestre = () => env.authenticatedContext(MESTRE).firestore();
const outro = () => env.authenticatedContext(OUTRO).firestore();
const anonimo = () => env.unauthenticatedContext().firestore();

describe('campanha/config', () => {
  it('qualquer um lê (a tela de login precisa saber se há Mestre)', async () => {
    await assertSucceeds(anonimo().doc('campanha/config').get());
  });

  it('ninguém troca o Mestre depois de criado', async () => {
    await assertFails(outro().doc('campanha/config').set({ mestreUid: OUTRO, criadoEm: 2 }));
    await assertFails(mestre().doc('campanha/config').update({ mestreUid: OUTRO }));
    await assertFails(mestre().doc('campanha/config').delete());
  });

  it('primeiro acesso: só cria apontando para si mesmo e sem campos extras', async () => {
    await env.clearFirestore();
    await assertFails(anonimo().doc('campanha/config').set({ mestreUid: OUTRO, criadoEm: 1 }));
    await assertFails(outro().doc('campanha/config').set({ mestreUid: MESTRE, criadoEm: 1 }));
    await assertFails(outro().doc('campanha/config').set({ mestreUid: OUTRO, criadoEm: 1, admin: true }));
    await assertSucceeds(outro().doc('campanha/config').set({ mestreUid: OUTRO, criadoEm: 1 }));
  });
});

describe('personagens', () => {
  it('Mestre lê, cria, atualiza e apaga', async () => {
    await assertSucceeds(mestre().doc('personagens/f1').get());
    await assertSucceeds(mestre().collection('personagens').get());
    await assertSucceeds(mestre().doc('personagens/f2').set({ id: 'f2', nome: 'Nova', atualizadoEm: 1 }));
    await assertSucceeds(mestre().doc('personagens/f1').set(ficha(2000)));
    await assertSucceeds(mestre().doc('personagens/f1').delete());
  });

  it('quem não é Mestre não lê nem escreve', async () => {
    await assertFails(outro().doc('personagens/f1').get());
    await assertFails(outro().collection('personagens').get());
    await assertFails(outro().doc('personagens/f1').set(ficha(2000)));
    await assertFails(anonimo().doc('personagens/f1').get());
  });

  it('última edição ganha: atualização mais velha é recusada, igual é aceita', async () => {
    await assertFails(mestre().doc('personagens/f1').set(ficha(999)));
    await assertSucceeds(mestre().doc('personagens/f1').set(ficha(1000)));
  });

  it('atualização sem atualizadoEm ou com id trocado é recusada', async () => {
    await assertFails(mestre().doc('personagens/f1').set({ id: 'f1', nome: 'x' }));
    await assertFails(mestre().doc('personagens/f1').set({ ...ficha(3000), id: 'f9' }));
    await assertFails(mestre().doc('personagens/f3').set({ id: 'f3', nome: 'x' }));
  });
});

describe('itens e journal', () => {
  it('Mestre grava com fichaId; sem fichaId é recusado', async () => {
    await assertSucceeds(mestre().doc('itens/i1').set(item(2000)));
    await assertFails(mestre().doc('itens/i2').set({ id: 'i2', nome: 'x', atualizadoEm: 1 }));
    await assertSucceeds(
      mestre().doc('journal/j1').set({ id: 'j1', fichaId: 'f1', data: '2026-11-06', texto: 'x', atualizadoEm: 1 }),
    );
  });

  it('item mais velho é recusado; outro usuário não acessa', async () => {
    await assertFails(mestre().doc('itens/i1').set(item(10)));
    await assertFails(outro().doc('itens/i1').get());
    await assertFails(outro().collection('itens').where('fichaId', '==', 'f1').get());
  });
});

describe('imagens', () => {
  const img = (dataUrl: string) => ({ id: 'm1', fichaId: 'f1', dataUrl, criadoEm: 1 });

  it('aceita webp/jpeg/png em data URL', async () => {
    await assertSucceeds(mestre().doc('imagens/m1').set(img(DATA_URL)));
    await assertSucceeds(mestre().doc('imagens/m1').set(img('data:image/jpeg;base64,AA==')));
  });

  it('recusa SVG, javascript: e imagem grande demais', async () => {
    await assertFails(mestre().doc('imagens/m1').set(img('data:image/svg+xml;base64,PHN2Zz4=')));
    await assertFails(mestre().doc('imagens/m1').set(img('javascript:alert(1)')));
    await assertFails(mestre().doc('imagens/m1').set(img(`data:image/webp;base64,${'A'.repeat(700_000)}`)));
  });

  it('outro usuário não lê imagens', async () => {
    await env.withSecurityRulesDisabled((ctx) => ctx.firestore().doc('imagens/m1').set(img(DATA_URL)));
    await assertFails(outro().doc('imagens/m1').get());
  });
});

describe('qualquer outra coleção', () => {
  it('fechada até para o Mestre', async () => {
    await assertFails(mestre().doc('segredos/x').set({ a: 1 }));
    await assertFails(mestre().doc('segredos/x').get());
  });
});
