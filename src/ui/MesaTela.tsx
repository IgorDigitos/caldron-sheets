// Mesa: chat da campanha com rolagens. Quem rola é o bot Caldronis Dice (no PC do Mestre), que
// também posta no Discord. "d30+FOR" no começo da mensagem rola; "quero rolar d30" é só texto.

import { useEffect, useState } from 'preact/hooks';
import { valorAtual, ATRIBUTOS } from '../rules/caldronis';
import type { Ficha } from '../dominio/ficha';
import {
  criarMensagem,
  descreverEstado,
  ehRolagem,
  MAX_TEXTO,
  MensagemInvalida,
  NOME_MESTRE,
  rolagemDeAtributo,
  rolagemDeSkill,
  trechos,
  type Canal,
  type Mensagem,
} from '../dominio/mesa';
import type { Skill } from '../dominio/skills';
import type { RepositorioMesa } from '../dados/mesa';
import type { RepositorioFichas, ResumoFicha } from '../dados/repositorio';
import { AbasFicha, Hora } from './comum';
import { useSessao } from './papel';

interface Props {
  repo: RepositorioFichas;
  mesa?: RepositorioMesa;
  /** Aberta pela aba da ficha: já fala como esse personagem. */
  fichaId?: string;
}

const MESTRE = '';

