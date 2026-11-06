// A tela só conhece esta interface. Etapa 2: Dexie (IndexedDB). Etapa 4: Firestore.

import type { Ficha } from '../dominio/ficha';

export interface ResumoFicha {
  id: string;
  nome: string;
  nivel: number;
  raca: string;
  classe: string;
  atualizadoEm: number;
}

export interface RepositorioFichas {
  listar(): Promise<ResumoFicha[]>;
  obter(id: string): Promise<Ficha | undefined>;
  salvar(ficha: Ficha): Promise<void>;
  excluir(id: string): Promise<void>;
}

export function resumir(f: Ficha): ResumoFicha {
  return { id: f.id, nome: f.nome, nivel: f.nivel, raca: f.raca, classe: f.classe, atualizadoEm: f.atualizadoEm };
}
