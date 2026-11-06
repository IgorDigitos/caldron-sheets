import { describe, expect, it } from 'vitest';
import { calcularCaldronis, FORMULAS_CALDRONIS, valorAtual, type FichaRegras } from './caldronis';
import { formatar } from './motor';
import { SKAR, SKAR_ESPERADO } from './fixtures/skar';

function valores(ficha: FichaRegras) {
  const r = calcularCaldronis(ficha);
  if (!r.ok) throw new Error(JSON.stringify(r.erros));
  return r.valores;
}

function comAtributo(ficha: FichaRegras, attr: keyof FichaRegras['atributos'], mudanca: object): FichaRegras {
  return { ...ficha, atributos: { ...ficha.atributos, [attr]: { ...ficha.atributos[attr], ...mudanca } } };
}

describe('Caldronis — Skar de referência', () => {
  const v = valores(SKAR);

  it.each(Object.entries(SKAR_ESPERADO))('%s bate com a planilha', (campo, esperado) => {
    expect(v[campo]).toBeCloseTo(esperado, 10);
  });

  it('calcula todos os campos do preset', () => {
    expect(Object.keys(v).sort()).toEqual(Object.keys(FORMULAS_CALDRONIS).sort());
  });

  it('calcula Corpo antes de Vida, STA e Deslocamento', () => {
    const r = calcularCaldronis(SKAR);
    if (!r.ok) throw new Error('falhou');
    const pos = (c: string) => r.ordem.indexOf(c);
    for (const dependente of ['VIDA', 'STA', 'DESLOCAMENTO', 'DEF_NATURAL']) {
      expect(pos('CORPO')).toBeLessThan(pos(dependente));
    }
    expect(pos('MENTE')).toBeLessThan(pos('MANA'));
  });

  it('mostra a Mente arredondada só na tela', () => {
    expect(formatar(v.MENTE!)).toBe('2,3');
    expect(formatar(v.DEF_MAGICA_NATURAL!)).toBe('3,8');
    expect(formatar(v.VIDA!)).toBe('45');
  });

  it('Mana não sofre erro de ponto flutuante visível', () => {
    expect(formatar(v.MANA!)).toBe('12');
  });
});

describe('Caldronis — atributo atual', () => {
  it('atual = base + extra − perda', () => {
    expect(valorAtual({ base: 5, extra: 2, perda: 1 })).toBe(6);
    expect(valorAtual({ base: 5 })).toBe(5);
  });

  it('bônus de CON aumenta Vida, STA e Def. Natural (usa CON atual)', () => {
    const v = valores(comAtributo(SKAR, 'CON', { extra: 2 }));
    // CON 7 → Corpo (8+2+7)/3 = 17/3
    expect(v.CORPO).toBeCloseTo(17 / 3);
    expect(v.VIDA).toBeCloseTo(2 * 5 + (17 / 3) * 2 + 7 * 5);
    expect(v.STA).toBeCloseTo(5 + (17 / 3) * 2 + 7);
    expect(v.DEF_NATURAL).toBeCloseTo(17 / 3 + 3.5);
  });

  it('perda de FOR reduz Corpo', () => {
    const v = valores(comAtributo(SKAR, 'FOR', { perda: 3 }));
    expect(v.CORPO).toBeCloseTo(4);
    expect(v.DESLOCAMENTO).toBe(9); // int(4/3) = 1 → 7,5 + 1,5
  });

  it('ajuste direto em Corpo entra antes dos dependentes', () => {
    const v = valores({ ...SKAR, ajustes: { CORPO: 1 } });
    expect(v.CORPO).toBe(6);
    expect(v.VIDA).toBe(47);
    expect(v.DESLOCAMENTO).toBe(10.5);
  });
});

describe('Caldronis — nível', () => {
  it.each([
    [1, 4, 1],
    [3, 4, 2],
    [5, 5, 2],
    [10, 6, 4],
  ])('nível %i → PA %i, Contrabalanço %i', (nivel, pa, contrabalanco) => {
    const v = valores({ ...SKAR, nivel });
    expect(v.PA).toBe(pa);
    expect(v.CONTRABALANCO).toBe(contrabalanco);
  });

  it('Vida sobe 5 por nível', () => {
    expect(valores({ ...SKAR, nivel: 3 }).VIDA).toBe(50);
  });
});

describe('Caldronis — fórmulas customizadas pelo Mestre', () => {
  it('fórmula com erro devolve mensagem em vez de quebrar', () => {
    const r = calcularCaldronis(SKAR, { ...FORMULAS_CALDRONIS, VIDA: 'NIVEL*5 + ' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros[0]).toMatchObject({ campo: 'VIDA' });
  });
});
