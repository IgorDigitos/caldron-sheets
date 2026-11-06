# Configurar o Firebase (Etapa 4)

Passo a passo para o Mestre criar o projeto do Caldron Sheets no Firebase. Usa o **plano gratuito
(Spark)**, que não pede cartão. Leva uns 10 minutos.

## 1. Criar o projeto

1. Abra <https://console.firebase.google.com> e entre com sua conta Google.
2. Clique em **Criar um projeto** (ou **Adicionar projeto**).
3. Nome: `caldron-sheets`. O Firebase pode acrescentar um sufixo (ex.: `caldron-sheets-a1b2c`);
   **anote o ID do projeto** que aparecer embaixo do nome.
4. Aceite os termos e continue.
5. **Google Analytics: desative.** O app não precisa.
6. Clique em **Criar projeto** e espere terminar.

## 2. Ligar o login com e-mail e senha

1. No menu da esquerda: **Criação** (Build) → **Authentication** → **Vamos começar**.
2. Aba **Método de login** → **E-mail/senha**.
3. Ative **só a primeira chave** ("E-mail/senha"). Deixe "Link do e-mail" desligado.
4. **Salvar**.

> Os jogadores não vão digitar e-mail: o app transforma o usuário que você criar (ex.: `thainan`)
> num e-mail interno (`thainan@caldron-sheets.invalid`, um domínio reservado que não existe e nunca
> recebe e-mail). Você só precisa ligar esse método.

## 3. Criar o banco (Firestore)

1. Menu da esquerda: **Criação** → **Firestore Database** → **Criar banco de dados**.
2. Edição: **Standard** (se perguntar).
3. Local: **`southamerica-east1` (São Paulo)**. ⚠️ Não dá para mudar depois.
4. Regras: **Iniciar no modo de produção** (bloqueia tudo; o app manda as regras certas na etapa 5).
5. **Criar**.

## 4. Registrar o app Web e pegar a configuração

1. Clique na engrenagem ⚙️ ao lado de "Visão geral do projeto" → **Configurações do projeto**.
2. Role até **Seus apps** → clique no ícone **Web** (`</>`).
3. Apelido: `caldron-web`. **Não** marque "Firebase Hosting" agora (fica para a etapa 6).
4. **Registrar app**.
5. Vai aparecer um bloco assim:

   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "caldron-sheets-xxxx.firebaseapp.com",
     projectId: "caldron-sheets-xxxx",
     storageBucket: "caldron-sheets-xxxx.firebasestorage.app",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abc123"
   };
   ```

6. **Copie esse bloco e mande no chat.**

> Esses valores **não são senha**: o Firebase foi feito para eles ficarem dentro do app, e qualquer
> pessoa que abrir o app consegue vê-los. Quem protege os dados são as regras do Firestore (etapa 5).
> Pode mandar sem medo; eles vão para o arquivo `.env` do projeto.

## 5. Ligar a linha de comando à sua conta

No terminal, dentro de `C:\CaldronSheets`:

```bash
npx firebase login
```

Ele abre o navegador para você entrar com a mesma conta Google e autorizar. Depois confira:

```bash
npx firebase projects:list
```

O projeto `caldron-sheets-...` tem que aparecer na lista.

## Pronto

Mande no chat:

- o **ID do projeto**;
- o bloco **firebaseConfig**;
- se o `firebase projects:list` mostrou o projeto.

Com isso, a etapa 4 começa.
