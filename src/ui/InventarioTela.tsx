import { useEffect, useState } from 'preact/hooks';
import {
  defesaItens,
  descreverMovimento,
  mudarQtd,
  movimentarMoeda,
  quantidadeMoeda,
  MOEDAS,
  ordenarItens,
  pesoTotal,
  temDefesa,
  totalCarteira,
  type Item,
  type TipoMoeda,
} from '../dominio/inventario';
import type { RepositorioFichas } from '../dados/repositorio';
import type { prepararImagem } from '../midia/imagem';
import { formatar } from '../rules/motor';
import { AbasFicha, Cabecalho, Entrada, Hora, NaoEncontrada, useFicha } from './comum';
import { FormItem } from './FormItem';
import { Miniatura } from './Miniatura';

interface Props {
  repo: RepositorioFichas;
  id: string;
  prepararImagem?: typeof prepararImagem;
}

export function InventarioTela({ repo, id, prepararImagem }: Props) {
  const [ficha, setFicha] = useFicha(repo, id);
  const [itens, setItens] = useState<Item[] | undefined>();
  const [editando, setEditando] = useState<Item | 'novo' | null>(null);
  const [erro, setErro] = useState('');
  const [verTodoHistorico, setVerTodoHistorico] = useState(false);

  useEffect(() => {
    let vivo = true;
    repo.listarItens(id).then((l) => vivo && setItens(l));
    return () => {
      vivo = false;
    };
  }, [repo, id]);

  if (ficha === undefined || itens === undefined) return <p class="carregando">Carregando…</p>;
  if (ficha === null) return <NaoEncontrada />;

  const tentar = async (fn: () => Promise<void>) => {
    try {
      setErro('');
      await fn();
    } catch (e) {
      setErro(`Não foi possível salvar: ${(e as Error).message}`);
    }
  };

  const atualizarItem = (novo: Item) =>
    tentar(async () => {
      setItens(itens.map((i) => (i.id === novo.id ? novo : i)));
      await repo.salvarItem(novo);
    });

  const mudarMoeda = (moeda: TipoMoeda, texto: string): boolean => {
    const qtd = Number(texto || 0);
    try {
      const carteira = movimentarMoeda(ficha.carteira, moeda, qtd);
      if (carteira === ficha.carteira) return true;
      const nova = { ...ficha, carteira, atualizadoEm: Date.now() };
      setFicha(nova);
      void tentar(() => repo.salvar(nova));
      return true;
    } catch (e) {
      setErro((e as Error).message);
      return false;
    }
  };

  const historicoCarteira = ficha.carteira.historico ?? [];

  const bonus = defesaItens(itens);
  const defF = ficha.maximos.DEF_NATURAL + bonus.fisica;
  const defM = ficha.maximos.DEF_MAGICA_NATURAL + bonus.magica;

  if (editando) {
    return (
      <main class="pagina">
        <AbasFicha fichaId={id} aba="inventario" />
        <FormItem
          repo={repo}
          fichaId={id}
          item={editando === 'novo' ? undefined : editando}
          prepararImagem={prepararImagem}
          onCancelar={() => setEditando(null)}
          onSalvo={(salvo) => {
            setItens(editando === 'novo' ? [...itens, salvo] : itens.map((i) => (i.id === salvo.id ? salvo : i)));
            setEditando(null);
          }}
          onExcluido={(idItem) => {
            setItens(itens.filter((i) => i.id !== idItem));
            setEditando(null);
          }}
        />
      </main>
    );
  }

  return (
    <main class="pagina inventario">
      <AbasFicha fichaId={id} aba="inventario" />
      <Cabecalho ficha={ficha} />

      {erro && (
        <p class="erro" role="alert">
          {erro}
        </p>
      )}

      <section class="derivados" aria-label="Defesa">
        <h2>Defesa</h2>
        <dl>
          <div>
            <dt>Def. Física</dt>
            <dd data-testid="def-fisica">{formatar(defF)}</dd>
            <small>
              natural {formatar(ficha.maximos.DEF_NATURAL)} + itens {formatar(bonus.fisica)}
            </small>
          </div>
          <div>
            <dt>Def. Mágica</dt>
            <dd data-testid="def-magica">{formatar(defM)}</dd>
            <small>
              natural {formatar(ficha.maximos.DEF_MAGICA_NATURAL)} + itens {formatar(bonus.magica)}
            </small>
          </div>
        </dl>
      </section>

      <section class="itens" aria-label="Itens">
        <div class="titulo-secao">
          <h2>Itens</h2>
          <span data-testid="peso-total">Peso total: {formatar(pesoTotal(itens))}</span>
        </div>
        {itens.length === 0 ? (
          <p class="vazio">Inventário vazio.</p>
        ) : (
          <ul class="lista-itens">
            {ordenarItens(itens).map((item) => (
              <li key={item.id} class={item.equipado ? 'item equipado' : 'item'}>
                <button type="button" class="item-abrir" onClick={() => setEditando(item)} aria-label={`Editar ${item.nome}`}>
                  <Miniatura repo={repo} imagemId={item.imagemId} alt="" />
                  <span class="item-info">
                    <strong>{item.nome}</strong>
                    <span class="item-detalhes">
                      {[
                        `peso ${formatar(item.peso)}`,
                        item.defF > 0 && `Def.F ${formatar(item.defF)}`,
                        item.defM > 0 && `Def.M ${formatar(item.defM)}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                </button>
                <div class="item-controles">
                  <div class="qtd" aria-label={`Quantidade de ${item.nome}`}>
                    <button type="button" class="btn-icone" aria-label={`Menos ${item.nome}`} onClick={() => void atualizarItem(mudarQtd(item, -1))}>
                      −
                    </button>
                    <span data-testid={`qtd-${item.nome}`}>{formatar(item.qtd)}</span>
                    <button type="button" class="btn-icone" aria-label={`Mais ${item.nome}`} onClick={() => void atualizarItem(mudarQtd(item, 1))}>
                      +
                    </button>
                  </div>
                  {temDefesa(item) && (
                    <label class="equipar">
                      <input
                        type="checkbox"
                        checked={item.equipado}
                        onChange={() => void atualizarItem({ ...item, equipado: !item.equipado, atualizadoEm: Date.now() })}
                      />
                      Equipado
                    </label>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <button type="button" class="btn btn-primario largo" onClick={() => setEditando('novo')}>
          Adicionar item
        </button>
      </section>

      <section class="carteira" aria-label="Carteira">
        <h2>Carteira</h2>
        <div class="total-carteira" role="group" aria-label="Total da carteira">
          <span class="total-rotulo">Total</span>
          <span class="total-linha">
            <strong class="total-valor" data-testid="total-carteira">
              {formatar(totalCarteira(ficha.carteira))}
            </strong>
            <span class="total-unidade">Caldris</span>
          </span>
          {ficha.carteira.alma > 0 && (
            <span class="total-alma" data-testid="total-alma">
              + {formatar(ficha.carteira.alma)} Moeda{ficha.carteira.alma > 1 ? 's' : ''} d'Alma
            </span>
          )}
        </div>
        <div class="moedas">
          {MOEDAS.map((m) => (
            <label key={m.id} class="campo">
              <span>{m.nome}</span>
              <Entrada
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                valor={String(quantidadeMoeda(ficha.carteira, m.id))}
                onConfirmar={(t) => mudarMoeda(m.id, t)}
              />
            </label>
          ))}
          <label class="campo moeda-alma">
            <span>Moeda d'Alma</span>
            <Entrada
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              valor={String(ficha.carteira.alma)}
              onConfirmar={(t) => mudarMoeda('alma', t)}
            />
          </label>
        </div>

        <div class="historico historico-carteira" role="region" aria-label="Histórico da carteira">
          <h3>Histórico</h3>
          {historicoCarteira.length === 0 ? (
            <p class="vazio">Nenhuma movimentação ainda.</p>
          ) : (
            <>
              <ul>
                {(verTodoHistorico ? historicoCarteira : historicoCarteira.slice(0, 6)).map((e) => (
                  <li key={e.id} class={e.para > e.de ? 'hist-cura' : 'hist-dano'}>
                    <span>{descreverMovimento(e)}</span>
                    <span class="hist-recurso">
                      {formatar(e.de)} → {formatar(e.para)}
                    </span>
                    <Hora em={e.em} />
                  </li>
                ))}
              </ul>
              {historicoCarteira.length > 6 && (
                <button type="button" class="btn-link" onClick={() => setVerTodoHistorico(!verTodoHistorico)}>
                  {verTodoHistorico ? 'Mostrar menos' : `Ver todas (${historicoCarteira.length})`}
                </button>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
