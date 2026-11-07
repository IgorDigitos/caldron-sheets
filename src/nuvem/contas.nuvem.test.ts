import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { criarContaMestre, emailDoUsuario } from './conta';
import { criarJogador, lerPapelJogador, listarJogadores } from './contas';
import type { Nuvem } from './firebase';
import { fecharNuvem, limparAuth, limparFirestore, novaNuvem } from './testeEmulador';
import { RepositorioFirestore } from '../dados/firestore';
import { aplicar, criarFicha } from '../dominio/ficha';
import { SKAR } from '../rules/fixtures/skar';

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

describe('contas de jogador (emulador)', () => {
  it('Mestre cria um jogador e continua logado como Mestre', async () => {
    const m = nova();
    const mestre = await criarContaMestre(m.auth, m.db, 'igor', 'segredo1');
    const conta = await criarJogador(m, 'Thainan', 'senha-thainan');
    expect(conta.usuario).toBe('thainan');
    expect(m.auth.currentUser?.uid).toBe(mestre.uid);
    expect((await listarJogadores(m.db)).map((j) => j.usuario)).toEqual(['thainan']);
  });

  it('o jogador entra, é reconhecido como jogador e só vê a ficha dele', async () => {
    const m = nova();
    await criarContaMestre(m.auth, m.db, 'igor', 'segredo1');
    const thainan = await criarJogador(m, 'thainan', 'senha-thainan');
    const repoMestre = new RepositorioFirestore(m.db);
    const skar = { ...criarFicha({ nome: 'Skar', ...SKAR }), donoUid: thainan.uid };
    await repoMestre.salvar(skar);
    await repoMestre.salvar(criarFicha({ nome: 'Ogro do Mestre' }));
    await repoMestre.sincronizado();

    const j = nova();
    const cred = await signInWithEmailAndPassword(j.auth, emailDoUsuario('thainan'), 'senha-thainan');
    expect(await lerPapelJogador(j.db, cred.user.uid)).toBe('jogador');

    const repoJogador = new RepositorioFirestore(j.db, undefined, { donoUid: cred.user.uid });
    expect((await repoJogador.listar()).map((f) => f.nome)).toEqual(['Skar']);

    // O jogador toma dano e o Mestre vê.
    await repoJogador.salvar(aplicar((await repoJogador.obter(skar.id))!, 'VIDA', 'dano', 8));
    await repoJogador.sincronizado();
    expect((await repoMestre.obter(skar.id))!.atuais.VIDA).toBe(37);
  });

  it('conta sem papel (ninguém criou) não é jogador', async () => {
    const m = nova();
    await criarContaMestre(m.auth, m.db, 'igor', 'segredo1');
    const x = nova();
    const { createUserWithEmailAndPassword } = await import('firebase/auth');
    const cred = await createUserWithEmailAndPassword(x.auth, 'qualquer@caldron-sheets.invalid', 'segredo9');
    expect(await lerPapelJogador(x.db, cred.user.uid)).toBeNull();
  });

  it('usuário repetido dá erro claro', async () => {
    const m = nova();
    await criarContaMestre(m.auth, m.db, 'igor', 'segredo1');
    await criarJogador(m, 'thainan', 'senha-thainan');
    await expect(criarJogador(m, 'thainan', 'outra-senha')).rejects.toMatchObject({ code: 'auth/email-already-in-use' });
  });
});
