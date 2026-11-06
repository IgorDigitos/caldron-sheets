# Caldron Sheets

Ficha, inventário e journal de RPG para o sistema **Caldronis**, instalável no Android como PWA
e funcionando sem internet.

- **Offline-first**: ficha, dano/cura, inventário com imagem e journal salvos no celular.
- **Sync online** (etapa 4): as mudanças sobem quando a conexão volta.
- **Mestre e Jogador** (etapa 5): a fórmula nunca sai do aparelho do Mestre.

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
- [ ] 2 · Ficha e recursos
- [ ] 3 · Inventário, imagens e journal
- [ ] 4 · Nuvem e sincronização
- [ ] 5 · Papéis e segurança
- [ ] 6 · Publicação
