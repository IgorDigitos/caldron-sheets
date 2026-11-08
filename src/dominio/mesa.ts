// Mesa: mensagens e rolagens da campanha. Quem rola é o bot Caldronis Dice, no PC do Mestre.
//
// O app grava um pedido (mensagem com `estado: 'pendente'`); o bot reserva, rola com o motor dele,
// grava o resultado e posta no Discord pelo webhook (canal da mesa ou canal do Mestre). O app nunca
// sorteia nem envia resultado: só pede.

import type { Recurso } from './ficha';
import { novoId } from './id';

/** `mesa`: todo mundo vê, vai para o canal da campanha. `mestre`: só o Mestre, canal secreto. */
export type Canal = 'mesa' | 'mestre';

export type EstadoRolagem = 'pendente' | 'rolando' | 'feita' | 'erro' | 'expirada';

export interface Mensagem {
  id: string;
  autorUid: string;
  /** Personagem que fala/rola. Sem ficha = o próprio Mestre. */
  fichaId?: string;
  /** Nome exibido (nome do personagem ou "Mestre"). */
  nome: string;
  texto: string;
  tipo: 'texto' | 'rolagem';
  /** Hora do aparelho que enviou. */
  criadoEm: number;
  /** Rolagem de descanso curto: o resultado recupera este recurso da ficha `fichaId`. */
  descanso?: Recurso;
  // ----- preenchido pelo bot (rolagens) -----
  estado?: EstadoRolagem;
  /** Resposta formatada do bot, a mesma que vai para o Discord (pode ter **negrito** e `código`). */
  resultado?: string[];
  /** Total de cada rolagem (várias com N#). */
  totais?: number[];
  erro?: string;
  discord?: 'enviado' | 'falhou';
}

/** Mesmo limite do bot (MAX_INPUT). */
export const MAX_TEXTO = 1000;
export const NOME_MESTRE = 'Mestre';

// Igual ao START do bot (dice/parser.py): a mensagem só é rolagem se COMEÇAR pela expressão.
// "d30+3" rola; "quero rolar d30+3" é só texto.
const INICIO_ROLAGEM = /^(?:[0-9]+#|#[0-9]*d[0-9]+|[0-9]*d[0-9]+)/i;

export function ehRolagem(texto: string): boolean {
  return INICIO_ROLAGEM.test(texto.slice(0, MAX_TEXTO + 1).trimStart());
}

export class MensagemInvalida extends Error {}

export function criarMensagem(
  dados: { texto: string; autorUid: string; nome: string; fichaId?: string; descanso?: Recurso },
  agora: number = Date.now(),
): Mensagem {
  const texto = dados.texto.trim();
  if (!texto) throw new MensagemInvalida('Escreva alguma coisa.');
  if (texto.length > MAX_TEXTO) throw new MensagemInvalida(`Máximo de ${MAX_TEXTO} caracteres.`);
  const rolagem = ehRolagem(texto);
  return {
    id: novoId(),
    autorUid: dados.autorUid,
    ...(dados.fichaId ? { fichaId: dados.fichaId } : {}),
    nome: dados.nome.trim().slice(0, 60) || NOME_MESTRE,
    texto,
    tipo: rolagem ? 'rolagem' : 'texto',
    criadoEm: agora,
    ...(rolagem ? { estado: 'pendente' as const } : {}),
    ...(rolagem && dados.descanso && dados.fichaId ? { descanso: dados.descanso } : {}),
  };
}

/** Rolagem rápida de atributo (d30 + atributo atual, como na mesa). */
export function rolagemDeAtributo(sigla: string): string {
  return `d30+${sigla}`;
}

/** A coluna ATK/MOD da skill vira rolagem se começar com dado (ex.: "2d4+FOR"). */
export function rolagemDeSkill(atkMod: string, nome: string): string | undefined {
  const expr = atkMod.trim();
  if (!ehRolagem(expr)) return undefined;
  return `${expr} ${nome}`.slice(0, MAX_TEXTO);
}

export function descreverEstado(m: Mensagem): string | undefined {
  if (m.tipo !== 'rolagem') return undefined;
  switch (m.estado) {
    case 'pendente':
    case 'rolando':
      return 'Aguardando o bot…';
    case 'expirada':
      return m.erro ?? 'Não foi rolada.';
    case 'erro':
      return m.erro ?? 'Não foi possível rolar.';
    case 'feita':
      return m.discord === 'falhou' ? 'Rolada, mas não chegou ao Discord.' : undefined;
    default:
      return undefined;
  }
}

export type Trecho = { tipo: 'texto' | 'negrito' | 'codigo'; texto: string };

/** Lê o Markdown simples que o bot usa (**negrito** e `código`) sem usar HTML. */
export function trechos(linha: string): Trecho[] {
  const saida: Trecho[] = [];
  const re = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let ultimo = 0;
  for (let m = re.exec(linha); m; m = re.exec(linha)) {
    if (m.index > ultimo) saida.push({ tipo: 'texto', texto: linha.slice(ultimo, m.index) });
    saida.push(m[1] !== undefined ? { tipo: 'negrito', texto: m[1] } : { tipo: 'codigo', texto: m[2]! });
    ultimo = re.lastIndex;
  }
  if (ultimo < linha.length) saida.push({ tipo: 'texto', texto: linha.slice(ultimo) });
  // O bot escapa Markdown no comentário (\* \_ …); na tela, mostra o caractere.
  return saida.map((t) => (t.tipo === 'texto' ? { ...t, texto: t.texto.replace(/\\([*_~`|>\\])/g, '$1') } : t));
}