function semRede(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function MesaTela({ repo, mesa, fichaId }: Props) {
  const { papel, uid } = useSessao();
  const ehMestre = papel === 'mestre';
  const [fichas, setFichas] = useState<ResumoFicha[] | undefined>();
  const [como, setComo] = useState<string | undefined>(fichaId);
  const [canal, setCanal] = useState<Canal>('mesa');
  const [mensagens, setMensagens] = useState<Mensagem[] | undefined>();
  const [texto, setTexto] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [ficha, setFicha] = useState<Ficha | undefined>();
  const [skills, setSkills] = useState<Skill[]>([]);

  useEffect(() => {
    let vivo = true;
    repo.listar().then((l) => {
      if (!vivo) return;
      setFichas(l);
      // Sem ficha escolhida: Mestre fala como Mestre; jogador, como o primeiro personagem dele.
      setComo((c) => c ?? (ehMestre ? MESTRE : (l[0]?.id ?? MESTRE)));
    });
    return () => {
      vivo = false;
    };
  }, [repo, ehMestre]);

  // Ficha de quem fala: atributos e skills viram botões de rolagem rápida.
  useEffect(() => {
    let vivo = true;
    setFicha(undefined);
    setSkills([]);
    if (!como) return;
    repo.obter(como).then((f) => vivo && setFicha(f));
    repo.listarSkills(como).then((s) => vivo && setSkills(s)).catch(() => {});
    return () => {
      vivo = false;
    };
  }, [repo, como]);

  const canalAtual: Canal = ehMestre ? canal : 'mesa';
  useEffect(() => {
    if (!mesa) return;
    setMensagens(undefined);
    return mesa.observar(canalAtual, setMensagens, () => setAviso('Não foi possível carregar a mesa.'));
  }, [mesa, canalAtual]);

  const cabecalho = fichaId ? (
    <AbasFicha fichaId={fichaId} aba="mesa" />
  ) : (
    <nav class="abas-ficha">
      <a href="#/" class="voltar">
        ← Fichas
      </a>
    </nav>
  );

  if (!mesa) {
    return (
      <main class="pagina">
        {cabecalho}
        <p class="vazio">A Mesa precisa da nuvem: entre com sua conta para rolar dados com o bot.</p>
      </main>
    );
  }

  const nomeDeQuemFala = como ? (fichas?.find((f) => f.id === como)?.nome ?? ficha?.nome ?? '') : NOME_MESTRE;

  const enviar = async (conteudo: string) => {
    setAviso(null);
    if (!uid) return setAviso('Entre com sua conta para usar a Mesa.');
    if (!ehMestre && !como) return setAviso('Você ainda não tem personagem.');
    if (ehRolagem(conteudo) && semRede()) {
      return setAviso('Sem internet: a rolagem precisa de conexão para chegar ao bot.');
    }
    try {
      const m = criarMensagem({ texto: conteudo, autorUid: uid, nome: nomeDeQuemFala, ...(como ? { fichaId: como } : {}) });
      await mesa.enviar(canalAtual, m);
      if (conteudo === texto) setTexto('');
    } catch (e) {
      setAviso(e instanceof MensagemInvalida ? e.message : `Não foi possível enviar: ${(e as Error).message}`);
    }
  };

  const rolagensDeSkill = skills
    .map((s) => ({ skill: s, expr: rolagemDeSkill(s.atkMod, s.nome) }))
    .filter((r): r is { skill: Skill; expr: string } => r.expr !== undefined);

  return (
    <main class="pagina mesa">
      {cabecalho}
      <h1>Mesa</h1>
      <p class="dica">
        Comece com a rolagem para rolar (<code>d30+FOR ataque</code>). Rolagens vão para o Discord.
      </p>

      {ehMestre && (
        <div class="abas abas-2" role="tablist" aria-label="Canal">
          {(['mesa', 'mestre'] as const).map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={canal === c}
              class={canal === c ? 'aba ativa' : 'aba'}
              onClick={() => setCanal(c)}
            >
              {c === 'mesa' ? 'Canal da mesa' : 'Canal do Mestre'}
            </button>
          ))}
        </div>
      )}
      {canalAtual === 'mestre' && <p class="dica">Só você vê. Rolagens vão para o canal secreto do Discord.</p>}

      <form
        class="form-mesa"
        onSubmit={(e) => {
          e.preventDefault();
          void enviar(texto);
        }}
      >
        <label class="campo">
          <span>Falar como</span>
          <select value={como ?? MESTRE} onChange={(e) => setComo((e.currentTarget as HTMLSelectElement).value || undefined)}>
            {ehMestre && <option value={MESTRE}>{NOME_MESTRE}</option>}
            {(fichas ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </label>
        <div class="linha-envio">
          <input
            type="text"
            aria-label="Mensagem ou rolagem"
            placeholder="d30+FOR ataque, ou uma mensagem"
            maxLength={MAX_TEXTO}
            value={texto}
            onInput={(e) => setTexto((e.currentTarget as HTMLInputElement).value)}
          />
          <button type="submit" class="btn btn-primario">
            Enviar
          </button>
        </div>
        {aviso && (
          <p class="erro" role="alert">
            {aviso}
          </p>
        )}
      </form>

      {ficha && (
        <div class="rolagens-rapidas" aria-label="Rolagens rápidas">
          {ATRIBUTOS.map((a) => (
            <button key={a} type="button" class="btn btn-secundario" onClick={() => void enviar(rolagemDeAtributo(a))}>
              {a} {valorAtual(ficha.atributos[a])}
            </button>
          ))}
          {rolagensDeSkill.map(({ skill, expr }) => (
            <button key={skill.id} type="button" class="btn btn-secundario" onClick={() => void enviar(expr)}>
              {skill.nome}
            </button>
          ))}
        </div>
      )}

      {mensagens === undefined ? (
        <p class="carregando">Carregando…</p>
      ) : mensagens.length === 0 ? (
        <p class="vazio">Nada por aqui ainda.</p>
      ) : (
        <ol class="mensagens" aria-label="Mensagens">
          {mensagens.map((m) => (
            <ItemMensagem
              key={m.id}
              m={m}
              onApagar={ehMestre ? () => void mesa.apagar(canalAtual, m.id) : undefined}
            />
          ))}
        </ol>
      )}
    </main>
  );
}

function ItemMensagem({ m, onApagar }: { m: Mensagem; onApagar?: () => void }) {
  const estado = descreverEstado(m);
  return (
    <li class="mensagem" data-tipo={m.tipo} data-estado={m.estado}>
      <p class="mensagem-topo">
        <strong>{m.nome}</strong> <Hora em={m.criadoEm} />
        {onApagar && (
          <button type="button" class="btn-icone" aria-label={`Apagar mensagem de ${m.nome}`} onClick={onApagar}>
            ✕
          </button>
        )}
      </p>
      <p class="mensagem-texto">{m.tipo === 'rolagem' ? <code>{m.texto}</code> : m.texto}</p>
      {m.resultado && (
        <div class="resultado-rolagem" aria-label="Resultado">
          {m.resultado.map((bloco, i) =>
            bloco.split('\n').map((linha, j) => (
              <p key={`${i}-${j}`}>
                {trechos(linha).map((t, k) =>
                  t.tipo === 'negrito' ? <strong key={k}>{t.texto}</strong> : t.tipo === 'codigo' ? <code key={k} class="total">{t.texto}</code> : t.texto,
                )}
              </p>
            )),
          )}
        </div>
      )}
      {estado && <p class={m.estado === 'feita' || m.estado === 'pendente' || m.estado === 'rolando' ? 'dica' : 'erro'}>{estado}</p>}
    </li>
  );
}
