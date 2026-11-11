import { describe, expect, it } from 'vitest';
import { alternar, CHAVE_SELECAO, gravarSelecao, lerSelecao, selecionadas } from './board';
import { criarFicha } from './ficha';

function armazem(inicial: Record<string, string> = {}) {
  const m = new Map(Object.entries(inicial));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
}

describe('seleção do board', () => {
  it('sem nada guardado (ou lixo) é null = todas', () => {
    expect(lerSelecao(armazem())).toBeNull();
    expect(lerSelecao(armazem({ [CHAVE_SELECAO]: '{oops' }))).toBeNull();
    expect(lerSelecao(armazem({ [CHAVE_SELECAO]: '[1, 2]' }))).toBeNull();
    expect(lerSelecao(undefined)).toBeNull();
  });

  it('grava e lê de volta; falha de armazenamento não quebra', () => {
    const a = armazem();
    gravarSelecao(a, ['b', 'a']);
    expect(lerSelecao(a)).toEqual(['b', 'a']);
    const quebrado = {
      getItem: () => {
        throw new Error('privado');
      },
      setItem: () => {
        throw new Error('cheio');
      },
    };
    expect(() => gravarSelecao(quebrado, ['x'])).not.toThrow();
    expect(lerSelecao(quebrado)).toBeNull();
  });
});

describe('selecionadas', () => {
  const skar = criarFicha({ nome: 'Skar Lionet' }, 1);
  const ogro = criarFicha({ nome: 'Ogro' }, 2);
  const ana = criarFicha({ nome: 'Ana' }, 3);

  it('null = todas, em ordem alfabética', () => {
    expect(selecionadas([skar, ogro, ana], null).map((f) => f.nome)).toEqual(['Ana', 'Ogro', 'Skar Lionet']);
  });

  it('lista filtra e ignora id que sumiu', () => {
    expect(selecionadas([skar, ogro, ana], [skar.id, 'apagada']).map((f) => f.nome)).toEqual(['Skar Lionet']);
    expect(selecionadas([skar, ogro, ana], [])).toEqual([]);
  });
});

describe('alternar', () => {
  it('partindo de todas, desmarcar vira lista explícita sem aquela', () => {
    expect(alternar(null, ['a', 'b', 'c'], 'b', false)).toEqual(['a', 'c']);
  });

  it('marcar acrescenta uma vez; desmarcar tira', () => {
    expect(alternar(['a'], ['a', 'b'], 'b', true)).toEqual(['a', 'b']);
    expect(alternar(['a', 'b'], ['a', 'b'], 'b', true)).toEqual(['a', 'b']);
    expect(alternar(['a', 'b'], ['a', 'b'], 'a', false)).toEqual(['b']);
  });
});
