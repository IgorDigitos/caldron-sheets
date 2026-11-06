# AGENTS.md — Caldron Sheets

Ficha + inventário + journal de RPG (sistema Caldronis), PWA offline-first em
Vite + TypeScript + Preact. Roadmap em 7 etapas (0 a 6); cada etapa só começa com o CI verde.

## Como rodar

```bash
npm ci                          # instala dependências
npx playwright install chromium # navegador do E2E (uma vez)
npm run dev                     # servidor de desenvolvimento (sem service worker)
npm run build && npm run preview  # build de produção com service worker
```

## Suítes de teste

| Comando | O que roda |
| --- | --- |
| `npm run lint` | ESLint (inclui `no-eval` / `no-new-func`) |
| `npm run typecheck` | `tsc` em modo estrito |
| `npm test` | Vitest unitário + componente (jsdom) — `src/**/*.test.ts(x)` |
| `npm run coverage` | Vitest com cobertura v8 |
| `npm run e2e` | Playwright (Chromium desktop + Pixel 7) contra o build de produção em `:4173` |
| `npm run check` | Tudo acima em sequência — rode antes de abrir PR |

O E2E faz o build sozinho (`webServer` em `playwright.config.ts`) porque o service
worker só existe no build de produção.

## Regras do projeto

- **Nunca use `eval`, `new Function` ou similares.** Fórmulas são interpretadas por um parser próprio.
- **A tela nunca fala direto com o banco.** Sempre através de um repositório (interface), para a
  troca Dexie → Firestore na etapa 4 não mexer nas telas.
- **A fórmula nunca sai do aparelho do Mestre.** O jogador só recebe máximos já calculados
  (`hpMax`, `staMax`, `manaMax`).
- Recursos atuais nunca passam do máximo. **Vida atual pode ficar negativa** (decisão do Mestre;
  limite inferior ainda a definir). STA e Mana: entre 0 e o máximo.
- Todo documento editável carrega `atualizadoEm` ("última edição ganha").
- Texto da interface em português do Brasil.
- Meta de cobertura: 90% no motor de regras, 70% no resto.

## Motor de regras (`src/rules`)

- `parser.ts` — tokeniza e interpreta fórmulas: números, símbolos (sem diferenciar maiúsculas),
  `+ - * /` (também `× ÷ −`), parênteses e as funções `media`, `soma`, `min`, `max`, `int`
  (`int` = INT do Excel, arredonda para baixo). Qualquer outra coisa vira `ErroFormula` com mensagem
  em português.
- `motor.ts` — `calcular(formulas, entradas, ajustes)` ordena por dependência, detecta ciclo e
  símbolo desconhecido e devolve `{ ok, valores }` ou `{ ok: false, erros }`. Nunca lança por
  erro do Mestre. `formatar()` arredonda só para exibir (1 casa, pt-BR).
- `caldronis.ts` — preset do sistema. Atributo atual = base + extra − perda, e **todas** as
  fórmulas usam o atual (inclusive CON em Vida/STA/Def). Decimais são mantidos até a tela.
- `fixtures/skar.ts` — **Skar Lionet** é o personagem de referência (planilha
  `C:\RPG KRAIO\Players\Thainan\Skar.xlsx`). Não use o Ez'kher: foi aposentado.

Dúvida sobre fórmula do Caldronis: pergunte ao Mestre, não adivinhe.

## Ficha e dados (etapa 2)

- `src/dominio/ficha.ts` — modelo `Ficha` e funções puras: `criarFicha`, `aplicar` (dano/cura/gasto),
  `recalcular` (máximos novos; se o máximo cai, o atual é cortado), `restaurarTudo`. Piso por recurso
  em `PISO`: Vida sem piso (pode ficar negativa), STA e Mana em 0. Histórico guarda as últimas 20.
- `alterar(ficha, alvo, valor)` muda nível ou atributo (base/extra/perda), recalcula e registra em
  `ficha.alteracoes` (de → para, efeito nos máximos de Vida/STA/Mana, hora; últimas 30). Toda
  edição de nível/atributo na tela passa por ela.
- Mudou o formato salvo da ficha? Crie uma nova `version()` no `dexie.ts` com `upgrade()` que
  preenche o campo nas fichas antigas, e um teste de migração em `repositorio.test.ts`.
- `src/dados/repositorio.ts` — interface `RepositorioFichas`. Implementações: `dexie.ts`
  (IndexedDB, usado no app) e `memoria.ts` (testes de tela). `repositorio.test.ts` roda a mesma
  suíte em todas; a do Firestore (etapa 4) entra nessa lista.
- `src/ui/` — telas. Rotas por hash: `#/` lista, `#/ficha/<id>` ficha. Testes de tela usam
  `RepositorioMemoria`; testes do Dexie usam `fake-indexeddb`.

## Inventário, fotos, journal e backup (etapa 3)

- `src/dominio/inventario.ts` — itens (qtd, peso por unidade, Def.F/Def.M, `equipado`), peso total,
  defesa dos itens (**só equipados**, qtd × defesa) e carteira (valores em cobre: ferro 0,1 … oricalco
  1.000.000; **Moeda d'Alma** é contador à parte, fora do total). Sem limite de carga (decisão do Mestre).
  Toda mudança de moeda passa por `movimentarMoeda`, que registra de → para em `carteira.historico`
  (últimas 30).
- `src/dominio/journal.ts` — entradas com data AAAA-MM-DD, título, texto, sessão opcional e até 6
  imagens (`imagens`: ids na tabela `imagens`, mesma compressão das fotos de item).
- Foto de item: só galeria/arquivo (sem botão de câmera, decisão do Mestre).
- `src/midia/imagem.ts` — foto ≤ 400px de lado e ≤ 150KB em WebP (JPEG se o navegador não tiver
  WebP), guardada como data URL num registro separado do item. `escolherCompressao` é pura e testada
  com codificador falso; a parte de canvas só roda no E2E.
- `src/dados/exportacao.ts` — exporta/importa o pacote inteiro em JSON. `lerArquivo` valida tudo antes de
  gravar (só aceita imagem `data:image/(webp|jpeg|png)`). Importar com id existente pede confirmação e
  substitui tudo daquela ficha numa transação.
- Rotas: `#/ficha/<id>`, `#/ficha/<id>/inventario`, `#/ficha/<id>/journal`.
- Banco Dexie na versão 3 (tabelas `itens`, `imagens`, `journal`; carteira na ficha).

## Estrutura

```
src/          código do app (Preact)
src/rules/    motor de fórmulas e preset Caldronis (cobertura mínima 90%)
src/dominio/  regras da ficha sem tela e sem banco
src/dados/    repositórios (Dexie hoje, Firestore na etapa 4)
src/ui/       componentes de tela
e2e/          testes Playwright
scripts/      utilitários (ex.: gen-icons.mjs gera os PNGs a partir de public/icon.svg)
public/       ícones e assets estáticos
```
