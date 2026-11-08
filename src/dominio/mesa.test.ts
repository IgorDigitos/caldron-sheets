import { describe, expect, it } from 'vitest';
import {
  criarMensagem,
  descreverEstado,
  ehRolagem,
  MAX_TEXTO,
  MensagemInvalida,
  rolagemDeAtributo,
  rolagemDeSkill,
  trechos,
  type Mensagem,
} from './mesa';

describe('ehRolagem (mesma regra do bot: só se COMEÇAR com a expressão)', () => {
  it.each(['d30', 'd30+3', '2d30+FOR ataque', '  D30', '3#d20+5', '#d20', '5d6!>>4', '2d30++5'])('"%s" rola', (t) => {
    expect(ehRolagem(t)).toBe(true);
  });

  it.each(['quero rolar d30+3', 'oi', '', 'FOR+d30', '# D20 título', 'd', 'dado'])('"%s" é texto', (t) => {
    expect(ehRolagem(t)).toBe(false);
  });
});

describe('criarMensagem', () => {
  it('rolagem nasce pendente; texto não tem estado', () => {
    const r = criarMensagem({ texto: ' d30+FOR ', autorUid: 'u', nome: 'Skar', fichaId: 'f' }, 5);
    expect(r).toMatchObject({ texto: 'd30+FOR', tipo: 'rolagem', estado: 'pendente', fichaId: 'f', criadoEm: 5 });
    const t = criarMensagem({ texto: 'quero rolar d30', autorUid: 'u', nome: 'Skar' });
    expect(t.tipo).toBe('texto');
    expect('estado' in t).toBe(false);
    expect('fichaId' in t).toBe(false);
  });

  it('nome vazio vira Mestre e nome longo é cortado', () => {
    expect(criarMensagem({ texto: 'oi', autorUid: 'u', nome: '  ' }).nome).toBe('Mestre');
    expect(criarMensagem({ texto: 'oi', autorUid: 'u', nome: 'x'.repeat(80) }).nome).toHaveLength(60);
  });

  it('recusa vazio e texto grande demais', () => {
    expect(() => criarMensagem({ texto: '   ', autorUid: 'u', nome: 'S' })).toThrow(MensagemInvalida);
    expect(() => criarMensagem({ texto: 'x'.repeat(MAX_TEXTO + 1), autorUid: 'u', nome: 'S' })).toThrow(/1000/);
  });
});

describe('rolagens rápidas', () => {
  it('atributo usa d30', () => {
    expect(rolagemDeAtributo('FOR')).toBe('d30+FOR');
  });

  it('skill só vira rolagem se o ATK/MOD começar com dado', () => {
    expect(rolagemDeSkill('2d4+FOR', 'Punhos de Pedra')).toBe('2d4+FOR Punhos de Pedra');
    expect(rolagemDeSkill('--', 'Postura')).toBeUndefined();
    expect(rolagemDeSkill('FOR', 'X')).toBeUndefined();
  });
});

describe('descreverEstado', () => {
  const base: Mensagem = { id: '1', autorUid: 'u', nome: 'S', texto: 'd30', tipo: 'rolagem', criadoEm: 1 };
  it('cobre cada estado', () => {
    expect(descreverEstado({ ...base, tipo: 'texto' })).toBeUndefined();
    expect(descreverEstado({ ...base, estado: 'pendente' })).toBe('Aguardando o bot…');
    expect(descreverEstado({ ...base, estado: 'rolando' })).toBe('Aguardando o bot…');
    expect(descreverEstado({ ...base, estado: 'feita' })).toBeUndefined();
    expect(descreverEstado({ ...base, estado: 'feita', discord: 'falhou' })).toMatch(/Discord/);
    expect(descreverEstado({ ...base, estado: 'erro', erro: 'Atributo não cadastrado: XYZ.' })).toBe('Atributo não cadastrado: XYZ.');
    expect(descreverEstado({ ...base, estado: 'erro' })).toBe('Não foi possível rolar.');
    expect(descreverEstado({ ...base, estado: 'expirada' })).toBe('Não foi rolada.');
    expect(descreverEstado({ ...base })).toBeUndefined();
  });
});

describe('trechos (Markdown do bot, sem HTML)', () => {
  it('separa negrito, código e texto e desfaz o escape do comentário', () => {
    expect(trechos('` 17 ` ⟵ [**30**, 5] 2d30 \\*uau\\*')).toEqual([
      { tipo: 'codigo', texto: ' 17 ' },
      { tipo: 'texto', texto: ' ⟵ [' },
      { tipo: 'negrito', texto: '30' },
      { tipo: 'texto', texto: ', 5] 2d30 *uau*' },
    ]);
    expect(trechos('<script>')).toEqual([{ tipo: 'texto', texto: '<script>' }]);
  });
});
