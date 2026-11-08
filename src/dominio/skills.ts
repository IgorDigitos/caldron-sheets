// Skills de uma ficha: Magias, Técnicas, Habilidades e Talentos (mesmas colunas da planilha do Skar).
// Só o Mestre cria e edita; o jogador só lê (garantido em firestore.rules).

import { aplicar, atualDe, ehBasico, extraDe, NOMES_RECURSOS, temRecurso, type Ficha, type IdRecurso } from './ficha';
import { novoId } from './id';

export const CATEGORIAS_SKILL = ['magia', 'tecnica', 'habilidade', 'talento'] as const;
export type CategoriaSkill = (typeof CATEGORIAS_SKILL)[number];

export const NOMES_CATEGORIAS: Record<CategoriaSkill, string> = {
  magia: 'Magias',
  tecnica: 'Técnicas',
  habilidade: 'Habilidades',
  talento: 'Talentos',
};

export const NOME_SINGULAR: Record<CategoriaSkill, string> = {
  magia: 'Magia',
  tecnica: 'Técnica',
  habilidade: 'Habilidade',
  talento: 'Talento',
};

export interface Skill {
  id: string;
  fichaId: string;
  categoria: CategoriaSkill;
  nome: string;
  /** Rolagem ou modificador de ataque, como na planilha: "2d4+FOR", "--". Texto livre. */
  atkMod: string;
  descricao: string;
  /** Custo em ação: "2 PA", "Reação ou 2 PA". Texto livre. */
  pas: string;
  /** Gasto de recurso ou tipo: "2 STA", "Passiva", "Ativo". Texto livre, só para leitura. */
  gastos: string;
  /** O que o botão "Usar" desconta da ficha. Vazio = skill sem custo (passiva). */
  custos: Custo[];
  criadoEm: number;
  atualizadoEm: number;
}

export interface Custo {
  /** Vida, STA, Mana ou o id de um recurso personalizado (ex.: Ímpeto). */
  recurso: IdRecurso;
  valor: number;
}

export const MAX_CUSTOS = 3;

export type DadosSkill = Partial<Pick<Skill, 'categoria' | 'nome' | 'atkMod' | 'descricao' | 'pas' | 'gastos' | 'custos'>>;

export class SkillInvalida extends Error {}

const LIMITES = { nome: 80, atkMod: 60, pas: 60, gastos: 60, descricao: 4000 } as const;

function validar(s: Skill): Skill {
  if (!CATEGORIAS_SKILL.includes(s.categoria)) throw new SkillInvalida('Categoria inválida');
  const limpa: Skill = {
    ...s,
    nome: s.nome.trim(),
    atkMod: s.atkMod.trim(),
    descricao: s.descricao.trim(),
    pas: s.pas.trim(),
    gastos: s.gastos.trim(),
  };
  if (!limpa.nome) throw new SkillInvalida('A skill precisa de um nome');
  const custos = s.custos ?? [];
  if (custos.length > MAX_CUSTOS) throw new SkillInvalida(`No máximo ${MAX_CUSTOS} custos por skill`);
  for (const c of custos) {
    if (!ehBasico(c.recurso) && !/^rec-[\w-]{1,80}$/.test(c.recurso)) {
      throw new SkillInvalida('Recurso do custo inválido');
    }
    if (!Number.isFinite(c.valor) || c.valor <= 0) throw new SkillInvalida('O custo precisa ser maior que zero');
  }
  if (new Set(custos.map((c) => c.recurso)).size !== custos.length) {
    throw new SkillInvalida('Cada recurso aparece uma vez só no custo');
  }
  limpa.custos = custos;
  for (const [campo, max] of Object.entries(LIMITES) as [keyof typeof LIMITES, number][]) {
    if (limpa[campo].length > max) throw new SkillInvalida(`Texto longo demais em ${campo} (máximo ${max})`);
  }
  return limpa;
}

export function criarSkill(fichaId: string, dados: DadosSkill, agora = Date.now()): Skill {
  return validar({
    id: novoId(),
    fichaId,
    categoria: dados.categoria ?? 'tecnica',
    nome: dados.nome ?? '',
    atkMod: dados.atkMod ?? '',
    descricao: dados.descricao ?? '',
    pas: dados.pas ?? '',
    gastos: dados.gastos ?? '',
    custos: dados.custos ?? [],
    criadoEm: agora,
    atualizadoEm: agora,
  });
}

export function editarSkill(s: Skill, dados: DadosSkill, agora = Date.now()): Skill {
  return validar({ ...s, ...dados, atualizadoEm: agora });
}

/** Na ordem em que foram criadas (como na planilha). */
export function daCategoria(skills: readonly Skill[], categoria: CategoriaSkill): Skill[] {
  return skills.filter((s) => s.categoria === categoria).sort((a, b) => a.criadoEm - b.criadoEm);
}

export class RecursoInsuficiente extends Error {}

type NomeDe = (id: IdRecurso) => string;
const nomeBasico: NomeDe = (id) => (ehBasico(id) ? NOMES_RECURSOS[id] : 'Recurso');

/** "2 Stamina + 1 Ímpeto". Vazio se não tem custo. `nome` resolve os personalizados. */
export function descreverCusto(custos: readonly Custo[] | undefined, nome: NomeDe = nomeBasico): string {
  return (custos ?? []).map((c) => `${c.valor.toLocaleString('pt-BR')} ${nome(c.recurso)}`).join(' + ');
}

/**
 * Usa a skill: desconta todos os custos de uma vez (extra primeiro, como no dano) e registra cada
 * um no histórico com o nome da skill. Se faltar recurso (contando o extra), nada é gasto.
 */
export function usarSkill(ficha: Ficha, skill: Skill, agora = Date.now(), nome: NomeDe = nomeBasico): Ficha {
  const custos = skill.custos ?? [];
  for (const c of custos) {
    if (!temRecurso(ficha, c.recurso)) {
      throw new RecursoInsuficiente(`Esta ficha não tem ${nome(c.recurso)} (custo de ${skill.nome})`);
    }
    const disponivel = atualDe(ficha, c.recurso) + extraDe(ficha, c.recurso);
    if (disponivel < c.valor) {
      throw new RecursoInsuficiente(
        `${nome(c.recurso)} insuficiente para ${skill.nome}: precisa de ${c.valor}, tem ${Math.max(0, disponivel)}`,
      );
    }
  }
  let f = ficha;
  for (const c of custos) {
    f = aplicar(f, c.recurso, 'dano', c.valor, agora);
    f = { ...f, historico: [{ ...f.historico[0]!, origem: skill.nome }, ...f.historico.slice(1)] };
  }
  return f;
}
