// Leva as fichas que estavam só neste aparelho (Dexie, etapas 2–3) para a nuvem.
// "Última edição ganha": se a nuvem já tem a mesma ficha mais nova, a do aparelho fica de fora.
// Os dados locais NÃO são apagados — continuam como cópia de segurança.

import type { RepositorioFichas } from '../dados/repositorio';

export interface ResultadoMigracao {
  enviadas: number;
  /** Já existiam na nuvem com edição igual ou mais nova. */
  ignoradas: number;
}

export async function migrar(origem: RepositorioFichas, destino: RepositorioFichas): Promise<ResultadoMigracao> {
  const resultado: ResultadoMigracao = { enviadas: 0, ignoradas: 0 };
  for (const resumo of await origem.listar()) {
    const naNuvem = await destino.obter(resumo.id);
    if (naNuvem && naNuvem.atualizadoEm >= resumo.atualizadoEm) {
      resultado.ignoradas++;
      continue;
    }
    const pacote = await origem.obterPacote(resumo.id);
    if (!pacote) continue;
    await destino.gravarPacote(pacote);
    resultado.enviadas++;
  }
  return resultado;
}

const chave = (uid: string) => `caldron:migracao-dispensada:${uid}`;

/** Lembra (por aparelho e conta) que a migração já foi feita ou dispensada. */
export function migracaoResolvida(uid: string, armazenamento: Pick<Storage, 'getItem'> = localStorage): boolean {
  try {
    return armazenamento.getItem(chave(uid)) === '1';
  } catch {
    return false;
  }
}

export function marcarMigracaoResolvida(uid: string, armazenamento: Pick<Storage, 'setItem'> = localStorage): void {
  try {
    armazenamento.setItem(chave(uid), '1');
  } catch {
    // Sem localStorage (modo privado): o aviso só volta a aparecer, nada se perde.
  }
}
