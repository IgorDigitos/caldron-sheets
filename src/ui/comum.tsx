import { useEffect, useRef, useState } from 'preact/hooks';
import { atualizarParaRegrasAtuais, type Ficha } from '../dominio/ficha';
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

/**
 * Carrega a ficha; `null` = não existe, `undefined` = carregando. Ficha salva com regras antigas é
 * recalculada e salva de novo (ex.: Vida máx. 38,7 → 39).
 */
export function useFicha(repo: RepositorioFichas, id: string) {
  const [ficha, setFicha] = useState<Ficha | null | undefined>(undefined);
  useEffect(() => {
    let vivo = true;
    repo.obter(id).then((f) => {
      if (!vivo) return;
      const atualizada = f && atualizarParaRegrasAtuais(f);
      if (atualizada) void repo.salvar(atualizada).catch(() => {});
      setFicha(atualizada ?? f ?? null);
    });
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

interface PropsEntrada {
  /** Valor salvo. Só substitui o que está digitado quando ele muda de verdade. */
  valor: string;
  /** Chamado ao confirmar (sair do campo / Enter). Devolva `false` para desfazer o que foi digitado. */
  onConfirmar: (texto: string) => boolean | void;
  type?: 'text' | 'number';
  inputMode?: 'text' | 'numeric' | 'decimal';
  min?: number;
  step?: number | 'any';
}

/**
 * Campo com rascunho próprio. Um `<input value={...}>` comum volta ao valor salvo a cada redesenho
 * da tela — e com a sincronização mudando o indicador o tempo todo, isso apagava o que a pessoa
 * estava digitando antes de ela sair do campo.
 */
export function Entrada({ valor, onConfirmar, type = 'text', inputMode, min, step }: PropsEntrada) {
  const [texto, setTexto] = useState(valor);
  const ultimoValor = useRef(valor);
  useEffect(() => {
    if (valor !== ultimoValor.current) {
      ultimoValor.current = valor;
      setTexto(valor);
    }
  }, [valor]);

  const comum = {
    inputMode,
    value: texto,
    onInput: (e: Event) => setTexto((e.currentTarget as HTMLInputElement).value),
    onChange: (e: Event) => {
      const input = e.currentTarget as HTMLInputElement;
      if (onConfirmar(input.value) === false) {
        // Desfaz também na tela: se o rascunho já era o valor salvo, o redesenho não acontece.
        input.value = valor;
        setTexto(valor);
      }
    },
  };
  // O tipo do <input> no Preact 11 depende do `type` literal, por isso os dois ramos.
  return type === 'number' ? <input type="number" min={min} step={step} {...comum} /> : <input type="text" {...comum} />;
}
