import { novoId } from './id';

export interface EntradaJournal {
  id: string;
  fichaId: string;
  /** Data da sessão, AAAA-MM-DD. */
  data: string;
  titulo: string;
  texto: string;
  /** Número da sessão (opcional). */
  sessao?: number;
  criadoEm: number;
  atualizadoEm: number;
}

export type DadosJournal = Partial<Pick<EntradaJournal, 'data' | 'titulo' | 'texto' | 'sessao'>>;

export class EntradaInvalida extends Error {}

/** AAAA-MM-DD no fuso local. */
export function hojeISO(agora = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())}`;
}

function validar(e: EntradaJournal): EntradaJournal {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.data) || Number.isNaN(Date.parse(e.data))) {
    throw new EntradaInvalida('Data inválida');
  }
  const titulo = e.titulo.trim();
  const texto = e.texto.trim();
  if (!titulo && !texto) throw new EntradaInvalida('Escreva um título ou um texto');
  if (e.sessao !== undefined && (!Number.isInteger(e.sessao) || e.sessao < 0)) {
    throw new EntradaInvalida('Sessão precisa ser um número inteiro');
  }
  const limpa: EntradaJournal = { ...e, titulo, texto };
  if (limpa.sessao === undefined) delete limpa.sessao;
  return limpa;
}

export function criarEntrada(fichaId: string, dados: DadosJournal, agora = Date.now()): EntradaJournal {
  return validar({
    id: novoId(),
    fichaId,
    data: dados.data ?? hojeISO(new Date(agora)),
    titulo: dados.titulo ?? '',
    texto: dados.texto ?? '',
    sessao: dados.sessao,
    criadoEm: agora,
    atualizadoEm: agora,
  });
}

export function editarEntrada(e: EntradaJournal, dados: DadosJournal, agora = Date.now()): EntradaJournal {
  return validar({ ...e, ...dados, atualizadoEm: agora });
}

/** Mais recente primeiro: por data, depois pela ordem em que foi criada. */
export function ordenarJournal(entradas: readonly EntradaJournal[]): EntradaJournal[] {
  return [...entradas].sort((a, b) => b.data.localeCompare(a.data) || b.criadoEm - a.criadoEm);
}

/** "06/11/2026" a partir de "2026-11-06" (sem passar por fuso horário). */
export function formatarData(iso: string): string {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}
