// Modelo da ficha e as regras de recurso (dano, cura, gasto) — sem tela e sem banco.

import {
  ATRIBUTOS,
  calcularCaldronis,
  NOMES_ATRIBUTOS,
  type Atributo,
  type Derivado,
  type FichaRegras,
  type ValorAtributo,
} from '../rules/caldronis';
import { formatar, type ErroCampo } from '../rules/motor';
import { carteiraVazia, type Carteira } from './inventario';
import { novoId } from './id';

export const RECURSOS = ['VIDA', 'STA', 'MANA'] as const;
export type Recurso = (typeof RECURSOS)[number];

export const NOMES_RECURSOS: Record<Recurso, string> = {
  VIDA: 'Vida',
  STA: 'Stamina',
  MANA: 'Mana',
};

/**
 * Até onde cada recurso pode cair. Vida pode ficar negativa (decisão do Mestre, 2026-11-06);
 * o limite exato ainda não foi definido, então por enquanto não há piso.
 */
export const PISO: Record<Recurso, number> = {
  VIDA: -Infinity,
  STA: 0,
  MANA: 0,
};

export type TipoMudanca = 'dano' | 'cura';

/** No histórico, além de dano/cura: descanso longo e ajuste do extra (temporário). */
export type TipoEntrada = TipoMudanca | 'descanso' | 'extra';

export interface EntradaHistorico {
  id: string;
  recurso: Recurso;
  tipo: TipoEntrada;
  /** Quanto o jogador pediu (sempre positivo). Em `extra`, o novo valor do extra. */
  valor: number;
  /** Quanto o recurso realmente mudou (ex.: cura limitada pelo máximo). Em `extra`, a diferença. */
  efetivo: number;
  /** Em `dano`: quanto saiu do extra (temporário) antes de chegar no recurso. */
  doExtra?: number;
  /** De onde veio (ex.: nome da skill usada). */
  origem?: string;
  em: number;
}

export const LIMITE_HISTORICO = 20;

export type ParteAtributo = keyof ValorAtributo;

/** O que foi alterado: o nível ou uma parte (base/extra/perda) de um atributo. */
export type AlvoAlteracao = { tipo: 'nivel' } | { tipo: 'atributo'; atributo: Atributo; parte: ParteAtributo };

export interface EntradaAlteracao {
  id: string;
  alvo: AlvoAlteracao;
  de: number;
  para: number;
  /** Máximos de recurso que mudaram por causa desta alteração. */
  efeitos: Partial<Record<Recurso, { de: number; para: number }>>;
  em: number;
}

export const LIMITE_ALTERACOES = 30;

export interface Ficha extends FichaRegras {
  id: string;
  nome: string;
  raca: string;
  classe: string;
  /** Valores derivados já calculados (Vida máx., STA máx., Corpo…). */
  maximos: Record<Derivado, number>;
  atuais: Record<Recurso, number>;
  /**
   * Extra temporário de cada recurso (efeito de item, magia…). O dano/gasto tira primeiro daqui; a
   * cura não recupera. Ausente em fichas antigas = 0.
   */
  extras?: Partial<Record<Recurso, number>>;
  historico: EntradaHistorico[];
  /** Histórico de mudanças de nível e atributos, mais nova primeiro. */
  alteracoes: EntradaAlteracao[];
  carteira: Carteira;
  /** Uid do jogador dono da ficha (o Mestre escolhe). Sem dono = só o Mestre vê. */
  donoUid?: string;
  criadoEm: number;
  atualizadoEm: number;
}

export type ResultadoFicha = { ok: true; ficha: Ficha } | { ok: false; erros: ErroCampo[] };

export { novoId } from './id';

function atributosBase(valor: number): Record<Atributo, ValorAtributo> {
  return Object.fromEntries(ATRIBUTOS.map((a) => [a, { base: valor }])) as Record<Atributo, ValorAtributo>;
}

/** Ficha nova com os recursos cheios. */
export function criarFicha(
  dados: Partial<Pick<Ficha, 'nome' | 'raca' | 'classe' | 'nivel' | 'atributos' | 'ajustes'>> = {},
  agora = Date.now(),
): Ficha {
  const regras: FichaRegras = {
    nivel: dados.nivel ?? 1,
    atributos: dados.atributos ?? atributosBase(1),
    ajustes: dados.ajustes ?? {},
  };
  const r = calcularCaldronis(regras);
  if (!r.ok) throw new Error(`Preset Caldronis inválido: ${r.erros.map((e) => e.mensagem).join('; ')}`);
  const maximos = r.valores as Record<Derivado, number>;
  return {
    id: novoId(),
    nome: dados.nome?.trim() || 'Sem nome',
    raca: dados.raca ?? '',
    classe: dados.classe ?? '',
    ...regras,
    maximos,
    atuais: { VIDA: maximos.VIDA, STA: maximos.STA, MANA: maximos.MANA },
    historico: [],
    alteracoes: [],
    carteira: carteiraVazia(),
    criadoEm: agora,
    atualizadoEm: agora,
  };
}

