import { describe, expect, it } from 'vitest';
import {
  calcularMaximo,
  criarDefRecurso,
  desabilitarRecurso,
  editarDefRecurso,
  habilitarRecurso,
  idsPersonalizados,
  MAX_PERSONALIZADOS,
  nomeRecurso,
  recalcularPersonalizados,
  RecursoInvalido,
} from './recursos';
import {
  alterar,
  aplicar,
  atualDe,
  criarFicha,
  definirExtra,
  descansoLongo,
  descreverEntrada,
  extraDe,
  maxDe,
  NOMES_RECURSOS,
  temRecurso,
  ValorInvalido,
  type Ficha,
} from './ficha';
import { criarSkill, descreverCusto, RecursoInsuficiente, usarSkill } from './skills';
import { SKAR } from '../rules/fixtures/skar';

const T = 1_700_000_000_000;
/** Ímpeto do Skar: 3 base + 1 a cada 2 níveis; começa em 0 ("dura até o fim do combate"). */
const IMPETO = criarDefRecurso({ nome: 'Ímpeto', formula: '3 + int(NIVEL/2)', comecaCheio: false, cor: '#d0703c' }, T);
const skar = (nivel = 2) => criarFicha({ nome: 'Skar', ...SKAR, nivel }, T);
const comImpeto = (nivel = 2) => habilitarRecurso(skar(nivel), IMPETO, T);
const nome = (id: string) => nomeRecurso(id, [IMPETO], NOMES_RECURSOS);

describe('catálogo', () => {
  it('cria com id próprio e padrões', () => {
    const d = criarDefRecurso({ nome: ' Fúria ', formula: ' CON ' }, T);
    expect(d).toMatchObject({ nome: 'Fúria', formula: 'CON', comecaCheio: true, cor: '#d9a441', criadoEm: T });
    expect(d.id).toMatch(/^rec-/);
  });

  it.each([
    [{ nome: '', formula: '1' }, 'precisa de um nome'],
    [{ nome: 'vida', formula: '1' }, 'já é um recurso básico'],
    [{ nome: 'X', formula: '' }, 'Informe a fórmula'],
    [{ nome: 'X', formula: '3 + SORTE' }, 'Símbolo desconhecido "SORTE"'],
    [{ nome: 'X', formula: '3 +' }, 'Esperava um valor'],
    [{ nome: 'X', formula: '0 - 5' }, 'não pode ser negativo'],
    [{ nome: 'X', formula: '1', cor: 'red' }, 'Cor inválida'],
  ])('recusa %o', (dados, msg) => {
    expect(() => criarDefRecurso(dados)).toThrow(RecursoInvalido);
    expect(() => criarDefRecurso(dados)).toThrow(msg);
  });

  it('editar valida de novo', () => {
    expect(editarDefRecurso(IMPETO, { formula: '4 + int(NIVEL/2)' }, T + 1).atualizadoEm).toBe(T + 1);
    expect(() => editarDefRecurso(IMPETO, { formula: 'nada' })).toThrow(RecursoInvalido);
  });
});

describe('máximo pela fórmula', () => {
  it.each([
    [1, 3],
    [2, 4],
    [3, 4],
    [4, 5],
    [10, 8],
  ])('Ímpeto no nível %i = %i', (nivel, esperado) => {
    expect(calcularMaximo(skar(nivel), IMPETO.formula)).toBe(esperado);
  });

  it('usa atributos atuais e derivados', () => {
    const f = skar();
    expect(calcularMaximo(f, 'CON + CORPO')).toBe(10);
    expect(calcularMaximo(f, 'arred(VIDA / 10)')).toBe(5);
  });
});

describe('habilitar e desabilitar na ficha', () => {
  it('Ímpeto começa em 0 com máximo 4; recurso "cheio" começa no máximo', () => {
    const f = comImpeto();
    expect(temRecurso(f, IMPETO.id)).toBe(true);
    expect(atualDe(f, IMPETO.id)).toBe(0);
    expect(maxDe(f, IMPETO.id)).toBe(4);
    const furia = criarDefRecurso({ nome: 'Fúria', formula: 'CON' });
    expect(atualDe(habilitarRecurso(f, furia), furia.id)).toBe(5);
  });

  it('habilitar de novo não mexe; limite de recursos', () => {
    const f = comImpeto();
    expect(habilitarRecurso(f, IMPETO)).toBe(f);
    let g = skar();
    for (let i = 0; i < MAX_PERSONALIZADOS; i++) g = habilitarRecurso(g, criarDefRecurso({ nome: `R${i}`, formula: '1' }));
    expect(() => habilitarRecurso(g, criarDefRecurso({ nome: 'Demais', formula: '1' }))).toThrow(`No máximo ${MAX_PERSONALIZADOS}`);
  });

  it('desabilitar tira valor, máximo e extra', () => {
    const f = definirExtra(comImpeto(), IMPETO.id, 2);
    const g = desabilitarRecurso(f, IMPETO.id, T + 9);
    expect(temRecurso(g, IMPETO.id)).toBe(false);
    expect(idsPersonalizados(g)).toEqual([]);
    expect(extraDe(g, IMPETO.id)).toBe(0);
    const semImpeto = skar();
    expect(desabilitarRecurso(semImpeto, IMPETO.id)).toBe(semImpeto);
  });
});

