// Suíte única para toda implementação de RepositorioFichas (Dexie, memória, Firestore).
// Cada teste chama `criar()` e espera um repositório VAZIO.

import { describe, expect, it } from 'vitest';
import { aplicar, criarFicha } from '../dominio/ficha';
import { criarItem } from '../dominio/inventario';
import { criarEntrada } from '../dominio/journal';
import type { Imagem } from '../midia/imagem';
import { SKAR } from '../rules/fixtures/skar';
import type { RepositorioFichas } from './repositorio';

export function testarRepositorio(nome: string, criar: () => RepositorioFichas | Promise<RepositorioFichas>): void {
  describe(`Repositório ${nome}`, () => {
    it('começa vazio', async () => {
      expect(await (await criar()).listar()).toEqual([]);
    });

    it('salva e lê a ficha inteira', async () => {
      const repo = await criar();
      const f = aplicar(criarFicha({ nome: 'Skar', ...SKAR }), 'VIDA', 'dano', 8);
      await repo.salvar(f);
      expect(await repo.obter(f.id)).toEqual(f);
    });

    it('obter de id inexistente devolve undefined', async () => {
      expect(await (await criar()).obter('nada')).toBeUndefined();
    });

    it('salvar de novo sobrescreve', async () => {
      const repo = await criar();
      const f = criarFicha({ nome: 'Skar', ...SKAR });
      await repo.salvar(f);
      await repo.salvar(aplicar(f, 'VIDA', 'dano', 10));
      expect((await repo.obter(f.id))!.atuais.VIDA).toBe(35);
      expect(await repo.listar()).toHaveLength(1);
    });

    it('lista a mais recente primeiro, só com o resumo', async () => {
      const repo = await criar();
      await repo.salvar(criarFicha({ nome: 'Antiga', classe: 'Mago' }, 1000));
      await repo.salvar(criarFicha({ nome: 'Nova' }, 2000));
      const lista = await repo.listar();
      expect(lista.map((r) => r.nome)).toEqual(['Nova', 'Antiga']);
      expect(lista[1]).toEqual({
        id: expect.any(String),
        nome: 'Antiga',
        nivel: 1,
        raca: '',
        classe: 'Mago',
        atualizadoEm: 1000,
      });
    });

    it('exclui', async () => {
      const repo = await criar();
      const f = criarFicha({ nome: 'X' });
      await repo.salvar(f);
      await repo.excluir(f.id);
      expect(await repo.obter(f.id)).toBeUndefined();
      expect(await repo.listar()).toEqual([]);
    });

    it('itens: salvar, listar por ficha, excluir', async () => {
      const repo = await criar();
      const a = criarItem('f1', { nome: 'Corda' });
      const b = criarItem('f1', { nome: 'Tocha' });
      await repo.salvarItem(a);
      await repo.salvarItem(b);
      await repo.salvarItem(criarItem('f2', { nome: 'De outro' }));
      expect((await repo.listarItens('f1')).map((i) => i.nome).sort()).toEqual(['Corda', 'Tocha']);
      await repo.salvarItem({ ...a, qtd: 5 });
      await repo.excluirItem(b.id);
      expect(await repo.listarItens('f1')).toEqual([{ ...a, qtd: 5 }]);
    });

    it('imagens: salvar, obter, excluir', async () => {
      const repo = await criar();
      const img: Imagem = { id: 'i1', fichaId: 'f1', dataUrl: 'data:image/webp;base64,AA==', tipo: 'image/webp', largura: 1, altura: 1, bytes: 1, criadoEm: 1 };
      await repo.salvarImagem(img);
      expect(await repo.obterImagem('i1')).toEqual(img);
      await repo.excluirImagem('i1');
      expect(await repo.obterImagem('i1')).toBeUndefined();
    });

    it('journal: salvar, listar por ficha, excluir', async () => {
      const repo = await criar();
      const e = criarEntrada('f1', { titulo: 'Sessão 1' });
      await repo.salvarEntrada(e);
      await repo.salvarEntrada(criarEntrada('f2', { titulo: 'Outra' }));
      expect(await repo.listarJournal('f1')).toEqual([e]);
      await repo.excluirEntrada(e.id);
      expect(await repo.listarJournal('f1')).toEqual([]);
    });

    it('excluir a ficha leva junto itens, imagens e journal (e só dela)', async () => {
      const repo = await criar();
      const f = criarFicha({ nome: 'Skar' });
      const outra = criarFicha({ nome: 'Outra' });
      await repo.salvar(f);
      await repo.salvar(outra);
      await repo.salvarItem(criarItem(f.id, { nome: 'Corda' }));
      await repo.salvarItem(criarItem(outra.id, { nome: 'Fica' }));
      await repo.salvarImagem({ id: 'i1', fichaId: f.id, dataUrl: 'data:image/webp;base64,AA==', tipo: 'image/webp', largura: 1, altura: 1, bytes: 1, criadoEm: 1 });
      await repo.salvarEntrada(criarEntrada(f.id, { titulo: 'x' }));
      await repo.excluir(f.id);
      expect(await repo.listarItens(f.id)).toEqual([]);
      expect(await repo.obterImagem('i1')).toBeUndefined();
      expect(await repo.listarJournal(f.id)).toEqual([]);
      expect(await repo.listarItens(outra.id)).toHaveLength(1);
    });

    it('pacote: obter e gravar substituindo', async () => {
      const repo = await criar();
      expect(await repo.obterPacote('nada')).toBeUndefined();
      const f = criarFicha({ nome: 'Skar' });
      await repo.salvar(f);
      const velho = criarItem(f.id, { nome: 'Velho' });
      await repo.salvarItem(velho);
      const novo = criarItem(f.id, { nome: 'Novo' });
      const entrada = criarEntrada(f.id, { titulo: 'x' });
      await repo.gravarPacote({ ficha: { ...f, nome: 'Skar 2' }, itens: [novo], imagens: [], journal: [entrada] });
      const p = (await repo.obterPacote(f.id))!;
      expect(p.ficha.nome).toBe('Skar 2');
      expect(p.itens).toEqual([novo]);
      expect(p.journal).toEqual([entrada]);
      expect(p.imagens).toEqual([]);
    });

    it('o objeto salvo não muda se a ficha em memória mudar depois', async () => {
      const repo = await criar();
      const f = criarFicha({ nome: 'X' });
      await repo.salvar(f);
      f.atuais.VIDA = -999;
      expect((await repo.obter(f.id))!.atuais.VIDA).not.toBe(-999);
    });
  });
}
