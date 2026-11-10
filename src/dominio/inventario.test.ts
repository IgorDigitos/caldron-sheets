import { describe, expect, it } from 'vitest';
import {
  carteiraVazia,
  criarItem,
  defesaItens,
  defesaTotal,
  definirMoeda,
  descreverMovimento,
  editarItem,
  ItemInvalido,
  LIMITE_HISTORICO_CARTEIRA,
  movimentarMoeda,
  mudarQtd,
  nomeMoeda,
  quantidadeMoeda,
  ordenarItens,
  pesoTotal,
  temDefesa,
  totalCarteira,
} from './inventario';

const T = 1_700_000_000_000;

describe('itens', () => {
  it('cria com valores padrão', () => {
    const i = criarItem('f1', { nome: '  Lamparina mágica ' }, T);
    expect(i).toMatchObject({ fichaId: 'f1', nome: 'Lamparina mágica', qtd: 1, peso: 0, defF: 0, defM: 0, equipado: false });
    expect(i.imagemId).toBeUndefined();
    expect(i.criadoEm).toBe(T);
  });

  it.each([
    [{ nome: '' }, 'precisa de um nome'],
    [{ nome: 'x', qtd: -1 }, 'Quantidade'],
    [{ nome: 'x', peso: Number.NaN }, 'Peso'],
    [{ nome: 'x', defF: -2 }, 'Def. Física'],
    [{ nome: 'x', defM: Infinity }, 'Def. Mágica'],
  ])('recusa %o', (dados, msg) => {
    expect(() => criarItem('f1', dados)).toThrow(ItemInvalido);
    expect(() => criarItem('f1', dados)).toThrow(msg);
  });

  it('editar troca campos e atualiza o carimbo', () => {
    const i = criarItem('f1', { nome: 'Espada', imagemId: 'img1' }, T);
    const e = editarItem(i, { nome: 'Espada longa', peso: 3 }, T + 5);
    expect(e).toMatchObject({ nome: 'Espada longa', peso: 3, imagemId: 'img1', atualizadoEm: T + 5, criadoEm: T });
  });

  it('editar com imagemId vazio remove a foto', () => {
    const i = criarItem('f1', { nome: 'Espada', imagemId: 'img1' });
    expect('imagemId' in editarItem(i, { imagemId: undefined })).toBe(false);
  });

  it('quantidade nunca fica negativa', () => {
    const i = criarItem('f1', { nome: 'Poção', qtd: 1 });
    expect(mudarQtd(i, -1).qtd).toBe(0);
    expect(mudarQtd(mudarQtd(i, -1), -1).qtd).toBe(0);
    expect(mudarQtd(i, 2).qtd).toBe(3);
  });

  it('peso total multiplica pela quantidade', () => {
    const itens = [
      criarItem('f', { nome: 'Corda', qtd: 2, peso: 1.5 }),
      criarItem('f', { nome: 'Armadura', qtd: 1, peso: 12 }),
      criarItem('f', { nome: 'Pena', qtd: 10, peso: 0 }),
    ];
    expect(pesoTotal(itens)).toBe(15);
    expect(pesoTotal([])).toBe(0);
  });
});

describe('defesa dos itens', () => {
  const armadura = criarItem('f', { nome: 'Cota', defF: 4, defM: 1, equipado: true });
  const escudo = criarItem('f', { nome: 'Escudo', defF: 2, qtd: 1, equipado: false });
  const amuletos = criarItem('f', { nome: 'Amuleto', defM: 0.5, qtd: 2, equipado: true });

  it('só os equipados somam, multiplicando pela quantidade', () => {
    expect(defesaItens([armadura, escudo, amuletos])).toEqual({ fisica: 4, magica: 2 });
  });

  it('sem itens é zero', () => {
    expect(defesaItens([])).toEqual({ fisica: 0, magica: 0 });
  });

  it('defesaTotal: natural da ficha + itens equipados', () => {
    const maximos = { DEF_NATURAL: 7.5, DEF_MAGICA_NATURAL: 23 / 6 };
    expect(defesaTotal(maximos, [armadura, escudo, amuletos])).toEqual({
      fisica: 11.5,
      magica: 23 / 6 + 2,
      itens: { fisica: 4, magica: 2 },
    });
    expect(defesaTotal(maximos, []).fisica).toBe(7.5);
  });

  it('temDefesa', () => {
    expect(temDefesa(armadura)).toBe(true);
    expect(temDefesa(criarItem('f', { nome: 'Corda' }))).toBe(false);
  });

  it('ordena equipados primeiro e depois por nome', () => {
    expect(ordenarItens([escudo, amuletos, armadura]).map((i) => i.nome)).toEqual(['Amuleto', 'Cota', 'Escudo']);
  });
});