describe('recalcular', () => {
  it('subir de nível aumenta o máximo e mantém o atual', () => {
    const f = aplicar(comImpeto(), IMPETO.id, 'cura', 3);
    const r = alterar(f, { tipo: 'nivel' }, 4);
    if (!r.ok) throw new Error('falhou');
    const g = recalcularPersonalizados(r.ficha, [IMPETO], T + 5)!;
    expect(maxDe(g, IMPETO.id)).toBe(5);
    expect(atualDe(g, IMPETO.id)).toBe(3);
  });

  it('máximo que cai corta o atual', () => {
    const f = aplicar(comImpeto(4), IMPETO.id, 'cura', 5);
    const g = recalcularPersonalizados({ ...f, nivel: 1 }, [IMPETO])!;
    expect(maxDe(g, IMPETO.id)).toBe(3);
    expect(atualDe(g, IMPETO.id)).toBe(3);
  });

  it('nada mudou, definição sumiu ou fórmula quebrada: devolve null', () => {
    expect(recalcularPersonalizados(comImpeto(), [IMPETO])).toBeNull();
    expect(recalcularPersonalizados(comImpeto(), [])).toBeNull();
    expect(recalcularPersonalizados({ ...comImpeto(), nivel: 8 }, [{ ...IMPETO, formula: 'SORTE' }])).toBeNull();
  });
});

describe('ganhar e gastar', () => {
  it('ganha até o máximo, gasta até 0, com histórico de "recuperou/gasto"', () => {
    let f = aplicar(comImpeto(), IMPETO.id, 'cura', 10);
    expect(atualDe(f, IMPETO.id)).toBe(4);
    expect(descreverEntrada(f.historico[0]!)).toBe('+10 recuperou');
    f = aplicar(f, IMPETO.id, 'dano', 9);
    expect(atualDe(f, IMPETO.id)).toBe(0);
    expect(f.historico[0]).toMatchObject({ recurso: IMPETO.id, efetivo: -4 });
  });

  it('extra funciona igual', () => {
    let f = definirExtra(aplicar(comImpeto(), IMPETO.id, 'cura', 2), IMPETO.id, 1);
    f = aplicar(f, IMPETO.id, 'dano', 2);
    expect(atualDe(f, IMPETO.id)).toBe(1);
    expect(extraDe(f, IMPETO.id)).toBe(0);
  });

  it('ficha sem o recurso recusa', () => {
    expect(() => aplicar(skar(), IMPETO.id, 'cura', 1)).toThrow(ValorInvalido);
  });

  it('descanso longo não mexe nos personalizados', () => {
    const f = aplicar(comImpeto(), IMPETO.id, 'cura', 2);
    expect(atualDe(descansoLongo(f), IMPETO.id)).toBe(2);
  });
});

describe('skill que custa Ímpeto', () => {
  const punhos = criarSkill('f', { nome: 'Punhos de Pedra (+1d4)', custos: [{ recurso: IMPETO.id, valor: 1 }] });

  it('gasta e mostra o nome do recurso', () => {
    const f = usarSkill(aplicar(comImpeto(), IMPETO.id, 'cura', 2), punhos, T, nome);
    expect(atualDe(f, IMPETO.id)).toBe(1);
    expect(f.historico[0]!.origem).toBe('Punhos de Pedra (+1d4)');
    expect(descreverCusto(punhos.custos, nome)).toBe('1 Ímpeto');
  });

  it('sem Ímpeto, ou ficha sem o recurso, recusa com o nome certo', () => {
    expect(() => usarSkill(comImpeto(), punhos, T, nome)).toThrow('Ímpeto insuficiente para Punhos de Pedra (+1d4): precisa de 1, tem 0');
    expect(() => usarSkill(skar(), punhos, T, nome)).toThrow(RecursoInsuficiente);
    expect(() => usarSkill(skar(), punhos, T, nome)).toThrow('Esta ficha não tem Ímpeto');
  });
});

it('nomeRecurso: básico, catálogo e removido', () => {
  expect(nome('STA')).toBe('Stamina');
  expect(nome(IMPETO.id)).toBe('Ímpeto');
  expect(nome('rec-sumiu')).toBe('Recurso removido');
});

it('ficha sem campos de personalizados (antiga) funciona', () => {
  const f: Ficha = skar();
  expect(idsPersonalizados(f)).toEqual([]);
  expect(atualDe(f, 'rec-x')).toBe(0);
});
