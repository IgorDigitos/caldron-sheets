import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { FichaTela } from './FichaTela';
import { ContextoSessao, type InfoSessao } from './papel';
import { RepositorioMemoria } from '../dados/memoria';
import { MesaMemoria } from '../dados/mesa';
import { aplicar, criarFicha, type Ficha } from '../dominio/ficha';
import { SKAR } from '../rules/fixtures/skar';

const JOGADOR: InfoSessao = { papel: 'jogador', uid: 'j', jogadores: [] };

afterEach(() => {
  cleanup();
});

async function montar({ cheio = false, comMesa = true, sessao = JOGADOR } = {}) {
  const repo = new RepositorioMemoria();
  const mesa = new MesaMemoria();
  let ficha: Ficha = { ...criarFicha({ nome: 'Skar Lionet', ...structuredClone(SKAR) }), donoUid: 'j' };
  if (!cheio) {
    ficha = aplicar(ficha, 'VIDA', 'dano', 40);
    ficha = aplicar(ficha, 'STA', 'dano', 15);
    ficha = aplicar(ficha, 'MANA', 'dano', 5);
  }
  await repo.salvar(ficha);
  const tela = (
    <ContextoSessao.Provider value={sessao}>
      <FichaTela repo={repo} id={ficha.id} mesa={comMesa ? mesa : undefined} />
    </ContextoSessao.Provider>
  );
  render(tela);
  await screen.findByRole('heading', { name: 'Skar Lionet' });
  return { repo, mesa, ficha };
}

describe('Descanso curto', () => {
  it('pede ao bot uma rolagem por recurso, como o personagem', async () => {
    const { mesa, ficha } = await montar();
    expect(screen.getByText('Rola 2d5 Vida, 3d5 Stamina, 2d2 Mana.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Descanso curto' }));
    await screen.findByText('Descanso curto: aguardando o bot…');
    const pedidos = mesa.todas('mesa');
    expect(pedidos.map((m) => m.texto).sort()).toEqual([
      '2d2 Mana (descanso curto)',
      '2d5 Vida (descanso curto)',
      '3d5 Stamina (descanso curto)',
    ]);
    for (const m of pedidos) {
      expect(m).toMatchObject({ tipo: 'rolagem', estado: 'pendente', autorUid: 'j', nome: 'Skar Lionet', fichaId: ficha.id });
    }
    expect(screen.getByRole('button', { name: 'Descanso curto' })).toHaveProperty('disabled', true);
  });

  it('soma o resultado do bot na ficha (uma vez só) e salva', async () => {
    const { mesa, repo, ficha } = await montar();
    fireEvent.click(screen.getByRole('button', { name: 'Descanso curto' }));
    await screen.findByText('Descanso curto: aguardando o bot…');
    const porRecurso = Object.fromEntries(mesa.todas('mesa').map((m) => [m.descanso, m.id]));
    mesa.responder('mesa', porRecurso.VIDA!, { estado: 'feita', totais: [7] });
    expect(await screen.findByText('+7 descanso curto (2d5)')).toBeTruthy();
    expect(screen.getByTestId('valor-VIDA').textContent).toBe('12 / 45');
    mesa.responder('mesa', porRecurso.STA!, { estado: 'feita', totais: [11] });
    mesa.responder('mesa', porRecurso.MANA!, { estado: 'feita', totais: [4] });
    await waitFor(() => expect(screen.getByTestId('valor-MANA').textContent).toBe('11 / 12'));
    expect(screen.getByTestId('valor-STA').textContent).toBe('16 / 20');
    // Outra mudança na mensagem (ex.: envio ao Discord) não soma de novo.
    mesa.responder('mesa', porRecurso.VIDA!, { discord: 'enviado' });
    await waitFor(async () => expect((await repo.obter(ficha.id))!.atuais).toEqual({ VIDA: 12, STA: 16, MANA: 11 }));
    expect(screen.getByTestId('valor-VIDA').textContent).toBe('12 / 45');
    expect(screen.queryByText('Descanso curto: aguardando o bot…')).toBeNull();
  });

  it('mostra o erro do bot', async () => {
    const { mesa } = await montar();
    fireEvent.click(screen.getByRole('button', { name: 'Descanso curto' }));
    await screen.findByText('Descanso curto: aguardando o bot…');
    const vida = mesa.todas('mesa').find((m) => m.descanso === 'VIDA')!;
    mesa.responder('mesa', vida.id, { estado: 'expirada', erro: 'O bot estava desligado: não foi rolada.' });
    const alerta = await screen.findByRole('alert');
    expect(within(alerta).getByText(/Vida: O bot estava desligado/)).toBeTruthy();
  });

  it('desligado com tudo cheio ou sem nuvem', async () => {
    await montar({ cheio: true });
    expect(screen.getByRole('button', { name: 'Descanso curto' })).toHaveProperty('disabled', true);
    expect(screen.getByText('Vida, Stamina e Mana já estão cheias.')).toBeTruthy();
    cleanup();
    await montar({ comMesa: false });
    expect(screen.getByRole('button', { name: 'Descanso curto' })).toHaveProperty('disabled', true);
    expect(screen.getByText(/precisa da nuvem/)).toBeTruthy();
  });

  it('não aplica rolagem de outra pessoa', async () => {
    const { mesa, ficha } = await montar();
    await mesa.enviar('mesa', {
      id: 'x',
      autorUid: 'outro',
      fichaId: ficha.id,
      nome: 'Skar Lionet',
      texto: '2d5 Vida',
      tipo: 'rolagem',
      criadoEm: Date.now(),
      estado: 'feita',
      totais: [9],
      descanso: 'VIDA',
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByTestId('valor-VIDA').textContent).toBe('5 / 45');
  });
});
