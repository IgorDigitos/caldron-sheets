import type { ComponentChildren } from 'preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { SkillsTela } from './SkillsTela';
import { ContextoSessao, type InfoSessao } from './papel';
import { RepositorioMemoria } from '../dados/memoria';
import { aplicar, criarFicha } from '../dominio/ficha';
import { criarSkill } from '../dominio/skills';
import { SKAR } from '../rules/fixtures/skar';
import { SKAR_SKILLS } from '../rules/fixtures/skarSkills';

const MESTRE: InfoSessao = { papel: 'mestre', jogadores: [] };
const JOGADOR: InfoSessao = { papel: 'jogador', uid: 'u1', jogadores: [] };
const com = (sessao: InfoSessao, filho: ComponentChildren) => (
  <ContextoSessao.Provider value={sessao}>{filho}</ContextoSessao.Provider>
);

afterEach(() => {
  vi.restoreAllMocks();
});

async function montar(sessao: InfoSessao, ajustar = (f: ReturnType<typeof criarFicha>) => f) {
  const repo = new RepositorioMemoria();
  const ficha = ajustar(criarFicha({ nome: 'Skar Lionet', ...SKAR }));
  await repo.salvar(ficha);
  for (const [i, d] of SKAR_SKILLS.entries()) await repo.salvarSkill(criarSkill(ficha.id, d, 1000 + i));
  render(com(sessao, <SkillsTela repo={repo} id={ficha.id} />));
  await screen.findByRole('heading', { name: 'Skar Lionet' });
  return { repo, ficha };
}

describe('SkillsTela', () => {
  it('mostra as três categorias com as skills do Skar', async () => {
    await montar(JOGADOR);
    const tecnicas = screen.getByRole('region', { name: 'Técnicas' });
    expect(within(tecnicas).getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toEqual([
      'Postura Impetuosa',
      'Punhos de Pedra',
      'Guarda de Impacto',
      'Duro na Queda',
    ]);
    expect(within(screen.getByRole('region', { name: 'Magias' })).getByText('Nenhuma.')).toBeTruthy();
    const punhos = within(tecnicas).getByRole('article', { name: 'Punhos de Pedra' });
    expect(within(punhos).getByText('2d4+FOR')).toBeTruthy();
    expect(within(punhos).queryByRole('button', { name: /Usar/ })).toBeNull(); // passiva, sem custo
    expect(screen.getByRole('tab', { name: 'Skills' }).getAttribute('aria-selected')).toBe('true');
  });

  it('jogador: Usar gasta STA e salva; não vê editar nem criar', async () => {
    const { repo, ficha } = await montar(JOGADOR);
    expect(screen.queryByRole('button', { name: /Editar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /\+ / })).toBeNull();
    const guarda = screen.getByRole('article', { name: 'Guarda de Impacto' });
    fireEvent.click(within(guarda).getByRole('button', { name: 'Usar (−2 Stamina)' }));
    expect((await screen.findByRole('status')).textContent).toBe('Usou Guarda de Impacto: −2 Stamina');
    expect(screen.getByTestId('resumo-recursos').textContent).toContain('Stamina 18/20');
    await waitFor(async () => expect((await repo.obter(ficha.id))!.atuais.STA).toBe(18));
    expect((await repo.obter(ficha.id))!.historico[0]!.origem).toBe('Guarda de Impacto');
  });

  it('sem Stamina suficiente avisa e não gasta', async () => {
    const { repo, ficha } = await montar(JOGADOR, (f) => aplicar(f, 'STA', 'dano', 19));
    fireEvent.click(within(screen.getByRole('article', { name: 'Guarda de Impacto' })).getByRole('button', { name: /Usar/ }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Stamina insuficiente para Guarda de Impacto: precisa de 2, tem 1',
    );
    expect((await repo.obter(ficha.id))!.atuais.STA).toBe(1);
  });

  it('Mestre cria uma magia com custo de Mana', async () => {
    const { repo, ficha } = await montar(MESTRE);
    fireEvent.click(screen.getByRole('button', { name: '+ Magia' }));
    const form = screen.getByRole('form', { name: 'Nova skill' });
    fireEvent.input(within(form).getByLabelText('Nome'), { target: { value: 'Toque da Dama' } });
    fireEvent.input(within(form).getByLabelText('ATK/MOD'), { target: { value: '1d8+SAB' } });
    fireEvent.click(within(form).getByRole('button', { name: '+ Adicionar custo' }));
    fireEvent.change(within(form).getByLabelText('Recurso do custo 1'), { target: { value: 'MANA' } });
    fireEvent.input(within(form).getByLabelText('Quantidade do custo 1'), { target: { value: '3' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar skill' }));

    const magia = await screen.findByRole('article', { name: 'Toque da Dama' });
    expect(within(screen.getByRole('region', { name: 'Magias' })).getByRole('article', { name: 'Toque da Dama' })).toBe(magia);
    expect(within(magia).getByRole('button', { name: 'Usar (−3 Mana)' })).toBeTruthy();
    const salvas = await repo.listarSkills(ficha.id);
    expect(salvas.find((s) => s.nome === 'Toque da Dama')).toMatchObject({ categoria: 'magia', custos: [{ recurso: 'MANA', valor: 3 }] });
  });

  it('Mestre edita (muda o custo, tira o custo) e exclui', async () => {
    const { repo, ficha } = await montar(MESTRE);
    fireEvent.click(screen.getByRole('button', { name: 'Editar Duro na Queda' }));
    const form = screen.getByRole('form', { name: 'Editar Duro na Queda' });
    fireEvent.click(within(form).getByRole('button', { name: 'Remover custo 1' }));
    expect(within(form).getByText('Sem custo: a skill não terá botão "Usar".')).toBeTruthy();
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar skill' }));
    const duro = await screen.findByRole('article', { name: 'Duro na Queda' });
    expect(within(duro).queryByRole('button', { name: /Usar/ })).toBeNull();

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Editar Duro na Queda' }));
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Duro na Queda' })).toBeNull());
    expect((await repo.listarSkills(ficha.id)).map((s) => s.nome)).not.toContain('Duro na Queda');
  });

  it('Mestre: nome vazio mostra erro; cancelar volta', async () => {
    await montar(MESTRE);
    fireEvent.click(screen.getByRole('button', { name: '+ Técnica' }));
    fireEvent.submit(screen.getByRole('form', { name: 'Nova skill' }));
    expect((await screen.findByRole('alert')).textContent).toBe('A skill precisa de um nome');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('region', { name: 'Técnicas' })).toBeTruthy();
  });

  it('descrição fica recolhida', async () => {
    await montar(JOGADOR);
    const caminho = screen.getByRole('article', { name: 'Caminho Digno' });
    expect(within(caminho).getByText('Descrição').closest('details')!.open).toBe(false);
  });
});
