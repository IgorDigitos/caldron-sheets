# Caldron Sheets

Ficha, inventário e journal de RPG para o sistema **Caldronis**, instalável no Android como PWA
e funcionando sem internet.

- **Offline-first**: ficha, dano/cura, inventário com imagem e journal salvos no celular.
- **Sync online**: as mudanças sobem sozinhas quando a conexão volta (Firebase).
- **Mestre e Jogador**: o Mestre cria as contas e entrega as fichas; o servidor recusa o que o jogador não pode mudar.

## Começando

```bash
npm ci
npx playwright install chromium
npm run dev
```

Comandos de teste e regras do projeto estão em [AGENTS.md](AGENTS.md).

## Etapas

- [x] 0 · Fundação — PWA, CI, testes
- [x] 1 · Motor de regras
- [x] 2 · Ficha e recursos
- [x] 3 · Inventário, imagens e journal
- [x] 4 · Nuvem e sincronização
- [x] 5 · Papéis e segurança
- [ ] 6 · Publicação
