import type { ComponentChildren } from 'preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { BoardTela } from './BoardTela';
import { ListaFichas } from './ListaFichas';
import { ContextoSessao, type InfoSessao } from './papel';
import { RepositorioMemoria } from '../dados/memoria';
import { CHAVE_SELECAO } from '../dominio/board';
import { aplicar, criarFicha, type Ficha } from '../dominio/ficha';
import { criarItem } from '../dominio/inventario';
import { SKAR } from '../rules/fixtures/skar';

const MESTRE: InfoSessao = { papel: 'mestre', uid: 'm', jogadores: [] };
const JOGADOR: InfoSessao = { papel: 'jogador', uid: 'j', jogadores: [] };
const com = (sessao: InfoSessao, filho: ComponentChildren) => (
  <ContextoSessao.Provider value={sessao}>{filho}</ContextoSessao.Provider>
);

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

async function montar() {
  const repo = new RepositorioMemoria();
  const skar: Ficha = criarFicha({ nome: 'Skar Lionet', raca: 'Humano', classe: 'Pugilista', ...structuredClone(SKAR) }, 1);
  const ogro = aplicar(criarFicha({ nome: 'Ogro', classe: 'Bruto' }, 2), 'VIDA', 'dano', 3, 3);
  await repo.salvar(skar);
  await repo.salvar(ogro);
  await repo.salvarItem(criarItem(skar.id, { nome: 'Couro', defF: 2, equipado: true }));
  render(com(MESTRE, <BoardTela repo={repo} />));
  await screen.findByRole('article', { name: 'Skar Lionet' });
  return { repo, skar, ogro };
}

const cartao = (nome: string) => screen.getByRole('article', { name: nome });

describe('BoardTela', () => {
  it('mostra todas as fichas em ordem alfabética, com recursos, atributos, status e histórico', async () => {
    await montar();
    expect(screen.getAllByRole('article').map((a) => within(a).getByRole('heading').textContent)).toEqual([
      'Ogro',
      'Skar Lionet',
    ]);
    const skar = cartao('Skar Lionet');
    expect(within(skar).getByText('Humano · Pugilista · Nível 2')).toBeTruthy();
    expect(within(skar).getByTestId('valor-VIDA').textContent).toBe('45 / 45');
    expect(within(skar).getByTestId('board-FOR').textContent).toBe('8');
    expect(within(skar).getByTestId('board-CAR').textContent).toBe('2');
    await waitFor(() => expect(within(skar).getByTestId('board-DEF_FISICA').textContent).toBe('9,5'));
    expect(within(skar).getByTestId('board-DEF_MAGICA').textContent).toBe('3,8');
    expect(within(skar).getByTestId('board-PA').textContent).toBe('4');
    expect(within(skar).getByTestId('board-CORPO').textContent).toBe('5');
    expect(within(skar).getByRole('link', { name: 'Abrir ficha' }).getAttribute('href')).toMatch(/^#\/ficha\//);
    expect(within(skar).getByText('Nada ainda.')).toBeTruthy();
    expect(within(cartao('Ogro')).getByText('−3 dano')).toBeTruthy();
    // Só valores: nada de rolar dado, descanso ou editar atributo/extra aqui.
    expect(screen.queryByRole('button', { name: /Descanso/ })).toBeNull();
    expect(screen.queryByLabelText(/Extra de/)).toBeNull();
    expect(screen.queryByText(/Rolagens/)).toBeNull();
  });

  it('dano num cartão atualiza só ele, registra no histórico e salva', async () => {
    const { repo, skar } = await montar();
    const c = cartao('Skar Lionet');
    fireEvent.input(within(c).getByLabelText('Quantidade de Vida'), { target: { value: '8' } });
    fireEvent.click(within(c).getByRole('button', { name: 'Dano' }));
    expect(within(c).getByTestId('valor-VIDA').textContent).toBe('37 / 45');
    expect(within(c).getByText('−8 dano')).toBeTruthy();
    expect(within(cartao('Ogro')).getByTestId('valor-VIDA').textContent).toBe('9 / 12');
    await waitFor(async () => expect((await repo.obter(skar.id))!.atuais.VIDA).toBe(37));
  });

  it('ao vivo: mudança vinda de fora (celular do jogador) aparece sem recarregar', async () => {
    const { repo, ogro } = await montar();
    await repo.salvar(aplicar(ogro, 'STA', 'dano', 4, 10));
    await waitFor(() => expect(within(cartao('Ogro')).getByTestId('valor-STA').textContent).toBe('4 / 8'));
    expect(within(cartao('Ogro')).getByText('−4 gasto')).toBeTruthy();
  });

  it('escolher fichas: desmarcar esconde o cartão e a escolha fica guardada neste aparelho', async () => {
    const { repo } = await montar();
    fireEvent.click(screen.getByText('Escolher fichas (2 de 2)'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ogro' }));
    expect(screen.queryByRole('article', { name: 'Ogro' })).toBeNull();
    expect(screen.getByText('Escolher fichas (1 de 2)')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(CHAVE_SELECAO)!)).toHaveLength(1);

    cleanup();
    render(com(MESTRE, <BoardTela repo={repo} />));
    await screen.findByRole('article', { name: 'Skar Lionet' });
    expect(screen.queryByRole('article', { name: 'Ogro' })).toBeNull();

    fireEvent.click(screen.getByText('Escolher fichas (1 de 2)'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Skar Lionet' }));
    expect(screen.getByText(/Nenhuma ficha escolhida/)).toBeTruthy();
  });

  it('sem fichas avisa', async () => {
    render(com(MESTRE, <BoardTela repo={new RepositorioMemoria()} />));
    expect(await screen.findByText('Nenhuma ficha ainda.')).toBeTruthy();
    expect(screen.queryByText(/Escolher fichas/)).toBeNull();
  });

  it('o link do board aparece na lista só para o Mestre', async () => {
    const repo = new RepositorioMemoria();
    render(com(MESTRE, <ListaFichas repo={repo} navegar={() => {}} />));
    expect((await screen.findByRole('link', { name: 'Board do Mestre' })).getAttribute('href')).toBe('#/board');
    cleanup();
    render(com(JOGADOR, <ListaFichas repo={repo} navegar={() => {}} />));
    await screen.findByText(/ainda não te deu/);
    expect(screen.queryByRole('link', { name: 'Board do Mestre' })).toBeNull();
  });
});
