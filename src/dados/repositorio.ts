// A tela só conhece esta interface. Etapas 2–3: Dexie (IndexedDB). Etapa 4: Firestore.

import type { Ficha } from '../dominio/ficha';
import type { Item } from '../dominio/inventario';
import type { EntradaJournal } from '../dominio/journal';
import type { Skill } from '../dominio/skills';
import type { Imagem } from '../midia/imagem';

export interface ResumoFicha {
  id: string;
  nome: string;
  nivel: number;
  raca: string;
  classe: string;
  atualizadoEm: number;
  donoUid?: string;
}

/** Tudo de um personagem, como vai no arquivo de exportação. */
export interface PacoteFicha {
  ficha: Ficha;
  itens: Item[];
  imagens: Imagem[];
  journal: EntradaJournal[];
  skills: Skill[];
}

export interface RepositorioFichas {
  listar(): Promise<ResumoFicha[]>;
  obter(id: string): Promise<Ficha | undefined>;
  salvar(ficha: Ficha): Promise<void>;
  /** Exclui a ficha e tudo dela (itens, imagens, journal, skills). */
  excluir(id: string): Promise<void>;

  listarItens(fichaId: string): Promise<Item[]>;
  salvarItem(item: Item): Promise<void>;
  excluirItem(id: string): Promise<void>;

  obterImagem(id: string): Promise<Imagem | undefined>;
  salvarImagem(imagem: Imagem): Promise<void>;
  excluirImagem(id: string): Promise<void>;

  listarJournal(fichaId: string): Promise<EntradaJournal[]>;
  salvarEntrada(entrada: EntradaJournal): Promise<void>;
  excluirEntrada(id: string): Promise<void>;

  listarSkills(fichaId: string): Promise<Skill[]>;
  salvarSkill(skill: Skill): Promise<void>;
  excluirSkill(id: string): Promise<void>;

  /** Lê tudo de uma ficha de uma vez (para exportar). */
  obterPacote(fichaId: string): Promise<PacoteFicha | undefined>;
  /** Grava o pacote inteiro, substituindo o que existir com o mesmo id da ficha. Tudo ou nada. */
  gravarPacote(pacote: PacoteFicha): Promise<void>;
}

export function resumir(f: Ficha): ResumoFicha {
  return {
    id: f.id,
    nome: f.nome,
    nivel: f.nivel,
    raca: f.raca,
    classe: f.classe,
    atualizadoEm: f.atualizadoEm,
    ...(f.donoUid ? { donoUid: f.donoUid } : {}),
  };
}
