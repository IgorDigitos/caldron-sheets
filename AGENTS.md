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
| `npm run test:nuvem` | Vitest contra o Firebase Emulator: mesma suíte do repositório no Firestore, login e `firestore.rules` |
| `npm run e2e` | Playwright (Chromium desktop + Pixel 7) contra o build `--mode emulador` em `:4173`, com o emulador junto |
| `npm run emulators` | Sobe Auth (9099) + Firestore (8080) do emulador, projeto `demo-caldron` |
| `npm run check` | Tudo acima em sequência — rode antes de abrir PR |

O E2E faz o build sozinho (`webServer` em `playwright.config.ts`) porque o service
worker só existe no build de produção. O emulador e o E2E precisam de **Java 21+** no PATH.
Os testes E2E rodam um por vez (todos limpam e usam o mesmo emulador).

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
  (`int` = INT do Excel, arredonda para baixo) e `arred` (inteiro mais próximo). Qualquer outra coisa vira `ErroFormula` com mensagem
  em português.
- `motor.ts` — `calcular(formulas, entradas, ajustes)` ordena por dependência, detecta ciclo e
  símbolo desconhecido e devolve `{ ok, valores }` ou `{ ok: false, erros }`. Nunca lança por
  erro do Mestre. `formatar()` arredonda só para exibir (1 casa, pt-BR).
- `caldronis.ts` — preset do sistema. Atributo atual = base + extra − perda, e **todas** as
  fórmulas usam o atual (inclusive CON em Vida/STA/Def). **Vida, STA e Mana máximas são inteiras**
  (`arred()`, mais próximo, ,5 sobe). Corpo, Mente, defesas e deslocamento guardam decimais até a tela.
  Ficha salva com regra antiga é recalculada ao abrir (`atualizarParaRegrasAtuais`).
- `fixtures/skar.ts` — **Skar Lionet** é o personagem de referência (planilha
  `C:\RPG KRAIO\Players\Thainan\Skar.xlsx`). Não use o Ez'kher: foi aposentado.

Dúvida sobre fórmula do Caldronis: pergunte ao Mestre, não adivinhe.

## Ficha e dados (etapa 2)

- `src/dominio/ficha.ts` — modelo `Ficha` e funções puras: `criarFicha`, `aplicar` (dano/cura/gasto),
  `recalcular` (máximos novos; se o máximo cai, o atual é cortado), `descansoLongo` (recupera 50% da
  Vida máxima, arredondado, sem passar do máximo; enche STA e Mana).
- **Extra (temporário)** por recurso em `ficha.extras` (campo manual no cartão do recurso): dano/gasto tira
  primeiro do extra, cura não recupera, descanso não mexe. `definirExtra`, `extraDe`.
