import type { ComponentChildren } from 'preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { MesaTela } from './MesaTela';
import { ContextoSessao, type InfoSessao } from './papel';
import { RepositorioMemoria } from '../dados/memoria';
import { MesaMemoria } from '../dados/mesa';
import { criarFicha } from '../dominio/ficha';
import { criarSkill } from '../dominio/skills';
import { SKAR } from '../rules/fixtures/skar';
import { SKAR_SKILLS } from '../rules/fixtures/skarSkills';

const MESTRE: InfoSessao = { papel: 'mestre', uid: 'm', jogadores: [] };
const JOGADOR: InfoSessao = { papel: 'jogador', uid: 'j', jogadores: [] };
const com = (sessao: InfoSessao, filho: ComponentChildren) => (
  <ContextoSessao.Provider value={sessao}>{filho}</ContextoSessao.Provider>
);

afterEach(() => {
  vi.restoreAllMocks();
});

async function montar(sessao: InfoSessao, { naFicha = false } = {}) {
  const repo = new RepositorioMemoria();
  const mesa = new MesaMemoria();
  const ficha = { ...criarFicha({ nome: 'Skar Lionet', ...SKAR }), donoUid: 'j' };
  await repo.salvar(ficha);
  for (const [i, d] of SKAR_SKILLS.entries()) await repo.salvarSkill(criarSkill(ficha.id, d, 1000 + i));
  render(com(sessao, <MesaTela repo={repo} mesa={mesa} fichaId={naFicha ? ficha.id : undefined} />));
  await screen.findByText('Nada por aqui ainda.');
  return { repo, mesa, ficha };
}

const campo = () => screen.getByRole('textbox', { name: 'Mensagem ou rolagem' });
function escrever(texto: string) {
  fireEvent.input(campo(), { target: { value: texto } });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
}

describe('MesaTela', () => {
  it('jogador rola como o personagem dele; a tela mostra "aguardando" e depois o resultado do bot', async () => {
    const { mesa, ficha } = await montar(JOGADOR);
    await waitFor(() => expect((screen.getByRole('combobox', { name: 'Falar como' }) as HTMLSelectElement).value).toBe(ficha.id));
    escrever('d30+FOR ataque');

    const item = await screen.findByRole('listitem');
    expect(item.getAttribute('data-estado')).toBe('pendente');
    expect(within(item).getByText('Aguardando o bot…')).toBeTruthy();
    const [m] = mesa.todas('mesa');
    expect(m).toMatchObject({ autorUid: 'j', fichaId: ficha.id, nome: 'Skar Lionet', tipo: 'rolagem', estado: 'pendente' });
    expect((campo() as HTMLInputElement).value).toBe('');

    mesa.responder('mesa', m!.id, { estado: 'feita', resultado: ['` 25 ` ⟵ [**17**] 1d30 + FOR\nFOR=+8'], totais: [25], discord: 'enviado' });
    const resultado = await within(screen.getByRole('listitem')).findByLabelText('Resultado');
    expect(resultado.textContent).toContain('25');
    expect(resultado.textContent).toContain('FOR=+8');
    expect(screen.queryByText('Aguardando o bot…')).toBeNull();
  });

  it('texto que não começa com dado vai como mensagem comum', async () => {
    const { mesa } = await montar(JOGADOR);
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1));
    escrever('quero rolar d30');
    await screen.findByText('quero rolar d30');
    expect(mesa.todas('mesa')[0]).toMatchObject({ tipo: 'texto' });
    expect(screen.getByRole('listitem').getAttribute('data-tipo')).toBe('texto');
  });

  it('erro do bot aparece na mensagem', async () => {
    const { mesa } = await montar(JOGADOR);
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1));
    escrever('d30+XYZ');
    await screen.findByRole('listitem');
    mesa.responder('mesa', mesa.todas('mesa')[0]!.id, { estado: 'erro', erro: 'Atributo não cadastrado: XYZ.' });
    expect(await screen.findByText('Atributo não cadastrado: XYZ.')).toBeTruthy();
  });

  it('botões rápidos: atributos com o valor atual e skills com dado', async () => {
    const { mesa } = await montar(JOGADOR);
    const rapidas = await screen.findByLabelText('Rolagens rápidas');
    expect(within(rapidas).getByRole('button', { name: 'FOR 8' })).toBeTruthy();
    fireEvent.click(within(rapidas).getByRole('button', { name: 'FOR 8' }));
    fireEvent.click(within(rapidas).getByRole('button', { name: 'Punhos de Pedra' }));
    await waitFor(() => expect(mesa.todas('mesa')).toHaveLength(2));
    expect(mesa.todas('mesa').map((m) => m.texto).sort()).toEqual(['2d4+FOR Punhos de Pedra', 'd30+FOR']);
    // Skill sem dado no ATK/MOD não vira botão.
    expect(within(rapidas).queryByRole('button', { name: 'Postura Impetuosa' })).toBeNull();
  });

  it('sem internet, rolagem não sai (texto sai)', async () => {
    const { mesa } = await montar(JOGADOR);
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1));
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    escrever('d30');
    expect((await screen.findByRole('alert')).textContent).toMatch(/Sem internet/);
    expect(mesa.todas('mesa')).toHaveLength(0);
    escrever('volto já');
    await waitFor(() => expect(mesa.todas('mesa')).toHaveLength(1));
  });

  it('jogador não vê o canal do Mestre nem o botão de apagar', async () => {
    await montar(JOGADOR);
    expect(screen.queryByRole('tab', { name: 'Canal do Mestre' })).toBeNull();
    escrever('oi');
    await screen.findByText('oi');
    expect(screen.queryByRole('button', { name: /Apagar/ })).toBeNull();
  });

  it('Mestre fala como Mestre, rola em segredo no canal dele e apaga mensagem', async () => {
    const { mesa } = await montar(MESTRE);
    expect((screen.getByRole('combobox', { name: 'Falar como' }) as HTMLSelectElement).value).toBe('');
    escrever('d30 público');
    await screen.findByText('d30 público');
    expect(mesa.todas('mesa')[0]).toMatchObject({ nome: 'Mestre', autorUid: 'm' });
    expect('fichaId' in mesa.todas('mesa')[0]!).toBe(false);

    fireEvent.click(screen.getByRole('tab', { name: 'Canal do Mestre' }));
    await screen.findByText('Nada por aqui ainda.');
    escrever('d30 emboscada');
    await screen.findByText('d30 emboscada');
    expect(mesa.todas('mestre')).toHaveLength(1);
    expect(mesa.todas('mesa')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Apagar mensagem de Mestre' }));
    await screen.findByText('Nada por aqui ainda.');
    expect(mesa.todas('mestre')).toHaveLength(0);
  });

  it('aberta pela aba da ficha: aba Mesa marcada e já fala como o personagem', async () => {
    const { ficha } = await montar(MESTRE, { naFicha: true });
    expect(screen.getByRole('tab', { name: 'Mesa' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Mesa' }).getAttribute('href')).toBe(`#/ficha/${ficha.id}/mesa`);
    expect((screen.getByRole('combobox', { name: 'Falar como' }) as HTMLSelectElement).value).toBe(ficha.id);
  });

  it('sem nuvem, explica que precisa entrar', () => {
    render(com(MESTRE, <MesaTela repo={new RepositorioMemoria()} />));
    expect(screen.getByText(/precisa da nuvem/)).toBeTruthy();
  });
});
