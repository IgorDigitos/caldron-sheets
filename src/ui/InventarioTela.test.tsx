import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { InventarioTela } from './InventarioTela';
import { RepositorioMemoria } from '../dados/memoria';
import { criarFicha } from '../dominio/ficha';
import { criarItem } from '../dominio/inventario';
import { SKAR } from '../rules/fixtures/skar';
import type { Imagem } from '../midia/imagem';

const DATA_URL = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';

afterEach(() => {
  vi.restoreAllMocks();
});

async function montar(itens: Parameters<typeof criarItem>[1][] = []) {
  const repo = new RepositorioMemoria();
  const ficha = criarFicha({ nome: 'Skar Lionet', ...SKAR });
  await repo.salvar(ficha);
  for (const dados of itens) await repo.salvarItem(criarItem(ficha.id, dados));
  const prepararImagem = vi.fn(
    async (_arquivo: Blob, fichaId: string): Promise<Imagem> => ({
      id: 'img-nova',
      fichaId,
      dataUrl: DATA_URL,
      tipo: 'image/webp',
      largura: 400,
      altura: 300,
      bytes: 40 * 1024,
      criadoEm: 1,
    }),
  );
  render(<InventarioTela repo={repo} id={ficha.id} prepararImagem={prepararImagem} />);
  await screen.findByRole('heading', { name: 'Skar Lionet' });
  return { repo, ficha, prepararImagem };
}

function preencher(rotulo: string, valor: string) {
  fireEvent.input(screen.getByLabelText(rotulo), { target: { value: valor } });
}

