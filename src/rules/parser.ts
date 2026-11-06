// Parser de fórmulas do Mestre. Aceita só números, símbolos (atributos ou valores
// derivados), + − × ÷, parênteses e as funções de FUNCOES. Nunca usa eval.

export type No =
  | { tipo: 'numero'; valor: number }
  | { tipo: 'ref'; nome: string }
  | { tipo: 'unario'; op: '-' | '+'; arg: No }
  | { tipo: 'binario'; op: '+' | '-' | '*' | '/'; esq: No; dir: No }
  | { tipo: 'chamada'; funcao: NomeFuncao; args: No[] };

export class ErroFormula extends Error {
  constructor(
    message: string,
    readonly posicao?: number,
  ) {
    super(message);
    this.name = 'ErroFormula';
  }
}

interface DefFuncao {
  minArgs: number;
  maxArgs: number;
  calc: (args: number[]) => number;
}

export const FUNCOES = {
  media: { minArgs: 1, maxArgs: Infinity, calc: (a) => a.reduce((s, x) => s + x, 0) / a.length },
  soma: { minArgs: 1, maxArgs: Infinity, calc: (a) => a.reduce((s, x) => s + x, 0) },
  min: { minArgs: 1, maxArgs: Infinity, calc: (a) => Math.min(...a) },
  max: { minArgs: 1, maxArgs: Infinity, calc: (a) => Math.max(...a) },
  // Igual ao INT() do Excel: arredonda para baixo.
  int: { minArgs: 1, maxArgs: 1, calc: (a) => Math.floor(a[0]!) },
} satisfies Record<string, DefFuncao>;

export type NomeFuncao = keyof typeof FUNCOES;

function ehFuncao(nome: string): nome is NomeFuncao {
  return Object.hasOwn(FUNCOES, nome);
}

type Token =
  | { tipo: 'num'; valor: number; pos: number }
  | { tipo: 'id'; nome: string; pos: number }
  | { tipo: 'op'; op: string; pos: number }
  | { tipo: 'fim'; pos: number };

// Letras latinas com acento, menos × (U+00D7) e ÷ (U+00F7), que são operadores.
const LETRA = /[A-Za-z_À-ÖØ-öø-ɏ]/;
const LETRA_OU_DIGITO = /[A-Za-z0-9_À-ÖØ-öø-ɏ]/;
const OPERADORES = new Set(['+', '-', '*', '/', '(', ')', ',']);
const MAX_TAMANHO = 500;

function tokenizar(texto: string): Token[] {
  if (texto.length > MAX_TAMANHO) {
    throw new ErroFormula(`Fórmula longa demais (máximo ${MAX_TAMANHO} caracteres)`);
  }
  const tokens: Token[] = [];
  let i = 0;
  while (i < texto.length) {
    const c = texto[i]!;
    if (/\s/.test(c)) {
      i++;
    } else if (/[0-9.]/.test(c)) {
      const inicio = i;
      while (i < texto.length && /[0-9.]/.test(texto[i]!)) i++;
      const bruto = texto.slice(inicio, i);
      if (!/^(\d+\.?\d*|\.\d+)$/.test(bruto)) {
        throw new ErroFormula(`Número inválido "${bruto}" na posição ${inicio + 1}`, inicio);
      }
      tokens.push({ tipo: 'num', valor: Number(bruto), pos: inicio });
    } else if (LETRA.test(c)) {
      const inicio = i;
      while (i < texto.length && LETRA_OU_DIGITO.test(texto[i]!)) i++;
      tokens.push({ tipo: 'id', nome: texto.slice(inicio, i), pos: inicio });
    } else if (OPERADORES.has(c)) {
      tokens.push({ tipo: 'op', op: c, pos: i });
      i++;
    } else if (c === '×') {
      tokens.push({ tipo: 'op', op: '*', pos: i++ });
    } else if (c === '÷') {
      tokens.push({ tipo: 'op', op: '/', pos: i++ });
    } else if (c === '−') {
      tokens.push({ tipo: 'op', op: '-', pos: i++ });
    } else {
      throw new ErroFormula(`Caractere não permitido "${c}" na posição ${i + 1}`, i);
    }
  }
  tokens.push({ tipo: 'fim', pos: texto.length });
  return tokens;
}

function descrever(t: Token): string {
  switch (t.tipo) {
    case 'num':
      return `o número ${t.valor}`;
    case 'id':
      return `"${t.nome}"`;
    case 'op':
      return `"${t.op}"`;
    case 'fim':
      return 'o fim da fórmula';
  }
}

/** Símbolos são comparados sem diferenciar maiúsculas: "corpo" e "CORPO" são o mesmo. */
export function normalizarSimbolo(nome: string): string {
  return nome.toUpperCase();
}

