import { describe, expect, it } from 'vitest';
import {
  carteiraVazia,
  criarItem,
  defesaItens,
  definirMoeda,
  editarItem,
  ItemInvalido,
  mudarQtd,
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

  it.each([-1, 1.5, Number.NaN])('recusa %d', (v) => {
    expect(() => definirMoeda(carteiraVazia(), 'ouro', v)).toThrow(ItemInvalido);
  });
});
