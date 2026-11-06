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

export interface EntradaHistorico {
  id: string;
  recurso: Recurso;
  tipo: TipoMudanca;
  /** Quanto o jogador pediu (sempre positivo). */
  valor: number;
  /** Quanto o recurso realmente mudou (ex.: cura limitada pelo máximo). */
  efetivo: number;
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
  historico: EntradaHistorico[];
  /** Histórico de mudanças de nível e atributos, mais nova primeiro. */
  alteracoes: EntradaAlteracao[];
  criadoEm: number;
  atualizadoEm: number;
}

export type ResultadoFicha = { ok: true; ficha: Ficha } | { ok: false; erros: ErroCampo[] };

/**
 * UUID v4. `crypto.randomUUID()` só existe em contexto seguro (HTTPS ou localhost); abrindo o
 * app pelo IP da rede (http://192.168.x.x) ele não existe, então montamos o UUID com
 * `getRandomValues`, que funciona em qualquer página.
 */
export function novoId(c: Pick<Crypto, 'getRandomValues'> & Partial<Pick<Crypto, 'randomUUID'>> = crypto): string {
  if (typeof c.randomUUID === 'function') return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40; // versão 4
  b[8] = (b[8]! & 0x3f) | 0x80; // variante RFC 4122
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

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

export class ValorInvalido extends Error {}

/** Aplica dano (ou gasto) e cura (ou recuperação). Respeita o piso e o máximo de cada recurso. */
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
  let depois: number;
  if (tipo === 'dano') {
    depois = Math.max(PISO[recurso], antes - valor);
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
    em: agora,
  };
  return {
    ...ficha,
    atuais: { ...ficha.atuais, [recurso]: depois },
    historico: [entrada, ...ficha.historico].slice(0, LIMITE_HISTORICO),
    atualizadoEm: agora,
  };
}

/** Volta todos os recursos para o máximo (descanso longo). */
export function restaurarTudo(ficha: Ficha, agora = Date.now()): Ficha {
  return {
    ...ficha,
    atuais: { VIDA: ficha.maximos.VIDA, STA: ficha.maximos.STA, MANA: ficha.maximos.MANA },
    atualizadoEm: agora,
  };
}

const ROTULO_TIPO: Record<Recurso, Record<TipoMudanca, string>> = {
  VIDA: { dano: 'dano', cura: 'cura' },
  STA: { dano: 'gasto', cura: 'recuperou' },
  MANA: { dano: 'gasto', cura: 'recuperou' },
};

export function rotuloAcao(recurso: Recurso, tipo: TipoMudanca): string {
  return ROTULO_TIPO[recurso][tipo];
}

/** Ex.: "−8 dano", "+5 cura", "−2 gasto". */
export function descreverEntrada(e: EntradaHistorico): string {
  const sinal = e.tipo === 'dano' ? '−' : '+';
  return `${sinal}${e.valor.toLocaleString('pt-BR')} ${rotuloAcao(e.recurso, e.tipo)}`;
}