export function parse(texto: string): No {
  const tokens = tokenizar(texto);
  let i = 0;
  const atual = () => tokens[i]!;
  const ehOp = (op: string) => {
    const t = atual();
    return t.tipo === 'op' && t.op === op;
  };
  const esperar = (op: string) => {
    if (!ehOp(op)) {
      const t = atual();
      throw new ErroFormula(`Esperava "${op}" na posição ${t.pos + 1}, mas veio ${descrever(t)}`, t.pos);
    }
    i++;
  };

  // expr  := termo (('+' | '-') termo)*
  // termo := fator (('*' | '/') fator)*
  // fator := ('+' | '-') fator | numero | id | id '(' args ')' | '(' expr ')'
  function expr(): No {
    let no = termo();
    while (ehOp('+') || ehOp('-')) {
      const op = (atual() as { op: '+' | '-' }).op;
      i++;
      no = { tipo: 'binario', op, esq: no, dir: termo() };
    }
    return no;
  }

  function termo(): No {
    let no = fator();
    while (ehOp('*') || ehOp('/')) {
      const op = (atual() as { op: '*' | '/' }).op;
      i++;
      no = { tipo: 'binario', op, esq: no, dir: fator() };
    }
    return no;
  }

  function fator(): No {
    const t = atual();
    if (ehOp('-') || ehOp('+')) {
      i++;
      return { tipo: 'unario', op: (t as { op: '-' | '+' }).op, arg: fator() };
    }
    if (t.tipo === 'num') {
      i++;
      return { tipo: 'numero', valor: t.valor };
    }
    if (ehOp('(')) {
      i++;
      const dentro = expr();
      esperar(')');
      return dentro;
    }
    if (t.tipo === 'id') {
      i++;
      if (ehOp('(')) {
        const nome = t.nome.toLowerCase();
        if (!ehFuncao(nome)) {
          throw new ErroFormula(
            `Função desconhecida "${t.nome}". Funções permitidas: ${Object.keys(FUNCOES).join(', ')}`,
            t.pos,
          );
        }
        i++;
        const args: No[] = [];
        if (!ehOp(')')) {
          args.push(expr());
          while (ehOp(',')) {
            i++;
            args.push(expr());
          }
        }
        esperar(')');
        const def: DefFuncao = FUNCOES[nome];
        if (args.length < def.minArgs || args.length > def.maxArgs) {
          const qtd = def.minArgs === def.maxArgs ? `${def.minArgs}` : `pelo menos ${def.minArgs}`;
          throw new ErroFormula(`${nome}() precisa de ${qtd} argumento(s), recebeu ${args.length}`, t.pos);
        }
        return { tipo: 'chamada', funcao: nome, args };
      }
      return { tipo: 'ref', nome: normalizarSimbolo(t.nome) };
    }
    throw new ErroFormula(`Esperava um valor na posição ${t.pos + 1}, mas veio ${descrever(t)}`, t.pos);
  }

  if (atual().tipo === 'fim') throw new ErroFormula('Fórmula vazia');
  const raiz = expr();
  if (atual().tipo !== 'fim') {
    const t = atual();
    throw new ErroFormula(`Sobrou ${descrever(t)} na posição ${t.pos + 1}`, t.pos);
  }
  return raiz;
}

/** Todos os símbolos que a fórmula usa, sem repetição. */
export function dependencias(no: No): string[] {
  const achados = new Set<string>();
  const visitar = (n: No): void => {
    switch (n.tipo) {
      case 'ref':
        achados.add(n.nome);
        break;
      case 'unario':
        visitar(n.arg);
        break;
      case 'binario':
        visitar(n.esq);
        visitar(n.dir);
        break;
      case 'chamada':
        n.args.forEach(visitar);
        break;
    }
  };
  visitar(no);
  return [...achados];
}

function operar(op: '+' | '-' | '*' | '/', a: number, b: number): number {
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '*':
      return a * b;
    case '/':
      if (b === 0) throw new ErroFormula('Divisão por zero');
      return a / b;
  }
}

export function avaliar(no: No, valores: ReadonlyMap<string, number>): number {
  switch (no.tipo) {
    case 'numero':
      return no.valor;
    case 'ref': {
      const v = valores.get(no.nome);
      if (v === undefined) throw new ErroFormula(`Símbolo desconhecido "${no.nome}"`);
      return v;
    }
    case 'unario': {
      const v = avaliar(no.arg, valores);
      return no.op === '-' ? -v : v;
    }
    case 'binario':
      return operar(no.op, avaliar(no.esq, valores), avaliar(no.dir, valores));
    case 'chamada': {
      const def: DefFuncao = FUNCOES[no.funcao];
      return def.calc(no.args.map((a) => avaliar(a, valores)));
    }
  }
}
