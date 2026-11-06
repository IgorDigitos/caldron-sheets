import { describe, expect, it } from 'vitest';
import {
  aplicar,
  criarFicha,
  descreverEntrada,
  LIMITE_HISTORICO,
  novoId,
  recalcular,
  restaurarTudo,
  ValorInvalido,
  type Ficha,
} from './ficha';
import { SKAR } from '../rules/fixtures/skar';

const T = 1_700_000_000_000;
const skar = (): Ficha => criarFicha({ nome: 'Skar Lionet', ...SKAR }, T);

describe('novoId', () => {
  const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it('usa randomUUID quando existe', () => {
    expect(novoId()).toMatch(UUID_V4);
  });

  it('funciona sem randomUUID (página aberta pelo IP da rede, sem HTTPS)', () => {
    const semRandomUUID = { getRandomValues: crypto.getRandomValues.bind(crypto) };
    const ids = new Set(Array.from({ length: 200 }, () => novoId(semRandomUUID)));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(UUID_V4);
  });

  it('marca versão e variante mesmo com bytes extremos', () => {
    const zeros = { getRandomValues: <T extends ArrayBufferView>(a: T) => a };
    expect(novoId(zeros)).toBe('00000000-0000-4000-8000-000000000000');
    const cheios = {
      getRandomValues: <T extends ArrayBufferView>(a: T) => {
        (a as unknown as Uint8Array).fill(255);
        return a;
      },
    };
    expect(novoId(cheios)).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
  });
});

describe('criarFicha', () => {
  it('nasce com os máximos calculados e recursos cheios', () => {
    const f = skar();
    expect(f.maximos.VIDA).toBe(45);
    expect(f.maximos.STA).toBe(20);
    expect(f.maximos.MANA).toBeCloseTo(12);
    expect(f.atuais).toEqual({ VIDA: 45, STA: 20, MANA: f.maximos.MANA });
    expect(f.atualizadoEm).toBe(T);
  });

  it('tem valores padrão', () => {
    const f = criarFicha({ nome: '   ' });
    expect(f.nome).toBe('Sem nome');
    expect(f.nivel).toBe(1);
    expect(f.atributos.FOR).toEqual({ base: 1 });
    expect(f.id).not.toBe(criarFicha().id);
  });
});

describe('dano', () => {
  it('reduz a Vida e registra no histórico', () => {
    const f = aplicar(skar(), 'VIDA', 'dano', 8, T + 1);
    expect(f.atuais.VIDA).toBe(37);
    expect(f.historico).toHaveLength(1);
    expect(f.historico[0]).toMatchObject({ recurso: 'VIDA', tipo: 'dano', valor: 8, efetivo: -8 });
    expect(descreverEntrada(f.historico[0]!)).toBe('−8 dano');
    expect(f.atualizadoEm).toBe(T + 1);
  });

  it('dano maior que a Vida deixa a Vida negativa (regra do Caldronis)', () => {
    const f = aplicar(skar(), 'VIDA', 'dano', 49);
    expect(f.atuais.VIDA).toBe(-4);
  });

  it('gasto maior que a STA para em 0', () => {
    const f = aplicar(skar(), 'STA', 'dano', 50);
    expect(f.atuais.STA).toBe(0);
    expect(f.historico[0]!.efetivo).toBe(-20);
    expect(descreverEntrada(f.historico[0]!)).toBe('−50 gasto');
  });

  it('gasto de Mana para em 0', () => {
    expect(aplicar(skar(), 'MANA', 'dano', 100).atuais.MANA).toBe(0);
  });

  it('não altera a ficha original', () => {
    const f = skar();
    aplicar(f, 'VIDA', 'dano', 5);
    expect(f.atuais.VIDA).toBe(45);
    expect(f.historico).toHaveLength(0);
  });
});

