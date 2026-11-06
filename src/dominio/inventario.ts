// Inventário, carteira e defesa total — regras puras, sem tela e sem banco.

import { novoId } from './id';

export interface Item {
  id: string;
  fichaId: string;
  nome: string;
  qtd: number;
  /** Peso de UMA unidade. */
  peso: number;
  descricao: string;
  /** Defesa física e mágica que o item dá quando equipado (armaduras, escudos…). */
  defF: number;
  defM: number;
  equipado: boolean;
  imagemId?: string;
  criadoEm: number;
  atualizadoEm: number;
}

export type DadosItem = Partial<Pick<Item, 'nome' | 'qtd' | 'peso' | 'descricao' | 'defF' | 'defM' | 'equipado' | 'imagemId'>>;

export class ItemInvalido extends Error {}

function numeroValido(v: number, campo: string, permitirZero = true): number {
  if (!Number.isFinite(v) || v < 0 || (!permitirZero && v === 0)) {
    throw new ItemInvalido(`${campo} precisa ser um número ${permitirZero ? 'maior ou igual a zero' : 'maior que zero'}`);
  }
  return v;
}

function validar(item: Item): Item {
  const nome = item.nome.trim();
  if (!nome) throw new ItemInvalido('O item precisa de um nome');
  numeroValido(item.qtd, 'Quantidade');
  numeroValido(item.peso, 'Peso');
  numeroValido(item.defF, 'Def. Física');
  numeroValido(item.defM, 'Def. Mágica');
  return { ...item, nome };
}

export function criarItem(fichaId: string, dados: DadosItem, agora = Date.now()): Item {
  return validar({
    id: novoId(),
    fichaId,
    nome: dados.nome ?? '',
    qtd: dados.qtd ?? 1,
    peso: dados.peso ?? 0,
    descricao: dados.descricao ?? '',
    defF: dados.defF ?? 0,
    defM: dados.defM ?? 0,
    equipado: dados.equipado ?? false,
    ...(dados.imagemId ? { imagemId: dados.imagemId } : {}),
    criadoEm: agora,
    atualizadoEm: agora,
  });
}

export function editarItem(item: Item, dados: DadosItem, agora = Date.now()): Item {
  const novo: Item = { ...item, ...dados, atualizadoEm: agora };
  if ('imagemId' in dados && !dados.imagemId) delete novo.imagemId;
  return validar(novo);
}

/** Soma (ou tira) unidades. Nunca fica abaixo de 0. */
export function mudarQtd(item: Item, delta: number, agora = Date.now()): Item {
  return { ...item, qtd: Math.max(0, item.qtd + delta), atualizadoEm: agora };
}

export function pesoTotal(itens: readonly Item[]): number {
  return itens.reduce((s, i) => s + i.qtd * i.peso, 0);
}

export function temDefesa(item: Item): boolean {
  return item.defF > 0 || item.defM > 0;
}

/** Bônus de defesa dos itens equipados (qtd × defesa, como na planilha). */
export function defesaItens(itens: readonly Item[]): { fisica: number; magica: number } {
  let fisica = 0;
  let magica = 0;
  for (const i of itens) {
    if (!i.equipado) continue;
    fisica += i.qtd * i.defF;
    magica += i.qtd * i.defM;
  }
  return { fisica, magica };
}

/** Ordena para a lista: equipados primeiro, depois por nome. */
export function ordenarItens(itens: readonly Item[]): Item[] {
  return [...itens].sort(
    (a, b) => Number(b.equipado) - Number(a.equipado) || a.nome.localeCompare(b.nome, 'pt-BR'),
  );
}

// ---------- Carteira ----------

/** Valor de cada moeda em cobre (aba INFO+ da planilha). */
export const MOEDAS = [
  { id: 'ferro', nome: 'Ferro', valor: 0.1 },
  { id: 'cobre', nome: 'Cobre', valor: 1 },
  { id: 'bronze', nome: 'Bronze', valor: 10 },
  { id: 'prata', nome: 'Prata', valor: 100 },
  { id: 'ouro', nome: 'Ouro', valor: 1_000 },
  { id: 'platina', nome: 'Platina', valor: 10_000 },
  { id: 'electrum', nome: 'Electrum', valor: 100_000 },
  { id: 'oricalco', nome: 'Oricalco', valor: 1_000_000 },
] as const;

export type Moeda = (typeof MOEDAS)[number]['id'];

export interface Carteira {
  moedas: Record<Moeda, number>;
  /** Moedas d'Alma: contador à parte, não entram no total. */
  alma: number;
}

export function carteiraVazia(): Carteira {
  return {
    moedas: Object.fromEntries(MOEDAS.map((m) => [m.id, 0])) as Record<Moeda, number>,
    alma: 0,
  };
}

/** Total em cobre. Arredonda para 1 casa para o ferro (0,1) não gerar 2089,9999. */
export function totalCarteira(c: Carteira): number {
  const total = MOEDAS.reduce((s, m) => s + (c.moedas[m.id] ?? 0) * m.valor, 0);
  return Math.round(total * 10) / 10;
}

export function definirMoeda(c: Carteira, moeda: Moeda | 'alma', qtd: number): Carteira {
  if (!Number.isInteger(qtd) || qtd < 0) throw new ItemInvalido('Quantidade de moedas precisa ser inteira e ≥ 0');
  if (moeda === 'alma') return { ...c, alma: qtd };
  return { ...c, moedas: { ...c.moedas, [moeda]: qtd } };
}
