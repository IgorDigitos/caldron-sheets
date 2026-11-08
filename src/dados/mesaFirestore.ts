// Mesa no Firestore: `mesa` (todo mundo lê) e `mesaMestre` (só o Mestre). O bot Caldronis Dice
// escuta as duas coleções com a conta de serviço e preenche o resultado das rolagens.

import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import type { Canal, Mensagem } from '../dominio/mesa';
import { LIMITE_MESA, type RepositorioMesa } from './mesa';

export const COLECOES_MESA: Record<Canal, string> = { mesa: 'mesa', mestre: 'mesaMestre' };

export class MesaFirestore implements RepositorioMesa {
  constructor(
    private readonly db: Firestore,
    /** Escrita recusada pelo servidor (ex.: sem permissão) chega aqui, depois. */
    private readonly aoFalhar: (e: unknown) => void = () => {},
  ) {}

  enviar(canal: Canal, m: Mensagem): Promise<void> {
    const ref = doc(this.db, COLECOES_MESA[canal], m.id);
    // `recebidoEm` é a hora do SERVIDOR: o bot compara com `criadoEm` para não rolar pedido que
    // ficou parado na fila sem internet.
    setDoc(ref, { ...m, recebidoEm: serverTimestamp() }).catch(this.aoFalhar);
    // O SDK já mostra a mensagem para os ouvintes locais assim que ela entra no cache.
    return Promise.resolve();
  }

  observar(canal: Canal, ouvinte: (m: Mensagem[]) => void, erro?: (e: unknown) => void): () => void {
    const q = query(collection(this.db, COLECOES_MESA[canal]), orderBy('criadoEm', 'desc'), limit(LIMITE_MESA));
    return onSnapshot(
      q,
      (snap) =>
        ouvinte(
          snap.docs.map((d) => {
            const m = d.data() as Mensagem & { recebidoEm?: unknown };
            delete m.recebidoEm; // hora do servidor (Timestamp): só o bot usa
            return m;
          }),
        ),
      (e) => erro?.(e),
    );
  }

  apagar(canal: Canal, id: string): Promise<void> {
    deleteDoc(doc(this.db, COLECOES_MESA[canal], id)).catch(this.aoFalhar);
    return Promise.resolve();
  }
}
