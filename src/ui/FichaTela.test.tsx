import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { FichaTela } from './FichaTela';
import { RepositorioMemoria } from '../dados/memoria';
import { criarFicha } from '../dominio/ficha';
import { SKAR } from '../rules/fixtures/skar';
import type { RepositorioFichas } from '../dados/repositorio';

async function montar(repo: RepositorioFichas = new RepositorioMemoria()) {
  const ficha = criarFicha({ nome: 'Skar Lionet', raca: 'Humano', classe: 'Pugilista', ...SKAR });
  await repo.salvar(ficha);
  render(<FichaTela repo={repo} id={ficha.id} />);
  await screen.findByRole('heading', { name: 'Skar Lionet' });
  return { repo, ficha };
}

function aplicarNa(recurso: string, rotuloQtd: string, valor: string, botao: string) {
  const secao = screen.getByRole('region', { name: recurso });
  fireEvent.input(within(secao).getByLabelText(rotuloQtd), { target: { value: valor } });
  fireEvent.click(within(secao).getByRole('button', { name: botao }));
}

describe('FichaTela', () => {
  it('mostra cabeçalho, recursos e valores calculados do Skar', async () => {
    await montar();
    expect(screen.getByText('Humano · Pugilista · Nível 2')).toBeTruthy();
    expect(screen.getByTestId('valor-VIDA').textContent).toBe('45 / 45');
    expect(screen.getByTestId('valor-STA').textContent).toBe('20 / 20');
    expect(screen.getByTestId('valor-MANA').textContent).toBe('12 / 12');
    expect(screen.getByTestId('derivado-CORPO').textContent).toBe('5');
    expect(screen.getByTestId('derivado-MENTE').textContent).toBe('2,3');
    expect(screen.getByTestId('derivado-DESLOCAMENTO').textContent).toBe('9');
  });

  it('dano atualiza a tela, o histórico e salva', async () => {
    const { repo, ficha } = await montar();
    aplicarNa('Vida', 'Quantidade de Vida', '8', 'Dano');
    expect(screen.getByTestId('valor-VIDA').textContent).toBe('37 / 45');
    const hist = screen.getByRole('region', { name: 'Histórico' });
    expect(within(hist).getByText('−8 dano')).toBeTruthy();
    await waitFor(async () => expect((await repo.obter(ficha.id))!.atuais.VIDA).toBe(37));
  });

  it('dano maior que a Vida deixa negativa; cura volta até o máximo', async () => {
    await montar();
    aplicarNa('Vida', 'Quantidade de Vida', '49', 'Dano');
    expect(screen.getByTestId('valor-VIDA').textContent).toBe('-4 / 45');
    aplicarNa('Vida', 'Quantidade de Vida', '100', 'Cura');
    expect(screen.getByTestId('valor-VIDA').textContent).toBe('45 / 45');
  });

  it('gastar Stamina para em 0', async () => {
    await montar();
    aplicarNa('Stamina', 'Quantidade de Stamina', '30', 'Gastar');
    expect(screen.getByTestId('valor-STA').textContent).toBe('0 / 20');
    expect(screen.getByText('−30 gasto')).toBeTruthy();
  });

  it('descanso restaura tudo', async () => {
    await montar();
    aplicarNa('Vida', 'Quantidade de Vida', '10', 'Dano');
    aplicarNa('Mana', 'Quantidade de Mana', '5', 'Gastar');
    fireEvent.click(screen.getByRole('button', { name: 'Descanso: restaurar tudo' }));
    expect(screen.getByTestId('valor-VIDA').textContent).toBe('45 / 45');
    expect(screen.getByTestId('valor-MANA').textContent).toBe('12 / 12');
  });

  it('histórico vazio avisa', async () => {
    await montar();
    expect(screen.getByText('Nada ainda.')).toBeTruthy();
  });

  it('mudar CON recalcula os máximos e salva', async () => {
    const { repo, ficha } = await montar();
    const con = screen.getByLabelText('Constituição extra');
    fireEvent.change(con, { target: { value: '2' } });
    expect(screen.getByTestId('atual-CON').textContent).toBe('7');
    expect(screen.getByTestId('valor-VIDA').textContent).toBe('45 / 56');
    await waitFor(async () => expect((await repo.obter(ficha.id))!.maximos.VIDA).toBe(56));
  });

  it('perder CON corta a Vida atual', async () => {
    await montar();
    fireEvent.change(screen.getByLabelText('Constituição perda'), { target: { value: '3' } });
    const [atual, max] = screen.getByTestId('valor-VIDA').textContent!.split(' / ');
    expect(atual).toBe(max);
  });

  it('subir o nível recalcula Vida e subtítulo', async () => {
    await montar();
    fireEvent.change(screen.getByLabelText('Nível'), { target: { value: '3' } });
    expect(screen.getByTestId('valor-VIDA').textContent).toBe('45 / 50');
    expect(screen.getByText('Humano · Pugilista · Nível 3')).toBeTruthy();
  });

  it('número inválido no atributo é desfeito', async () => {
    await montar();
    const input = screen.getByLabelText('Força extra') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '-2' } });
    expect(input.value).toBe('0');
    expect(screen.getByTestId('derivado-CORPO').textContent).toBe('5');
  });

  it('mudar nome, raça e classe', async () => {
    const { repo, ficha } = await montar();
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Skar' } });
    fireEvent.change(screen.getByLabelText('Classe'), { target: { value: 'Monge' } });
    expect(screen.getByRole('heading', { name: 'Skar' })).toBeTruthy();
    await waitFor(async () => expect((await repo.obter(ficha.id))!.classe).toBe('Monge'));
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: '  ' } });
    expect(screen.getByRole('heading', { name: 'Sem nome' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Raça'), { target: { value: 'Anão' } });
    expect(screen.getByText('Anão · Monge · Nível 2')).toBeTruthy();
  });

  it('alterações de atributo aparecem no histórico próprio, com o efeito', async () => {
    const { repo, ficha } = await montar();
    const secao = screen.getByRole('region', { name: 'Alterações de atributos' });
    expect(within(secao).getByText('Nenhuma alteração ainda.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Constituição extra'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Nível'), { target: { value: '3' } });

    const itens = within(secao).getAllByRole('listitem');
    expect(itens).toHaveLength(2);
    expect(itens[0]!.textContent).toContain('Nível 2 → 3');
    expect(itens[1]!.textContent).toContain('Constituição extra 0 → 2');
    expect(itens[1]!.textContent).toContain('Vida máx. 45 → 56');
    expect(itens[0]!.className).toBe('alt-subiu');

    await waitFor(async () => expect((await repo.obter(ficha.id))!.alteracoes).toHaveLength(2));
  });

  it('reduzir atributo fica marcado como queda', async () => {
    await montar();
    fireEvent.change(screen.getByLabelText('Força base'), { target: { value: '6' } });
    const item = within(screen.getByRole('region', { name: 'Alterações de atributos' })).getByRole('listitem');
    expect(item.className).toBe('alt-desceu');
    expect(item.textContent).toContain('Força base 8 → 6');
  });

  it('mesmo valor não gera registro', async () => {
    await montar();
    fireEvent.change(screen.getByLabelText('Força base'), { target: { value: '8' } });
    expect(screen.getByText('Nenhuma alteração ainda.')).toBeTruthy();
  });

  it('mostra as últimas e permite ver todas', async () => {
    await montar();
    for (let n = 3; n <= 10; n++) fireEvent.change(screen.getByLabelText('Nível'), { target: { value: String(n) } });
    const secao = screen.getByRole('region', { name: 'Alterações de atributos' });
    expect(within(secao).getAllByRole('listitem')).toHaveLength(6);
    fireEvent.click(within(secao).getByRole('button', { name: 'Ver todas (8)' }));
    expect(within(secao).getAllByRole('listitem')).toHaveLength(8);
    fireEvent.click(within(secao).getByRole('button', { name: 'Mostrar menos' }));
    expect(within(secao).getAllByRole('listitem')).toHaveLength(6);
  });

  it('alteração de outro dia mostra a data', async () => {
    const repo = new RepositorioMemoria();
    const ficha = criarFicha({ nome: 'Skar Lionet', ...SKAR });
    const d = new Date();
    d.setDate(d.getDate() - 2);
    d.setHours(21, 30, 0, 0);
    const ontem = d.getTime();
    const esperado = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}, 21:30`;
    ficha.alteracoes = [
      { id: 'a', alvo: { tipo: 'nivel' }, de: 1, para: 2, efeitos: {}, em: ontem },
    ];
    await repo.salvar(ficha);
    render(<FichaTela repo={repo} id={ficha.id} />);
    const secao = await screen.findByRole('region', { name: 'Alterações de atributos' });
    expect(within(secao).getByRole('listitem').textContent).toContain(esperado);
  });

  it('exportar baixa um JSON com o nome da ficha', async () => {
    await montar();
    const urls: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => {
      urls.push(b);
      return 'blob:x';
    });
    URL.revokeObjectURL = vi.fn();
    const clique = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('skar-lionet.caldron.json');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Exportar ficha (JSON)' }));
    await waitFor(() => expect(clique).toHaveBeenCalled());
    const dados = JSON.parse(await urls[0]!.text());
    expect(dados).toMatchObject({ formato: 'caldron-sheets', ficha: { nome: 'Skar Lionet' } });
  });

  it('erro ao exportar aparece', async () => {
    const { repo } = await montar();
    vi.spyOn(repo, 'obterPacote').mockRejectedValue(new Error('falhou'));
    fireEvent.click(screen.getByRole('button', { name: 'Exportar ficha (JSON)' }));
    expect(await screen.findByText('Não foi possível exportar: falhou')).toBeTruthy();
  });

  it('abas levam a inventário e journal', async () => {
    const { ficha } = await montar();
    expect(screen.getByRole('tab', { name: 'Ficha' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Inventário' }).getAttribute('href')).toBe(`#/ficha/${ficha.id}/inventario`);
    expect(screen.getByRole('tab', { name: 'Journal' }).getAttribute('href')).toBe(`#/ficha/${ficha.id}/journal`);
  });

  it('ficha salva com máximo quebrado (regra antiga) abre arredondada e é salva assim', async () => {
    const repo = new RepositorioMemoria();
    const f = criarFicha({ nome: 'Rogerin', ...SKAR });
    const antiga = { ...f, maximos: { ...f.maximos, VIDA: 38.7, STA: 16.7 }, atuais: { ...f.atuais, VIDA: 12, STA: 16.7 } };
    await repo.salvar(antiga);
    render(<FichaTela repo={repo} id={f.id} />);
    await screen.findByRole('heading', { name: 'Rogerin' });
    expect(screen.getByTestId('valor-VIDA').textContent).toBe('12 / 45');
    expect(screen.getByTestId('valor-STA').textContent).toBe('20 / 20');
    await waitFor(async () => expect((await repo.obter(f.id))!.maximos.STA).toBe(20));
  });

  it('erro ao salvar aparece na tela', async () => {
    const repo = new RepositorioMemoria();
    const { ficha } = await montar(repo);
    vi.spyOn(repo, 'salvar').mockRejectedValue(new Error('disco cheio'));
    aplicarNa('Vida', 'Quantidade de Vida', '1', 'Dano');
    expect(await screen.findByText('Não foi possível salvar: disco cheio')).toBeTruthy();
    expect(ficha.id).toBeTruthy();
  });

  it('valor de atributo que o motor recusa mostra o erro', async () => {
    await montar();
    // Base aceita negativo; um valor enorme faz o resultado deixar de ser finito.
    fireEvent.change(screen.getByLabelText('Força base'), { target: { value: '1e308' } });
    fireEvent.change(screen.getByLabelText('Destreza base'), { target: { value: '1e308' } });
    fireEvent.change(screen.getByLabelText('Constituição base'), { target: { value: '1e308' } });
    expect((await screen.findAllByRole('alert'))[0]!.textContent).toMatch(/número finito/);
  });
});
