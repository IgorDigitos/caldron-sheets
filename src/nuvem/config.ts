// Configuração pública do app Web no Firebase. Não é segredo: vai dentro do app de qualquer jeito.
// Quem protege os dados são as regras em firestore.rules.

export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDRbalpy5frpIgKEfZH2bdpOtQz6nAjl7Y',
  authDomain: 'caldron-sheets.firebaseapp.com',
  projectId: 'caldron-sheets',
  storageBucket: 'caldron-sheets.firebasestorage.app',
  messagingSenderId: '287402428351',
  appId: '1:287402428351:web:a5db057f80e8f617dcc30a',
} as const;

/** Projeto usado com o Firebase Emulator (testes). "demo-" faz o SDK nunca tocar a nuvem real. */
export const PROJETO_EMULADOR = 'demo-caldron';

export const PORTAS_EMULADOR = { auth: 9099, firestore: 8080 } as const;

/** Build com `--mode emulador` (E2E) aponta para o emulador local. */
export const USAR_EMULADOR = import.meta.env.VITE_EMULADOR === '1';
