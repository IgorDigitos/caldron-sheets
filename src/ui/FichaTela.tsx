import { useEffect, useState } from 'preact/hooks';
import {
  aplicar,
  descreverEntrada,
  NOMES_RECURSOS,
  RECURSOS,
  recalcular,
  restaurarTudo,
  type Ficha,
  type Recurso,
  type TipoMudanca,
} from '../dominio/ficha';
import type { RepositorioFichas } from '../dados/repositorio';
import {
  ATRIBUTOS,
  FORMULAS_CALDRONIS,
  NOMES_ATRIBUTOS,
  NOMES_DERIVADOS,
  valorAtual,
  type Atributo,
  type Derivado,
  type ValorAtributo,
} from '../rules/caldronis';
import { formatar, type ErroCampo } from '../rules/motor';
import { BarraRecurso } from './BarraRecurso';

const HISTORICO_VISIVEL = 6;
const DERIVADOS_EXIBIDOS = (Object.keys(FORMULAS_CALDRONIS) as Derivado[]).filter(
  (d) => !(RECURSOS as readonly string[]).includes(d),
);

interface Props {
  repo: RepositorioFichas;
  id: string;
}

export function FichaTela({ repo, id }: Props) {
  const [ficha, setFicha] = useState<Ficha | null | undefined>(undefined);
  const [erros, setErros] = useState<ErroCampo[]>([]);
  const [erroSalvar, setErroSalvar] = useState('');

  useEffect(() => {
    let vivo = true;
    repo.obter(id).then((f) => vivo && setFicha(f ?? null));
    return () => {
      vivo = false;
    };
  }, [repo, id]);

  if (ficha === undefined) return <p class="carregando">Carregando…</p>;
  if (ficha === null) {
    return (
      <main class="pagina">
        <p>Ficha não encontrada.</p>
        <a href="#/">Voltar</a>
      </main>
    );
  }

  const salvar = async (nova: Ficha) => {
    setFicha(nova);
    try {
      await repo.salvar(nova);
      setErroSalvar('');
    } catch (e) {
      setErroSalvar(`Não foi possível salvar: ${(e as Error).message}`);
    }
  };

  const mudarRegras = (mudanca: Partial<Ficha>) => {
    const r = recalcular({ ...ficha, ...mudanca });
    if (r.ok) {
      setErros([]);
      void salvar(r.ficha);
    } else {
      setErros(r.erros);
    }
  };

  const mudarAtributo = (attr: Atributo, campo: keyof ValorAtributo, valor: number) => {
    const atual = ficha.atributos[attr];
    mudarRegras({ atributos: { ...ficha.atributos, [attr]: { ...atual, [campo]: valor } } });
  };

  const aplicarRecurso = (recurso: Recurso, tipo: TipoMudanca, valor: number) => {
    try {
      void salvar(aplicar(ficha, recurso, tipo, valor));
    } catch (e) {
      setErroSalvar(`Não foi possível aplicar: ${(e as Error).message}`);
    }
  };

  const mudarTexto = (campo: 'nome' | 'raca' | 'classe', valor: string) => {
    void salvar({ ...ficha, [campo]: campo === 'nome' ? valor.trim() || 'Sem nome' : valor, atualizadoEm: Date.now() });
  };

  return (
    <main class="pagina ficha">
      <nav class="topo-ficha">
        <a href="#/" class="voltar">
          ← Fichas
        </a>
      </nav>

      <header class="cabecalho">
        <h1>{ficha.nome}</h1>
        <p class="subtitulo">
          {[ficha.raca, ficha.classe, `Nível ${ficha.nivel}`].filter(Boolean).join(' · ')}
        </p>
      </header>

      {erroSalvar && (
        <p class="erro" role="alert">
          {erroSalvar}
        </p>
      )}

      <div class="recursos">
        {RECURSOS.map((r) => (
          <BarraRecurso
            key={r}
            recurso={r}
            atual={ficha.atuais[r]}
            max={ficha.maximos[r]}
            onAplicar={(tipo, valor) => aplicarRecurso(r, tipo, valor)}
          />
        ))}
        <button type="button" class="btn btn-secundario" onClick={() => void salvar(restaurarTudo(ficha))}>
          Descanso: restaurar tudo
        </button>
      </div>

      <section class="historico" aria-label="Histórico">
        <h2>Histórico</h2>
        {ficha.historico.length === 0 ? (
          <p class="vazio">Nada ainda.</p>
        ) : (
          <ul>
            {ficha.historico.slice(0, HISTORICO_VISIVEL).map((e) => (
              <li key={e.id} class={`hist-${e.tipo}`}>
                <span class="hist-recurso">{NOMES_RECURSOS[e.recurso]}</span>
                <span>{descreverEntrada(e)}</span>
                <time dateTime={new Date(e.em).toISOString()}>
                  {new Date(e.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section class="derivados" aria-label="Valores calculados">
        <h2>Status</h2>
        <dl>
          {DERIVADOS_EXIBIDOS.map((d) => (
            <div key={d}>
              <dt>{NOMES_DERIVADOS[d]}</dt>
              <dd data-testid={`derivado-${d}`}>{formatar(ficha.maximos[d])}</dd>
            </div>
          ))}
        </dl>
      </section>

      <details class="editar">
        <summary>Editar ficha</summary>

        <div class="campos-texto">
          <CampoTexto rotulo="Nome" valor={ficha.nome} onMudar={(v) => mudarTexto('nome', v)} />
          <CampoTexto rotulo="Raça" valor={ficha.raca} onMudar={(v) => mudarTexto('raca', v)} />
          <CampoTexto rotulo="Classe" valor={ficha.classe} onMudar={(v) => mudarTexto('classe', v)} />
          <CampoNumero rotulo="Nível" valor={ficha.nivel} min={1} onMudar={(v) => mudarRegras({ nivel: v })} />
        </div>

        {erros.length > 0 && (
          <ul class="erro" role="alert">
            {erros.map((e) => (
              <li key={e.campo}>
                {e.campo}: {e.mensagem}
              </li>
            ))}
          </ul>
        )}

        <table class="atributos">
          <thead>
            <tr>
              <th scope="col">Atributo</th>
              <th scope="col">Base</th>
              <th scope="col">Extra</th>
              <th scope="col">Perda</th>
              <th scope="col">Atual</th>
            </tr>
          </thead>
          <tbody>
            {ATRIBUTOS.map((a) => {
              const v = ficha.atributos[a];
              return (
                <tr key={a}>
                  <th scope="row">{NOMES_ATRIBUTOS[a]}</th>
                  {(['base', 'extra', 'perda'] as const).map((campo) => (
                    <td key={campo}>
                      <CampoNumero
                        rotulo={`${NOMES_ATRIBUTOS[a]} ${campo}`}
                        oculto
                        valor={v[campo] ?? 0}
                        min={campo === 'base' ? undefined : 0}
                        onMudar={(n) => mudarAtributo(a, campo, n)}
                      />
                    </td>
                  ))}
                  <td data-testid={`atual-${a}`}>{formatar(valorAtual(v))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>
    </main>
  );
}

function CampoTexto({ rotulo, valor, onMudar }: { rotulo: string; valor: string; onMudar: (v: string) => void }) {
  return (
    <label class="campo">
      <span>{rotulo}</span>
      <input type="text" value={valor} onChange={(e) => onMudar(e.currentTarget.value)} />
    </label>
  );
}

function CampoNumero(props: {
  rotulo: string;
  valor: number;
  min?: number;
  oculto?: boolean;
  onMudar: (v: number) => void;
}) {
  return (
    <label class="campo campo-numero">
      <span class={props.oculto ? 'sr-only' : undefined}>{props.rotulo}</span>
      <input
        type="number"
        inputMode="decimal"
        step="any"
        min={props.min}
        value={props.valor}
        onChange={(e) => {
          const n = e.currentTarget.valueAsNumber;
          if (Number.isFinite(n) && (props.min === undefined || n >= props.min)) props.onMudar(n);
          else e.currentTarget.value = String(props.valor);
        }}
      />
    </label>
  );
}
