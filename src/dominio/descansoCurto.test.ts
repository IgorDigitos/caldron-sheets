import { describe, expect, it } from 'vitest';
import { aplicar, criarFicha, descreverEntrada, LIMITE_HISTORICO, type Ficha } from './ficha';
import { aplicarDescansoCurto, dadosDescansoCurto, jaAplicada, textoRolagem } from './descansoCurto';
import { criarMensagem } from './mesa';
import { SKAR } from '../rules/fixtures/skar';

const T = 1_700_000_000_000;
const skar = (): Ficha => criarFicha({ nome: 'Skar Lionet', ...structuredClone(SKAR) }, T);
const cansado = (): Ficha => {
  let f = aplicar(skar(), 'VIDA', 'dano', 40, T);
  f = aplicar(f, 'STA', 'dano', 15, T);
  return aplicar(f, 'MANA', 'dano', 5, T);
};

describe('dadosDescansoCurto', () => {
  it('Skar: 2dCON Vida, 3dCORPO Stamina, 2dMENTE Mana (Mente 2,33 vira d2)', () => {
    const dados = dadosDescansoCurto(cansado());
    expect(dados).toEqual([
      { recurso: 'VIDA', qtd: 2, faces: 5 },
      { recurso: 'STA', qtd: 3, faces: 5 },
      { recurso: 'MANA', qtd: 2, faces: 2 },
    ]);
    expect(dados.map(textoRolagem)).toEqual([
      '2d5 Vida (descanso curto)',
      '3d5 Stamina (descanso curto)',
      '2d2 Mana (descanso curto)',
    ]);
  });

  it('usa o atributo ATUAL e arredonda para o mais próximo (,5 sobe)', () => {
    const f = cansado();
    f.atributos.CON = { base: 5, extra: 2, perda: 1 };
    f.maximos.CORPO = 4.5;
    f.maximos.MENTE = 2.49;
    expect(dadosDescansoCurto(f).map((d) => d.faces)).toEqual([6, 5, 2]);
  });

  it('pula recurso cheio e dado menor que d1', () => {
    expect(dadosDescansoCurto(skar())).toEqual([]);
    const f = cansado();
    f.atributos.CON = { base: 0 };
    expect(dadosDescansoCurto(f).map((d) => d.recurso)).toEqual(['STA', 'MANA']);
  });
});

describe('aplicarDescansoCurto', () => {
  it('soma o resultado, não passa do máximo e registra os dados', () => {
    let f = aplicarDescansoCurto(cansado(), 'VIDA', 7, 'r1', '2d5', T + 1);
    expect(f.atuais.VIDA).toBe(12);
    expect(f.atualizadoEm).toBe(T + 1);
    expect(descreverEntrada(f.historico[0]!)).toBe('+7 descanso curto (2d5)');
    f = aplicarDescansoCurto(f, 'MANA', 4, 'r2', '2d2', T + 2);
    expect(f.atuais.MANA).toBe(11);
    f = aplicarDescansoCurto(f, 'MANA', 4, 'r3', '2d2', T + 3);
    expect(f.atuais.MANA).toBe(12);
    expect(descreverEntrada(f.historico[0]!)).toBe('+1 descanso curto (2d2, rolou 4)');
  });

  it('nunca aplica a mesma rolagem duas vezes', () => {
    const uma = aplicarDescansoCurto(cansado(), 'STA', 10, 'r1', '3d5', T);
    expect(jaAplicada(uma, 'r1')).toBe(true);
    expect(aplicarDescansoCurto(uma, 'STA', 10, 'r1', '3d5', T)).toBe(uma);
    expect(uma.atuais.STA).toBe(15);
  });

  it('vale a partir de Vida negativa; total inválido não muda nada', () => {
    const f = aplicar(skar(), 'VIDA', 'dano', 50, T);
    expect(aplicarDescansoCurto(f, 'VIDA', 3, 'r', '2d5').atuais.VIDA).toBe(-2);
    expect(aplicarDescansoCurto(f, 'VIDA', Number.NaN, 'r', '2d5')).toBe(f);
  });

  it('histórico guarda só as últimas', () => {
    let f = cansado();
    for (let i = 0; i < LIMITE_HISTORICO + 5; i++) f = aplicarDescansoCurto(f, 'VIDA', 0, `r${i}`, '2d5');
    expect(f.historico).toHaveLength(LIMITE_HISTORICO);
  });
});

describe('mensagem de descanso', () => {
  it('só marca descanso em rolagem com ficha', () => {
    const base = { autorUid: 'u', nome: 'Skar', descanso: 'VIDA' as const };
    expect(criarMensagem({ ...base, texto: '2d5 Vida', fichaId: 'f' }).descanso).toBe('VIDA');
    expect(criarMensagem({ ...base, texto: '2d5 Vida' }).descanso).toBeUndefined();
    expect(criarMensagem({ ...base, texto: 'oi', fichaId: 'f' }).descanso).toBeUndefined();
  });
});
