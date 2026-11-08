import { describe, expect, it } from 'vitest';
import {
  criarSkill,
  daCategoria,
  descreverCusto,
  editarSkill,
  RecursoInsuficiente,
  SkillInvalida,
  usarSkill,
} from './skills';
import { aplicar, criarFicha, definirExtra, descreverEntrada } from './ficha';
import { SKAR } from '../rules/fixtures/skar';
import { SKAR_SKILLS } from '../rules/fixtures/skarSkills';

const T = 1_700_000_000_000;
const skar = () => criarFicha({ nome: 'Skar', ...SKAR }, T);
const guarda = () =>
  criarSkill('f', { nome: 'Guarda de Impacto', pas: 'Reação ou 2 PA', gastos: '2 STA', custos: [{ recurso: 'STA', valor: 2 }] }, T);

describe('skills — cadastro', () => {
  it('cria com padrões e limpa espaços', () => {
    const s = criarSkill('f1', { nome: '  Punhos de Pedra ', atkMod: ' 2d4+FOR ' }, T);
    expect(s).toMatchObject({ fichaId: 'f1', categoria: 'tecnica', nome: 'Punhos de Pedra', atkMod: '2d4+FOR', custos: [], criadoEm: T });
  });

  it.each([
    [{ nome: '' }, 'precisa de um nome'],
    [{ nome: 'x', categoria: 'combo' as never }, 'Categoria inválida'],
    [{ nome: 'x', custos: [{ recurso: 'STA' as const, valor: 0 }] }, 'maior que zero'],
    [{ nome: 'x', custos: [{ recurso: 'PODER' as never, valor: 1 }] }, 'Recurso do custo inválido'],
    [{ nome: 'x', custos: [{ recurso: 'STA' as const, valor: 1 }, { recurso: 'STA' as const, valor: 2 }] }, 'uma vez só'],
    [{ nome: 'x'.repeat(81) }, 'longo demais'],
  ])('recusa %o', (dados, msg) => {
    expect(() => criarSkill('f', dados)).toThrow(SkillInvalida);
    expect(() => criarSkill('f', dados)).toThrow(msg);
  });

  it('editar mantém id e criadoEm', () => {
    const s = guarda();
    const e = editarSkill(s, { gastos: '3 STA', custos: [{ recurso: 'STA', valor: 3 }] }, T + 5);
    expect(e).toMatchObject({ id: s.id, criadoEm: T, atualizadoEm: T + 5, gastos: '3 STA' });
  });

  it('agrupa por categoria na ordem de criação', () => {
    const lista = SKAR_SKILLS.map((d, i) => criarSkill('f', d, T + i));
    expect(daCategoria(lista, 'tecnica').map((s) => s.nome)).toEqual([
      'Postura Impetuosa',
      'Punhos de Pedra',
      'Guarda de Impacto',
      'Duro na Queda',
    ]);
    expect(daCategoria(lista, 'habilidade').map((s) => s.nome)).toEqual(['Caminho Digno']);
    expect(daCategoria(lista, 'talento').map((s) => s.nome)).toEqual(['Dupla Empunhadura']);
    expect(daCategoria(lista, 'magia')).toEqual([]);
  });

  it('descreve o custo', () => {
    expect(descreverCusto([{ recurso: 'STA', valor: 2 }, { recurso: 'MANA', valor: 1 }])).toBe('2 Stamina + 1 Mana');
    expect(descreverCusto([])).toBe('');
    expect(descreverCusto(undefined)).toBe('');
  });
});

describe('skills — usar', () => {
  it('desconta o custo e registra com o nome da skill', () => {
    const f = usarSkill(skar(), guarda(), T + 1);
    expect(f.atuais.STA).toBe(18);
    expect(f.historico[0]).toMatchObject({ recurso: 'STA', tipo: 'dano', valor: 2, origem: 'Guarda de Impacto', em: T + 1 });
    expect(descreverEntrada(f.historico[0]!)).toBe('−2 gasto (Guarda de Impacto)');
  });

  it('tira primeiro do extra', () => {
    const f = usarSkill(definirExtra(skar(), 'STA', 1), guarda());
    expect(f.atuais.STA).toBe(19);
    expect(descreverEntrada(f.historico[0]!)).toBe('−2 gasto (Guarda de Impacto, 1 do extra)');
  });

  it('vários custos de uma vez', () => {
    const s = criarSkill('f', { nome: 'Explosão', custos: [{ recurso: 'MANA', valor: 3 }, { recurso: 'STA', valor: 1 }] });
    const f = usarSkill(skar(), s);
    expect(f.atuais).toMatchObject({ MANA: 9, STA: 19 });
    expect(f.historico.slice(0, 2).map((e) => e.recurso).sort()).toEqual(['MANA', 'STA']);
  });

  it('sem recurso suficiente não gasta nada', () => {
    const cansado = aplicar(skar(), 'STA', 'dano', 19); // 1 de STA
    const s = criarSkill('f', { nome: 'Combo', custos: [{ recurso: 'MANA', valor: 1 }, { recurso: 'STA', valor: 2 }] });
    expect(() => usarSkill(cansado, s)).toThrow(RecursoInsuficiente);
    expect(() => usarSkill(cansado, s)).toThrow('Stamina insuficiente para Combo: precisa de 2, tem 1');
  });

  it('skill sem custo não muda a ficha', () => {
    const f = skar();
    expect(usarSkill(f, criarSkill('f', { nome: 'Passiva' }))).toBe(f);
  });
});
