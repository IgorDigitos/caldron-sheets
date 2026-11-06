import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { criarContaMestre, entrar, ErroConta, lerMestreUid, mensagemErro, sair } from './conta';
import type { Nuvem } from './firebase';
import { fecharNuvem, limparAuth, limparFirestore, novaNuvem } from './testeEmulador';

const abertas: Nuvem[] = [];
const nova = () => {
  const n = novaNuvem();
  abertas.push(n);
  return n;
};

beforeEach(async () => {
  await Promise.all([limparAuth(), limparFirestore()]);
});

afterEach(async () => {
  await Promise.all(abertas.splice(0).map(fecharNuvem));
});

describe('conta (emulador)', () => {
  it('campanha nova não tem Mestre; primeiro acesso cria e marca', async () => {
    const n = nova();
    expect(await lerMestreUid(n.db)).toBeNull();
    const user = await criarContaMestre(n.auth, n.db, 'Igor', 'segredo1');
    expect(user.email).toBe('igor@caldron-sheets.invalid');
    expect(await lerMestreUid(n.db)).toBe(user.uid);
  });

  it('não deixa criar um segundo Mestre', async () => {
    const a = nova();
    await criarContaMestre(a.auth, a.db, 'igor', 'segredo1');
    const b = nova();
    await expect(criarContaMestre(b.auth, b.db, 'outro', 'segredo2')).rejects.toThrow(
      'Esta campanha já tem um Mestre',
    );
  });

  it('mesmo que a checagem falhe, as regras recusam um segundo Mestre e a conta sai', async () => {
    const a = nova();
    await criarContaMestre(a.auth, a.db, 'igor', 'segredo1');
    // Simula a corrida: outro cliente que leu "sem Mestre" antes do primeiro terminar.
    const b = nova();
    const { createUserWithEmailAndPassword } = await import('firebase/auth');
    const { doc, setDoc } = await import('firebase/firestore');
    const cred = await createUserWithEmailAndPassword(b.auth, 'intruso@caldron-sheets.invalid', 'segredo3');
    await expect(setDoc(doc(b.db, 'campanha/config'), { mestreUid: cred.user.uid, criadoEm: 1 })).rejects.toMatchObject({
      code: 'permission-denied',
    });
    expect(await lerMestreUid(b.db)).not.toBe(cred.user.uid);
  });

  it('entrar com usuário e senha; senha errada dá mensagem clara', async () => {
    const a = nova();
    const mestre = await criarContaMestre(a.auth, a.db, 'igor', 'segredo1');
    await sair(a.auth);
    const user = await entrar(a.auth, ' IGOR ', 'segredo1');
    expect(user.uid).toBe(mestre.uid);
    await sair(a.auth);
    const erro = await entrar(a.auth, 'igor', 'errada').catch((e) => e);
    expect(mensagemErro(erro)).toBe('Usuário ou senha incorretos');
  });

  it('valida usuário e senha antes de ir ao servidor', async () => {
    const a = nova();
    await expect(criarContaMestre(a.auth, a.db, 'ab', 'segredo1')).rejects.toBeInstanceOf(ErroConta);
    await expect(criarContaMestre(a.auth, a.db, 'igor', '123')).rejects.toThrow('pelo menos 6');
  });
});
