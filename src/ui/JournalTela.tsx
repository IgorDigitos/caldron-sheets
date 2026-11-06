import { useEffect, useState } from 'preact/hooks';
import {
  criarEntrada,
  editarEntrada,
  formatarData,
  hojeISO,
  ordenarJournal,
  type EntradaJournal,
} from '../dominio/journal';
import type { RepositorioFichas } from '../dados/repositorio';
import { AbasFicha, Cabecalho, NaoEncontrada, useFicha } from './comum';

export function JournalTela({ repo, id }: { repo: RepositorioFichas; id: string }) {
  const [ficha] = useFicha(repo, id);
  const [entradas, setEntradas] = useState<EntradaJournal[] | undefined>();
  const [editando, setEditando] = useState<EntradaJournal | 'nova' | null>(null);

  useEffect(() => {
    let vivo = true;
    repo.listarJournal(id).then((l) => vivo && setEntradas(l));
    return () => {
      vivo = false;
    };
  }, [repo, id]);

  if (ficha === undefined || entradas === undefined) return <p class="carregando">Carregando…</p>;
  if (ficha === null) return <NaoEncontrada />;

  const proximaSessao = Math.max(0, ...entradas.map((e) => e.sessao ?? 0)) + 1;

  return (
    <main class="pagina journal">
      <AbasFicha fichaId={id} aba="journal" />
      <Cabecalho ficha={ficha} />

      {editando ? (
        <FormEntrada
          repo={repo}
          fichaId={id}
          entrada={editando === 'nova' ? undefined : editando}
          sessaoSugerida={proximaSessao}
          onFechar={(mudou) => {
            if (mudou) {
              const { tipo, entrada } = mudou;
              setEntradas(
                tipo === 'excluida'
                  ? entradas.filter((e) => e.id !== entrada.id)
                  : [...entradas.filter((e) => e.id !== entrada.id), entrada],
              );
            }
            setEditando(null);
          }}
        />
      ) : (
        <button type="button" class="btn btn-primario largo" onClick={() => setEditando('nova')}>
          Nova entrada
        </button>
      )}

      {entradas.length === 0 ? (
        <p class="vazio">Nenhuma entrada ainda.</p>
      ) : (
        <ol class="lista-journal" aria-label="Entradas do journal">
          {ordenarJournal(entradas).map((e) => (
            <li key={e.id}>
              <article>
                <header>
                  <time dateTime={e.data}>{formatarData(e.data)}</time>
                  {e.sessao !== undefined && <span class="sessao">Sessão {e.sessao}</span>}
                  <button type="button" class="btn-link" onClick={() => setEditando(e)} aria-label={`Editar ${e.titulo || formatarData(e.data)}`}>
                    Editar
                  </button>
                </header>
                {e.titulo && <h3>{e.titulo}</h3>}
                {e.texto && <p class="texto-journal">{e.texto}</p>}
              </article>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}

type Mudanca = { tipo: 'salva' | 'excluida'; entrada: EntradaJournal } | null;

function FormEntrada(props: {
  repo: RepositorioFichas;
  fichaId: string;
  entrada?: EntradaJournal;
  sessaoSugerida: number;
  onFechar: (m: Mudanca) => void;
}) {
  const { repo, fichaId, entrada, onFechar } = props;
  const [data, setData] = useState(entrada?.data ?? hojeISO());
  const [sessao, setSessao] = useState(String(entrada ? (entrada.sessao ?? '') : props.sessaoSugerida));
  const [titulo, setTitulo] = useState(entrada?.titulo ?? '');
  const [texto, setTexto] = useState(entrada?.texto ?? '');
  const [erro, setErro] = useState('');

  const salvar = async (ev: Event) => {
    ev.preventDefault();
    try {
      const dados = { data, titulo, texto, sessao: sessao.trim() === '' ? undefined : Number(sessao) };
      const salva = entrada ? editarEntrada(entrada, dados) : criarEntrada(fichaId, dados);
      await repo.salvarEntrada(salva);
      onFechar({ tipo: 'salva', entrada: salva });
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const excluir = async () => {
    if (!entrada || !confirm('Excluir esta entrada do journal?')) return;
    try {
      await repo.excluirEntrada(entrada.id);
      onFechar({ tipo: 'excluida', entrada });
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  return (
    <form class="form-journal" onSubmit={salvar} aria-label={entrada ? 'Editar entrada' : 'Nova entrada'}>
      <div class="campos-texto">
        <label class="campo">
          <span>Data</span>
          <input type="date" required value={data} onInput={(e) => setData(e.currentTarget.value)} />
        </label>
        <label class="campo">
          <span>Sessão</span>
          <input type="text" inputMode="numeric" value={sessao} onInput={(e) => setSessao(e.currentTarget.value)} />
        </label>
      </div>
      <label class="campo">
        <span>Título</span>
        <input type="text" value={titulo} onInput={(e) => setTitulo(e.currentTarget.value)} />
      </label>
      <label class="campo">
        <span>Texto</span>
        <textarea rows={6} value={texto} onInput={(e) => setTexto(e.currentTarget.value)} />
      </label>
      {erro && (
        <p class="erro" role="alert">
          {erro}
        </p>
      )}
      <div class="form-acoes">
        <button type="submit" class="btn btn-primario">
          Salvar entrada
        </button>
        <button type="button" class="btn" onClick={() => onFechar(null)}>
          Cancelar
        </button>
        {entrada && (
          <button type="button" class="btn btn-dano" onClick={() => void excluir()}>
            Excluir
          </button>
        )}
      </div>
    </form>
  );
}
