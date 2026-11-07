// Regras de segurança para o JOGADOR (etapa 5), contra o emulador.
// Os dados são montados com as próprias funções do app (dano, alterar atributo, extra…), então o
// teste também confere que a conta do app e a conta do servidor (firestore.rules) batem.

import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { PORTAS_EMULADOR, PROJETO_EMULADOR } from './config';
import { alterar, aplicar, criarFicha, definirExtra, descansoLongo, type Ficha } from '../dominio/ficha';
import { movimentarMoeda } from '../dominio/inventario';
import { SKAR } from '../rules/fixtures/skar';

let env: RulesTestEnvironment;
const MESTRE = 'uid-mestre';
const JOGADOR = 'uid-jogador';
const OUTRO = 'uid-outro';
const DATA_URL = 'data:image/webp;base64,AA==';

const json = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const skarDoJogador = (): Ficha => json({ ...criarFicha({ nome: 'Skar', ...SKAR }, 1000), id: 'skar', donoUid: JOGADOR });
const fichaDeOutro = (): Ficha => json({ ...criarFicha({ nome: 'Ogro' }, 1000), id: 'ogro', donoUid: OUTRO });

const mestre = () => env.authenticatedContext(MESTRE).firestore();
const jogador = () => env.authenticatedContext(JOGADOR).firestore();
const gravar = (f: object) => jogador().doc('personagens/skar').set(json(f));

function alterado(f: Ficha, ...args: Parameters<typeof alterar> extends [Ficha, ...infer R] ? R : never): Ficha {
  const r = alterar(f, ...args);
  if (!r.ok) throw new Error(JSON.stringify(r.erros));
  return r.ficha;
}

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
    const db = ctx.firestore();
    await db.doc('campanha/config').set({ mestreUid: MESTRE, criadoEm: 1 });
    await db.doc('personagens/skar').set(skarDoJogador());
    await db.doc('personagens/ogro').set(fichaDeOutro());
    await db.doc(`usuarios/${JOGADOR}`).set({ usuario: 'thainan', papel: 'jogador', criadoEm: 1 });
  });
});

describe('jogador — leitura', () => {
  it('lê a própria ficha e lista só as dele (com filtro)', async () => {
    await assertSucceeds(jogador().doc('personagens/skar').get());
    await assertSucceeds(jogador().collection('personagens').where('donoUid', '==', JOGADOR).get());
  });

  it('não lê ficha de outro nem lista tudo', async () => {
    await assertFails(jogador().doc('personagens/ogro').get());
    await assertFails(jogador().collection('personagens').get());
    await assertFails(jogador().collection('personagens').where('donoUid', '==', OUTRO).get());
  });
});

describe('jogador — o que ele PODE mudar', () => {
  it('tomar dano, extra e descanso longo', async () => {
    let f = aplicar(skarDoJogador(), 'VIDA', 'dano', 8, 2000);
    await assertSucceeds(gravar(f));
    f = definirExtra(f, 'VIDA', 10, 3000);
    await assertSucceeds(gravar(f));
    f = aplicar(f, 'VIDA', 'dano', 12, 3500);
    await assertSucceeds(gravar(f));
    f = descansoLongo(f, 4000);
    await assertSucceeds(gravar(f));
  });

  it('Vida negativa', async () => {
    await assertSucceeds(gravar(aplicar(skarDoJogador(), 'VIDA', 'dano', 60, 2000)));
  });

  it('extra e perda de atributo, com os máximos recalculados pelo app', async () => {
    const f = alterado(skarDoJogador(), { tipo: 'atributo', atributo: 'CON', parte: 'extra' }, 2, 2000);
    expect(f.maximos.VIDA).toBe(56);
    await assertSucceeds(gravar(f));
    const f2 = alterado(f, { tipo: 'atributo', atributo: 'SAB', parte: 'perda' }, 1, 3000);
    await assertSucceeds(gravar(f2));
    const f3 = alterado(f2, { tipo: 'atributo', atributo: 'FOR', parte: 'perda' }, 3, 4000);
    await assertSucceeds(gravar(f3));
  });

  it('carteira', async () => {
    const f = skarDoJogador();
    await assertSucceeds(gravar({ ...f, carteira: movimentarMoeda(f.carteira, 'ouro', 3), atualizadoEm: 2000 }));
  });
});

