// Ajudantes para testes que rodam contra o Firebase Emulator (npm run test:nuvem).

import { deleteApp } from 'firebase/app';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, waitForPendingWrites } from 'firebase/firestore';
import { PORTAS_EMULADOR, PROJETO_EMULADOR } from './config';
import { CAMINHO_CAMPANHA, emailDoUsuario } from './conta';
import { iniciarNuvem, type Nuvem } from './firebase';

const BASE_FS = `http://127.0.0.1:${PORTAS_EMULADOR.firestore}/emulator/v1/projects/${PROJETO_EMULADOR}`;
const BASE_AUTH = `http://127.0.0.1:${PORTAS_EMULADOR.auth}/emulator/v1/projects/${PROJETO_EMULADOR}`;

/** Apaga tudo do Firestore do emulador. Tenta de novo se ainda houver escrita em andamento (409). */
export async function limparFirestore(): Promise<void> {
  for (let tentativa = 0; ; tentativa++) {
    const r = await fetch(`${BASE_FS}/databases/(default)/documents`, { method: 'DELETE' });
    if (r.ok) return;
    if (r.status !== 409 || tentativa >= 10) throw new Error(`Falha ao limpar o Firestore do emulador: ${r.status}`);
    await new Promise((ok) => setTimeout(ok, 100 * (tentativa + 1)));
  }
}

export async function limparAuth(): Promise<void> {
  const r = await fetch(`${BASE_AUTH}/accounts`, { method: 'DELETE' });
  if (!r.ok) throw new Error(`Falha ao limpar o Auth do emulador: ${r.status}`);
}

let contador = 0;

export function novaNuvem(): Nuvem {
  return iniciarNuvem({ emulador: true, persistente: false, nome: `teste-${++contador}-${Date.now()}` });
}

/** Espera as escritas pendentes (no máximo 5s) e fecha o cliente. */
export async function fecharNuvem(n: Nuvem): Promise<void> {
  await Promise.race([waitForPendingWrites(n.db).catch(() => {}), new Promise((ok) => setTimeout(ok, 5000))]);
  await deleteApp(n.app);
}

/** Loga uma conta já existente e marca como Mestre da campanha (Firestore precisa estar limpo). */
export async function entrarComoMestre(n: Nuvem, usuario: string, senha: string): Promise<string> {
  const cred = await signInWithEmailAndPassword(n.auth, emailDoUsuario(usuario), senha);
  await setDoc(doc(n.db, CAMINHO_CAMPANHA), { mestreUid: cred.user.uid, criadoEm: Date.now() });
  return cred.user.uid;
}
