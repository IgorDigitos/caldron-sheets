// Repositório da Mesa (chat + rolagens). Fica separado do RepositorioFichas porque é um fluxo ao
// vivo (o app escuta as mudanças) e só existe na nuvem: quem rola é o bot, lendo o Firestore.

import type { Canal, Mensagem } from '../dominio/mesa';

/** Quantas mensagens a tela acompanha (as mais novas). */
export const LIMITE_MESA = 60;

export interface RepositorioMesa {
  /** Grava no aparelho e devolve; o servidor confirma depois. */
  enviar(canal: Canal, m: Mensagem): Promise<void>;
  /** Chama `ouvinte` com as mensagens mais novas primeiro, a cada mudança. Devolve o "parar". */
  observar(canal: Canal, ouvinte: (m: Mensagem[]) => void, erro?: (e: unknown) => void): () => void;
  /** Só o Mestre (limpar a mesa). */
  apagar(canal: Canal, id: string): Promise<void>;
}

/** Para testes de tela. `responder` simula o bot. */
export class MesaMemoria implements RepositorioMesa {
  private readonly canais: Record<Canal, Map<string, Mensagem>> = { mesa: new Map(), mestre: new Map() };
  private readonly ouvintes = new Set<{ canal: Canal; f: (m: Mensagem[]) => void }>();

  enviar(canal: Canal, m: Mensagem): Promise<void> {
    this.canais[canal].set(m.id, structuredClone(m));
    this.avisar(canal);
    return Promise.resolve();
  }

  observar(canal: Canal, ouvinte: (m: Mensagem[]) => void): () => void {
    const o = { canal, f: ouvinte };
    this.ouvintes.add(o);
    ouvinte(this.lista(canal));
    return () => this.ouvintes.delete(o);
  }

  apagar(canal: Canal, id: string): Promise<void> {
    this.canais[canal].delete(id);
    this.avisar(canal);
    return Promise.resolve();
  }

  /** O que o bot faria: muda a mensagem e avisa a tela. */
  responder(canal: Canal, id: string, mudancas: Partial<Mensagem>): void {
    const m = this.canais[canal].get(id);
    if (!m) throw new Error(`Mensagem ${id} não existe`);
    this.canais[canal].set(id, { ...m, ...mudancas });
    this.avisar(canal);
  }

  todas(canal: Canal): Mensagem[] {
    return this.lista(canal);
  }

  private lista(canal: Canal): Mensagem[] {
    return [...this.canais[canal].values()].sort((a, b) => b.criadoEm - a.criadoEm).slice(0, LIMITE_MESA);
  }

  private avisar(canal: Canal): void {
    for (const o of this.ouvintes) if (o.canal === canal) o.f(this.lista(canal));
  }
}
