import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { JournalTela } from './JournalTela';
import { RepositorioMemoria } from '../dados/memoria';
import { criarFicha } from '../dominio/ficha';
import { criarEntrada, hojeISO } from '../dominio/journal';
import type { Imagem } from '../midia/imagem';

afterEach(() => {
  vi.restoreAllMocks();
});

const DATA_URL = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';
let contador = 0;
const prepararFalso = vi.fn(
  async (_a: Blob, fichaId: string): Promise<Imagem> => ({
    id: `img-${++contador}`,
    fichaId,
    dataUrl: DATA_URL,
    tipo: 'image/webp',
    largura: 400,
    altura: 300,
    bytes: 1000,
    criadoEm: 1,
  }),
);

async function montar() {
  const repo = new RepositorioMemoria();
  const ficha = criarFicha({ nome: 'Skar Lionet' });
  await repo.salvar(ficha);
  render(<JournalTela repo={repo} id={ficha.id} prepararImagem={prepararFalso} />);
  await screen.findByRole('heading', { name: 'Skar Lionet' });
  return { repo, ficha };
}

const arquivos = (n: number) => Array.from({ length: n }, (_, i) => new File(['x'], `f${i}.png`, { type: 'image/png' }));

function anexar(n: number) {
  fireEvent.change(screen.getByLabelText('Adicionar imagem'), { target: { files: arquivos(n) } });
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
    expect((await screen.findByRole('alert')).textContent).toBe('Escreva um título, um texto ou adicione uma imagem');
  });

  it('cancelar não salva', async () => {
    const { repo, ficha } = await montar();
    fireEvent.click(screen.getByRole('button', { name: 'Nova entrada' }));
    digitar('Título', 'Nada');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await repo.listarJournal(ficha.id)).toEqual([]);
    expect(screen.getByRole('button', { name: 'Nova entrada' })).toBeTruthy();
  });

  it('adicionar imagens à entrada, salvar e ver na lista', async () => {
    const { repo, ficha } = await montar();
    fireEvent.click(screen.getByRole('button', { name: 'Nova entrada' }));
    digitar('Título', 'Mapa de Vel');
    anexar(2);
    expect(await screen.findByAltText('Imagem 2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar entrada' }));

    const lista = await screen.findByRole('list', { name: 'Entradas do journal' });
    await waitFor(() => expect(within(lista).getAllByRole('img')).toHaveLength(2));
    expect(within(lista).getByAltText('Imagem 1 de Mapa de Vel').getAttribute('src')).toBe(DATA_URL);
    const [entrada] = await repo.listarJournal(ficha.id);
    expect(entrada!.imagens).toHaveLength(2);
    for (const id of entrada!.imagens!) expect(await repo.obterImagem(id)).toBeTruthy();
  });

  it('entrada só com imagem pode ser salva', async () => {
    const { repo, ficha } = await montar();
    fireEvent.click(screen.getByRole('button', { name: 'Nova entrada' }));
    anexar(1);
    await screen.findByAltText('Imagem 1');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar entrada' }));
    await waitFor(async () => expect(await repo.listarJournal(ficha.id)).toHaveLength(1));
  });

  it('remover imagem ao editar apaga só ela', async () => {
    const { repo, ficha } = await montar();
    fireEvent.click(screen.getByRole('button', { name: 'Nova entrada' }));
    digitar('Título', 'Duas');
    anexar(2);
    await screen.findByAltText('Imagem 2');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar entrada' }));
    await screen.findByRole('list', { name: 'Entradas do journal' });
    const [antes] = await repo.listarJournal(ficha.id);
    const [primeira, segunda] = antes!.imagens!;

    fireEvent.click(screen.getByRole('button', { name: 'Editar Duas' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Remover imagem 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar entrada' }));
    await waitFor(async () => expect((await repo.listarJournal(ficha.id))[0]!.imagens).toEqual([segunda]));
    expect(await repo.obterImagem(primeira!)).toBeUndefined();
    expect(await repo.obterImagem(segunda!)).toBeTruthy();
  });

  it('excluir entrada apaga as imagens dela', async () => {
    const { repo, ficha } = await montar();
    fireEvent.click(screen.getByRole('button', { name: 'Nova entrada' }));
    digitar('Título', 'Some');
    anexar(1);
    await screen.findByAltText('Imagem 1');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar entrada' }));
    await screen.findByRole('list', { name: 'Entradas do journal' });
    const [e] = await repo.listarJournal(ficha.id);

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Editar Some' }));
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    await waitFor(async () => expect(await repo.listarJournal(ficha.id)).toEqual([]));
    expect(await repo.obterImagem(e!.imagens![0]!)).toBeUndefined();
  });

  it('mais de 6 imagens: guarda 6, avisa e esconde o botão', async () => {
    await montar();
    fireEvent.click(screen.getByRole('button', { name: 'Nova entrada' }));
    anexar(8);
    expect(await screen.findByAltText('Imagem 6')).toBeTruthy();
    expect(screen.queryByAltText('Imagem 7')).toBeNull();
    expect(screen.getByRole('alert').textContent).toBe('No máximo 6 imagens por entrada');
    expect(screen.queryByLabelText('Adicionar imagem')).toBeNull();
  });

  it('imagem que não abre mostra o erro', async () => {
    await montar();
    prepararFalso.mockRejectedValueOnce(new Error('O arquivo não é uma imagem'));
    fireEvent.click(screen.getByRole('button', { name: 'Nova entrada' }));
    anexar(1);
    expect((await screen.findByRole('alert')).textContent).toBe('O arquivo não é uma imagem');
  });

  it('ficha inexistente', async () => {
    render(<JournalTela repo={new RepositorioMemoria()} id="nada" />);
    expect(await screen.findByText('Ficha não encontrada.')).toBeTruthy();
  });
});
