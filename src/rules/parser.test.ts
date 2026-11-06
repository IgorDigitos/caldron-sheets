import { describe, expect, it } from 'vitest';
import { avaliar, dependencias, ErroFormula, parse } from './parser';

const calc = (texto: string, valores: Record<string, number> = {}) =>
  avaliar(parse(texto), new Map(Object.entries(valores)));

describe('parser — aritmética', () => {
  it.each([
    ['1 + 2', 3],
    ['2 + 3 * 4', 14],
    ['(2 + 3) * 4', 20],
    ['10 / 4', 2.5],
    ['10 - 2 - 3', 5],
    ['8 / 2 / 2', 2],
    ['-3 + 5', 2],
    ['--3', 3],
    ['+4', 4],
    ['2 * -3', -6],
    ['7.5', 7.5],
    ['.5 + 1', 1.5],
    ['3 × 2 ÷ 4 − 1', 0.5],
    ['3×2', 6],
  ])('%s = %d', (texto, esperado) => {
    expect(calc(texto)).toBe(esperado);
  });
});

describe('parser — funções', () => {
  it.each([
    ['media(8, 2, 5)', 5],
    ['media(2, 3, 2)', 7 / 3],
    ['media(1, 2)', 1.5],
    ['soma(1, 2, 3)', 6],
    ['min(4, 2, 9)', 2],
    ['max(4, 2, 9)', 9],
    ['int(2.9)', 2],
    ['int(-0.5)', -1],
    ['MEDIA(2, 4)', 3],
    ['max(1, media(2, 4) * 2)', 6],
  ])('%s = %d', (texto, esperado) => {
    expect(calc(texto)).toBeCloseTo(esperado, 10);
  });

  it('média não arredonda', () => {
    expect(calc('media(1, 1, 2)')).toBeCloseTo(4 / 3, 12);
  });

  it('int() precisa de exatamente 1 argumento', () => {
    expect(() => parse('int(1, 2)')).toThrow('int() precisa de 1 argumento(s), recebeu 2');
    expect(() => parse('media()')).toThrow('pelo menos 1');
  });
});

describe('parser — símbolos', () => {
  it('lê atributos, sem diferenciar maiúsculas', () => {
    expect(calc('for + Con * 2', { FOR: 8, CON: 5 })).toBe(18);
  });

  it('aceita acento e sublinhado', () => {
    expect(calc('DEF_NATURAL + força', { DEF_NATURAL: 1, FORÇA: 2 })).toBe(3);
  });

  it('símbolo desconhecido dá erro claro', () => {
    expect(() => calc('FOR + XYZ', { FOR: 1 })).toThrow('Símbolo desconhecido "XYZ"');
  });

  it('lista as dependências sem repetir', () => {
    expect(dependencias(parse('CORPO*2 + media(FOR, CORPO) + 3'))).toEqual(['CORPO', 'FOR']);
  });
});

describe('parser — erros de sintaxe', () => {
  it.each([
    ['', 'Fórmula vazia'],
    ['   ', 'Fórmula vazia'],
    ['1 +', 'Esperava um valor'],
    ['(1 + 2', 'Esperava ")"'],
    ['1 + 2)', 'Sobrou ")"'],
    ['1 2', 'Sobrou o número 2'],
    ['media(1,', 'Esperava um valor'],
    ['1..2', 'Número inválido'],
    ['FOR * ', 'mas veio o fim da fórmula'],
    ['* 2', 'mas veio "*"'],
  ])('"%s" → %s', (texto, mensagem) => {
    expect(() => parse(texto)).toThrow(ErroFormula);
    expect(() => parse(texto)).toThrow(mensagem);
  });

  it('informa a posição do erro', () => {
    try {
      parse('1 + $');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ErroFormula);
      expect((e as ErroFormula).posicao).toBe(4);
      expect((e as ErroFormula).message).toContain('posição 5');
    }
  });

  it('divisão por zero', () => {
    expect(() => calc('FOR / (CON - 5)', { FOR: 1, CON: 5 })).toThrow('Divisão por zero');
  });

  it('recusa fórmula gigante', () => {
    expect(() => parse('1+'.repeat(300) + '1')).toThrow('longa demais');
  });
});

describe('parser — texto malicioso é recusado', () => {
  it.each([
    ['alert(1)', 'Função desconhecida "alert"'],
    ['eval(1)', 'Função desconhecida "eval"'],
    ['constructor(1)', 'Função desconhecida'],
    ['toString()', 'Função desconhecida'],
    ['window.alert(1)', 'Número inválido'],
    ['FOR; alert(1)', 'Caractere não permitido ";"'],
    ['"abc"', 'Caractere não permitido'],
    ['`x`', 'Caractere não permitido'],
    ['FOR[0]', 'Caractere não permitido "["'],
    ['() => 1', 'Caractere não permitido'],
    ['FOR = 99', 'Caractere não permitido "="'],
  ])('%s', (texto, mensagem) => {
    expect(() => parse(texto)).toThrow(mensagem);
  });

  it('nomes de propriedades do JS não viram valores', () => {
    expect(() => calc('__proto__')).toThrow('Símbolo desconhecido "__PROTO__"');
    expect(() => calc('constructor')).toThrow('Símbolo desconhecido');
  });
});
