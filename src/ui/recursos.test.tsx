import type { ComponentChildren } from 'preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { FichaTela } from './FichaTela';
import { RecursosTela } from './RecursosTela';
import { SkillsTela } from './SkillsTela';
import { ContextoSessao, type InfoSessao } from './papel';
import { RepositorioMemoria } from '../dados/memoria';
import { aplicar, atualDe, criarFicha } from '../dominio/ficha';
import { criarDefRecurso, habilitarRecurso } from '../dominio/recursos';
import { SKAR } from '../rules/fixtures/skar';

const MESTRE: InfoSessao = { papel: 'mestre', jogadores: [] };
const JOGADOR: InfoSessao = { papel: 'jogador', uid: 'u1', jogadores: [] };
const com = (sessao: InfoSessao, filho: ComponentChildren) => (
  <ContextoSessao.Provider value={sessao}>{filho}</ContextoSessao.Provider>
);
const IMPETO = criarDefRecurso({ nome: 'Ímpeto', formula: '3 + int(NIVEL/2)', comecaCheio: false, cor: '#d0703c' }, 1);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('tela Recursos (catálogo)', () => {
  it('cria o Ímpeto com prévia da fórmula', async () => {
    const repo = new RepositorioMemoria();
    render(<RecursosTela repo={repo} />);
    expect(await screen.findByText('Nenhum recurso ainda.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Novo recurso' }));
    const form = screen.getByRole('form', { name: 'Novo recurso' });
    fireEvent.input(within(form).getByLabelText('Nome'), { target: { value: 'Ímpeto' } });
    fireEvent.input(within(form).getByLabelText('Fórmula do máximo'), { target: { value: '3 + int(NIVEL/2)' } });
    expect(screen.getByTestId('previa-formula').textContent).toBe('No Skar (nível 2): 4');
    fireEvent.click(within(form).getByLabelText(/Começa cheio/));
    fireEvent.click(within(form).getByLabelText('Cor #9b6dd6'));
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar recurso' }));

    expect(await screen.findByRole('button', { name: 'Editar Ímpeto' })).toBeTruthy();
    const [d] = await repo.listarRecursos();
    expect(d).toMatchObject({ nome: 'Ímpeto', formula: '3 + int(NIVEL/2)', comecaCheio: false, cor: '#9b6dd6' });
  });

  it('fórmula com erro aparece na prévia e não salva', async () => {
    const repo = new RepositorioMemoria();
    render(<RecursosTela repo={repo} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Novo recurso' }));
    fireEvent.input(screen.getByLabelText('Nome'), { target: { value: 'X' } });
    fireEvent.input(screen.getByLabelText('Fórmula do máximo'), { target: { value: '3 + SORTE' } });
    expect(screen.getByTestId('previa-formula').textContent).toBe('Fórmula com erro: Símbolo desconhecido "SORTE"');
    fireEvent.submit(screen.getByRole('form', { name: 'Novo recurso' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Símbolo desconhecido "SORTE"');
    expect(await repo.listarRecursos()).toEqual([]);
  });

  it('excluir tira o recurso das fichas que o tinham', async () => {
    const repo = new RepositorioMemoria();
    await repo.salvarRecurso(IMPETO);
    const f = habilitarRecurso(criarFicha({ nome: 'Skar', ...SKAR }), IMPETO);
    await repo.salvar(f);
    render(<RecursosTela repo={repo} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Ímpeto' }));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(await screen.findByText('Nenhum recurso ainda.')).toBeTruthy();
    expect((await repo.obter(f.id))!.maxPersonalizados).toEqual({});
  });
});

describe('Ímpeto na ficha', () => {
  async function fichaComCatalogo(sessao: InfoSessao, habilitado: boolean) {
    const repo = new RepositorioMemoria();
    await repo.salvarRecurso(IMPETO);
    let f = criarFicha({ nome: 'Skar Lionet', ...SKAR });
    if (habilitado) f = habilitarRecurso(f, IMPETO);
    await repo.salvar(f);
    render(com(sessao, <FichaTela repo={repo} id={f.id} />));
    await screen.findByRole('heading', { name: 'Skar Lionet' });
    return { repo, f };
  }

  it('Mestre habilita em "Recursos especiais": barra aparece em 0 / 4', async () => {
    const { repo, f } = await fichaComCatalogo(MESTRE, false);
    expect(screen.queryByRole('region', { name: 'Ímpeto' })).toBeNull();
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Ímpeto' }));
    const barra = await screen.findByRole('region', { name: 'Ímpeto' });
    expect(within(barra).getByTestId(`valor-${IMPETO.id}`).textContent).toBe('0 / 4');
    await waitFor(async () => expect((await repo.obter(f.id))!.maxPersonalizados).toEqual({ [IMPETO.id]: 4 }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ímpeto' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Ímpeto' })).toBeNull());
  });

  it('jogador ganha Ímpeto, vê no histórico, e não vê as caixas de habilitar', async () => {
    await fichaComCatalogo(JOGADOR, true);
    expect(screen.queryByRole('checkbox', { name: 'Ímpeto' })).toBeNull();
    const barra = screen.getByRole('region', { name: 'Ímpeto' });
    fireEvent.input(within(barra).getByLabelText('Quantidade de Ímpeto'), { target: { value: '2' } });
    fireEvent.click(within(barra).getByRole('button', { name: 'Recuperar' }));
    expect(within(barra).getByTestId(`valor-${IMPETO.id}`).textContent).toBe('2 / 4');
    const hist = within(screen.getByRole('region', { name: 'Histórico' })).getAllByRole('listitem')[0]!;
    expect(hist.textContent).toContain('Ímpeto');
    expect(hist.textContent).toContain('+2 recuperou');
  });

  it('subir de nível (Mestre) recalcula o máximo do Ímpeto', async () => {
    await fichaComCatalogo(MESTRE, true);
    fireEvent.change(screen.getByLabelText('Nível'), { target: { value: '4' } });
    await waitFor(() => expect(screen.getByTestId(`valor-${IMPETO.id}`).textContent).toBe('0 / 5'));
  });
});

describe('skill que custa Ímpeto', () => {
  it('Mestre escolhe Ímpeto como custo; jogador usa', async () => {
    const repo = new RepositorioMemoria();
    await repo.salvarRecurso(IMPETO);
    const f = aplicar(habilitarRecurso(criarFicha({ nome: 'Skar Lionet', ...SKAR }), IMPETO), IMPETO.id, 'cura', 2);
    await repo.salvar(f);
    const { unmount } = render(com(MESTRE, <SkillsTela repo={repo} id={f.id} />));
    await screen.findByRole('heading', { name: 'Skar Lionet' });
    expect(screen.getByTestId('resumo-recursos').textContent).toContain('Ímpeto 2/4');
    fireEvent.click(screen.getByRole('button', { name: '+ Técnica' }));
    fireEvent.input(screen.getByLabelText('Nome'), { target: { value: 'Golpe Impetuoso' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Adicionar custo' }));
    fireEvent.change(screen.getByLabelText('Recurso do custo 1'), { target: { value: IMPETO.id } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar skill' }));
    await screen.findByRole('article', { name: 'Golpe Impetuoso' });
    unmount();

    render(com(JOGADOR, <SkillsTela repo={repo} id={f.id} />));
    const golpe = await screen.findByRole('article', { name: 'Golpe Impetuoso' });
    fireEvent.click(within(golpe).getByRole('button', { name: 'Usar (−1 Ímpeto)' }));
    expect((await screen.findByRole('status')).textContent).toBe('Usou Golpe Impetuoso: −1 Ímpeto');
    await waitFor(async () => expect(atualDe((await repo.obter(f.id))!, IMPETO.id)).toBe(1));
  });
});
