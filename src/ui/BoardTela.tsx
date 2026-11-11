// Board do Mestre: fichas lado a lado no PC, ao vivo. Só valores, dano/cura e histórico curto;
// sem rolagem, sem edição de atributo (isso fica na ficha completa).

import { useEffect, useState } from 'preact/hooks';
import type { RepositorioFichas } from '../dados/repositorio';
import { alternar, gravarSelecao, HISTORICO_BOARD, lerSelecao, selecionadas } from '../dominio/board';
import {
  aplicar,
  atualDe,
  descreverEntrada,
  extraDe,
  maxDe,
  NOMES_RECURSOS,
  RECURSOS,
  type Ficha,
  type IdRecurso,
  type TipoMudanca,
} from '../dominio/ficha';
import { defesaTotal, type Item } from '../dominio/inventario';
import { idsPersonalizados, nomeRecurso } from '../dominio/recursos';
import { ATRIBUTOS, NOMES_DERIVADOS, valorAtual, type Derivado } from '../rules/caldronis';
import { formatar } from '../rules/motor';
import { BarraRecurso } from './BarraRecurso';
import { Hora, useCatalogo } from './comum';

/** Depois das defesas totais, no mesmo destaque do Status da ficha. */
const STATUS_BOARD: Derivado[] = ['PA', 'DESLOCAMENTO', 'CONTRABALANCO', 'CORPO', 'MENTE'];