/**
 * Recalcula os máximos depois de mudar nível, atributo ou ajuste.
 * Se um máximo cair, o atual é cortado para o novo teto; se subir, o atual fica onde está.
 */
export function recalcular(ficha: Ficha, agora = Date.now()): ResultadoFicha {
  const r = calcularCaldronis(ficha);
  if (!r.ok) return r;
  const maximos = r.valores as Record<Derivado, number>;
  const atuais = { ...ficha.atuais };
  for (const rec of RECURSOS) atuais[rec] = Math.min(atuais[rec], maximos[rec]);
  return { ok: true, ficha: { ...ficha, maximos, atuais, atualizadoEm: agora } };
}

function lerAlvo(ficha: FichaRegras, alvo: AlvoAlteracao): number {
  if (alvo.tipo === 'nivel') return ficha.nivel;
  return ficha.atributos[alvo.atributo][alvo.parte] ?? 0;
}

/**
 * Muda o nível ou uma parte de um atributo, recalcula os máximos e registra a alteração.
 * Se o valor não mudou, devolve a ficha como está, sem registro.
 */
export function alterar(ficha: Ficha, alvo: AlvoAlteracao, valor: number, agora = Date.now()): ResultadoFicha {
  const de = lerAlvo(ficha, alvo);
  if (de === valor) return { ok: true, ficha };

  const mudada: Ficha =
    alvo.tipo === 'nivel'
      ? { ...ficha, nivel: valor }
      : {
          ...ficha,
          atributos: {
            ...ficha.atributos,
            [alvo.atributo]: { ...ficha.atributos[alvo.atributo], [alvo.parte]: valor },
          },
        };
  const r = recalcular(mudada, agora);
  if (!r.ok) return r;

  const efeitos: EntradaAlteracao['efeitos'] = {};
  for (const rec of RECURSOS) {
    const [antes, depois] = [ficha.maximos[rec], r.ficha.maximos[rec]];
    if (antes !== depois) efeitos[rec] = { de: antes, para: depois };
  }
  const entrada: EntradaAlteracao = { id: novoId(), alvo, de, para: valor, efeitos, em: agora };
  return {
    ok: true,
    ficha: { ...r.ficha, alteracoes: [entrada, ...(ficha.alteracoes ?? [])].slice(0, LIMITE_ALTERACOES) },
  };
}

const NOMES_PARTES: Record<ParteAtributo, string> = { base: 'base', extra: 'extra', perda: 'perda' };

/** Ex.: "Nível", "Constituição extra". */
export function nomeAlvo(alvo: AlvoAlteracao): string {
  return alvo.tipo === 'nivel' ? 'Nível' : `${NOMES_ATRIBUTOS[alvo.atributo]} ${NOMES_PARTES[alvo.parte]}`;
}

/** Ex.: "Vida máx. 45 → 56,3 · Stamina máx. 20 → 22,3". Vazio se nenhum máximo mudou. */
export function descreverEfeitos(e: EntradaAlteracao): string {
  return RECURSOS.filter((r) => e.efeitos[r])
    .map((r) => `${NOMES_RECURSOS[r]} máx. ${formatar(e.efeitos[r]!.de)} → ${formatar(e.efeitos[r]!.para)}`)
    .join(' · ');
}

/**
 * Recalcula uma ficha salva com regras antigas (ex.: Vida máx. 38,7 antes do arredondamento).
 * Recurso que estava cheio continua cheio no máximo novo. Devolve `null` se nada mudou.
 */
export function atualizarParaRegrasAtuais(ficha: Ficha, agora = Date.now()): Ficha | null {
  const r = recalcular(ficha, agora);
  if (!r.ok) return null;
  const mudou = (Object.keys(r.ficha.maximos) as Derivado[]).some((d) => r.ficha.maximos[d] !== ficha.maximos[d]);
  if (!mudou) return null;
  const atuais = { ...r.ficha.atuais };
  for (const rec of RECURSOS) {
    if (ficha.atuais[rec] === ficha.maximos[rec]) atuais[rec] = r.ficha.maximos[rec];
  }
  return { ...r.ficha, atuais };
}

export class ValorInvalido extends Error {}

export function extraDe(ficha: Ficha, recurso: Recurso): number {
  return ficha.extras?.[recurso] ?? 0;
}

function registrar(ficha: Ficha, entradas: EntradaHistorico[]): EntradaHistorico[] {
  return [...entradas, ...ficha.historico].slice(0, LIMITE_HISTORICO);
}

