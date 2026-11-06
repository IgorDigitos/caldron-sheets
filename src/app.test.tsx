import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/preact';
import { App, rotaParaTela } from './app';
import { RepositorioMemoria } from './dados/memoria';
import { criarFicha } from './dominio/ficha';

beforeEach(() => {
  location.hash = '';
});

describe('App', () => {
  it('mostra o título na lista', async () => {
    render(<App repo={new RepositorioMemoria()} />);
    expect(screen.getByRole('heading', { name: 'Caldron Sheets' })).toBeTruthy();
    expect(await screen.findByText('Nenhuma ficha ainda.')).toBeTruthy();
  });

  it('reage quando a rede cai e volta', () => {
    render(<App repo={new RepositorioMemoria()} />);
    const status = screen.getByTestId('status');
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(status.dataset.online).toBe('false');
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(status.dataset.online).toBe('true');
  });

  it('criar o Skar abre a ficha dele, e voltar mostra ele na lista', async () => {
    const repo = new RepositorioMemoria();
    render(<App repo={repo} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Criar Skar de exemplo' }));
    expect(await screen.findByRole('heading', { name: 'Skar Lionet' })).toBeTruthy();
    expect(location.hash).toMatch(/^#\/ficha\//);

    act(() => {
      location.hash = '/';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(await screen.findByRole('link', { name: /Skar Lionet/ })).toBeTruthy();
  });

  it.each([
    ['/', { tela: 'lista' }],
    ['/ficha/abc-1', { tela: 'ficha', id: 'abc-1' }],
    ['/ficha/abc-1/inventario', { tela: 'inventario', id: 'abc-1' }],
    ['/ficha/abc-1/journal', { tela: 'journal', id: 'abc-1' }],
    ['/ficha/abc-1/outra', { tela: 'lista' }],
    ['/qualquer', { tela: 'lista' }],
  ])('rota %s', (rota, esperado) => {
    expect(rotaParaTela(rota)).toEqual(esperado);
  });

  it('abre inventário e journal pela rota', async () => {
    const repo = new RepositorioMemoria();
    const f = criarFicha({ nome: 'Skar' });
    await repo.salvar(f);
    location.hash = `/ficha/${f.id}/inventario`;
    render(<App repo={repo} />);
    expect(await screen.findByText('Inventário vazio.')).toBeTruthy();
    act(() => {
      location.hash = `/ficha/${f.id}/journal`;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(await screen.findByText('Nenhuma entrada ainda.')).toBeTruthy();
  });

  it('ficha inexistente mostra aviso', async () => {
    location.hash = '/ficha/nao-existe';
    render(<App repo={new RepositorioMemoria()} />);
    expect(await screen.findByText('Ficha não encontrada.')).toBeTruthy();
  });
});
