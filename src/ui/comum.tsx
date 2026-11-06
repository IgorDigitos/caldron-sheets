import { useEffect, useState } from 'preact/hooks';
import type { Ficha } from '../dominio/ficha';
import type { RepositorioFichas } from '../dados/repositorio';

export type Aba = 'ficha' | 'inventario' | 'journal';

const ABAS: { id: Aba; nome: string; sufixo: string }[] = [
  { id: 'ficha', nome: 'Ficha', sufixo: '' },
  { id: 'inventario', nome: 'Inventário', sufixo: '/inventario' },
  { id: 'journal', nome: 'Journal', sufixo: '/journal' },
];

export function rotaAba(fichaId: string, aba: Aba): string {
  return `#/ficha/${fichaId}${ABAS.find((a) => a.id === aba)!.sufixo}`;
}

export function AbasFicha({ fichaId, aba }: { fichaId: string; aba: Aba }) {
  return (
    <nav class="abas-ficha">
      <a href="#/" class="voltar">
        ← Fichas
      </a>
      <div class="abas" role="tablist">
        {ABAS.map((a) => (
          <a
            key={a.id}
            href={rotaAba(fichaId, a.id)}
            role="tab"
            aria-selected={a.id === aba}
            class={a.id === aba ? 'aba ativa' : 'aba'}
          >
            {a.nome}
          </a>
        ))}
      </div>
    </nav>
  );
}

export function Cabecalho({ ficha }: { ficha: Ficha }) {
  return (
    <header class="cabecalho">
      <h1>{ficha.nome}</h1>
      <p class="subtitulo">{[ficha.raca, ficha.classe, `Nível ${ficha.nivel}`].filter(Boolean).join(' · ')}</p>
    </header>
  );
}

/** Carrega a ficha; `null` = não existe, `undefined` = carregando. */
export function useFicha(repo: RepositorioFichas, id: string) {
  const [ficha, setFicha] = useState<Ficha | null | undefined>(undefined);
  useEffect(() => {
    let vivo = true;
    repo.obter(id).then((f) => vivo && setFicha(f ?? null));
    return () => {
      vivo = false;
    };
  }, [repo, id]);
  return [ficha, setFicha] as const;
}

export function NaoEncontrada() {
  return (
    <main class="pagina">
      <p>Ficha não encontrada.</p>
      <a href="#/">Voltar</a>
    </main>
  );
}

/** Lê um campo numérico; vazio vira `vazio`. Aceita vírgula decimal. */
export function lerNumero(texto: string, vazio = 0): number {
  const t = texto.trim().replace(',', '.');
  return t === '' ? vazio : Number(t);
}

/** Hora se for hoje; senão, dia/mês e hora (atributos mudam entre sessões). */
export function Hora({ em }: { em: number }) {
  const d = new Date(em);
  const hoje = new Date().toDateString() === d.toDateString();
  const texto = hoje
    ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return <time dateTime={d.toISOString()}>{texto}</time>;
}
