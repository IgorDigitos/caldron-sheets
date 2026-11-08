// Descanso curto: Vida recupera 2dCON, Stamina 3dCORPO e Mana 2dMENTE (valores atuais).
//
// Quem rola é o bot (pela Mesa, aparece no Discord). O app manda uma rolagem por recurso
// ("2d5 Vida") com o campo `descanso` e, quando o resultado volta, soma no recurso. Corpo e Mente
// têm casas decimais: o tamanho do dado é arredondado para o mais próximo (,5 sobe).

import { LIMITE_HISTORICO, NOMES_RECURSOS, novoId, type EntradaHistorico, type Ficha, type Recurso } from './ficha';
import { valorAtual } from '../rules/caldronis';

export interface DadoDescanso {
  recurso: Recurso;
  qtd: number;
  faces: number;
}

/** Quantos dados de cada recurso e de onde vem o tamanho do dado. */
const REGRA: Record<Recurso, { qtd: number; faces: (f: Ficha) => number }> = {
  VIDA: { qtd: 2, faces: (f) => valorAtual(f.atributos.CON) },
  STA: { qtd: 3, faces: (f) => f.maximos.CORPO },
  MANA: { qtd: 2, faces: (f) => f.maximos.MENTE },
};

const ORDEM: Recurso[] = ['VIDA', 'STA', 'MANA'];

/** Dados do descanso curto. Fica de fora o recurso cheio ou com dado menor que d1. */
export function dadosDescansoCurto(ficha: Ficha): DadoDescanso[] {
  return ORDEM.flatMap((recurso) => {
    const { qtd, faces } = REGRA[recurso];
    const lados = Math.round(faces(ficha));
    if (!(lados >= 1) || ficha.atuais[recurso] >= ficha.maximos[recurso]) return [];
    return [{ recurso, qtd, faces: lados }];
  });
}

export function expressao(d: DadoDescanso): string {
  return `${d.qtd}d${d.faces}`;
}

/** O que vai para a Mesa: começa com o dado (o bot só rola assim) e o resto é comentário. */
export function textoRolagem(d: DadoDescanso): string {
  return `${expressao(d)} ${NOMES_RECURSOS[d.recurso]} (descanso curto)`;
}

export function jaAplicada(ficha: Ficha, rolagemId: string): boolean {
  return ficha.historico.some((e) => e.rolagem === rolagemId);
}

/**
 * Soma o resultado do bot no recurso (sem passar do máximo; a partir de Vida negativa também vale).
 * Registra no histórico com o id da rolagem: a mesma rolagem nunca é aplicada duas vezes.
 */
export function aplicarDescansoCurto(
  ficha: Ficha,
  recurso: Recurso,
  total: number,
  rolagemId: string,
  dados: string,
  agora = Date.now(),
): Ficha {
  if (jaAplicada(ficha, rolagemId) || !Number.isFinite(total)) return ficha;
  const valor = Math.max(0, Math.round(total));
  const antes = ficha.atuais[recurso];
  const depois = Math.max(antes, Math.min(ficha.maximos[recurso], antes + valor));
  const entrada: EntradaHistorico = {
    id: novoId(),
    recurso,
    tipo: 'descansoCurto',
    valor,
    efetivo: depois - antes,
    origem: dados,
    rolagem: rolagemId,
    em: agora,
  };
  return {
    ...ficha,
    atuais: { ...ficha.atuais, [recurso]: depois },
    historico: [entrada, ...ficha.historico].slice(0, LIMITE_HISTORICO),
    atualizadoEm: agora,
  };
}
