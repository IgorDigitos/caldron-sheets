// Contas de jogador: o Mestre cria (usuário e senha) e escolhe de quem é cada ficha.

import { deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { collection, doc, getDoc, getDocFromCache, getDocs, setDoc, type Firestore } from 'firebase/firestore';
import { emailDoUsuario, validarSenha } from './conta';
import type { Nuvem } from './firebase';

export type Papel = 'mestre' | 'jogador';

export interface Conta {
  uid: string;
  usuario: string;
  papel: 'jogador';
  criadoEm: number;
}

export const COLECAO_USUARIOS = 'usuarios';

/**
 * Cria a conta de um jogador SEM deslogar o Mestre: usa uma segunda instância do Firebase só para
 * o cadastro, e grava `usuarios/{uid}` (só o Mestre pode) para marcar o papel.
 */
export async function criarJogador(nuvem: Nuvem, usuario: string, senha: string): Promise<Conta> {
  const email = emailDoUsuario(usuario);
  validarSenha(senha);
  const auxiliar = initializeApp(nuvem.app.options, `cadastro-${Date.now()}`);
  try {
    const auth = getAuth(auxiliar);
    const emulador = nuvem.auth.emulatorConfig;
    if (emulador) connectAuthEmulator(auth, `${emulador.protocol}://${emulador.host}:${emulador.port}`, { disableWarnings: true });
    const cred = await createUserWithEmailAndPassword(auth, email, senha);
    await signOut(auth);
    const conta: Conta = { uid: cred.user.uid, usuario: usuario.trim().toLowerCase(), papel: 'jogador', criadoEm: Date.now() };
    const { uid, ...dados } = conta;
    await setDoc(doc(nuvem.db, COLECAO_USUARIOS, uid), dados);
    return conta;
  } finally {
    await deleteApp(auxiliar);
  }
}

export async function listarJogadores(db: Firestore): Promise<Conta[]> {
  const snap = await getDocs(collection(db, COLECAO_USUARIOS));
  return snap.docs
    .map((d) => ({ uid: d.id, ...(d.data() as Omit<Conta, 'uid'>) }))
    .sort((a, b) => a.usuario.localeCompare(b.usuario, 'pt-BR'));
}

/** Papel de uma conta que não é a do Mestre: 'jogador' ou null (sem acesso). Sem rede, usa o cache. */
export async function lerPapelJogador(db: Firestore, uid: string): Promise<'jogador' | null> {
  const ref = doc(db, COLECAO_USUARIOS, uid);
  const semRede = typeof navigator !== 'undefined' && navigator.onLine === false;
  let snap;
  try {
    snap = semRede ? await getDocFromCache(ref) : await getDoc(ref);
  } catch {
    snap = await getDocFromCache(ref).catch(() => null);
  }
  return snap?.exists() && snap.data().papel === 'jogador' ? 'jogador' : null;
}