describe('carteira', () => {
  it('total da carteira do Skar (planilha: 2090)', () => {
    let c = carteiraVazia();
    c = definirMoeda(c, 'ouro', 2);
    c = definirMoeda(c, 'bronze', 9);
    expect(totalCarteira(c)).toBe(2090);
  });

  it('ferro vale 0,1 sem erro de ponto flutuante', () => {
    expect(totalCarteira(definirMoeda(carteiraVazia(), 'ferro', 3))).toBe(0.3);
  });

  it('todas as moedas', () => {
    let c = carteiraVazia();
    for (const m of ['ferro', 'cobre', 'bronze', 'prata', 'ouro', 'platina', 'electrum', 'oricalco'] as const) {
      c = definirMoeda(c, m, 1);
    }
    expect(totalCarteira(c)).toBe(1_111_111.1);
  });

  it("Moeda d'Alma não entra no total", () => {
    const c = definirMoeda(carteiraVazia(), 'alma', 5);
    expect(c.alma).toBe(5);
    expect(totalCarteira(c)).toBe(0);
  });

  it('movimentar registra entrada e saída, mais nova primeiro', () => {
    let c = carteiraVazia();
    c = movimentarMoeda(c, 'ouro', 2, T);
    c = movimentarMoeda(c, 'ouro', 1, T + 1);
    c = movimentarMoeda(c, 'alma', 3, T + 2);
    expect(c.moedas.ouro).toBe(1);
    expect(c.historico!.map(descreverMovimento)).toEqual(["+3 Moeda d'Alma", '−1 Ouro', '+2 Ouro']);
    expect(c.historico![1]).toMatchObject({ moeda: 'ouro', de: 2, para: 1, em: T + 1 });
  });

  it('movimentar sem mudança devolve a mesma carteira, sem registro', () => {
    const c = carteiraVazia();
    expect(movimentarMoeda(c, 'prata', 0)).toBe(c);
  });

  it('movimentar valor inválido lança e não registra', () => {
    expect(() => movimentarMoeda(carteiraVazia(), 'ouro', -2)).toThrow(ItemInvalido);
  });

  it('histórico da carteira tem limite', () => {
    let c = carteiraVazia();
    for (let i = 1; i <= LIMITE_HISTORICO_CARTEIRA + 4; i++) c = movimentarMoeda(c, 'cobre', i);
    expect(c.historico).toHaveLength(LIMITE_HISTORICO_CARTEIRA);
    expect(c.historico![0]!.para).toBe(LIMITE_HISTORICO_CARTEIRA + 4);
  });

  it('carteira antiga sem histórico funciona', () => {
    const antiga = carteiraVazia();
    delete antiga.historico;
    expect(movimentarMoeda(antiga, 'ferro', 5).historico).toHaveLength(1);
  });

  it('quantidade e nome de cada moeda', () => {
    const c = definirMoeda(definirMoeda(carteiraVazia(), 'bronze', 9), 'alma', 2);
    expect(quantidadeMoeda(c, 'bronze')).toBe(9);
    expect(quantidadeMoeda(c, 'alma')).toBe(2);
    expect(nomeMoeda('oricalco')).toBe('Oricalco');
    expect(descreverMovimento({ id: 'x', moeda: 'cobre', de: 0, para: 1500, em: 0 })).toBe('+1.500 Cobre');
  });

  it.each([-1, 1.5, Number.NaN])('recusa %d', (v) => {
    expect(() => definirMoeda(carteiraVazia(), 'ouro', v)).toThrow(ItemInvalido);
  });
});
