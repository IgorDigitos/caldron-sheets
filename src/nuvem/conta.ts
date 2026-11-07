// Login com usuário e senha criados pelo Mestre. O Firebase exige e-mail, então "thainan" vira
// "thainan@caldron-sheets.invalid" — domínio reservado (RFC 2606), que não existe e nunca recebe e-mail.

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import { doc, getDoc, getDocFromCache, setDoc, type Firestore } from 'firebase/firestore';

export const DOMINIO_USUARIOS = 'caldron-sheets.invalid';
export const CAMINHO_CAMPANHA = 'campanha/config';

export class ErroConta extends Error {}

export function emailDoUsuario(usuario: string): string {
  const u = usuario.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(u)) {
    throw new ErroConta('Usuário precisa ter de 3 a 30 letras sem acento, números, ponto, hífen ou _ (sem espaço)');
  }
  return `${u}@${DOMINIO_USUARIOS}`;
}

export function usuarioDoEmail(email: string | null | undefined): string {
  return (email ?? '').split('@')[0] ?? '';
}

export function validarSenha(senha: string): void {
  if (senha.length < 6) throw new ErroConta('A senha precisa de pelo menos 6 caracteres');
}

const MENSAGENS: Record<string, string> = {
  'auth/invalid-credential': 'Usuário ou senha incorretos',
  'auth/wrong-password': 'Usuário ou senha incorretos',
  'auth/user-not-found': 'Usuário ou senha incorretos',
  'auth/invalid-email': 'Usuário inválido',
  'auth/email-already-in-use': 'Esse usuário já existe',
  'auth/weak-password': 'A senha precisa de pelo menos 6 caracteres',
  'auth/too-many-requests': 'Muitas tentativas. Espere um pouco e tente de novo',
  'auth/network-request-failed': 'Sem internet. O primeiro login precisa de conexão',
  'auth/user-disabled': 'Esta conta foi desativada',
  'permission-denied': 'Sem permissão para isso',
  unavailable: 'Sem conexão com o servidor',
};

/** Mensagem em português para erros do Firebase (e repassa as nossas). */
export function mensagemErro(e: unknown): string {
  if (e instanceof ErroConta) return e.message;
  const codigo = (e as { code?: string })?.code;
  if (codigo && MENSAGENS[codigo]) return MENSAGENS[codigo];
  return (e as Error)?.message || 'Erro desconhecido';
}

export async function entrar(auth: Auth, usuario: string, senha: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, emailDoUsuario(usuario), senha);
  return cred.user;
}

export function sair(auth: Auth): Promise<void> {
  return signOut(auth);
}

/**
 * Uid do Mestre da campanha, ou null se ainda não há Mestre. Sem rede, usa o que ficou no cache.
 */
export async function lerMestreUid(db: Firestore): Promise<string | null> {
  const ref = doc(db, CAMINHO_CAMPANHA);
  let snap;
  try {
    // `=== false`: no Node existe `navigator`, mas sem `onLine` (undefined não é "offline").
    const semRede = typeof navigator !== 'undefined' && navigator.onLine === false;
    snap = semRede ? await getDocFromCache(ref) : await getDoc(ref);
  } catch {
    snap = await getDocFromCache(ref);
  }
  return snap.exists() ? ((snap.data().mestreUid as string) ?? null) : null;
}

/**
 * Primeiro acesso: cria a conta do Mestre e marca a campanha como dele. Só funciona uma vez —
 * as regras recusam criar `campanha/config` se ela já existe.
 */
export async function criarContaMestre(auth: Auth, db: Firestore, usuario: string, senha: string): Promise<User> {
  const email = emailDoUsuario(usuario);
  validarSenha(senha);
  if (await lerMestreUid(db)) throw new ErroConta('Esta campanha já tem um Mestre');
  const cred = await createUserWithEmailAndPassword(auth, email, senha);
  try {
    await setDoc(doc(db, CAMINHO_CAMPANHA), { mestreUid: cred.user.uid, criadoEm: Date.now() });
  } catch (e) {
    await signOut(auth);
    throw e;
  }
  return cred.user;
}
