import { describe, expect, it } from 'vitest';
import { exportarFicha, importarFicha, ImportInvalido, lerArquivo, nomeArquivo, type ArquivoExport } from './exportacao';
import { RepositorioMemoria } from './memoria';
import { aplicar, alterar, criarFicha } from '../dominio/ficha';
import { criarItem, movimentarMoeda } from '../dominio/inventario';
import { criarEntrada } from '../dominio/journal';
import { SKAR } from '../rules/fixtures/skar';
import type { Imagem } from '../midia/imagem';

const DATA_URL = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';

async function skarCompleto() {
  const repo = new RepositorioMemoria();
  let ficha = aplicar(criarFicha({ nome: 'Skar Lionet', raca: 'Humano', ...SKAR }), 'VIDA', 'dano', 8);
  const r = alterar(ficha, { tipo: 'nivel' }, 3);
  if (!r.ok) throw new Error('falhou');
  ficha = { ...r.ficha, carteira: movimentarMoeda(movimentarMoeda(r.ficha.carteira, 'ouro', 2), 'alma', 1) };
  await repo.salvar(ficha);
  const imagem: Imagem = { id: 'img1', fichaId: ficha.id, dataUrl: DATA_URL, tipo: 'image/webp', largura: 1, altura: 1, bytes: 30, criadoEm: 1 };
  await repo.salvarImagem(imagem);
  await repo.salvarItem(criarItem(ficha.id, { nome: 'Lamparina mágica', imagemId: 'img1', peso: 0.5 }));
  await repo.salvarItem(criarItem(ficha.id, { nome: 'Cota de malha', defF: 4, equipado: true }));
  await repo.salvarImagem({ ...imagem, id: 'img2' });
  await repo.salvarEntrada(
    criarEntrada(ficha.id, { titulo: 'Sessão 1', texto: 'Skar derrubou o ogro.', sessao: 1, imagens: ['img2'] }),
  );
  return { repo, ficha };
}

const ordenar = <T extends { id: string }>(l: T[]) => [...l].sort((a, b) => a.id.localeCompare(b.id));

describe('exportar e importar', () => {
  it('ida e volta gera a mesma ficha, itens, fotos e journal', async () => {
    const { repo, ficha } = await skarCompleto();
    const arquivo = await exportarFicha(repo, ficha.id, new Date('2026-11-06T20:00:00Z'));
    expect(arquivo).toMatchObject({ formato: 'caldron-sheets', versao: 1, exportadoEm: '2026-11-06T20:00:00.000Z' });

    const texto = JSON.stringify(arquivo);
    const outro = new RepositorioMemoria();
    const id = await importarFicha(outro, lerArquivo(texto));

    expect(id).toBe(ficha.id);
    const original = (await repo.obterPacote(ficha.id))!;
    const importado = (await outro.obterPacote(id))!;
    expect(importado.ficha).toEqual(original.ficha);
    expect(ordenar(importado.itens)).toEqual(ordenar(original.itens));
    expect(ordenar(importado.imagens)).toEqual(ordenar(original.imagens));
    expect(importado.journal[0]!.imagens).toEqual(['img2']);
    expect(importado.ficha.carteira.historico!.map((h) => h.moeda)).toEqual(['alma', 'ouro']);
    expect(importado.journal).toEqual(original.journal);
  });

  it('importar por cima substitui (itens que não estão no backup somem)', async () => {
    const { repo, ficha } = await skarCompleto();
    const arquivo = lerArquivo(JSON.stringify(await exportarFicha(repo, ficha.id)));
    await repo.salvarItem(criarItem(ficha.id, { nome: 'Item depois do backup' }));
    await repo.salvar(aplicar(ficha, 'VIDA', 'dano', 30));

    await importarFicha(repo, arquivo);
    const itens = await repo.listarItens(ficha.id);
    expect(itens.map((i) => i.nome).sort()).toEqual(['Cota de malha', 'Lamparina mágica']);
    expect((await repo.obter(ficha.id))!.atuais.VIDA).toBe(37);
  });

  it('arquivo antigo sem carteira e alterações é completado', async () => {
    const { repo, ficha } = await skarCompleto();
    const arquivo = JSON.parse(JSON.stringify(await exportarFicha(repo, ficha.id))) as ArquivoExport;
    delete (arquivo.ficha as Partial<typeof arquivo.ficha>).carteira;
    delete (arquivo.ficha as Partial<typeof arquivo.ficha>).alteracoes;
    const outro = new RepositorioMemoria();
    await importarFicha(outro, lerArquivo(JSON.stringify(arquivo)));
    const f = (await outro.obter(ficha.id))!;
    expect(f.alteracoes).toEqual([]);
    expect(f.carteira.alma).toBe(0);
  });

  it('exportar ficha inexistente', async () => {
    await expect(exportarFicha(new RepositorioMemoria(), 'nada')).rejects.toThrow('Ficha não encontrada');
  });

  it('nome do arquivo', () => {
    expect(nomeArquivo("Skar Lionet")).toBe('skar-lionet.caldron.json');
    expect(nomeArquivo("Ez'kher Ãção!")).toBe('ez-kher-acao.caldron.json');
    expect(nomeArquivo('???')).toBe('ficha.caldron.json');
  });
});

