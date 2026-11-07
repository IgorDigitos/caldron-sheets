// Quem está usando o app (Mestre ou Jogador) e as contas de jogador, para as telas decidirem o que
// mostrar. Quem protege de verdade são as regras do Firestore; isto é só a interface.

import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { Conta, Papel } from '../nuvem/contas';

export interface InfoSessao {
  papel: Papel;
  uid?: string;
  /** Contas de jogador (só o Mestre recebe). */
  jogadores: Conta[];
  criarJogador?: (usuario: string, senha: string) => Promise<Conta>;
}

/** Sem sessão (testes e modo local) = Mestre: pode tudo. */
export const SESSAO_PADRAO: InfoSessao = { papel: 'mestre', jogadores: [] };

export const ContextoSessao = createContext<InfoSessao>(SESSAO_PADRAO);

export function useSessao(): InfoSessao {
  return useContext(ContextoSessao);
}

export function nomeDoJogador(jogadores: Conta[], uid: string | undefined): string | undefined {
  return uid ? jogadores.find((j) => j.uid === uid)?.usuario : undefined;
}
