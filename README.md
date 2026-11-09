# Caldron Sheets

[![CI](https://github.com/IgorDigitos/caldron-sheets/actions/workflows/ci.yml/badge.svg)](https://github.com/IgorDigitos/caldron-sheets/actions/workflows/ci.yml)

Aplicativo web progressivo (PWA) de fichas de personagem para o sistema de RPG **Caldronis**. Reúne ficha,
inventário, journal, skills e uma mesa de rolagens integrada ao Discord. Funciona sem internet e sincroniza
os dados com a nuvem quando a conexão volta.

**Acesse:** <https://caldron-sheets.web.app>

## Funcionalidades

- **Ficha de personagem.** Atributos, nível e valores derivados (Vida, Stamina, Mana, Corpo, Mente, defesas
  e deslocamento) calculados pelas fórmulas do Caldronis. Dano, cura, recursos temporários, descanso curto
  e longo e histórico de alterações.
- **Inventário e carteira.** Itens com quantidade, peso, defesa, foto e controle de equipados. Moedas
  convertidas em Caldris, com histórico de movimentações.
- **Journal.** Registro das sessões com data, texto e até seis imagens por entrada.
- **Skills.** Magias, técnicas, habilidades e talentos, com custo descontado da ficha ao usar.
- **Recursos personalizados.** O Mestre define recursos próprios da campanha (por exemplo, Ímpeto), cada um
  com uma fórmula para o máximo.
- **Mesa.** Chat da campanha com rolagens de dados feitas pelo bot
  [Caldronis Dice](https://github.com/IgorDigitos/Caldronis-Dice) e publicadas no Discord. Também tem um
  canal reservado ao Mestre para rolagens secretas.
- **Mestre e jogadores.** O Mestre cria as contas e atribui as fichas. Cada jogador vê e edita apenas o que
  é seu, e as regras do servidor validam cada alteração.
- **Offline e backup.** Os dados ficam salvos no aparelho, e cada ficha pode ser exportada e importada em
  JSON.

## Instalação no celular

1. Abra <https://caldron-sheets.web.app> no navegador (Chrome no Android, Safari no iPhone).
2. Escolha **Instalar app** no menu ⋮ do Chrome ou **Adicionar à Tela de Início** no menu de compartilhar
   do Safari.

Use sempre esse endereço. O login fica salvo por endereço, e os links de prévia dos pull requests têm uma
sessão separada.

## Tecnologias

| Camada | Ferramentas |
| --- | --- |
| Interface | [Preact](https://preactjs.com/), TypeScript (modo estrito), [Vite](https://vite.dev/) e `vite-plugin-pwa` |
| Dados | Firebase Authentication e Cloud Firestore com cache persistente (IndexedDB) |
| Hospedagem | Firebase Hosting |
| Testes | Vitest, Testing Library, Playwright e Firebase Emulator Suite |
| Integração contínua | GitHub Actions |

As fórmulas do sistema passam por um interpretador próprio (`src/rules`). O projeto não usa `eval` nem
`new Function`.

## Desenvolvimento

Pré-requisitos: Node.js 22 ou superior e Java 21 ou superior (o emulador do Firebase e os testes E2E
precisam de Java).

```bash
npm ci
npx playwright install chromium
npm run dev
```

O servidor de desenvolvimento não registra o service worker. Para testar o comportamento offline, use o
build de produção:

```bash
npm run build && npm run preview
```

### Scripts

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run lint` | ESLint |
| `npm run typecheck` | Verificação de tipos com `tsc` |
| `npm test` | Testes unitários e de componentes |
| `npm run coverage` | Testes com relatório de cobertura |
| `npm run test:nuvem` | Testes do repositório e das regras do Firestore no emulador |
| `npm run e2e` | Testes de ponta a ponta (Chromium desktop e Pixel 7) |
| `npm run check` | Lint, tipos, testes unitários e E2E em sequência |

### Estrutura

```
src/rules/     motor de fórmulas e preset Caldronis
src/dominio/   regras da ficha, sem interface e sem banco de dados
src/dados/     repositórios (Firestore, Dexie e memória)
src/nuvem/     configuração do Firebase, login e migração
src/ui/        componentes de tela
e2e/           testes Playwright
```

Convenções, regras de negócio e decisões do projeto estão em [AGENTS.md](AGENTS.md). A configuração do
Firebase está descrita em [docs/firebase-setup.md](docs/firebase-setup.md).

## Publicação

Cada pull request passa pelo CI (lint, tipos, cobertura, emulador e E2E) e ganha um link de prévia, que
expira em sete dias. O merge na `main` publica o site em produção e roda um teste de fumaça no endereço
publicado.

As regras do Firestore **não** são publicadas pelo CI. Depois de alterar `firestore.rules`, publique à mão:

```bash
npx firebase deploy --only firestore:rules --project caldron-sheets
```