describe('lerArquivo — validação', () => {
  async function valido() {
    const { repo, ficha } = await skarCompleto();
    return JSON.parse(JSON.stringify(await exportarFicha(repo, ficha.id))) as Record<string, unknown> & ArquivoExport;
  }

  it.each([
    ['não é JSON', () => 'oi', 'não é um JSON válido'],
    ['outro formato', () => JSON.stringify({ formato: 'outro' }), 'não é uma ficha do Caldron Sheets'],
    ['array', () => '[]', 'não é uma ficha'],
    ['grande demais', () => ' '.repeat(20 * 1024 * 1024 + 1), 'grande demais'],
  ])('%s', (_n, gerar, msg) => {
    expect(() => lerArquivo(gerar())).toThrow(ImportInvalido);
    expect(() => lerArquivo(gerar())).toThrow(msg);
  });

  it.each<[string, (a: ArquivoExport & Record<string, unknown>) => void, string]>([
    ['sem versão', (a) => delete (a as Partial<ArquivoExport>).versao, 'sem versão'],
    ['versão futura', (a) => (a.versao = 99), 'versão mais nova'],
    ['sem ficha', (a) => delete (a as Partial<ArquivoExport>).ficha, 'sem ficha'],
    ['ficha sem id', (a) => (a.ficha.id = ''), 'sem id ou nome'],
    ['nível texto', (a) => ((a.ficha as unknown as Record<string, unknown>).nivel = '2'), 'sem nível'],
    ['sem atributos', (a) => delete (a.ficha as Partial<typeof a.ficha>).atributos, 'sem atributos'],
    ['vida texto', (a) => ((a.ficha.atuais as unknown as Record<string, unknown>).VIDA = 'x'), 'VIDA atual'],
    ['sem histórico', (a) => delete (a.ficha as Partial<typeof a.ficha>).historico, 'sem histórico'],
    ['sem itens', (a) => delete (a as Partial<ArquivoExport>).itens, 'lista de itens'],
    ['item de outra ficha', (a) => (a.itens[0]!.fichaId = 'outra'), 'itens nº 1'],
    ['item sem qtd', (a) => ((a.itens[1] as unknown as Record<string, unknown>).qtd = null), 'itens nº 2'],
    ['imagem que não é imagem', (a) => (a.imagens[0]!.dataUrl = 'javascript:alert(1)'), 'imagens nº 1'],
    ['imagem svg', (a) => (a.imagens[0]!.dataUrl = 'data:image/svg+xml;base64,PHN2Zz4='), 'imagens nº 1'],
    ['journal sem texto', (a) => ((a.journal[0] as unknown as Record<string, unknown>).texto = 3), 'journal nº 1'],
    ['journal com imagem que não está no arquivo', (a) => (a.journal[0]!.imagens = ['sumiu']), 'journal nº 1'],
    ['journal com imagens que não é lista', (a) => ((a.journal[0] as unknown as Record<string, unknown>).imagens = 'img2'), 'journal nº 1'],
  ])('%s', async (_n, estragar, msg) => {
    const a = await valido();
    estragar(a);
    expect(() => lerArquivo(JSON.stringify(a))).toThrow(msg);
  });
});
