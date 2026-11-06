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
    expect(screen.getByTestId('valor-VIDA').textContent).toBe('45 / 56,3');
    await waitFor(async () => expect((await repo.obter(ficha.id))!.maximos.VIDA).toBeCloseTo(56.33, 1));
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