describe('cura', () => {
  it('cura nunca passa do máximo', () => {
    let f = aplicar(skar(), 'VIDA', 'dano', 10);
    f = aplicar(f, 'VIDA', 'cura', 100);
    expect(f.atuais.VIDA).toBe(45);
    expect(f.historico[0]).toMatchObject({ valor: 100, efetivo: 10 });
    expect(descreverEntrada(f.historico[0]!)).toBe('+100 cura');
  });

  it('cura com Vida já cheia não muda nada além do histórico', () => {
    const f = aplicar(skar(), 'VIDA', 'cura', 5);
    expect(f.atuais.VIDA).toBe(45);
    expect(f.historico[0]!.efetivo).toBe(0);
  });

  it('cura a partir de Vida negativa', () => {
    let f = aplicar(skar(), 'VIDA', 'dano', 50);
    f = aplicar(f, 'VIDA', 'cura', 10);
    expect(f.atuais.VIDA).toBe(5);
  });

  it('recuperar STA usa o rótulo certo', () => {
    let f = aplicar(skar(), 'STA', 'dano', 5);
    f = aplicar(f, 'STA', 'cura', 3);
    expect(f.atuais.STA).toBe(18);
    expect(descreverEntrada(f.historico[0]!)).toBe('+3 recuperou');
  });
});

describe('valores inválidos', () => {
  it.each([0, -3, Number.NaN, Infinity])('recusa %d', (v) => {
    expect(() => aplicar(skar(), 'VIDA', 'dano', v)).toThrow(ValorInvalido);
  });

  it('aceita decimal', () => {
    expect(aplicar(skar(), 'VIDA', 'dano', 2.5).atuais.VIDA).toBe(42.5);
  });
});

describe('histórico', () => {
  it('guarda só as últimas entradas, mais nova primeiro', () => {
    let f = skar();
    for (let i = 1; i <= LIMITE_HISTORICO + 5; i++) f = aplicar(f, 'VIDA', 'cura', i);
    expect(f.historico).toHaveLength(LIMITE_HISTORICO);
    expect(f.historico[0]!.valor).toBe(LIMITE_HISTORICO + 5);
  });
});

describe('recalcular', () => {
  it('ganhar CON aumenta o máximo e mantém o atual', () => {
    const f = skar();
    const r = recalcular({ ...f, atributos: { ...f.atributos, CON: { base: 5, extra: 2 } } }, T + 5);
    if (!r.ok) throw new Error('falhou');
    expect(r.ficha.maximos.VIDA).toBeCloseTo(56.333, 2);
    expect(r.ficha.atuais.VIDA).toBe(45);
    expect(r.ficha.atualizadoEm).toBe(T + 5);
  });

  it('perder CON corta o atual para o novo máximo', () => {
    const f = skar();
    const r = recalcular({ ...f, atributos: { ...f.atributos, CON: { base: 5, perda: 3 } } });
    if (!r.ok) throw new Error('falhou');
    expect(r.ficha.maximos.VIDA).toBeLessThan(45);
    expect(r.ficha.atuais.VIDA).toBe(r.ficha.maximos.VIDA);
    expect(r.ficha.atuais.STA).toBe(r.ficha.maximos.STA);
  });

  it('não sobe o atual que estava abaixo do máximo', () => {
    const f = aplicar(skar(), 'VIDA', 'dano', 40);
    const r = recalcular({ ...f, nivel: 3 });
    if (!r.ok) throw new Error('falhou');
    expect(r.ficha.maximos.VIDA).toBe(50);
    expect(r.ficha.atuais.VIDA).toBe(5);
  });

  it('valor inválido de atributo devolve erro em vez de quebrar', () => {
    const f = skar();
    const r = recalcular({ ...f, atributos: { ...f.atributos, FOR: { base: Number.NaN } } });
    expect(r.ok).toBe(false);
  });
});

describe('restaurarTudo', () => {
  it('volta tudo ao máximo', () => {
    let f = aplicar(skar(), 'VIDA', 'dano', 60);
    f = aplicar(f, 'MANA', 'dano', 5);
    f = restaurarTudo(f, T + 9);
    expect(f.atuais).toEqual({ VIDA: 45, STA: 20, MANA: f.maximos.MANA });
    expect(f.atualizadoEm).toBe(T + 9);
  });
});
