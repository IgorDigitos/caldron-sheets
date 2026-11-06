import { describe, expect, it } from 'vitest';
import { calcular, formatar } from './motor';

describe('motor — ordem de dependência', () => {
  it('resolve dependências em qualquer ordem de declaração', () => {
    const r = calcular({ VIDA: 'CORPO * 2', CORPO: 'media(FOR, CON)' }, { FOR: 6, CON: 4 });
    expect(r).toMatchObject({ ok: true, valores: { CORPO: 5, VIDA: 10 }, ordem: ['CORPO', 'VIDA'] });
  });

  it('nomes não diferenciam maiúsculas', () => {
    const r = calcular({ corpo: 'For + 1' }, { for: 2 });
    expect(r).toMatchObject({ ok: true, valores: { CORPO: 3 } });
  });

  it('aplica ajustes depois da fórmula e antes dos dependentes', () => {
    const r = calcular({ A: 'X', B: 'A * 10' }, { X: 1 }, { a: 2 });
    expect(r).toMatchObject({ ok: true, valores: { A: 3, B: 30 } });
  });

  it('sem fórmulas devolve vazio', () => {
    expect(calcular({}, { FOR: 1 })).toEqual({ ok: true, valores: {}, ordem: [] });
  });
});

describe('motor — erros', () => {
  it('detecta dependência circular (STA usa VIDA que usa STA)', () => {
    const r = calcular({ STA: 'VIDA + 1', VIDA: 'STA * 2' }, {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros[0]!.mensagem).toBe('Dependência circular: STA → VIDA → STA');
  });

  it('detecta campo que depende de si mesmo', () => {
    const r = calcular({ VIDA: 'VIDA + 1' }, {});
    if (r.ok) throw new Error('deveria falhar');
    expect(r.erros[0]!.mensagem).toBe('Dependência circular: VIDA → VIDA');
  });

  it('detecta ciclo longo', () => {
    const r = calcular({ A: 'B', B: 'C', C: 'A', D: '1' }, {});
    if (r.ok) throw new Error('deveria falhar');
    expect(r.erros[0]!.mensagem).toBe('Dependência circular: A → B → C → A');
  });

  it('símbolo desconhecido aponta o campo', () => {
    const r = calcular({ VIDA: 'CON * 5 + SORTE' }, { CON: 5 });
    expect(r).toEqual({ ok: false, erros: [{ campo: 'VIDA', mensagem: 'Símbolo desconhecido "SORTE"' }] });
  });

  it('erro de sintaxe não gera "desconhecido" em quem depende do campo', () => {
    const r = calcular({ CORPO: 'media(FOR', VIDA: 'CORPO * 2' }, { FOR: 1 });
    if (r.ok) throw new Error('deveria falhar');
    expect(r.erros).toHaveLength(1);
    expect(r.erros[0]!.campo).toBe('CORPO');
  });

  it('junta vários erros de uma vez', () => {
    const r = calcular({ A: '1 +', B: 'alert(1)', C: 'ZZZ' }, {});
    if (r.ok) throw new Error('deveria falhar');
    expect(r.erros.map((e) => e.campo)).toEqual(['A', 'B', 'C']);
  });

  it('atributo e fórmula com o mesmo nome', () => {
    const r = calcular({ FOR: '1' }, { FOR: 2 });
    if (r.ok) throw new Error('deveria falhar');
    expect(r.erros[0]!.mensagem).toContain('atributo e fórmula ao mesmo tempo');
  });

  it('entrada que não é número', () => {
    const r = calcular({ A: 'FOR' }, { FOR: Number.NaN });
    if (r.ok) throw new Error('deveria falhar');
    expect(r.erros[0]).toEqual({ campo: 'FOR', mensagem: 'Valor não é um número' });
  });

  it('divisão por zero vira erro do campo', () => {
    const r = calcular({ A: 'FOR / 0', B: 'A + 1' }, { FOR: 1 });
    expect(r).toEqual({ ok: false, erros: [{ campo: 'A', mensagem: 'Divisão por zero' }] });
  });

  it('resultado infinito vira erro', () => {
    const r = calcular({ A: 'FOR * FOR' }, { FOR: 1e200 });
    if (r.ok) throw new Error('deveria falhar');
    expect(r.erros[0]!.mensagem).toBe('Resultado não é um número finito');
  });

  it('erro inesperado (bug) não é engolido', () => {
    const formulas = new Proxy({} as Record<string, string>, {
      ownKeys: () => ['A'],
      getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true, value: 1 }),
    });
    expect(() => calcular(formulas, {})).toThrow(TypeError);
  });
});

describe('formatar', () => {
  it.each([
    [45, '45'],
    [7.5, '7,5'],
    [7 / 3, '2,3'],
    [23 / 6, '3,8'],
    [-4, '-4'],
    [1234.56, '1.234,6'],
  ])('%d → %s', (valor, texto) => {
    expect(formatar(valor)).toBe(texto);
  });
});
