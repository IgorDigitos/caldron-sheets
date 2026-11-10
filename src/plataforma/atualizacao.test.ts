import { describe, expect, it, vi } from 'vitest';
import { INTERVALO_MINIMO, procurarAtualizacaoAoVoltar } from './atualizacao';

function montar() {
  let ouvinte: (() => void) | undefined;
  const doc = {
    visibilityState: 'visible' as DocumentVisibilityState,
    addEventListener: (_: 'visibilitychange', f: () => void) => {
      ouvinte = f;
    },
    removeEventListener: vi.fn(),
  };
  const update = vi.fn(() => Promise.resolve(undefined));
  let t = 0;
  const desligar = procurarAtualizacaoAoVoltar({ update } as never, doc, () => t);
  const voltar = (depois: number) => {
    t += depois;
    doc.visibilityState = 'hidden';
    ouvinte!();
    doc.visibilityState = 'visible';
    ouvinte!();
  };
  return { update, voltar, desligar, doc };
}

describe('procurarAtualizacaoAoVoltar', () => {
  it('procura versão nova ao voltar para o app', () => {
    const { update, voltar } = montar();
    voltar(INTERVALO_MINIMO);
    expect(update).toHaveBeenCalledTimes(1);
    voltar(INTERVALO_MINIMO + 1);
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('não procura ao sair nem em trocas rápidas de app', () => {
    const { update, voltar } = montar();
    voltar(1000);
    voltar(1000);
    expect(update).not.toHaveBeenCalled();
  });

  it('sem rede, o erro é ignorado; desligar remove o ouvinte', async () => {
    const { update, voltar, desligar, doc } = montar();
    update.mockRejectedValueOnce(new Error('offline'));
    voltar(INTERVALO_MINIMO);
    await Promise.resolve();
    desligar();
    expect(doc.removeEventListener).toHaveBeenCalled();
  });
});
