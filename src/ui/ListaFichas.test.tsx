import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { ListaFichas } from './ListaFichas';
import { RepositorioMemoria } from '../dados/memoria';
import { criarFicha } from '../dominio/ficha';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ListaFichas', () => {
  it('Nova ficha cria, salva e navega', async () => {
    const repo = new RepositorioMemoria();
    const navegar = vi.fn();
    render(<ListaFichas repo={repo} navegar={navegar} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Nova ficha' }));
    await waitFor(() => expect(navegar).toHaveBeenCalled());
    const [resumo] = await repo.listar();
    expect(resumo!.nome).toBe('Novo personagem');
    expect(navegar).toHaveBeenCalledWith(`/ficha/${resumo!.id}`);
  });

  it('lista com raça, classe e nível', async () => {
    const repo = new RepositorioMemoria();
    await repo.salvar(criarFicha({ nome: 'Skar', raca: 'Humano', classe: 'Pugilista', nivel: 2 }));
    render(<ListaFichas repo={repo} navegar={() => {}} />);
    expect(await screen.findByText('Humano · Pugilista · Nível 2')).toBeTruthy();
  });

  it('se criar falhar, o erro aparece na tela em vez de não fazer nada', async () => {
    const repo = new RepositorioMemoria();
    vi.spyOn(repo, 'salvar').mockRejectedValue(new Error('banco travado'));
    const navegar = vi.fn();
    render(<ListaFichas repo={repo} navegar={navegar} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Criar Skar de exemplo' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Não foi possível criar a ficha: banco travado');
    expect(navegar).not.toHaveBeenCalled();
  });

  it('se listar falhar, o erro aparece na tela', async () => {
    const repo = new RepositorioMemoria();
    vi.spyOn(repo, 'listar').mockRejectedValue(new Error('sem acesso ao armazenamento'));
    render(<ListaFichas repo={repo} navegar={() => {}} />);
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Não foi possível carregar as fichas: sem acesso ao armazenamento',
    );
  });

  it('excluir pede confirmação', async () => {
    const repo = new RepositorioMemoria();
    await repo.salvar(criarFicha({ nome: 'Skar' }));
    render(<ListaFichas repo={repo} navegar={() => {}} />);

    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir Skar' }));
    expect(confirmar).toHaveBeenCalledWith('Excluir a ficha de Skar? Isso não pode ser desfeito.');
    expect(await repo.listar()).toHaveLength(1);

    confirmar.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Excluir Skar' }));
    expect(await screen.findByText('Nenhuma ficha ainda.')).toBeTruthy();
    expect(await repo.listar()).toHaveLength(0);
  });
});
