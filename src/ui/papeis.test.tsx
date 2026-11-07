// O que cada papel (Mestre x Jogador) vê e consegue editar nas telas.
// A segurança de verdade está nas regras (regrasJogador.nuvem.test.ts); aqui é a interface.

import type { ComponentChildren } from 'preact';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { FichaTela } from './FichaTela';
import { JogadoresTela } from './JogadoresTela';
import { ListaFichas } from './ListaFichas';
import { ContextoSessao, type InfoSessao } from './papel';
import { RepositorioMemoria } from '../dados/memoria';
import { criarFicha } from '../dominio/ficha';
import { SKAR } from '../rules/fixtures/skar';
import type { Conta } from '../nuvem/contas';

const THAINAN: Conta = { uid: 'u-thainan', usuario: 'thainan', papel: 'jogador', criadoEm: 1 };
const MESTRE: InfoSessao = { papel: 'mestre', uid: 'u-mestre', jogadores: [THAINAN] };
const JOGADOR: InfoSessao = { papel: 'jogador', uid: THAINAN.uid, jogadores: [] };

const com = (sessao: InfoSessao, filho: ComponentChildren) => (
  <ContextoSessao.Provider value={sessao}>{filho}</ContextoSessao.Provider>
);

async function fichaDoThainan() {
  const repo = new RepositorioMemoria();
  const ficha = { ...criarFicha({ nome: 'Skar Lionet', raca: 'Humano', ...SKAR }), donoUid: THAINAN.uid };
  await repo.salvar(ficha);
  return { repo, ficha };
}