- Histórico de recursos (`TipoEntrada`): dano, cura, `descanso` (uma linha por recurso que subiu) e
  `extra` (de → para). Piso por recurso
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
  defesa dos itens (**só equipados**, qtd × defesa) e carteira (valores em **Caldris**, a unidade do total — 1 cobre = 1 Caldris: ferro 0,1 … oricalco
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

## Nuvem e sincronização (etapa 4)

- Firebase Auth (usuário e senha) + Firestore com cache persistente (IndexedDB). Config pública em
  `src/nuvem/config.ts`; `.env.emulador` (`VITE_EMULADOR=1`) aponta o build para o emulador.
- Login: "thainan" vira `thainan@caldron-sheets.invalid`. O **primeiro acesso** cria a conta do Mestre e
  grava `campanha/config { mestreUid }` — as regras só deixam criar esse documento uma vez.
- `src/dados/firestore.ts` — `RepositorioFirestore`. **Escrita nunca espera o servidor**: grava no cache,
  espera só a gravação local (leitura do cache enfileirada depois) e acompanha a confirmação à parte
  (`observar()` → `EstadoSync { pendentes, gravando, erro }`). Sem rede, lê direto do cache.
- Coleções no topo: `personagens`, `itens`, `imagens`, `journal` (cada doc com `fichaId`).
- `firestore.rules` — só o Mestre lê/escreve; **última edição ganha**: atualização com `atualizadoEm`
  menor que o do servidor é recusada (o aparelho atrasado recebe aviso). Imagens: só data URL
  webp/jpeg/png < 700KB. Testes em `src/nuvem/regras.nuvem.test.ts`.
- Campos editáveis que salvam ao sair do campo usam `<Entrada>` (`src/ui/comum.tsx`), que guarda o
  rascunho: um `<input value>` comum é resetado pelos redesenhos do indicador de sync.
- Fichas antigas do Dexie: aviso "Enviar para a nuvem" na lista (`src/nuvem/migracao.ts`); o Dexie
  não é apagado.
- Publicar regras: `npx firebase deploy --only firestore:rules --project caldron-sheets`.

## Papéis: Mestre e Jogador (etapa 5)

- Um Mestre por campanha (`campanha/config`). Ele cria as contas de jogador na tela **Jogadores**
  (`src/nuvem/contas.ts` usa uma segunda instância do Firebase para não deslogar o Mestre) e grava
  `usuarios/{uid} { usuario, papel: 'jogador' }`. A ficha ganha `donoUid` (escolhido em "Editar ficha").
- Jogador: vê só as fichas com `donoUid` dele (o repositório filtra; as regras exigem o filtro).
  Pode: recursos, extra, descanso, histórico, carteira, inventário, journal (tudo) e **extra/perda** dos
  atributos. Não pode: base dos atributos, nome, raça, classe, nível, dono, criar/apagar ficha.
- O app do jogador recalcula os máximos na hora (as fórmulas vão no app) e o **servidor refaz a conta**
  em `firestore.rules` (`maximosConferem`). ⚠️ Mudou uma fórmula em `src/rules/caldronis.ts`? Mude
  `maximosConferem` junto e rode `npm run test:nuvem` (`regrasJogador.nuvem.test.ts` monta os dados
  com as funções do app, então pega divergência).
- Interface: `ContextoSessao` (`src/ui/papel.tsx`) diz o papel às telas; sem contexto = Mestre.
- Trocar senha de jogador: só pelo console do Firebase (sem Admin SDK no plano gratuito).

## Publicação (etapa 6)

- Site: **https://caldron-sheets.web.app** (Firebase Hosting, `firebase.json`). `index.html`, `sw.js` e o
  manifesto vão sem cache; `assets/` com hash em cache de 1 ano.
- CI (`.github/workflows/ci.yml`): o job `deploy` só roda depois do `check` (lint, tipos, cobertura,
  emulador e E2E). Em PR publica num **canal de prévia** (link comentado no PR, expira em 7 dias); no
  push para `main` publica no site de verdade. Depois roda `npm run e2e:producao` (fumaça sem login
  contra o link publicado: abre, é instalável, abre sem rede).
- Segredo `FIREBASE_SERVICE_ACCOUNT_CALDRON_SHEETS` (criado por `firebase init hosting:github`; conta de
  serviço só com permissão de Hosting). **As regras do Firestore NÃO são publicadas pelo CI**: rode
  `npx firebase deploy --only firestore:rules` à mão depois de mudar `firestore.rules`.
- Publicar à mão: `npm run deploy`.
- O app pede armazenamento persistente ao abrir (`src/plataforma/armazenamento.ts`).

## Skills (Magias, Técnicas, Habilidades, Talentos)

- `src/dominio/skills.ts` — colunas da planilha (nome, ATK/MOD, PAs, gastos em texto, descrição) mais
  `custos` estruturados (`{ recurso, valor }[]`, até 3), que o botão **Usar** desconta da ficha via
  `usarSkill` (extra primeiro; sem recurso suficiente, não gasta nada). O histórico guarda `origem`
  (nome da skill).
- Coleção `skills` (com `fichaId`). Só o Mestre cria/edita/apaga; o dono da ficha só lê. Usar a skill
  grava a FICHA (regras de jogador já cobrem gastar STA/Mana).
- Aba `#/ficha/<id>/skills`. "Criar Skar de exemplo" já vem com as skills da planilha.
- Backup inclui `skills` (opcional no arquivo, para backups antigos).

## Recursos personalizados (ex.: Ímpeto)

- Catálogo da campanha (coleção `recursos`, tela `#/recursos`, só Mestre): nome, cor, fórmula do máximo
  (motor de fórmulas: NIVEL, atributos atuais, derivados; ex.: Ímpeto = `3 + int(NIVEL/2)`) e se começa
  cheio ou em 0. `src/dominio/recursos.ts`.
- Em cada ficha o Mestre marca quais tem ("Editar ficha → Recursos especiais"), até 6. A ficha guarda
  `personalizados` (atual) e `maxPersonalizados` (máximo).
- **Só o app do Mestre calcula o máximo** (`recalcularPersonalizados`, ao abrir a ficha e ao mudar
  nível/atributo): o servidor não confere fórmula livre. As regras deixam o jogador mudar o atual
  (0…máximo) e o extra, nunca o máximo nem a lista. Se o jogador mudar extra/perda de atributo, o
  máximo do personalizado só atualiza quando o Mestre abrir a ficha.
- Jogador e Mestre gastam/recuperam; o Descanso longo não mexe; podem ser custo de skill.
- `IdRecurso` (string) generaliza `aplicar`, `definirExtra`, histórico e custos: básicos são
  `VIDA/STA/MANA`, personalizados têm id `rec-…`.
- Backup leva as definições usadas pela ficha; importar cria no catálogo as que faltam.

## Estrutura

```
src/          código do app (Preact)
src/rules/    motor de fórmulas e preset Caldronis (cobertura mínima 90%)
src/dominio/  regras da ficha sem tela e sem banco
src/dados/    repositórios (Firestore no app; Dexie para migrar; memória nos testes)
src/nuvem/    Firebase: config, login, migração, ajudantes de teste do emulador
src/ui/       componentes de tela
e2e/          testes Playwright
scripts/      utilitários (ex.: gen-icons.mjs gera os PNGs a partir de public/icon.svg)
public/       ícones e assets estáticos
```
