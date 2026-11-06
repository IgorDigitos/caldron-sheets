// Calcula os valores derivados (Corpo, Vida, STA…) em ordem de dependência.

import { avaliar, dependencias, ErroFormula, normalizarSimbolo, parse, type No } from './parser';

export interface ErroCampo {
  campo: string;
  mensagem: string;
}

export type ResultadoCalculo =
  | { ok: true; valores: Record<string, number>; ordem: string[] }
  | { ok: false; erros: ErroCampo[] };

/**
 * @param formulas  campo derivado → texto da fórmula (ex.: `VIDA: "NIVEL*5 + CORPO*2"`)
 * @param entradas  atributos já com bônus/penalidade (ex.: `{ FOR: 8, NIVEL: 2 }`)
 * @param ajustes   bônus fixo somado ao derivado depois da fórmula (ex.: `{ CORPO: 1 }`)
 */
export function calcular(
  formulas: Readonly<Record<string, string>>,
  entradas: Readonly<Record<string, number>>,
  ajustes: Readonly<Record<string, number>> = {},
): ResultadoCalculo {
  const erros: ErroCampo[] = [];
  const valores = new Map<string, number>();

  for (const [nome, v] of Object.entries(entradas)) {
    const campo = normalizarSimbolo(nome);
    if (!Number.isFinite(v)) erros.push({ campo, mensagem: 'Valor não é um número' });
    else valores.set(campo, v);
  }

  const arvores = new Map<string, No>();
  for (const [nome, texto] of Object.entries(formulas)) {
    const campo = normalizarSimbolo(nome);
    if (valores.has(campo)) {
      erros.push({ campo, mensagem: `"${campo}" é atributo e fórmula ao mesmo tempo` });
      continue;
    }
    try {
      arvores.set(campo, parse(texto));
    } catch (e) {
      erros.push({ campo, mensagem: mensagemDe(e) });
    }
  }

  // Uma fórmula com erro de sintaxe ainda é um campo conhecido: quem depende dela
  // não deve receber também "símbolo desconhecido".
  const camposFormula = new Set(Object.keys(formulas).map(normalizarSimbolo));
  for (const [campo, arvore] of arvores) {
    for (const dep of dependencias(arvore)) {
      if (!valores.has(dep) && !camposFormula.has(dep)) {
        erros.push({ campo, mensagem: `Símbolo desconhecido "${dep}"` });
      }
    }
  }
  if (erros.length) return { ok: false, erros };

  // Ordenação topológica (DFS) com detecção de ciclo.
  const ordem: string[] = [];
  const estado = new Map<string, 'visitando' | 'feito'>();
  const pilha: string[] = [];

  const visitar = (campo: string): void => {
    if (estado.get(campo) === 'feito' || !arvores.has(campo)) return;
    if (estado.get(campo) === 'visitando') {
      const ciclo = [...pilha.slice(pilha.indexOf(campo)), campo];
      throw new ErroFormula(`Dependência circular: ${ciclo.join(' → ')}`);
    }
    estado.set(campo, 'visitando');
    pilha.push(campo);
    for (const dep of dependencias(arvores.get(campo)!)) visitar(dep);
    pilha.pop();
    estado.set(campo, 'feito');
    ordem.push(campo);
  };

  for (const campo of arvores.keys()) {
    try {
      visitar(campo);
    } catch (e) {
      return { ok: false, erros: [{ campo, mensagem: mensagemDe(e) }] };
    }
  }

  const ajustesNorm = new Map(Object.entries(ajustes).map(([k, v]) => [normalizarSimbolo(k), v]));
  const saida: Record<string, number> = {};
  for (const campo of ordem) {
    try {
      const v = avaliar(arvores.get(campo)!, valores) + (ajustesNorm.get(campo) ?? 0);
      if (!Number.isFinite(v)) throw new ErroFormula('Resultado não é um número finito');
      valores.set(campo, v);
      saida[campo] = v;
    } catch (e) {
      erros.push({ campo, mensagem: mensagemDe(e) });
      // Os dependentes deste campo vão falhar com "símbolo desconhecido"; paramos aqui.
      return { ok: false, erros };
    }
  }
  return { ok: true, valores: saida, ordem };
}

function mensagemDe(e: unknown): string {
  if (e instanceof ErroFormula) return e.message;
  throw e;
}

/** Formata para a tela: até 1 casa decimal, vírgula decimal (pt-BR). */
export function formatar(valor: number): string {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}
