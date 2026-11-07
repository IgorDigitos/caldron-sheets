import { useEffect, useState } from 'preact/hooks';
import { NOMES_RECURSOS, RECURSOS, extraDe, type Recurso } from '../dominio/ficha';
import {
  CATEGORIAS_SKILL,
  criarSkill,
  daCategoria,
  descreverCusto,
  editarSkill,
  MAX_CUSTOS,
  NOME_SINGULAR,
  NOMES_CATEGORIAS,
  RecursoInsuficiente,
  usarSkill,
  type CategoriaSkill,
  type Custo,
  type Skill,
} from '../dominio/skills';
import type { RepositorioFichas } from '../dados/repositorio';
import { formatar } from '../rules/motor';
import { AbasFicha, Cabecalho, NaoEncontrada, useFicha } from './comum';
import { useSessao } from './papel';

export function SkillsTela({ repo, id }: { repo: RepositorioFichas; id: string }) {
  const [ficha, setFicha] = useFicha(repo, id);
  const [skills, setSkills] = useState<Skill[] | undefined>();
  const [editando, setEditando] = useState<Skill | CategoriaSkill | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const ehMestre = useSessao().papel === 'mestre';

  useEffect(() => {
    let vivo = true;
    repo.listarSkills(id).then((l) => vivo && setSkills(l));
    return () => {
      vivo = false;
    };
  }, [repo, id]);

  if (ficha === undefined || skills === undefined) return <p class="carregando">Carregando…</p>;
  if (ficha === null) return <NaoEncontrada />;

  const usar = async (skill: Skill) => {
    try {
      const nova = usarSkill(ficha, skill);
      setFicha(nova);
      await repo.salvar(nova);
      setAviso({ tipo: 'ok', texto: `Usou ${skill.nome}: −${descreverCusto(skill.custos)}` });
    } catch (e) {
      setAviso({
        tipo: 'erro',
        texto: e instanceof RecursoInsuficiente ? e.message : `Não foi possível usar: ${(e as Error).message}`,
      });
    }
  };

  if (editando && ehMestre) {
    return (
      <main class="pagina">
        <AbasFicha fichaId={id} aba="skills" />
        <FormSkill
          repo={repo}
          fichaId={id}
          skill={typeof editando === 'string' ? undefined : editando}
          categoria={typeof editando === 'string' ? editando : editando.categoria}
          onFechar={(mudou) => {
            if (mudou?.tipo === 'salva') setSkills([...skills.filter((s) => s.id !== mudou.skill.id), mudou.skill]);
            if (mudou?.tipo === 'excluida') setSkills(skills.filter((s) => s.id !== mudou.skill.id));
            setEditando(null);
          }}
        />
      </main>
    );
  }

  return (
    <main class="pagina skills">
      <AbasFicha fichaId={id} aba="skills" />
      <Cabecalho ficha={ficha} />

      <p class="resumo-recursos" data-testid="resumo-recursos">
        {RECURSOS.map((r) => (
          <span key={r}>
            {NOMES_RECURSOS[r]} {formatar(ficha.atuais[r])}/{formatar(ficha.maximos[r])}
            {extraDe(ficha, r) > 0 && <small> +{formatar(extraDe(ficha, r))}</small>}
          </span>
        ))}
      </p>

      {aviso && (
        <p class={aviso.tipo === 'ok' ? 'aviso-texto' : 'erro'} role={aviso.tipo === 'ok' ? 'status' : 'alert'}>
          {aviso.texto}
        </p>
      )}

      {CATEGORIAS_SKILL.map((cat) => {
        const lista = daCategoria(skills, cat);
        return (
          <section key={cat} class="categoria-skill" aria-label={NOMES_CATEGORIAS[cat]}>
            <div class="titulo-secao">
              <h2>{NOMES_CATEGORIAS[cat]}</h2>
              {ehMestre && (
                <button type="button" class="btn-link" onClick={() => setEditando(cat)}>
                  + {NOME_SINGULAR[cat]}
                </button>
              )}
            </div>
            {lista.length === 0 ? (
              <p class="vazio">Nenhuma.</p>
            ) : (
              <ul class="lista-skills">
                {lista.map((s) => (
                  <li key={s.id}>
                    <article class="skill" aria-label={s.nome}>
                      <header>
                        <h3>{s.nome}</h3>
                        {s.atkMod && s.atkMod !== '--' && <span class="selo-atk">{s.atkMod}</span>}
                      </header>
                      <p class="skill-meta">
                        {[s.pas && s.pas !== '--' && `PA: ${s.pas}`, s.gastos && s.gastos !== '--' && s.gastos]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      {s.descricao && (
                        <details class="skill-descricao">
                          <summary>Descrição</summary>
                          <p>{s.descricao}</p>
                        </details>
                      )}
                      <div class="skill-acoes">
                        {s.custos.length > 0 && (
                          <button type="button" class="btn btn-primario" onClick={() => void usar(s)}>
                            Usar <small>(−{descreverCusto(s.custos)})</small>
                          </button>
                        )}
                        {ehMestre && (
                          <button type="button" class="btn" onClick={() => setEditando(s)} aria-label={`Editar ${s.nome}`}>
                            Editar
                          </button>
                        )}
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </main>
  );
}

type Mudanca = { tipo: 'salva' | 'excluida'; skill: Skill } | null;

function FormSkill(props: {
  repo: RepositorioFichas;
  fichaId: string;
  skill?: Skill;
  categoria: CategoriaSkill;
  onFechar: (m: Mudanca) => void;
}) {
  const { repo, fichaId, skill, onFechar } = props;
  const [categoria, setCategoria] = useState<CategoriaSkill>(skill?.categoria ?? props.categoria);
  const [nome, setNome] = useState(skill?.nome ?? '');
  const [atkMod, setAtkMod] = useState(skill?.atkMod ?? '');
  const [pas, setPas] = useState(skill?.pas ?? '');
  const [gastos, setGastos] = useState(skill?.gastos ?? '');
  const [descricao, setDescricao] = useState(skill?.descricao ?? '');
  const [custos, setCustos] = useState<{ recurso: Recurso; valor: string }[]>(
    (skill?.custos ?? []).map((c) => ({ recurso: c.recurso, valor: String(c.valor) })),
  );
  const [erro, setErro] = useState('');

  const salvar = async (ev: Event) => {
    ev.preventDefault();
    try {
      const listaCustos: Custo[] = custos.map((c) => ({
        recurso: c.recurso,
        valor: Number(c.valor.replace(',', '.')),
      }));
      const dados = { categoria, nome, atkMod, pas, gastos, descricao, custos: listaCustos };
      const salva = skill ? editarSkill(skill, dados) : criarSkill(fichaId, dados);
      await repo.salvarSkill(salva);
      onFechar({ tipo: 'salva', skill: salva });
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const excluir = async () => {
    if (!skill || !confirm(`Excluir ${skill.nome}?`)) return;
    try {
      await repo.excluirSkill(skill.id);
      onFechar({ tipo: 'excluida', skill });
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const livres = RECURSOS.filter((r) => !custos.some((c) => c.recurso === r));

  return (
    <form class="form-journal" onSubmit={salvar} aria-label={skill ? `Editar ${skill.nome}` : 'Nova skill'}>
      <h2>{skill ? 'Editar skill' : `Nova ${NOME_SINGULAR[categoria].toLowerCase()}`}</h2>
      <div class="campos-texto">
        <label class="campo">
          <span>Tipo</span>
          <select value={categoria} onChange={(e) => setCategoria(e.currentTarget.value as CategoriaSkill)}>
            {CATEGORIAS_SKILL.map((c) => (
              <option key={c} value={c}>
                {NOME_SINGULAR[c]}
              </option>
            ))}
          </select>
        </label>
        <label class="campo">
          <span>ATK/MOD</span>
          <input type="text" placeholder="2d4+FOR" value={atkMod} onInput={(e) => setAtkMod(e.currentTarget.value)} />
        </label>
      </div>
      <label class="campo">
        <span>Nome</span>
        <input type="text" required value={nome} onInput={(e) => setNome(e.currentTarget.value)} />
      </label>
      <div class="campos-texto">
        <label class="campo">
          <span>PAs</span>
          <input type="text" placeholder="2 PA, Reação…" value={pas} onInput={(e) => setPas(e.currentTarget.value)} />
        </label>
        <label class="campo">
          <span>Gastos (texto)</span>
          <input type="text" placeholder="Passiva, 2 STA…" value={gastos} onInput={(e) => setGastos(e.currentTarget.value)} />
        </label>
      </div>

      <fieldset class="custos" aria-label="Custo do botão Usar">
        <legend>Custo do botão "Usar"</legend>
        {custos.length === 0 && <p class="vazio">Sem custo: a skill não terá botão "Usar".</p>}
        {custos.map((c, i) => (
          <div key={i} class="linha-custo">
            <label class="campo">
              <span class="sr-only">Recurso do custo {i + 1}</span>
              <select
                value={c.recurso}
                onChange={(e) =>
                  setCustos(custos.map((x, j) => (j === i ? { ...x, recurso: e.currentTarget.value as Recurso } : x)))
                }
              >
                {RECURSOS.filter((r) => r === c.recurso || livres.includes(r)).map((r) => (
                  <option key={r} value={r}>
                    {NOMES_RECURSOS[r]}
                  </option>
                ))}
              </select>
            </label>
            <label class="campo">
              <span class="sr-only">Quantidade do custo {i + 1}</span>
              <input
                type="text"
                inputMode="decimal"
                value={c.valor}
                onInput={(e) => setCustos(custos.map((x, j) => (j === i ? { ...x, valor: e.currentTarget.value } : x)))}
              />
            </label>
            <button
              type="button"
              class="btn-icone"
              aria-label={`Remover custo ${i + 1}`}
              onClick={() => setCustos(custos.filter((_, j) => j !== i))}
            >
              ✕
            </button>
          </div>
        ))}
        {custos.length < MAX_CUSTOS && livres.length > 0 && (
          <button type="button" class="btn-link" onClick={() => setCustos([...custos, { recurso: livres[0]!, valor: '1' }])}>
            + Adicionar custo
          </button>
        )}
      </fieldset>

      <label class="campo">
        <span>Descrição</span>
        <textarea rows={8} value={descricao} onInput={(e) => setDescricao(e.currentTarget.value)} />
      </label>

      {erro && (
        <p class="erro" role="alert">
          {erro}
        </p>
      )}
      <div class="form-acoes">
        <button type="submit" class="btn btn-primario">
          Salvar skill
        </button>
        <button type="button" class="btn" onClick={() => onFechar(null)}>
          Cancelar
        </button>
        {skill && (
          <button type="button" class="btn btn-dano" onClick={() => void excluir()}>
            Excluir
          </button>
        )}
      </div>
    </form>
  );
}