describe('lista de fichas', () => {
  it('Mestre: vê o dono de cada ficha, botões de criar/importar/excluir e Jogadores', async () => {
    const { repo } = await fichaDoThainan();
    await repo.salvar(criarFicha({ nome: 'Ogro' }));
    render(com(MESTRE, <ListaFichas repo={repo} navegar={() => {}} />));
    expect(await screen.findByTestId('dono-Skar Lionet')).toHaveProperty('textContent', 'thainan');
    expect(screen.getByTestId('dono-Ogro').textContent).toBe('sem jogador');
    expect(screen.getByRole('button', { name: 'Nova ficha' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Excluir Skar Lionet' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Jogadores' }).getAttribute('href')).toBe('#/jogadores');
  });

  it('Jogador: só a ficha, sem criar, importar, excluir nem Jogadores', async () => {
    const { repo } = await fichaDoThainan();
    render(com(JOGADOR, <ListaFichas repo={repo} navegar={() => {}} />));
    expect(await screen.findByRole('link', { name: /Skar Lionet/ })).toBeTruthy();
    for (const nome of ['Nova ficha', 'Criar Skar de exemplo', 'Excluir Skar Lionet']) {
      expect(screen.queryByRole('button', { name: nome })).toBeNull();
    }
    expect(screen.queryByLabelText('Importar backup (JSON)')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Jogadores' })).toBeNull();
    expect(screen.queryByTestId('dono-Skar Lionet')).toBeNull();
  });

  it('Jogador sem ficha recebe um aviso claro', async () => {
    render(com(JOGADOR, <ListaFichas repo={new RepositorioMemoria()} navegar={() => {}} />));
    expect(await screen.findByText('O Mestre ainda não te deu nenhuma ficha.')).toBeTruthy();
  });
});

describe('ficha', () => {
  it('Jogador: não edita nome, raça, classe, nível nem base; edita extra e perda', async () => {
    const { repo, ficha } = await fichaDoThainan();
    render(com(JOGADOR, <FichaTela repo={repo} id={ficha.id} />));
    await screen.findByRole('heading', { name: 'Skar Lionet' });
    expect(screen.getByText('Atributos')).toBeTruthy(); // título do bloco para o jogador
    for (const rotulo of ['Nome', 'Raça', 'Classe', 'Nível', 'Jogador', 'Força base']) {
      expect(screen.queryByLabelText(rotulo)).toBeNull();
    }
    expect(screen.getByTestId('base-FOR').textContent).toBe('8');

    fireEvent.change(screen.getByLabelText('Constituição extra'), { target: { value: '2' } });
    expect(screen.getByTestId('valor-VIDA').textContent).toBe('45 / 56');
    await waitFor(async () => expect((await repo.obter(ficha.id))!.atributos.CON).toEqual({ base: 5, extra: 2 }));
  });

  it('Jogador continua com dano, cura, extra de recurso e descanso', async () => {
    const { repo, ficha } = await fichaDoThainan();
    render(com(JOGADOR, <FichaTela repo={repo} id={ficha.id} />));
    await screen.findByRole('heading', { name: 'Skar Lionet' });
    const vida = screen.getByRole('region', { name: 'Vida' });
    expect(within(vida).getByRole('button', { name: 'Dano' })).toBeTruthy();
    expect(within(vida).getByLabelText('Extra de Vida')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Descanso longo' })).toBeTruthy();
  });

  it('Mestre escolhe o jogador dono da ficha (ou ninguém)', async () => {
    const repo = new RepositorioMemoria();
    const ficha = criarFicha({ nome: 'Skar Lionet', ...SKAR });
    await repo.salvar(ficha);
    render(com(MESTRE, <FichaTela repo={repo} id={ficha.id} />));
    await screen.findByRole('heading', { name: 'Skar Lionet' });
    const dono = screen.getByLabelText('Jogador') as HTMLSelectElement;
    expect(dono.value).toBe('');
    fireEvent.change(dono, { target: { value: THAINAN.uid } });
    await waitFor(async () => expect((await repo.obter(ficha.id))!.donoUid).toBe(THAINAN.uid));
    fireEvent.change(dono, { target: { value: '' } });
    await waitFor(async () => expect('donoUid' in (await repo.obter(ficha.id))!).toBe(false));
  });
});

describe('tela de jogadores', () => {
  it('lista as contas e cria uma nova', async () => {
    const criarJogador = vi.fn(async (usuario: string) => ({ ...THAINAN, uid: 'novo', usuario }));
    render(com({ ...MESTRE, criarJogador }, <JogadoresTela />));
    expect(screen.getByText('thainan')).toBeTruthy();
    const form = screen.getByRole('form', { name: 'Nova conta de jogador' });
    fireEvent.input(within(form).getByLabelText('Usuário'), { target: { value: 'joao' } });
    fireEvent.input(within(form).getByLabelText('Senha'), { target: { value: 'segredo1' } });
    fireEvent.input(within(form).getByLabelText('Confirmar senha'), { target: { value: 'segredo1' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Criar conta de jogador' }));
    expect(await screen.findByRole('status')).toHaveProperty(
      'textContent',
      'Conta "joao" criada. Passe o usuário e a senha para o jogador.',
    );
    expect(criarJogador).toHaveBeenCalledWith('joao', 'segredo1');
  });

  it('senhas diferentes e erro do servidor aparecem', async () => {
    const criarJogador = vi.fn(async () => {
      throw Object.assign(new Error('x'), { code: 'auth/email-already-in-use' });
    });
    render(com({ ...MESTRE, jogadores: [], criarJogador }, <JogadoresTela />));
    expect(screen.getByText('Nenhum jogador ainda.')).toBeTruthy();
    const form = screen.getByRole('form', { name: 'Nova conta de jogador' });
    fireEvent.input(within(form).getByLabelText('Usuário'), { target: { value: 'joao' } });
    fireEvent.input(within(form).getByLabelText('Senha'), { target: { value: 'segredo1' } });
    fireEvent.input(within(form).getByLabelText('Confirmar senha'), { target: { value: 'outra' } });
    fireEvent.submit(form);
    expect((await screen.findByRole('alert')).textContent).toBe('As senhas não são iguais');
    fireEvent.input(within(form).getByLabelText('Confirmar senha'), { target: { value: 'segredo1' } });
    fireEvent.submit(form);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Esse usuário já existe'));
  });
});
