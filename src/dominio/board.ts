// Board do Mestre: várias fichas lado a lado no PC, só para acompanhar e aplicar dano/cura.
// Quais fichas aparecem é escolha do Mestre, guardada NESTE aparelho (localStorage), não na nuvem.

import type { Ficha } from './ficha';

export const CHAVE_SELECAO = 'caldron-board-fichas';
/** Linhas de histórico por cartão. */
export const HISTORICO_BOARD = 4;

type Armazem = Pick<Storage, 'getItem' | 'setItem'>;

/** Ids escolhidos, ou `null` se o Mestre ainda não escolheu (= todas as fichas). */
export function lerSelecao(armazem: Armazem | undefined): string[] | null {
  try {
    const bruto = armazem?.getItem(CHAVE_SELECAO);
    if (!bruto) return null;
    const lista: unknown = JSON.parse(bruto);
    return Array.isArray(lista) && lista.every((x) => typeof x === 'string') ? (lista as string[]) : null;
  } catch {
    return null;
  }
}

export function gravarSelecao(armazem: Armazem | undefined, ids: string[]): void {
  try {
    armazem?.setItem(CHAVE_SELECAO, JSON.stringify(ids));
  } catch {
    // Sem espaço ou modo privado: o board funciona do mesmo jeito, só não lembra a escolha.
  }
}

/** Fichas que vão para o board, em ordem alfabética. Id que não existe mais é ignorado. */
export function selecionadas(fichas: readonly Ficha[], selecao: string[] | null): Ficha[] {
  const lista = selecao === null ? [...fichas] : fichas.filter((f) => selecao.includes(f.id));
  return lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR') || a.criadoEm - b.criadoEm);
}

/** Marca ou desmarca uma ficha. Partindo de "todas" (`null`), vira uma lista explícita. */
export function alternar(selecao: string[] | null, todas: readonly string[], id: string, marcada: boolean): string[] {
  const atual = selecao ?? [...todas];
  if (marcada) return atual.includes(id) ? atual : [...atual, id];
  return atual.filter((x) => x !== id);
}
