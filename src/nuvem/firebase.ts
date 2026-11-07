import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { FIREBASE_CONFIG, PORTAS_EMULADOR, PROJETO_EMULADOR } from './config';

export interface Nuvem {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

export interface OpcoesNuvem {
  emulador: boolean;
  /**
   * Cache no IndexedDB: é o que deixa o app abrir e editar sem internet e mandar as mudanças quando
   * a rede volta. Testes em Node usam memória.
   */
  persistente: boolean;
  /** Nome do app Firebase (testes criam vários). */
  nome?: string;
}

export function iniciarNuvem({ emulador, persistente, nome }: OpcoesNuvem): Nuvem {
  const config = emulador ? { apiKey: 'demo-key', projectId: PROJETO_EMULADOR, appId: 'demo-app' } : FIREBASE_CONFIG;
  const app = initializeApp(config, nome);
  const db = initializeFirestore(app, {
    localCache: persistente ? persistentLocalCache({ tabManager: persistentMultipleTabManager() }) : memoryLocalCache(),
    ignoreUndefinedProperties: true,
  });
  const auth = getAuth(app);
  if (emulador) {
    connectFirestoreEmulator(db, '127.0.0.1', PORTAS_EMULADOR.firestore);
    connectAuthEmulator(auth, `http://127.0.0.1:${PORTAS_EMULADOR.auth}`, { disableWarnings: true });
  }
  return { app, auth, db };
}
