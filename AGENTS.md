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
- Recursos atuais sempre entre 0 e o máximo.
- Todo documento editável carrega `atualizadoEm` ("última edição ganha").
- Texto da interface em português do Brasil.
- Meta de cobertura: 90% no motor de regras, 70% no resto.

## Estrutura

```
src/          código do app (Preact)
e2e/          testes Playwright
scripts/      utilitários (ex.: gen-icons.mjs gera os PNGs a partir de public/icon.svg)
public/       ícones e assets estáticos
```
