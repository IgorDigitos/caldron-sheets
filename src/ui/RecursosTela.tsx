import { useEffect, useState } from 'preact/hooks';
import { criarFicha } from '../dominio/ficha';
import {
  calcularMaximo,
  CORES_RECURSO,
  criarDefRecurso,
  desabilitarRecurso,
  editarDefRecurso,
  type DefRecurso,
} from '../dominio/recursos';
import type { RepositorioFichas } from '../dados/repositorio';
import { SKAR } from '../rules/fixtures/skar';
import { formatar } from '../rules/motor';

/** Ficha usada só para mostrar a prévia da fórmula. */
const EXEMPLO = criarFicha({ nome: 'Skar', ...SKAR });

/** Tela do Mestre: catálogo de recursos personalizados da campanha (ex.: Ímpeto). */
export function RecursosTela({ repo }: { repo: RepositorioFichas }) {
  const [defs, setDefs] = useState<DefRecurso[] | undefined>();
  const [editando, setEditando] = useState<DefRecurso | 'novo' | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let vivo = true;
    repo
      .listarRecursos()
      .then((l) => vivo && setDefs(l))
      .catch((e: Error) => vivo && setErro(e.message));
    return () => {
      vivo = false;
    };
  }, [repo]);

  if (defs === undefined) return <p class="carregando pagina">{erro || 'Carregando…'}</p>;

  /** Apaga do catálogo e tira de todas as fichas que tinham o recurso. */
  const excluir = async (d: DefRecurso) => {
    if (!confirm(`Excluir ${d.nome}? Ele some de todas as fichas que o têm.`)) return;
    try {
      for (const resumo of await repo.listar()) {
        const f = await repo.obter(resumo.id);
        if (f?.maxPersonalizados?.[d.id] !== undefined) await repo.salvar(desabilitarRecurso(f, d.id));
      }
      await repo.excluirRecurso(d.id);
      setDefs(defs.filter((x) => x.id !== d.id));
      setEditando(null);
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  return (
    <main class="pagina recursos-catalogo">
      <nav class="abas-ficha">
        <a href="#/" class="voltar">
          ← Fichas
        </a>
      </nav>
      <header class="cabecalho">
        <h1>Recursos</h1>
        <p class="subtitulo">
          Barras extras além de Vida, Stamina e Mana (ex.: Ímpeto). Crie aqui e marque em cada ficha, em "Editar ficha →
          Recursos especiais".
        </p>
      </header>

      {erro && (
        <p class="erro" role="alert">
          {erro}
        </p>
      )}

      {editando ? (
        <FormRecurso
          def={editando === 'novo' ? undefined : editando}
          onCancelar={() => setEditando(null)}
          onExcluir={(d) => void excluir(d)}
          onSalvar={async (d) => {
            await repo.salvarRecurso(d);
            setDefs([...defs.filter((x) => x.id !== d.id), d].sort((a, b) => a.criadoEm - b.criadoEm));
            setEditando(null);
          }}
        />
      ) : (
        <>
          {defs.length === 0 ? (
            <p class="vazio">Nenhum recurso ainda.</p>
          ) : (
            <ul class="lista-jogadores">
              {defs.map((d) => (
                <li key={d.id}>
                  <button type="button" class="item-abrir" onClick={() => setEditando(d)} aria-label={`Editar ${d.nome}`}>
                    <span class="bolinha" style={{ background: d.cor }} aria-hidden="true" />
                    <span class="item-info">
                      <strong>{d.nome}</strong>
                      <span class="item-detalhes">
                        Máximo: <code>{d.formula}</code> · começa {d.comecaCheio ? 'cheio' : 'em 0'}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" class="btn btn-primario largo" onClick={() => setEditando('novo')}>
            Novo recurso
          </button>
        </>
      )}
    </main>
  );
}

function FormRecurso(props: {
  def?: DefRecurso;
  onSalvar: (d: DefRecurso) => Promise<void>;
  onCancelar: () => void;
  onExcluir: (d: DefRecurso) => void;
}) {
  const { def } = props;
  const [nome, setNome] = useState(def?.nome ?? '');
  const [formula, setFormula] = useState(def?.formula ?? '');
  const [cor, setCor] = useState(def?.cor ?? CORES_RECURSO[0]);
  const [comecaCheio, setComecaCheio] = useState(def?.comecaCheio ?? true);
  const [erro, setErro] = useState('');

  let previa = '';
  if (formula.trim()) {
    try {
      previa = `No Skar (nível ${EXEMPLO.nivel}): ${formatar(calcularMaximo(EXEMPLO, formula))}`;
    } catch (e) {
      previa = `Fórmula com erro: ${(e as Error).message}`;
    }
  }

  const salvar = async (ev: Event) => {
    ev.preventDefault();
    try {
      const dados = { nome, formula, cor, comecaCheio };
      await props.onSalvar(def ? editarDefRecurso(def, dados) : criarDefRecurso(dados));
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  return (
    <form class="form-journal" onSubmit={salvar} aria-label={def ? `Editar ${def.nome}` : 'Novo recurso'}>
      <label class="campo">
        <span>Nome</span>
        <input type="text" required placeholder="Ímpeto" value={nome} onInput={(e) => setNome(e.currentTarget.value)} />
      </label>
      <label class="campo">
        <span>Fórmula do máximo</span>
        <input
          type="text"
          required
          placeholder="3 + int(NIVEL/2)"
          spellcheck={false}
          autoCapitalize="none"
          value={formula}
          onInput={(e) => setFormula(e.currentTarget.value)}
        />
      </label>
      <p class="vazio" data-testid="previa-formula">
        {previa || 'Use NIVEL, FOR, DES, CON, INT, SAB, CAR, CORPO, MENTE, VIDA… e int(), media(), arred(), min(), max().'}
      </p>
      <fieldset class="custos">
        <legend>Cor da barra</legend>
        <div class="cores">
          {CORES_RECURSO.map((c) => (
            <label key={c} class="cor">
              <input type="radio" name="cor" value={c} checked={cor === c} onChange={() => setCor(c)} aria-label={`Cor ${c}`} />
              <span class="bolinha grande" style={{ background: c }} />
            </label>
          ))}
        </div>
      </fieldset>
      <label class="equipar">
        <input type="checkbox" checked={comecaCheio} onChange={() => setComecaCheio(!comecaCheio)} />
        Começa cheio ao habilitar numa ficha (desmarque para começar em 0, como o Ímpeto)
      </label>
      {erro && (
        <p class="erro" role="alert">
          {erro}
        </p>
      )}
      <div class="form-acoes">
        <button type="submit" class="btn btn-primario">
          Salvar recurso
        </button>
        <button type="button" class="btn" onClick={props.onCancelar}>
          Cancelar
        </button>
        {def && (
          <button type="button" class="btn btn-dano" onClick={() => props.onExcluir(def)}>
            Excluir
          </button>
        )}
      </div>
    </form>
  );
}
