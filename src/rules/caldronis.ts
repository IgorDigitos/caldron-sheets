// Preset do sistema Caldronis, tirado da planilha de ficha (aba Combate).
// Decisões do Mestre (2026-11-06):
// - Vida, STA e Def. Natural usam a CON atual (base + extra − perda), não a base.
// - Corpo e Mente guardam decimais; arredondar só na tela (ver formatar()).
// - Vida atual pode ficar negativa (tratado na etapa 2).

import { calcular, type ResultadoCalculo } from './motor';

export const ATRIBUTOS = ['FOR', 'DES', 'CON', 'INT', 'SAB', 'CAR'] as const;
export type Atributo = (typeof ATRIBUTOS)[number];

export const NOMES_ATRIBUTOS: Record<Atributo, string> = {
  FOR: 'Força',
  DES: 'Destreza',
  CON: 'Constituição',
  INT: 'Inteligência',
  SAB: 'Sabedoria',
  CAR: 'Carisma',
};

export const FORMULAS_CALDRONIS = {
  CORPO: 'media(FOR, DES, CON)',
  MENTE: 'media(INT, SAB, CAR)',
  VIDA: 'NIVEL*5 + CORPO*2 + CON*5',
  STA: '5 + CORPO*2 + CON',
  MANA: '5 + MENTE*3',
  PA: '4 + int(NIVEL/5)',
  DESLOCAMENTO: '7.5 + int(CORPO/3)*1.5',
  DEF_NATURAL: 'CORPO + CON/2',
  DEF_MAGICA_NATURAL: 'MENTE + SAB/2',
  CONTRABALANCO: 'int(NIVEL/3) + 1',
} as const satisfies Record<string, string>;

export type Derivado = keyof typeof FORMULAS_CALDRONIS;

export const NOMES_DERIVADOS: Record<Derivado, string> = {
  CORPO: 'Corpo',
  MENTE: 'Mente',
  VIDA: 'Vida',
  STA: 'Stamina',
  MANA: 'Mana',
  PA: 'PA',
  DESLOCAMENTO: 'Deslocamento',
  DEF_NATURAL: 'Def. Natural',
  DEF_MAGICA_NATURAL: 'Def. Mágica Natural',
  CONTRABALANCO: 'Contrabalanço',
};

export interface ValorAtributo {
  base: number;
  /** Bônus temporário ou de item. */
  extra?: number;
  /** Penalidade (coluna "L" da planilha). */
  perda?: number;
}

export interface FichaRegras {
  nivel: number;
  atributos: Record<Atributo, ValorAtributo>;
  /** Bônus/penalidade direto em Corpo ou Mente (colunas Extra/L da planilha). */
  ajustes?: Partial<Record<'CORPO' | 'MENTE', number>>;
}

export function valorAtual(a: ValorAtributo): number {
  return a.base + (a.extra ?? 0) - (a.perda ?? 0);
}

export function calcularCaldronis(
  ficha: FichaRegras,
  formulas: Readonly<Record<string, string>> = FORMULAS_CALDRONIS,
): ResultadoCalculo {
  const entradas: Record<string, number> = { NIVEL: ficha.nivel };
  for (const attr of ATRIBUTOS) entradas[attr] = valorAtual(ficha.atributos[attr]);
  return calcular(formulas, entradas, ficha.ajustes ?? {});
}
