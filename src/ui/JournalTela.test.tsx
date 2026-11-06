import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { JournalTela } from './JournalTela';
import { RepositorioMemoria } from '../dados/memoria';
import { criarFicha } from '../dominio/ficha';
import { criarEntrada, hojeISO } from '../dominio/journal';

afterEach(() => {
  vi.restoreAllMocks();
});

async function montar() {
  const repo = new RepositorioMemoria();
  const ficha = criarFicha({ nome: 'Skar Lionet' });
  await repo.salvar(ficha);
  render(<JournalTela repo={repo} id={ficha.id} />);
  await screen.findByRole('heading', { name: 'Skar Lionet' });
  return { repo, ficha };
}

const digitar = (rotulo: string, valor: string) => fireEvent.input(screen.getByLabelText(rotulo), { target: { value: valor } });

describe('JournalTela', () => {
  it('começa vazio', async () => {
    await montar();
    expect(screen.getByText('Nenhuma entrada ainda.')).toBeTruthy();
  });

  it('nova entrada já vem com a data de hoje e a próxima sessão', async () => {
    const { repo, ficha } = await montar();
    fireEvent.click(screen.getByRole('button', { name: 'Nova entrada' }));
    expect((screen.getByLabelText('Data') as HTMLInputElement).value).toBe(hojeISO());
    expect((screen.getByLabelText('Sessão') as HTMLInputElement).value).toBe('1');

    digitar('Título', 'Chegada a Vel');
    digitar('Texto', 'Skar derrubou o ogro\ncom um soco.');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar entrada' }));

    const lista = await screen.findByRole('list', { name: 'Entradas do journal' });
    expect(within(lista).getByRole('heading', { name: 'Chegada a Vel' })).toBeTruthy();
    expect(within(lista).getByText('Sessão 1')).toBeTruthy();
    expect(within(lista).getByText(/com um soco/)).toBeTruthy();
    expect(await repo.listarJournal(ficha.id)).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Nova entrada' }));
    expect((screen.getByLabelText('Sessão') as HTMLInputElement).value).toBe('2');
  });

  it('mais recente primeiro', async () => {
    const { repo, ficha } = await montar();
    await repo.salvarEntrada(criarEntrada(ficha.id, { titulo: 'Antiga', data: '2026-10-01' }));
    await repo.salvarEntrada(criarEntrada(ficha.id, { titulo: 'Nova', data: '2026-11-01' }));
    render(<JournalTela repo={repo} id={ficha.id} />);
    const lista = await screen.findByRole('list', { name: 'Entradas do journal' });
    expect(within(lista).getAllByRole('heading').map((h) => h.textContent)).toEqual(['Nova', 'Antiga']);
    expect(within(lista).getByText('01/11/2026')).toBeTruthy();
  });

  it('editar e excluir', async () => {
    const { repo, ficha } = await montar();
    await repo.salvarEntrada(criarEntrada(ficha.id, { titulo: 'Rascunho', data: '2026-11-01' }));
    render(<JournalTela repo={repo} id={ficha.id} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Rascunho' }));
    digitar('Título', 'Final');
    digitar('Sessão', '');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar entrada' }));
    expect(await screen.findByRole('heading', { name: 'Final' })).toBeTruthy();
    expect((await repo.listarJournal(ficha.id))[0]!.sessao).toBeUndefined();

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Editar Final' }));
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    await waitFor(async () => expect(await repo.listarJournal(ficha.id)).toEqual([]));
    // A primeira tela (montar) também mostra o aviso; esta é a segunda.
    expect(await screen.findAllByText('Nenhuma entrada ainda.')).toHaveLength(2);
  });

  it('entrada vazia mostra erro', async () => {
    await montar();
    fireEvent.click(screen.getByRole('button', { name: 'Nova entrada' }));
    fireEvent.submit(screen.getByRole('form', { name: 'Nova entrada' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Escreva um título ou um texto');
  });

  it('cancelar não salva', async () => {
    const { repo, ficha } = await montar();
    fireEvent.click(screen.getByRole('button', { name: 'Nova entrada' }));
    digitar('Título', 'Nada');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await repo.listarJournal(ficha.id)).toEqual([]);
    expect(screen.getByRole('button', { name: 'Nova entrada' })).toBeTruthy();
  });

  it('ficha inexistente', async () => {
    render(<JournalTela repo={new RepositorioMemoria()} id="nada" />);
    expect(await screen.findByText('Ficha não encontrada.')).toBeTruthy();
  });
});
