// Mesma suíte de Dexie e memória, agora contra o Firestore do emulador, logado como Mestre.

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { RepositorioFirestore } from './firestore';
import { testarRepositorio } from './suiteRepositorio';
import { emailDoUsuario, mensagemErro } from '../nuvem/conta';
import type { Nuvem } from '../nuvem/firebase';
import { entrarComoMestre, fecharNuvem, limparAuth, limparFirestore, novaNuvem } from '../nuvem/testeEmulador';
import { aplicar, criarFicha } from '../dominio/ficha';
import { criarItem } from '../dominio/inventario';
import { SKAR } from '../rules/fixtures/skar';

const SENHA = 'senha-mestre';
const abertas: Nuvem[] = [];

beforeAll(async () => {
  await limparAuth();
  const n = novaNuvem();
  await createUserWithEmailAndPassword(n.auth, emailDoUsuario('mestre'), SENHA);
  await fecharNuvem(n);
});

afterEach(async () => {
  await Promise.all(abertas.splice(0).map(fecharNuvem));
});

afterAll(async () => {
  await limparFirestore();
});

/** Firestore vazio + cliente novo logado como Mestre. */
async function repoLimpo(): Promise<{ repo: RepositorioFirestore; nuvem: Nuvem }> {
  await limparFirestore();
  const nuvem = novaNuvem();
  abertas.push(nuvem);
  await entrarComoMestre(nuvem, 'mestre', SENHA);
  return { repo: new RepositorioFirestore(nuvem.db, mensagemErro), nuvem };
}

testarRepositorio('Firestore', async () => (await repoLimpo()).repo);

describe('Firestore — sincronização', () => {
  it('escrita devolve na hora e o pendente zera quando o servidor confirma', async () => {
    const { repo, nuvem } = await repoLimpo();
    const estados: number[] = [];
    repo.observar((e) => estados.push(e.pendentes));
    const f = criarFicha({ nome: 'Skar', ...SKAR });
    await repo.salvar(f);
    expect(repo.estado().pendentes).toBeGreaterThan(0);
    await repo.sincronizado();
    await new Promise((r) => setTimeout(r, 0));
    expect(repo.estado().pendentes).toBe(0);
    expect(estados).toContain(1);
    expect((await getDoc(doc(nuvem.db, 'personagens', f.id))).data()!.nome).toBe('Skar');
  });

  it('outro cliente (outro aparelho) vê a escrita', async () => {
    const { repo } = await repoLimpo();
    const f = aplicar(criarFicha({ nome: 'Skar', ...SKAR }), 'VIDA', 'dano', 8);
    await repo.salvar(f);
    await repo.sincronizado();

    const outro = novaNuvem();
    abertas.push(outro);
    await entrarComoMestreSemRecriar(outro);
    const repoB = new RepositorioFirestore(outro.db);
    expect((await repoB.obter(f.id))!.atuais.VIDA).toBe(37);
  });

  it('edição mais velha é recusada pelo servidor (última edição ganha) e vira erro de sync', async () => {
    const { repo } = await repoLimpo();
    const f = criarFicha({ nome: 'Skar', ...SKAR }, 1000);
    const nova = { ...aplicar(f, 'VIDA', 'dano', 5, 3000) };
    await repo.salvar(nova);
    await repo.sincronizado();

    const velha = aplicar(f, 'VIDA', 'dano', 10, 2000); // feita antes, chegando depois
    await repo.salvar(velha);
    await repo.sincronizado().catch(() => {});
    await new Promise((r) => setTimeout(r, 50));
    expect(repo.estado().erro).toBe('Sem permissão para isso');

    const outro = novaNuvem();
    abertas.push(outro);
    await entrarComoMestreSemRecriar(outro);
    expect((await new RepositorioFirestore(outro.db).obter(f.id))!.atuais.VIDA).toBe(40);

    repo.limparErro();
    expect(repo.estado().erro).toBeUndefined();
  });

  it('item sem atualizadoEm mais novo também segue a regra', async () => {
    const { repo } = await repoLimpo();
    const item = criarItem('f1', { nome: 'Corda' }, 5000);
    await repo.salvarItem(item);
    await repo.sincronizado();
    await repo.salvarItem({ ...item, qtd: 9, atualizadoEm: 4000 });
    await repo.sincronizado().catch(() => {});
    await new Promise((r) => setTimeout(r, 50));
    expect(repo.estado().erro).toBeDefined();
  });
});

async function entrarComoMestreSemRecriar(n: Nuvem) {
  const { signInWithEmailAndPassword } = await import('firebase/auth');
  await signInWithEmailAndPassword(n.auth, emailDoUsuario('mestre'), SENHA);
}
