import { describe, expect, it } from 'vitest';
import { marcarMigracaoResolvida, migracaoResolvida, migrar } from './migracao';
import { RepositorioMemoria } from '../dados/memoria';
import { aplicar, criarFicha } from '../dominio/ficha';
import { criarItem } from '../dominio/inventario';
import { criarEntrada } from '../dominio/journal';

describe('migrar fichas locais para a nuvem', () => {
  it('envia ficha com itens e journal; local continua intacto', async () => {
    const local = new RepositorioMemoria();
    const nuvem = new RepositorioMemoria();
    const f = criarFicha({ nome: 'Skar' }, 1000);
    await local.salvar(f);
    await local.salvarItem(criarItem(f.id, { nome: 'Corda' }));
    await local.salvarEntrada(criarEntrada(f.id, { titulo: 'Sessão 1' }));

    expect(await migrar(local, nuvem)).toEqual({ enviadas: 1, ignoradas: 0 });
    expect(await nuvem.obterPacote(f.id)).toEqual(await local.obterPacote(f.id));
    expect(await local.listar()).toHaveLength(1);
  });

  it('última edição ganha: nuvem mais nova fica; local mais nova substitui', async () => {
    const local = new RepositorioMemoria();
    const nuvem = new RepositorioMemoria();
    const a = criarFicha({ nome: 'A' }, 1000);
    const b = criarFicha({ nome: 'B' }, 1000);
    await local.salvar(aplicar(a, 'VIDA', 'dano', 1, 2000)); // local mais nova
    await nuvem.salvar(a);
    await local.salvar(b);
    await nuvem.salvar(aplicar(b, 'VIDA', 'dano', 3, 5000)); // nuvem mais nova

    expect(await migrar(local, nuvem)).toEqual({ enviadas: 1, ignoradas: 1 });
    expect((await nuvem.obter(a.id))!.atualizadoEm).toBe(2000);
    expect((await nuvem.obter(b.id))!.atualizadoEm).toBe(5000);
  });

  it('nada para migrar', async () => {
    expect(await migrar(new RepositorioMemoria(), new RepositorioMemoria())).toEqual({ enviadas: 0, ignoradas: 0 });
  });

  it('lembra que a migração foi resolvida, por conta', () => {
    const mapa = new Map<string, string>();
    const arm = { getItem: (k: string) => mapa.get(k) ?? null, setItem: (k: string, v: string) => void mapa.set(k, v) };
    expect(migracaoResolvida('u1', arm)).toBe(false);
    marcarMigracaoResolvida('u1', arm);
    expect(migracaoResolvida('u1', arm)).toBe(true);
    expect(migracaoResolvida('u2', arm)).toBe(false);
  });

  it('sem localStorage (modo privado) não quebra', () => {
    const quebrado = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    };
    expect(migracaoResolvida('u1', quebrado)).toBe(false);
    expect(() => marcarMigracaoResolvida('u1', quebrado)).not.toThrow();
  });
});
