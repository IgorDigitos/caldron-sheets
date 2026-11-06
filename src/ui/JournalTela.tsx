import { useEffect, useState } from 'preact/hooks';
import {
  criarEntrada,
  editarEntrada,
  formatarData,
  hojeISO,
  MAX_IMAGENS_ENTRADA,
  ordenarJournal,
  type EntradaJournal,
} from '../dominio/journal';
import type { RepositorioFichas } from '../dados/repositorio';
import { prepararImagem as prepararPadrao, type Imagem } from '../midia/imagem';
import { AbasFicha, Cabecalho, NaoEncontrada, useFicha } from './comum';
import { Miniatura } from './Miniatura';

interface Props {
  repo: RepositorioFichas;
  id: string;
  /** Injetável para testes (jsdom não tem canvas). */
  prepararImagem?: typeof prepararPadrao;
}

export function JournalTela({ repo, id, prepararImagem = prepararPadrao }: Props) {
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
          prepararImagem={prepararImagem}
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
                  <button
                    type="button"
                    class="btn-link"
                    onClick={() => setEditando(e)}
                    aria-label={`Editar ${e.titulo || formatarData(e.data)}`}
                  >
                    Editar
                  </button>
                </header>
                {e.titulo && <h3>{e.titulo}</h3>}
                {e.texto && <p class="texto-journal">{e.texto}</p>}
                {(e.imagens?.length ?? 0) > 0 && (
                  <div class="imagens-journal">
                    {e.imagens!.map((imgId, i) => (
                      <Miniatura
                        key={imgId}
                        repo={repo}
                        imagemId={imgId}
                        classe="imagem-journal"
                        alt={`Imagem ${i + 1} de ${e.titulo || formatarData(e.data)}`}
                      />
                    ))}
                  </div>
                )}
              </article>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}

type Mudanca = { tipo: 'salva' | 'excluida'; entrada: EntradaJournal } | null;

/** Imagem já salva (só o id) ou recém-escolhida (ainda não gravada). */
type ImagemForm = { tipo: 'salva'; id: string } | { tipo: 'nova'; imagem: Imagem };
const idDe = (i: ImagemForm) => (i.tipo === 'salva' ? i.id : i.imagem.id);

function FormEntrada(props: {
  repo: RepositorioFichas;
  fichaId: string;
  entrada?: EntradaJournal;
  sessaoSugerida: number;
  prepararImagem: typeof prepararPadrao;
  onFechar: (m: Mudanca) => void;
}) {
  const { repo, fichaId, entrada, onFechar } = props;
  const [data, setData] = useState(entrada?.data ?? hojeISO());
  const [sessao, setSessao] = useState(String(entrada ? (entrada.sessao ?? '') : props.sessaoSugerida));
  const [titulo, setTitulo] = useState(entrada?.titulo ?? '');
  const [texto, setTexto] = useState(entrada?.texto ?? '');
  const [imagens, setImagens] = useState<ImagemForm[]>(
    (entrada?.imagens ?? []).map((id) => ({ tipo: 'salva', id })),
  );
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');

  const adicionarImagens = async (ev: Event) => {
    const input = ev.currentTarget as HTMLInputElement;
    const arquivos = [...(input.files ?? [])];
    input.value = '';
    const vagas = MAX_IMAGENS_ENTRADA - imagens.length;
    if (arquivos.length > vagas) setErro(`No máximo ${MAX_IMAGENS_ENTRADA} imagens por entrada`);
    else setErro('');
    setProcessando(true);
    try {
      const novas: ImagemForm[] = [];
      for (const a of arquivos.slice(0, vagas)) novas.push({ tipo: 'nova', imagem: await props.prepararImagem(a, fichaId) });
      setImagens((atuais) => [...atuais, ...novas]);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setProcessando(false);
    }
  };

  const salvar = async (ev: Event) => {
    ev.preventDefault();
    try {
      const dados = {
        data,
        titulo,
        texto,
        sessao: sessao.trim() === '' ? undefined : Number(sessao),
        imagens: imagens.map(idDe),
      };
      const salva = entrada ? editarEntrada(entrada, dados) : criarEntrada(fichaId, dados);
      for (const i of imagens) if (i.tipo === 'nova') await repo.salvarImagem(i.imagem);
      await repo.salvarEntrada(salva);
      const ficaram = new Set(salva.imagens ?? []);
      for (const antiga of entrada?.imagens ?? []) if (!ficaram.has(antiga)) await repo.excluirImagem(antiga);
      onFechar({ tipo: 'salva', entrada: salva });
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const excluir = async () => {
    if (!entrada || !confirm('Excluir esta entrada do journal?')) return;
    try {
      await repo.excluirEntrada(entrada.id);
      for (const id of entrada.imagens ?? []) await repo.excluirImagem(id);
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

      <div class="imagens-form" aria-label="Imagens da entrada" role="group">
        {imagens.map((i, n) => (
          <div key={idDe(i)} class="imagem-form">
            {i.tipo === 'nova' ? (
              <img class="miniatura grande" src={i.imagem.dataUrl} alt={`Imagem ${n + 1}`} />
            ) : (
              <Miniatura repo={repo} imagemId={i.id} classe="miniatura grande" alt={`Imagem ${n + 1}`} />
            )}
            <button
              type="button"
              class="btn-icone remover-imagem"
              aria-label={`Remover imagem ${n + 1}`}
              onClick={() => setImagens(imagens.filter((x) => x !== i))}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      {imagens.length < MAX_IMAGENS_ENTRADA && (
        <label class="btn botao-arquivo">
          Adicionar imagem
          <input
            type="file"
            accept="image/*"
            multiple
            class="sr-only"
            onChange={(e) => void adicionarImagens(e)}
            aria-label="Adicionar imagem"
          />
        </label>
      )}
      {processando && <p class="vazio">Comprimindo imagem…</p>}

      {erro && (
        <p class="erro" role="alert">
          {erro}
        </p>
      )}
      <div class="form-acoes">
        <button type="submit" class="btn btn-primario" disabled={processando}>
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
