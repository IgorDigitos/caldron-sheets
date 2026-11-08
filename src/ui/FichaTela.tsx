import { useEffect, useState } from 'preact/hooks';
import {
  alterar,
  aplicar,
  atualDe,
  maxDe,
  type IdRecurso,
  definirExtra,
  extraDe,
  descreverEfeitos,
  descreverEntrada,
  nomeAlvo,
  NOMES_RECURSOS,
  RECURSOS,
  descansoLongo,
  type AlvoAlteracao,
  type Ficha,
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
import { useSessao } from './papel';
import { AbasFicha, Cabecalho, Entrada, Hora, NaoEncontrada, useCatalogo, useFicha } from './comum';
import {
  desabilitarRecurso,
  habilitarRecurso,
  idsPersonalizados,
  nomeRecurso,
  recalcularPersonalizados,
  type DefRecurso,
} from '../dominio/recursos';

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
  const { papel, jogadores } = useSessao();
  const ehMestre = papel === 'mestre';
  const [erros, setErros] = useState<ErroCampo[]>([]);
  const [erroSalvar, setErroSalvar] = useState('');
  const [verTodas, setVerTodas] = useState(false);
  const defs = useCatalogo(repo);

  // Só o app do Mestre calcula o máximo dos recursos personalizados (o servidor não confere fórmula
  // livre). Ao abrir a ficha ou mudar nível/atributo, recalcula e salva se mudou.
  useEffect(() => {
    if (!ficha || !ehMestre || defs.length === 0) return;
    const r = recalcularPersonalizados(ficha, defs);
    if (r) {
      setFicha(r);
      void repo.salvar(r).catch(() => {});
    }
  }, [ficha, defs, ehMestre, repo, setFicha]);

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

  const aplicarRecurso = (recurso: IdRecurso, tipo: TipoMudanca, valor: number) => {
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

  const mudarDono = (uid: string) => {
    const nova: Ficha = { ...ficha, atualizadoEm: Date.now() };
    if (uid) nova.donoUid = uid;
    else delete nova.donoUid;
    void salvar(nova);
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
            extra={extraDe(ficha, r)}
            onAplicar={(tipo, valor) => aplicarRecurso(r, tipo, valor)}
            onExtra={(valor) => void salvar(definirExtra(ficha, r, valor))}
          />
        ))}
        {idsPersonalizados(ficha).map((rid) => {
          const def = defs.find((d) => d.id === rid);
          return (
            <BarraRecurso
              key={rid}
              recurso={rid}
              nome={def?.nome ?? 'Recurso removido'}
              cor={def?.cor}
              atual={atualDe(ficha, rid)}
              max={maxDe(ficha, rid)}
              extra={extraDe(ficha, rid)}
              onAplicar={(tipo, valor) => aplicarRecurso(rid, tipo, valor)}
              onExtra={(valor) => void salvar(definirExtra(ficha, rid, valor))}
            />
          );
        })}
        <button type="button" class="btn btn-secundario" onClick={() => void salvar(descansoLongo(ficha))}>
          Descanso longo
        </button>
      </div>

      <section class="atributos-visiveis" aria-label="Atributos">
        <h2>Atributos</h2>
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
              <th scope="col" class="col-atual">Atual</th>
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
                      {campo === 'base' && !ehMestre ? (
                        <span class="valor-fixo" data-testid={`base-${a}`}>
                          {formatar(v.base)}
                        </span>
                      ) : (
                        <CampoNumero
                          rotulo={`${NOMES_ATRIBUTOS[a]} ${campo}`}
                          oculto
                          valor={v[campo] ?? 0}
                          min={campo === 'base' ? undefined : 0}
                          onMudar={(n) => mudar({ tipo: 'atributo', atributo: a, parte: campo }, n)}
                        />
                      )}
                    </td>
                  ))}
                  <td class="celula-atual">
                    <span
                      class="valor-atual"
                      data-testid={`atual-${a}`}
                      data-mudou={valorAtual(v) !== v.base ? (valorAtual(v) > v.base ? 'subiu' : 'desceu') : undefined}
                    >
                      {formatar(valorAtual(v))}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!ehMestre && (
          <p class="vazio dica-atributos">Você pode mudar o extra e a perda. A base, o nível e o nome são do Mestre.</p>
        )}
      </section>


      <section class="historico" aria-label="Histórico">
        <h2>Histórico</h2>
        {ficha.historico.length === 0 ? (
          <p class="vazio">Nada ainda.</p>
        ) : (
          <ul>
            {ficha.historico.slice(0, HISTORICO_VISIVEL).map((e) => (
              <li key={e.id} class={`hist-${e.tipo}`}>
                <span class="hist-recurso">{nomeRecurso(e.recurso, defs, NOMES_RECURSOS)}</span>
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

      {ehMestre && (
        <details class="editar">
          <summary>Editar ficha</summary>

          <div class="campos-texto">
            <CampoTexto rotulo="Nome" valor={ficha.nome} onMudar={(v) => mudarTexto('nome', v)} />
            <CampoTexto rotulo="Raça" valor={ficha.raca} onMudar={(v) => mudarTexto('raca', v)} />
            <CampoTexto rotulo="Classe" valor={ficha.classe} onMudar={(v) => mudarTexto('classe', v)} />
            <CampoNumero rotulo="Nível" valor={ficha.nivel} min={1} onMudar={(v) => mudar({ tipo: 'nivel' }, v)} />
            <label class="campo campo-dono">
              <span>Jogador</span>
              <select value={ficha.donoUid ?? ''} onChange={(e) => mudarDono(e.currentTarget.value)}>
                <option value="">Ninguém (só o Mestre)</option>
                {jogadores.map((j) => (
                  <option key={j.uid} value={j.uid}>
                    {j.usuario}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {defs.length > 0 && (
            <RecursosEspeciais
              ficha={ficha}
              defs={defs}
              onMudar={(nova) => void salvar(nova)}
              onErro={(m) => setErroSalvar(m)}
            />
          )}
        </details>
      )}

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
      <Entrada type="text" valor={valor} onConfirmar={onMudar} />
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
      <Entrada
        type="number"
        inputMode="decimal"
        step="any"
        min={props.min}
        valor={String(props.valor)}
        onConfirmar={(texto) => {
          const n = texto.trim() === '' ? Number.NaN : Number(texto);
          if (!Number.isFinite(n) || (props.min !== undefined && n < props.min)) return false;
          props.onMudar(n);
        }}
      />
    </label>
  );
}

/** Mestre: quais recursos do catálogo esta ficha tem. */
function RecursosEspeciais(props: {
  ficha: Ficha;
  defs: DefRecurso[];
  onMudar: (f: Ficha) => void;
  onErro: (mensagem: string) => void;
}) {
  const { ficha, defs } = props;
  const ativos = new Set(idsPersonalizados(ficha));
  return (
    <fieldset class="recursos-especiais">
      <legend>Recursos especiais</legend>
      {defs.map((d) => (
        <label key={d.id} class="equipar">
          <input
            type="checkbox"
            checked={ativos.has(d.id)}
            onChange={() => {
              try {
                props.onMudar(ativos.has(d.id) ? desabilitarRecurso(ficha, d.id) : habilitarRecurso(ficha, d));
              } catch (e) {
                props.onErro((e as Error).message);
              }
            }}
          />
          <span class="bolinha" style={{ background: d.cor }} aria-hidden="true" />
          {d.nome}
        </label>
      ))}
    </fieldset>
  );
}