/** Ajusta o extra (temporário) de um recurso, à mão. Sem mudança, devolve a mesma ficha. */
export function definirExtra(ficha: Ficha, recurso: Recurso, valor: number, agora = Date.now()): Ficha {
  if (!Number.isFinite(valor) || valor < 0) throw new ValorInvalido('O extra precisa ser um número maior ou igual a zero');
  const de = extraDe(ficha, recurso);
  if (de === valor) return ficha;
  const entrada: EntradaHistorico = { id: novoId(), recurso, tipo: 'extra', valor, efetivo: valor - de, em: agora };
  return {
    ...ficha,
    extras: { ...ficha.extras, [recurso]: valor },
    historico: registrar(ficha, [entrada]),
    atualizadoEm: agora,
  };
}

/**
 * Aplica dano (ou gasto) e cura (ou recuperação). Respeita o piso e o máximo de cada recurso.
 * Dano/gasto consome primeiro o extra (temporário); cura não mexe no extra.
 */
export function aplicar(
  ficha: Ficha,
  recurso: Recurso,
  tipo: TipoMudanca,
  valor: number,
  agora = Date.now(),
): Ficha {
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new ValorInvalido('Informe um número maior que zero');
  }
  const antes = ficha.atuais[recurso];
  const max = ficha.maximos[recurso];
  const extra = extraDe(ficha, recurso);
  let depois: number;
  let doExtra = 0;
  if (tipo === 'dano') {
    doExtra = Math.min(extra, valor);
    depois = Math.max(PISO[recurso], antes - (valor - doExtra));
  } else {
    // Cura nunca passa do máximo, mas também nunca reduz quem já está acima dele.
    depois = Math.max(antes, Math.min(max, antes + valor));
  }
  const entrada: EntradaHistorico = {
    id: novoId(),
    recurso,
    tipo,
    valor,
    efetivo: depois - antes,
    ...(doExtra > 0 ? { doExtra } : {}),
    em: agora,
  };
  return {
    ...ficha,
    atuais: { ...ficha.atuais, [recurso]: depois },
    ...(doExtra > 0 ? { extras: { ...ficha.extras, [recurso]: extra - doExtra } } : {}),
    historico: registrar(ficha, [entrada]),
    atualizadoEm: agora,
  };
}

/** Fração da Vida máxima recuperada no descanso longo. */
export const CURA_DESCANSO_LONGO = 0.5;

/**
 * Descanso longo: recupera 50% da Vida máxima (arredondado para o mais próximo, sem passar do
 * máximo — vale também a partir de Vida negativa) e enche Stamina e Mana. O extra não muda.
 * Cada recurso que subiu ganha uma linha no histórico.
 */
export function descansoLongo(ficha: Ficha, agora = Date.now()): Ficha {
  const { maximos, atuais } = ficha;
  const cura = Math.round(maximos.VIDA * CURA_DESCANSO_LONGO);
  const novos: Record<Recurso, number> = {
    VIDA: Math.max(atuais.VIDA, Math.min(maximos.VIDA, atuais.VIDA + cura)),
    STA: Math.max(atuais.STA, maximos.STA),
    MANA: Math.max(atuais.MANA, maximos.MANA),
  };
  // Ordem do histórico (mais nova primeiro): Vida aparece no topo.
  const entradas: EntradaHistorico[] = RECURSOS.filter((r) => novos[r] > atuais[r]).map((r) => ({
    id: novoId(),
    recurso: r,
    tipo: 'descanso',
    valor: novos[r] - atuais[r],
    efetivo: novos[r] - atuais[r],
    em: agora,
  }));
  return { ...ficha, atuais: novos, historico: registrar(ficha, entradas), atualizadoEm: agora };
}

const ROTULO_TIPO: Record<Recurso, Record<TipoMudanca, string>> = {
  VIDA: { dano: 'dano', cura: 'cura' },
  STA: { dano: 'gasto', cura: 'recuperou' },
  MANA: { dano: 'gasto', cura: 'recuperou' },
};

export function rotuloAcao(recurso: Recurso, tipo: TipoMudanca): string {
  return ROTULO_TIPO[recurso][tipo];
}

const num = (n: number) => n.toLocaleString('pt-BR');

/** Ex.: "−8 dano", "−8 dano (5 do extra)", "+5 cura", "−2 gasto", "+20 descanso longo", "extra 0 → 10". */
export function descreverEntrada(e: EntradaHistorico): string {
  switch (e.tipo) {
    case 'descanso':
      return `+${num(e.valor)} descanso longo`;
    case 'extra':
      return `extra ${num(e.valor - e.efetivo)} → ${num(e.valor)}`;
    case 'dano': {
      const detalhes = [e.origem, e.doExtra ? `${num(e.doExtra)} do extra` : ''].filter(Boolean).join(', ');
      return `−${num(e.valor)} ${rotuloAcao(e.recurso, e.tipo)}${detalhes ? ` (${detalhes})` : ''}`;
    }
    case 'cura':
      return `+${num(e.valor)} ${rotuloAcao(e.recurso, e.tipo)}`;
  }
}
