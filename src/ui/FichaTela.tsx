import { useState } from 'preact/hooks';
import {
  alterar,
  aplicar,
  descreverEfeitos,
  descreverEntrada,
  nomeAlvo,
  NOMES_RECURSOS,
  RECURSOS,
  restaurarTudo,
  type AlvoAlteracao,
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
  type Derivado,
} from '../rules/caldronis';
import { formatar, type ErroCampo } from '../rules/motor';
import { exportarFicha, nomeArquivo } from '../dados/exportacao';
import { BarraRecurso } from './BarraRecurso';
import { AbasFicha, Cabecalho, Hora, NaoEncontrada, useFicha } from './comum';

const HISTORICO_VISIVEL = 6;
const DERIVADOS_EXIBIDOS = (Object.keys(FORMULAS_CALDRONIS) as Derivado[]).filter(
  (d) => !(RECURSOS as readonly string[]).includes(d),
);

interface Props {
  repo: RepositorioFichas;
  id: string;
}

export function FichaTela({ repo, id }: Props) {
  const [ficha, setFicha] = useFicha(repo, id);
  const [erros, setErros] = useState<ErroCampo[]>([]);
  const [erroSalvar, setErroSalvar] = useState('');
  const [verTodas, setVerTodas] = useState(false);

  if (ficha === undefined) return <p class="carregando">Carregando…</p>;
  if (ficha === null) return <NaoEncontrada />;

  const salvar = async (nova: Ficha) => {
    setFicha(nova);
    try {
      await repo.salvar(nova);
      setErroSalvar('');
    } catch (e) {
      setErroSalvar(`Não foi possível salvar: ${(e as Error).message}`);
    }
  };

  const mudar = (alvo: AlvoAlteracao, valor: number) => {
    const r = alterar(ficha, alvo, valor);
    if (!r.ok) {
      setErros(r.erros);
      return;
    }
    setErros([]);
    if (r.ficha !== ficha) void salvar(r.ficha);
  };

  const aplicarRecurso = (recurso: Recurso, tipo: TipoMudanca, valor: number) => {
    try {
      void salvar(aplicar(ficha, recurso, tipo, valor));
    } catch (e) {
      setErroSalvar(`Não foi possível aplicar: ${(e as Error).message}`);
    }
  };

  const exportar = async () => {
    try {
      const arquivo = await exportarFicha(repo, id);
      const blob = new Blob([JSON.stringify(arquivo, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nomeArquivo(ficha.nome);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setErroSalvar(`Não foi possível exportar: ${(e as Error).message}`);
    }
  };

  const mudarTexto = (campo: 'nome' | 'raca' | 'classe', valor: string) => {
    void salvar({ ...ficha, [campo]: campo === 'nome' ? valor.trim() || 'Sem nome' : valor, atualizadoEm: Date.now() });
  };

  return (
    <main class="pagina ficha">
      <AbasFicha fichaId={id} aba="ficha" />
      <Cabecalho ficha={ficha} />

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
                <Hora em={e.em} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section class="historico alteracoes" aria-label="Alterações de atributos">
        <h2>Alterações de atributos</h2>
        {ficha.alteracoes.length === 0 ? (
          <p class="vazio">Nenhuma alteração ainda.</p>
        ) : (
          <>
            <ul>
              {(verTodas ? ficha.alteracoes : ficha.alteracoes.slice(0, HISTORICO_VISIVEL)).map((e) => (
                <li key={e.id} class={e.para > e.de ? 'alt-subiu' : 'alt-desceu'}>
                  <span class="alt-texto">
                    <span class="alt-alvo">{nomeAlvo(e.alvo)}</span>{' '}
                    <span class="alt-valores">
                      {formatar(e.de)} → {formatar(e.para)}
                    </span>
                    {descreverEfeitos(e) && <small class="alt-efeitos">{descreverEfeitos(e)}</small>}
                  </span>
                  <Hora em={e.em} />
                </li>
              ))}
            </ul>
            {ficha.alteracoes.length > HISTORICO_VISIVEL && (
              <button type="button" class="btn-link" onClick={() => setVerTodas(!verTodas)}>
                {verTodas ? 'Mostrar menos' : `Ver todas (${ficha.alteracoes.length})`}
              </button>
            )}
          </>
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
          <CampoNumero rotulo="Nível" valor={ficha.nivel} min={1} onMudar={(v) => mudar({ tipo: 'nivel' }, v)} />
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
                        onMudar={(n) => mudar({ tipo: 'atributo', atributo: a, parte: campo }, n)}
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

      <section class="backup" aria-label="Backup">
        <h2>Backup</h2>
        <p class="vazio">Baixa um arquivo com a ficha, os itens (com fotos) e o journal.</p>
        <button type="button" class="btn btn-secundario" onClick={() => void exportar()}>
          Exportar ficha (JSON)
        </button>
      </section>
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
