// Recursos personalizados (ex.: Ímpeto): o Mestre cria no catálogo da campanha e habilita em cada
// ficha. O máximo vem de uma fórmula do motor (ex.: "3 + int(NIVEL/2)") e só o app do Mestre calcula
// e grava — o servidor não consegue conferir fórmula livre, então o jogador não mexe no máximo.

import { valorAtual, ATRIBUTOS } from '../rules/caldronis';
import { calcular } from '../rules/motor';
import { atualDe, criarFicha, ehBasico, maxDe, type Ficha, type IdRecurso } from './ficha';
import { novoId } from './id';

export interface DefRecurso {
  id: IdRecurso;
  nome: string;
  /** Cor da barra (uma de CORES_RECURSO). */
  cor: string;
  /** Fórmula do máximo. Usa NIVEL, FOR…CAR (atuais) e os derivados (CORPO, MENTE, VIDA…). */
  formula: string;
  /** Ao habilitar numa ficha: começa no máximo (como Mana) ou em 0 (como Ímpeto). */
  comecaCheio: boolean;
  criadoEm: number;
  atualizadoEm: number;
}

export const CORES_RECURSO = ['#d9a441', '#9b6dd6', '#3fa7a3', '#d0703c', '#c4528f', '#7a9b3c'] as const;

/** As regras do servidor conferem até este número de recursos personalizados por ficha. */
export const MAX_PERSONALIZADOS = 6;

export class RecursoInvalido extends Error {}

function entradasDaFicha(f: Ficha): Record<string, number> {
  const e: Record<string, number> = { NIVEL: f.nivel, ...f.maximos };
  for (const a of ATRIBUTOS) e[a] = valorAtual(f.atributos[a]);
  return e;
}

/** Máximo do recurso para esta ficha. Lança RecursoInvalido se a fórmula não fecha. */
export function calcularMaximo(ficha: Ficha, formula: string): number {
  const r = calcular({ MAXIMO: formula }, entradasDaFicha(ficha));
  if (!r.ok) throw new RecursoInvalido(r.erros.map((e) => e.mensagem).join('; '));
  const v = r.valores.MAXIMO!;
  if (v < 0) throw new RecursoInvalido('O máximo não pode ser negativo');
  return v;
}

/** Confere a fórmula numa ficha de teste antes de salvar no catálogo. */
function validarFormula(formula: string): void {
  calcularMaximo(criarFicha({ nivel: 1 }), formula);
}

function validar(d: DefRecurso): DefRecurso {
  const nome = d.nome.trim();
  const formula = d.formula.trim();
  if (!nome) throw new RecursoInvalido('O recurso precisa de um nome');
  if (nome.length > 40) throw new RecursoInvalido('Nome longo demais (máximo 40)');
  if (ehBasico(nome.toUpperCase())) throw new RecursoInvalido(`"${nome}" já é um recurso básico`);
  if (!formula) throw new RecursoInvalido('Informe a fórmula do máximo (ex.: 3 + int(NIVEL/2))');
  if (!(CORES_RECURSO as readonly string[]).includes(d.cor)) throw new RecursoInvalido('Cor inválida');
  validarFormula(formula);
  return { ...d, nome, formula };
}

export function criarDefRecurso(
  dados: Partial<Pick<DefRecurso, 'nome' | 'cor' | 'formula' | 'comecaCheio'>>,
  agora = Date.now(),
): DefRecurso {
  return validar({
    id: `rec-${novoId()}`,
    nome: dados.nome ?? '',
    cor: dados.cor ?? CORES_RECURSO[0],
    formula: dados.formula ?? '',
    comecaCheio: dados.comecaCheio ?? true,
    criadoEm: agora,
    atualizadoEm: agora,
  });
}

export function editarDefRecurso(
  d: DefRecurso,
  dados: Partial<Pick<DefRecurso, 'nome' | 'cor' | 'formula' | 'comecaCheio'>>,
  agora = Date.now(),
): DefRecurso {
  return validar({ ...d, ...dados, atualizadoEm: agora });
}

export function idsPersonalizados(ficha: Ficha): IdRecurso[] {
  return Object.keys(ficha.maxPersonalizados ?? {});
}

/** Habilita o recurso na ficha: calcula o máximo e começa cheio ou em 0. */
export function habilitarRecurso(ficha: Ficha, def: DefRecurso, agora = Date.now()): Ficha {
  if (ficha.maxPersonalizados?.[def.id] !== undefined) return ficha;
  if (idsPersonalizados(ficha).length >= MAX_PERSONALIZADOS) {
    throw new RecursoInvalido(`No máximo ${MAX_PERSONALIZADOS} recursos personalizados por ficha`);
  }
  const max = calcularMaximo(ficha, def.formula);
  return {
    ...ficha,
    maxPersonalizados: { ...ficha.maxPersonalizados, [def.id]: max },
    personalizados: { ...ficha.personalizados, [def.id]: def.comecaCheio ? max : 0 },
    atualizadoEm: agora,
  };
}

/** Tira o recurso da ficha (valor, máximo e extra). */
export function desabilitarRecurso(ficha: Ficha, id: IdRecurso, agora = Date.now()): Ficha {
  if (ficha.maxPersonalizados?.[id] === undefined && ficha.personalizados?.[id] === undefined) return ficha;
  const semChave = <T>(m: Record<string, T> | undefined): Record<string, T> => {
    const copia = { ...m };
    delete copia[id];
    return copia;
  };
  return {
    ...ficha,
    personalizados: semChave(ficha.personalizados),
    maxPersonalizados: semChave(ficha.maxPersonalizados),
    extras: semChave(ficha.extras) as Ficha['extras'],
    atualizadoEm: agora,
  };
}

/**
 * Recalcula o máximo dos recursos habilitados (ex.: subiu de nível, mudou a fórmula). Se o máximo
 * cair, o atual é cortado. Recurso cuja definição sumiu do catálogo fica como está.
 * Devolve `null` se nada mudou.
 */
export function recalcularPersonalizados(
  ficha: Ficha,
  defs: readonly DefRecurso[],
  agora = Date.now(),
): Ficha | null {
  const maximos = { ...ficha.maxPersonalizados };
  const atuais = { ...ficha.personalizados };
  let mudou = false;
  for (const id of idsPersonalizados(ficha)) {
    const def = defs.find((d) => d.id === id);
    if (!def) continue;
    let novo: number;
    try {
      novo = calcularMaximo(ficha, def.formula);
    } catch {
      continue;
    }
    if (novo !== maxDe(ficha, id)) {
      maximos[id] = novo;
      atuais[id] = Math.min(atualDe(ficha, id), novo);
      mudou = true;
    }
  }
  return mudou ? { ...ficha, maxPersonalizados: maximos, personalizados: atuais, atualizadoEm: agora } : null;
}

/** Nome para mostrar: básico pelo nome fixo; personalizado pelo catálogo. */
export function nomeRecurso(id: IdRecurso, defs: readonly DefRecurso[], nomesBasicos: Record<string, string>): string {
  return nomesBasicos[id] ?? defs.find((d) => d.id === id)?.nome ?? 'Recurso removido';
}
