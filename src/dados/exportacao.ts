// Exporta e importa um personagem inteiro (ficha, itens, fotos e journal) em JSON — backup manual.

import { carteiraVazia } from '../dominio/inventario';
import type { PacoteFicha, RepositorioFichas } from './repositorio';

export const FORMATO = 'caldron-sheets';
export const VERSAO_EXPORT = 1;
const MAX_BYTES = 20 * 1024 * 1024;

export interface ArquivoExport extends PacoteFicha {
  formato: typeof FORMATO;
  versao: number;
  exportadoEm: string;
}

export class ImportInvalido extends Error {}

export async function exportarFicha(repo: RepositorioFichas, fichaId: string, agora = new Date()): Promise<ArquivoExport> {
  const pacote = await repo.obterPacote(fichaId);
  if (!pacote) throw new ImportInvalido('Ficha não encontrada');
  return { formato: FORMATO, versao: VERSAO_EXPORT, exportadoEm: agora.toISOString(), ...pacote };
}

/** Nome de arquivo seguro: "skar-lionet.caldron.json". */
export function nomeArquivo(nome: string): string {
  const base = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${base || 'ficha'}.caldron.json`;
}

const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const ehTexto = (v: unknown): v is string => typeof v === 'string';
const ehNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function exigir(condicao: boolean, mensagem: string): asserts condicao {
  if (!condicao) throw new ImportInvalido(mensagem);
}

function validarLista(v: unknown, nome: string, fichaId: string, checar: (o: Record<string, unknown>) => boolean) {
  exigir(Array.isArray(v), `Arquivo sem a lista de ${nome}`);
  v.forEach((o, i) => {
    exigir(ehObjeto(o) && ehTexto(o.id) && o.fichaId === fichaId && checar(o), `${nome} nº ${i + 1} está inválido`);
  });
}

/**
 * Lê o texto do arquivo e confere a estrutura antes de tocar no banco.
 * Nada do arquivo é executado: é JSON puro, e cada campo é conferido.
 */
export function lerArquivo(texto: string): ArquivoExport {
  exigir(texto.length <= MAX_BYTES, 'Arquivo grande demais');
  let dados: unknown;
  try {
    dados = JSON.parse(texto);
  } catch {
    throw new ImportInvalido('O arquivo não é um JSON válido');
  }
  exigir(ehObjeto(dados) && dados.formato === FORMATO, 'Este arquivo não é uma ficha do Caldron Sheets');
  exigir(ehNumero(dados.versao), 'Arquivo sem versão');
  exigir(dados.versao <= VERSAO_EXPORT, 'Arquivo de uma versão mais nova do app — atualize o app');

  const f = dados.ficha;
  exigir(ehObjeto(f), 'Arquivo sem ficha');
  exigir(ehTexto(f.id) && f.id.length > 0 && ehTexto(f.nome), 'Ficha sem id ou nome');
  exigir(ehNumero(f.nivel), 'Ficha sem nível');
  exigir(ehObjeto(f.atributos) && ehObjeto(f.maximos) && ehObjeto(f.atuais), 'Ficha sem atributos ou recursos');
  for (const r of ['VIDA', 'STA', 'MANA']) {
    exigir(ehNumero((f.atuais as Record<string, unknown>)[r]), `Ficha sem ${r} atual`);
  }
  exigir(Array.isArray(f.historico), 'Ficha sem histórico');

  validarLista(dados.itens, 'itens', f.id, (o) => ehTexto(o.nome) && ehNumero(o.qtd) && ehNumero(o.peso));
  validarLista(dados.imagens, 'imagens', f.id, (o) => ehTexto(o.dataUrl) && /^data:image\/(webp|jpeg|png);base64,/.test(o.dataUrl));
  const idsImagens = new Set((dados.imagens as { id: string }[]).map((i) => i.id));
  validarLista(
    dados.journal,
    'journal',
    f.id,
    (o) =>
      ehTexto(o.data) &&
      ehTexto(o.texto) &&
      (o.imagens === undefined || (Array.isArray(o.imagens) && o.imagens.every((id) => ehTexto(id) && idsImagens.has(id)))),
  );

  return dados as unknown as ArquivoExport;
}

/** Campos que o app atual espera e um arquivo antigo pode não ter. */
function completar(a: ArquivoExport): PacoteFicha {
  const ficha = { ...a.ficha };
  ficha.alteracoes ??= [];
  ficha.carteira ??= carteiraVazia();
  return { ficha, itens: a.itens, imagens: a.imagens, journal: a.journal };
}

export async function importarFicha(repo: RepositorioFichas, arquivo: ArquivoExport): Promise<string> {
  const pacote = completar(arquivo);
  await repo.gravarPacote(pacote);
  return pacote.ficha.id;
}