describe('jogador — o que ele NÃO pode mudar', () => {
  it('base de atributo', async () => {
    await assertFails(gravar(alterado(skarDoJogador(), { tipo: 'atributo', atributo: 'FOR', parte: 'base' }, 12, 2000)));
  });

  it('nível, nome, raça, classe, dono', async () => {
    await assertFails(gravar(alterado(skarDoJogador(), { tipo: 'nivel' }, 5, 2000)));
    const f = { ...skarDoJogador(), atualizadoEm: 2000 };
    await assertFails(gravar({ ...f, nome: 'Skar, o Grande' }));
    await assertFails(gravar({ ...f, raca: 'Elfo' }));
    await assertFails(gravar({ ...f, classe: 'Mago' }));
    await assertFails(gravar({ ...f, donoUid: OUTRO }));
  });

  it('máximo inventado (código mexido)', async () => {
    const f = { ...skarDoJogador(), atualizadoEm: 2000 };
    await assertFails(gravar({ ...f, maximos: { ...f.maximos, VIDA: 999 }, atuais: { ...f.atuais, VIDA: 999 } }));
    await assertFails(gravar({ ...f, maximos: { ...f.maximos, DEF_NATURAL: 50 } }));
    await assertFails(gravar({ ...f, maximos: { ...f.maximos, PA: 9 } }));
  });

  it('mudar extra de atributo SEM recalcular os máximos', async () => {
    const f = skarDoJogador();
    await assertFails(gravar({ ...f, atributos: { ...f.atributos, CON: { base: 5, extra: 10 } }, atualizadoEm: 2000 }));
  });

  it('atual acima do máximo, STA ou Mana negativas', async () => {
    const f = { ...skarDoJogador(), atualizadoEm: 2000 };
    await assertFails(gravar({ ...f, atuais: { ...f.atuais, VIDA: 46 } }));
    await assertFails(gravar({ ...f, atuais: { ...f.atuais, STA: -1 } }));
    await assertFails(gravar({ ...f, atuais: { ...f.atuais, MANA: 13 } }));
  });

  it('edição mais velha (última edição ganha vale para ele também)', async () => {
    await assertFails(gravar(aplicar(skarDoJogador(), 'VIDA', 'dano', 1, 500)));
  });

  it('criar ou apagar ficha; mexer na ficha de outro', async () => {
    const nova = json({ ...criarFicha({ nome: 'X' }), id: 'nova', donoUid: JOGADOR });
    await assertFails(jogador().doc('personagens/nova').set(nova));
    await assertFails(jogador().doc('personagens/skar').delete());
    await assertFails(jogador().doc('personagens/ogro').set(json(aplicar(fichaDeOutro(), 'VIDA', 'dano', 1, 2000))));
  });

  it('virar Mestre ou criar contas', async () => {
    await assertFails(jogador().doc('campanha/config').set({ mestreUid: JOGADOR, criadoEm: 1 }));
    await assertFails(jogador().doc(`usuarios/${JOGADOR}`).set({ usuario: 'thainan', papel: 'jogador', criadoEm: 2 }));
    await assertFails(jogador().doc('usuarios/novo').set({ usuario: 'novo', papel: 'jogador', criadoEm: 1 }));
    await assertFails(jogador().collection('usuarios').get());
  });
});

describe('jogador — itens, journal e imagens', () => {
  const item = (fichaId: string, id = 'it1', atualizadoEm = 1) => ({ id, fichaId, nome: 'Corda', qtd: 1, atualizadoEm });

  it('cria, lista, edita e apaga itens da própria ficha', async () => {
    await assertSucceeds(jogador().doc('itens/it1').set(item('skar')));
    await assertSucceeds(jogador().collection('itens').where('fichaId', '==', 'skar').get());
    await assertSucceeds(jogador().doc('itens/it1').set(item('skar', 'it1', 2)));
    await assertSucceeds(jogador().doc('itens/it1').delete());
  });

  it('não mexe nos itens de outra ficha nem muda o item de ficha', async () => {
    await env.withSecurityRulesDisabled((ctx) => ctx.firestore().doc('itens/do-ogro').set(item('ogro', 'do-ogro')));
    await assertFails(jogador().doc('itens/x').set(item('ogro', 'x')));
    await assertFails(jogador().doc('itens/do-ogro').get());
    await assertFails(jogador().collection('itens').where('fichaId', '==', 'ogro').get());
    await assertFails(jogador().doc('itens/do-ogro').delete());
    await assertSucceeds(jogador().doc('itens/meu').set(item('skar', 'meu')));
    await assertFails(jogador().doc('itens/meu').set(item('ogro', 'meu', 5)));
  });

  it('journal: tudo na própria ficha, nada na de outro', async () => {
    const e = { id: 'j1', fichaId: 'skar', data: '2026-11-06', texto: 'x', atualizadoEm: 1 };
    await assertSucceeds(jogador().doc('journal/j1').set(e));
    await assertSucceeds(jogador().doc('journal/j1').set({ ...e, texto: 'editado', atualizadoEm: 2 }));
    await assertSucceeds(jogador().collection('journal').where('fichaId', '==', 'skar').get());
    await assertSucceeds(jogador().doc('journal/j1').delete());
    await assertFails(jogador().doc('journal/j2').set({ ...e, id: 'j2', fichaId: 'ogro' }));
  });

  it('imagens: só na própria ficha', async () => {
    await assertSucceeds(jogador().doc('imagens/i1').set({ id: 'i1', fichaId: 'skar', dataUrl: DATA_URL, criadoEm: 1 }));
    await assertSucceeds(jogador().doc('imagens/i1').get());
    await assertFails(jogador().doc('imagens/i2').set({ id: 'i2', fichaId: 'ogro', dataUrl: DATA_URL, criadoEm: 1 }));
  });
});

describe('contas', () => {
  it('jogador lê a própria conta; Mestre lista e cria contas de jogador', async () => {
    await assertSucceeds(jogador().doc(`usuarios/${JOGADOR}`).get());
    await assertFails(jogador().doc(`usuarios/${OUTRO}`).get());
    await assertSucceeds(mestre().collection('usuarios').get());
    await assertSucceeds(mestre().doc('usuarios/novo').set({ usuario: 'novo', papel: 'jogador', criadoEm: 1 }));
    await assertFails(mestre().doc('usuarios/novo2').set({ usuario: 'novo2', papel: 'mestre', criadoEm: 1 }));
  });

  it('Mestre continua podendo tudo na ficha do jogador', async () => {
    const f = alterado(skarDoJogador(), { tipo: 'atributo', atributo: 'FOR', parte: 'base' }, 12, 2000);
    await assertSucceeds(mestre().doc('personagens/skar').set(json({ ...f, nome: 'Skar II', donoUid: OUTRO })));
  });
});
