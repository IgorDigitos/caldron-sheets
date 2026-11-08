// Regras da Mesa (chat + rolagens) contra o emulador.

import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { PORTAS_EMULADOR, PROJETO_EMULADOR } from './config';
import { criarFicha } from '../dominio/ficha';
import { criarMensagem, type Mensagem } from '../dominio/mesa';

let env: RulesTestEnvironment;
const MESTRE = 'uid-mestre';
const JOGADOR = 'uid-jogador';
const ESTRANHO = 'uid-estranho'; // conta criada fora do app (não está em `usuarios`)

const json = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const db = (uid: string) => env.authenticatedContext(uid).firestore();

function pedido(uid: string, texto: string, extra: Partial<Mensagem> = {}): Mensagem & { recebidoEm: unknown } {
  const m = criarMensagem({ texto, autorUid: uid, nome: 'Skar', fichaId: 'skar' }, 1000);
  return { ...json({ ...m, ...extra }), recebidoEm: firebase.firestore.FieldValue.serverTimestamp() };
}

const gravar = <T extends { id: string }>(uid: string, colecao: string, m: T) => db(uid).doc(`${colecao}/${m.id}`).set(m);

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
    const d = ctx.firestore();
    await d.doc('campanha/config').set({ mestreUid: MESTRE, criadoEm: 1 });
    await d.doc('personagens/skar').set(json({ ...criarFicha({ nome: 'Skar' }, 1), id: 'skar', donoUid: JOGADOR }));
    await d.doc('personagens/ogro').set(json({ ...criarFicha({ nome: 'Ogro' }, 1), id: 'ogro', donoUid: 'uid-outro' }));
    await d.doc(`usuarios/${JOGADOR}`).set({ usuario: 'thainan', papel: 'jogador', criadoEm: 1 });
  });
});

describe('mesa — jogador', () => {
  it('pede rolagem e manda texto como o próprio personagem', async () => {
    const rolagem = pedido(JOGADOR, 'd30+FOR ataque');
    expect(rolagem.tipo).toBe('rolagem');
    await assertSucceeds(gravar(JOGADOR, 'mesa', rolagem));
    await assertSucceeds(gravar(JOGADOR, 'mesa', pedido(JOGADOR, 'quero rolar d30')));
  });

  it('lê a mesa inteira (todo mundo vê)', async () => {
    await assertSucceeds(db(JOGADOR).collection('mesa').orderBy('criadoEm', 'desc').limit(60).get());
  });

  it('não manda o resultado nem muda a rolagem depois', async () => {
    await assertFails(gravar(JOGADOR, 'mesa', pedido(JOGADOR, 'd30', { estado: 'feita', resultado: ['30'] })));
    const m = pedido(JOGADOR, 'd30');
    await assertSucceeds(gravar(JOGADOR, 'mesa', m));
    await assertFails(db(JOGADOR).doc(`mesa/${m.id}`).update({ estado: 'feita' }));
    await assertFails(db(JOGADOR).doc(`mesa/${m.id}`).delete());
  });

  it('não fala como personagem de outro, com outro nome ou como outra pessoa', async () => {
    await assertFails(gravar(JOGADOR, 'mesa', pedido(JOGADOR, 'd30', { fichaId: 'ogro', nome: 'Ogro' })));
    await assertFails(gravar(JOGADOR, 'mesa', pedido(JOGADOR, 'd30', { nome: 'Mestre' })));
    await assertFails(gravar(JOGADOR, 'mesa', pedido('uid-outro', 'd30')));
    const semFicha = pedido(JOGADOR, 'oi');
    delete (semFicha as Partial<Mensagem>).fichaId;
    await assertFails(gravar(JOGADOR, 'mesa', semFicha));
  });

  it('descanso curto: rolagem do personagem marcada com Vida, Stamina ou Mana', async () => {
    await assertSucceeds(gravar(JOGADOR, 'mesa', pedido(JOGADOR, '2d5 Vida (descanso curto)', { descanso: 'VIDA' })));
    await assertSucceeds(gravar(JOGADOR, 'mesa', pedido(JOGADOR, '2d2 Mana', { descanso: 'MANA' })));
    await assertFails(gravar(JOGADOR, 'mesa', pedido(JOGADOR, '2d5', { descanso: 'OURO' as 'VIDA' })));
    await assertFails(gravar(JOGADOR, 'mesa', { ...pedido(JOGADOR, 'oi'), descanso: 'VIDA' }));
    const semFicha = pedido(MESTRE, '2d5', { descanso: 'VIDA' });
    delete (semFicha as Partial<Mensagem>).fichaId;
    await assertFails(gravar(MESTRE, 'mesa', semFicha));
  });

  it('não inventa a hora do servidor nem passa do tamanho', async () => {
    await assertFails(gravar(JOGADOR, 'mesa', { ...pedido(JOGADOR, 'd30'), recebidoEm: 1 }));
    await assertFails(gravar(JOGADOR, 'mesa', { ...pedido(JOGADOR, 'x'), texto: 'x'.repeat(1001) }));
    await assertFails(gravar(JOGADOR, 'mesa', { ...pedido(JOGADOR, 'x'), outro: 1 }));
  });

  it('não lê nem escreve no canal do Mestre', async () => {
    await assertFails(db(JOGADOR).collection('mesaMestre').get());
    await assertFails(gravar(JOGADOR, 'mesaMestre', pedido(JOGADOR, 'd30')));
  });
});

describe('mesa — Mestre', () => {
  it('rola como Mestre (sem ficha) na mesa e no canal secreto, e apaga', async () => {
    const m = { ...json(criarMensagem({ texto: 'd30', autorUid: MESTRE, nome: 'Mestre' }, 1)), recebidoEm: firebase.firestore.FieldValue.serverTimestamp() };
    await assertSucceeds(gravar(MESTRE, 'mesa', m));
    await assertSucceeds(gravar(MESTRE, 'mesaMestre', { ...m, id: 'secreta' }));
    await assertSucceeds(db(MESTRE).collection('mesaMestre').get());
    await assertSucceeds(db(MESTRE).doc(`mesa/${m.id}`).delete());
  });
});

describe('mesa — quem não é da campanha', () => {
  it('conta criada por fora não lê nem escreve', async () => {
    await assertFails(db(ESTRANHO).collection('mesa').get());
    await assertFails(gravar(ESTRANHO, 'mesa', pedido(ESTRANHO, 'd30')));
    await assertFails(env.unauthenticatedContext().firestore().collection('mesa').get());
  });
});