describe('InventarioTela', () => {
  it('vazio mostra aviso, defesa natural e carteira zerada', async () => {
    await montar();
    expect(screen.getByText('Inventário vazio.')).toBeTruthy();
    expect(screen.getByTestId('def-fisica').textContent).toBe('7,5');
    expect(screen.getByTestId('def-magica').textContent).toBe('3,8');
    expect(screen.getByTestId('peso-total').textContent).toBe('Peso total: 0');
    expect(screen.getByTestId('total-carteira').textContent).toBe('0');
    expect(screen.queryByTestId('total-alma')).toBeNull();
    expect(screen.getByRole('tab', { name: 'Inventário' }).getAttribute('aria-selected')).toBe('true');
  });

  it('adiciona item com foto e ele aparece na lista', async () => {
    const { repo, ficha, prepararImagem } = await montar();
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar item' }));
    preencher('Nome', 'Cota de malha');
    preencher('Quantidade', '1');
    preencher('Peso (unidade)', '12,5');
    preencher('Def. Física', '4');

    const arquivo = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Escolher foto'), { target: { files: [arquivo] } });
    expect(await screen.findByTestId('info-foto')).toBeTruthy();
    expect(screen.getByTestId('info-foto').textContent).toBe('400×300 · 40 KB');
    expect(prepararImagem).toHaveBeenCalledWith(arquivo, ficha.id);

    fireEvent.click(screen.getByRole('button', { name: 'Salvar item' }));
    expect(await screen.findByText('Cota de malha')).toBeTruthy();
    expect(screen.getByTestId('peso-total').textContent).toBe('Peso total: 12,5');

    const [item] = await repo.listarItens(ficha.id);
    expect(item).toMatchObject({ nome: 'Cota de malha', peso: 12.5, defF: 4, imagemId: 'img-nova' });
    expect((await repo.obterImagem('img-nova'))!.dataUrl).toBe(DATA_URL);
    await waitFor(() => expect(document.querySelector('img.miniatura')?.getAttribute('src')).toBe(DATA_URL));
  });

  it('equipar armadura soma na defesa', async () => {
    const { repo, ficha } = await montar([{ nome: 'Cota', defF: 4, defM: 1 }, { nome: 'Corda', peso: 1 }]);
    expect(screen.getByTestId('def-fisica').textContent).toBe('7,5');
    expect(screen.getAllByRole('checkbox')).toHaveLength(1); // corda não tem defesa
    fireEvent.click(screen.getByRole('checkbox', { name: 'Equipado' }));
    expect(screen.getByTestId('def-fisica').textContent).toBe('11,5');
    expect(screen.getByTestId('def-magica').textContent).toBe('4,8');
    await waitFor(async () => expect((await repo.listarItens(ficha.id)).find((i) => i.nome === 'Cota')!.equipado).toBe(true));
  });

  it('+ e − mudam a quantidade e o peso', async () => {
    await montar([{ nome: 'Poção', qtd: 2, peso: 0.5 }]);
    fireEvent.click(screen.getByRole('button', { name: 'Mais Poção' }));
    expect(screen.getByTestId('qtd-Poção').textContent).toBe('3');
    expect(screen.getByTestId('peso-total').textContent).toBe('Peso total: 1,5');
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByRole('button', { name: 'Menos Poção' }));
    expect(screen.getByTestId('qtd-Poção').textContent).toBe('0');
  });

  it('editar item e remover a foto apaga a imagem antiga', async () => {
    const { repo, ficha } = await montar();
    await repo.salvarImagem({ id: 'velha', fichaId: ficha.id, dataUrl: DATA_URL, tipo: 'image/webp', largura: 1, altura: 1, bytes: 1, criadoEm: 1 });
    await repo.salvarItem(criarItem(ficha.id, { nome: 'Lamparina', imagemId: 'velha' }));
    // Recarrega a tela para ver o item.
    render(<InventarioTela repo={repo} id={ficha.id} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Lamparina' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remover foto' }));
    preencher('Nome', 'Lamparina mágica');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar item' }));
    expect(await screen.findByText('Lamparina mágica')).toBeTruthy();
    expect(await repo.obterImagem('velha')).toBeUndefined();
    expect((await repo.listarItens(ficha.id))[0]!.imagemId).toBeUndefined();
  });

  it('excluir item pede confirmação e apaga a foto junto', async () => {
    const { repo, ficha } = await montar();
    await repo.salvarImagem({ id: 'f1', fichaId: ficha.id, dataUrl: DATA_URL, tipo: 'image/webp', largura: 1, altura: 1, bytes: 1, criadoEm: 1 });
    await repo.salvarItem(criarItem(ficha.id, { nome: 'Tocha', imagemId: 'f1' }));
    render(<InventarioTela repo={repo} id={ficha.id} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Tocha' }));
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(await screen.findAllByText('Inventário vazio.')).toBeTruthy();
    expect(confirmar).toHaveBeenCalledWith('Excluir Tocha?');
    expect(await repo.listarItens(ficha.id)).toEqual([]);
    expect(await repo.obterImagem('f1')).toBeUndefined();
  });

  it('item sem nome mostra erro e não salva', async () => {
    const { repo, ficha } = await montar();
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar item' }));
    preencher('Nome', '   ');
    fireEvent.submit(screen.getByRole('form', { name: 'Novo item' }));
    expect((await screen.findByRole('alert')).textContent).toBe('O item precisa de um nome');
    expect(await repo.listarItens(ficha.id)).toEqual([]);
  });

  it('cancelar volta para a lista', async () => {
    await montar();
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar item' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByText('Inventário vazio.')).toBeTruthy();
  });

  it('foto que não abre mostra o erro', async () => {
    const { prepararImagem } = await montar();
    prepararImagem.mockRejectedValueOnce(new Error('O arquivo não é uma imagem'));
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar item' }));
    fireEvent.change(screen.getByLabelText('Escolher foto'), {
      target: { files: [new File(['x'], 'a.txt', { type: 'text/plain' })] },
    });
    expect((await screen.findByRole('alert')).textContent).toBe('O arquivo não é uma imagem');
  });

  it('carteira calcula o total e guarda Moeda d\'Alma à parte', async () => {
    const { repo, ficha } = await montar();
    const carteira = screen.getByRole('region', { name: 'Carteira' });
    fireEvent.change(within(carteira).getByLabelText('Ouro'), { target: { value: '2' } });
    fireEvent.change(within(carteira).getByLabelText('Bronze'), { target: { value: '9' } });
    fireEvent.change(within(carteira).getByLabelText("Moeda d'Alma"), { target: { value: '3' } });
    expect(screen.getByTestId('total-carteira').textContent).toBe('2.090');
    expect(screen.getByTestId('total-alma').textContent).toBe("+ 3 Moedas d'Alma");
    await waitFor(async () => expect((await repo.obter(ficha.id))!.carteira).toMatchObject({ alma: 3, moedas: { ouro: 2, bronze: 9 } }));
  });

  it('histórico da carteira registra cada entrada e saída', async () => {
    const { repo, ficha } = await montar();
    const carteira = screen.getByRole('region', { name: 'Carteira' });
    const hist = () => within(screen.getByRole('region', { name: 'Histórico da carteira' }));
    expect(hist().getByText('Nenhuma movimentação ainda.')).toBeTruthy();

    fireEvent.change(within(carteira).getByLabelText('Ouro'), { target: { value: '5' } });
    fireEvent.change(within(carteira).getByLabelText('Ouro'), { target: { value: '3' } });
    fireEvent.change(within(carteira).getByLabelText("Moeda d'Alma"), { target: { value: '1' } });
    fireEvent.change(within(carteira).getByLabelText('Prata'), { target: { value: '0' } }); // sem mudança

    const linhas = hist().getAllByRole('listitem');
    expect(linhas.map((l) => l.firstElementChild!.textContent)).toEqual(["+1 Moeda d'Alma", '−2 Ouro', '+5 Ouro']);
    expect(linhas[1]!.textContent).toContain('5 → 3');
    expect(linhas[1]!.className).toBe('hist-dano');
    expect(linhas[2]!.className).toBe('hist-cura');
    await waitFor(async () => expect((await repo.obter(ficha.id))!.carteira.historico).toHaveLength(3));
  });

  it('histórico da carteira mostra 6 e permite ver todas', async () => {
    await montar();
    const ouro = within(screen.getByRole('region', { name: 'Carteira' })).getByLabelText('Ouro');
    for (let i = 1; i <= 8; i++) fireEvent.change(ouro, { target: { value: String(i) } });
    const hist = within(screen.getByRole('region', { name: 'Histórico da carteira' }));
    expect(hist.getAllByRole('listitem')).toHaveLength(6);
    fireEvent.click(hist.getByRole('button', { name: 'Ver todas (8)' }));
    expect(hist.getAllByRole('listitem')).toHaveLength(8);
    fireEvent.click(hist.getByRole('button', { name: 'Mostrar menos' }));
    expect(hist.getAllByRole('listitem')).toHaveLength(6);
  });

  it('item: botão de foto diz Adicionar e depois Trocar', async () => {
    await montar();
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar item' }));
    expect(screen.getByText('Adicionar foto')).toBeTruthy();
    expect(screen.queryByText('Tirar foto')).toBeNull();
    fireEvent.change(screen.getByLabelText('Escolher foto'), {
      target: { files: [new File(['x'], 'f.png', { type: 'image/png' })] },
    });
    expect(await screen.findByText('Trocar foto')).toBeTruthy();
  });

  it('moeda inválida é desfeita com aviso', async () => {
    await montar();
    const ouro = within(screen.getByRole('region', { name: 'Carteira' })).getByLabelText('Ouro') as HTMLInputElement;
    fireEvent.change(ouro, { target: { value: '1.5' } });
    expect(ouro.value).toBe('0');
    expect(screen.getByRole('alert').textContent).toContain('inteira');
  });

  it('erro ao salvar aparece', async () => {
    const { repo } = await montar([{ nome: 'Poção' }]);
    vi.spyOn(repo, 'salvarItem').mockRejectedValue(new Error('disco cheio'));
    fireEvent.click(screen.getByRole('button', { name: 'Mais Poção' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Não foi possível salvar: disco cheio');
  });

  it('ficha inexistente', async () => {
    render(<InventarioTela repo={new RepositorioMemoria()} id="nada" />);
    expect(await screen.findByText('Ficha não encontrada.')).toBeTruthy();
  });
});