function armazemLocal(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

interface Props {
  repo: RepositorioFichas;
}

export function BoardTela({ repo }: Props) {
  const [fichas, setFichas] = useState<Ficha[] | undefined>(undefined);
  const [erro, setErro] = useState('');
  const [selecao, setSelecao] = useState<string[] | null>(() => lerSelecao(armazemLocal()));
  const [itens, setItens] = useState<Record<string, Item[]>>({});
  const defs = useCatalogo(repo);

  // Ao vivo: mudou no celular do jogador, muda aqui.
  useEffect(
    () => repo.observarFichas(setFichas, () => setErro('Não foi possível acompanhar as fichas.')),
    [repo],
  );

  const visiveis = fichas ? selecionadas(fichas, selecao) : [];
  const chaveVisiveis = visiveis.map((f) => f.id).join(',');

  // Itens equipados entram na defesa total. Carregados ao montar o board (equipamento quase não
  // muda em combate), não ao vivo.
  useEffect(() => {
    let vivo = true;
    const ids = chaveVisiveis ? chaveVisiveis.split(',') : [];
    void Promise.all(ids.map(async (id) => [id, await repo.listarItens(id).catch(() => [])] as const)).then(
      (pares) => vivo && setItens(Object.fromEntries(pares)),
    );
    return () => {
      vivo = false;
    };
  }, [repo, chaveVisiveis]);

  const escolher = (id: string, marcada: boolean) => {
    const nova = alternar(selecao, (fichas ?? []).map((f) => f.id), id, marcada);
    setSelecao(nova);
    gravarSelecao(armazemLocal(), nova);
  };

  const aplicarEm = (ficha: Ficha, recurso: IdRecurso, tipo: TipoMudanca, valor: number) => {
    try {
      const nova = aplicar(ficha, recurso, tipo, valor);
      setFichas((lista) => lista?.map((f) => (f.id === nova.id ? nova : f)));
      setErro('');
      void repo.salvar(nova).catch((e: unknown) => setErro(`Não foi possível salvar: ${(e as Error).message}`));
    } catch (e) {
      setErro(`Não foi possível aplicar: ${(e as Error).message}`);
    }
  };

  return (
    <main class="pagina board">
      <a href="#/" class="voltar">
        ← Fichas
      </a>
      <div class="board-topo">
        <h1>Board do Mestre</h1>
        {fichas && fichas.length > 0 && (
          <details class="escolher-fichas">
            <summary>
              Escolher fichas ({visiveis.length} de {fichas.length})
            </summary>
            <ul>
              {[...fichas]
                .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
                .map((f) => (
                  <li key={f.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={selecao === null || selecao.includes(f.id)}
                        onChange={(e) => escolher(f.id, e.currentTarget.checked)}
                      />
                      {f.nome}
                    </label>
                  </li>
                ))}
            </ul>
          </details>
        )}
      </div>

      {erro && (
        <p class="erro" role="alert">
          {erro}
        </p>
      )}

      {fichas === undefined ? (
        <p class="carregando">Carregando…</p>
      ) : fichas.length === 0 ? (
        <p class="vazio">Nenhuma ficha ainda.</p>
      ) : visiveis.length === 0 ? (
        <p class="vazio">Nenhuma ficha escolhida. Use "Escolher fichas" para montar o board.</p>
      ) : (
        <div class="grade-board">
          {visiveis.map((f) => (
            <CartaoBoard key={f.id} ficha={f} itens={itens[f.id] ?? []} defs={defs} onAplicar={aplicarEm} />
          ))}
        </div>
      )}
    </main>
  );
}

interface PropsCartao {
  ficha: Ficha;
  itens: Item[];
  defs: ReturnType<typeof useCatalogo>;
  onAplicar: (ficha: Ficha, recurso: IdRecurso, tipo: TipoMudanca, valor: number) => void;
}

function CartaoBoard({ ficha: f, itens, defs, onAplicar }: PropsCartao) {
  const defesa = defesaTotal(f.maximos, itens);
  const sub = [f.raca, f.classe, `Nível ${f.nivel}`].filter(Boolean).join(' · ');
  const idTitulo = `board-titulo-${f.id}`;
  return (
    <article class="cartao-board" aria-labelledby={idTitulo}>
      <header class="cartao-board-topo">
        <div>
          <h2 id={idTitulo}>{f.nome}</h2>
          <p class="sub">{sub}</p>
        </div>
        <a href={`#/ficha/${f.id}`}>Abrir ficha</a>
      </header>

      <div class="recursos">
        {RECURSOS.map((r) => (
          <BarraRecurso
            key={r}
            idPrefixo={`board-${f.id}`}
            recurso={r}
            atual={f.atuais[r]}
            max={f.maximos[r]}
            extra={extraDe(f, r)}
            onAplicar={(tipo, valor) => onAplicar(f, r, tipo, valor)}
          />
        ))}
        {idsPersonalizados(f).map((rid) => {
          const def = defs.find((d) => d.id === rid);
          return (
            <BarraRecurso
              key={rid}
              idPrefixo={`board-${f.id}`}
              recurso={rid}
              nome={def?.nome ?? 'Recurso removido'}
              cor={def?.cor}
              atual={atualDe(f, rid)}
              max={maxDe(f, rid)}
              extra={extraDe(f, rid)}
              onAplicar={(tipo, valor) => onAplicar(f, rid, tipo, valor)}
            />
          );
        })}
      </div>

      <dl class="board-atributos" aria-label="Atributos">
        {ATRIBUTOS.map((a) => (
          <div key={a}>
            <dt>{a}</dt>
            <dd data-testid={`board-${a}`}>{formatar(valorAtual(f.atributos[a]))}</dd>
          </div>
        ))}
      </dl>

      <dl class="board-status" aria-label="Status">
        <div class="destaque">
          <dt>Def. Física</dt>
          <dd data-testid="board-DEF_FISICA">{formatar(defesa.fisica)}</dd>
        </div>
        <div class="destaque">
          <dt>Def. Mágica</dt>
          <dd data-testid="board-DEF_MAGICA">{formatar(defesa.magica)}</dd>
        </div>
        {STATUS_BOARD.map((d) => (
          <div key={d}>
            <dt>{NOMES_DERIVADOS[d]}</dt>
            <dd data-testid={`board-${d}`}>{formatar(f.maximos[d])}</dd>
          </div>
        ))}
      </dl>

      <section class="historico" aria-label="Histórico">
        {f.historico.length === 0 ? (
          <p class="vazio">Nada ainda.</p>
        ) : (
          <ul>
            {f.historico.slice(0, HISTORICO_BOARD).map((e) => (
              <li key={e.id} class={`hist-${e.tipo}`}>
                <span class="hist-recurso">{nomeRecurso(e.recurso, defs, NOMES_RECURSOS)}</span>
                <span>{descreverEntrada(e)}</span>
                <Hora em={e.em} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}
