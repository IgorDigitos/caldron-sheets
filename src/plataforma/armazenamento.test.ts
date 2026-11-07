import { describe, expect, it, vi } from 'vitest';
import { pedirArmazenamentoPersistente } from './armazenamento';

describe('pedirArmazenamentoPersistente', () => {
  it('já persistente não pede de novo', async () => {
    const persist = vi.fn();
    expect(await pedirArmazenamentoPersistente({ persisted: async () => true, persist })).toBe('persistente');
    expect(persist).not.toHaveBeenCalled();
  });

  it('pede e o navegador aceita ou nega', async () => {
    expect(await pedirArmazenamentoPersistente({ persisted: async () => false, persist: async () => true })).toBe('persistente');
    expect(await pedirArmazenamentoPersistente({ persisted: async () => false, persist: async () => false })).toBe('negado');
  });

  it('navegador sem a API ou com erro', async () => {
    expect(await pedirArmazenamentoPersistente(undefined)).toBe('indisponivel');
    const quebrado = { persisted: async () => Promise.reject(new Error('x')), persist: async () => true };
    expect(await pedirArmazenamentoPersistente(quebrado)).toBe('indisponivel');
  });
});
