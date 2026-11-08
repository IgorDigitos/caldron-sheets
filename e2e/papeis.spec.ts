// Etapa 5: Mestre e Jogador em navegadores diferentes.

import { expect, test } from '@playwright/test';
import { abrirComoNovoMestre, entrarComo, esperarSincronizado, limparEmulador, recarregar } from './ajuda';

test.beforeEach(limparEmulador);

test('Mestre cria o jogador e entrega a ficha; jogador joga e o servidor aceita', async ({ page, browser, baseURL }) => {
  // Mestre
  await abrirComoNovoMestre(page);
  await page.getByRole('button', { name: 'Criar Skar de exemplo' }).click();
  await expect(page.getByRole('heading', { name: 'Skar Lionet' })).toBeVisible();
  const rotaSkar = new URL(page.url()).hash;
  await page.getByRole('link', { name: '← Fichas' }).click();
  await page.getByRole('button', { name: 'Nova ficha' }).click(); // ficha que NÃO é do jogador
  await page.getByRole('link', { name: '← Fichas' }).click();

  await page.getByRole('link', { name: 'Jogadores' }).click();
  const form = page.getByRole('form', { name: 'Nova conta de jogador' });
  await form.getByLabel('Usuário').fill('thainan');
  await form.getByLabel('Senha', { exact: true }).fill('senha-thainan');
  await form.getByLabel('Confirmar senha').fill('senha-thainan');
  await form.getByRole('button', { name: 'Criar conta de jogador' }).click();
  await expect(page.getByRole('status')).toContainText('Conta "thainan" criada');
  await expect(page.getByText('mestre', { exact: true })).toBeVisible(); // Mestre continua logado

  await page.goto(`/${rotaSkar}`);
  await page.getByText('Editar ficha').click();
  await page.getByLabel('Jogador').selectOption({ label: 'thainan' });
  await esperarSincronizado(page);

  // Jogador
  const ctx = await browser.newContext({ baseURL });
  const jog = await ctx.newPage();
  await entrarComo(jog, 'thainan', 'senha-thainan');
  await expect(jog.getByRole('link', { name: /Skar Lionet/ })).toBeVisible();
  await expect(jog.getByRole('link', { name: /Novo personagem/ })).toHaveCount(0);
  await expect(jog.getByRole('button', { name: 'Nova ficha' })).toHaveCount(0);
  await expect(jog.getByRole('link', { name: 'Jogadores' })).toHaveCount(0);

  await jog.getByRole('link', { name: /Skar Lionet/ }).click();
  await expect(jog.getByText('Editar ficha')).toHaveCount(0);
  await expect(jog.getByRole('region', { name: 'Atributos' }).getByTestId('atual-FOR')).toHaveText('8');
  await expect(jog.getByLabel('Força base')).toHaveCount(0);
  await expect(jog.getByLabel('Nível')).toHaveCount(0);
  await jog.getByLabel('Constituição extra').fill('2');
  await jog.getByLabel('Constituição extra').press('Tab');
  await expect(jog.getByTestId('valor-VIDA')).toHaveText('45 / 56');
  const vida = jog.getByRole('region', { name: 'Vida' });
  await vida.getByLabel('Quantidade de Vida').fill('8');
  await vida.getByRole('button', { name: 'Dano' }).click();
  await expect(jog.getByTestId('valor-VIDA')).toHaveText('37 / 56');
  await esperarSincronizado(jog);
  await expect(jog.getByRole('alert')).toHaveCount(0); // servidor não recusou nada

  // Skills: o jogador vê e usa, mas não edita.
  await jog.getByRole('tab', { name: 'Skills' }).click();
  const guarda = jog.getByRole('article', { name: 'Guarda de Impacto' });
  await expect(jog.getByRole('button', { name: /^Editar/ })).toHaveCount(0);
  await guarda.getByRole('button', { name: 'Usar (−2 Stamina)' }).click();
  await expect(jog.getByRole('status')).toHaveText('Usou Guarda de Impacto: −2 Stamina');
  await esperarSincronizado(jog);
  await expect(jog.getByRole('alert')).toHaveCount(0);

  // O jogador vai para o inventário e o journal da própria ficha.
  await jog.getByRole('tab', { name: 'Journal' }).click();
  await jog.getByRole('button', { name: 'Nova entrada' }).click();
  await jog.getByLabel('Título').fill('Diário do Skar');
  await jog.getByRole('button', { name: 'Salvar entrada' }).click();
  await esperarSincronizado(jog);
  await expect(jog.getByRole('alert')).toHaveCount(0);

  // O Mestre vê tudo.
  await recarregar(page);
  await expect(page.getByTestId('valor-VIDA')).toHaveText('37 / 56');
  await expect(page.getByTestId('valor-STA')).toHaveText(/^18 \//);
  await expect(page.getByRole('region', { name: 'Histórico', exact: true })).toContainText('−2 gasto (Guarda de Impacto)');
  await page.getByRole('tab', { name: 'Journal' }).click();
  await expect(page.getByRole('heading', { name: 'Diário do Skar' })).toBeVisible();
  await ctx.close();
});

test('jogador abrindo ficha de outro pela URL não vê nada', async ({ page, browser, baseURL }) => {
  await abrirComoNovoMestre(page);
  await page.getByRole('button', { name: 'Criar Skar de exemplo' }).click();
  await expect(page.getByRole('heading', { name: 'Skar Lionet' })).toBeVisible();
  const rotaSkar = new URL(page.url()).hash;
  expect(rotaSkar).toMatch(/^#\/ficha\//);
  await page.getByRole('link', { name: '← Fichas' }).click();
  await page.getByRole('link', { name: 'Jogadores' }).click();
  const form = page.getByRole('form', { name: 'Nova conta de jogador' });
  await form.getByLabel('Usuário').fill('curioso');
  await form.getByLabel('Senha', { exact: true }).fill('senha-curioso');
  await form.getByLabel('Confirmar senha').fill('senha-curioso');
  await form.getByRole('button', { name: 'Criar conta de jogador' }).click();
  await expect(page.getByRole('status')).toBeVisible();

  const ctx = await browser.newContext({ baseURL });
  const jog = await ctx.newPage();
  await entrarComo(jog, 'curioso', 'senha-curioso');
  await expect(jog.getByText('O Mestre ainda não te deu nenhuma ficha.')).toBeVisible();
  await jog.goto(`/${rotaSkar}`);
  await expect(jog.getByText('Ficha não encontrada.')).toBeVisible();
  await jog.goto('/#/jogadores');
  await expect(jog.getByRole('form', { name: 'Nova conta de jogador' })).toHaveCount(0);
  await ctx.close();
});

test('Ímpeto: Mestre cria e habilita; jogador ganha e gasta numa skill', async ({ page, browser, baseURL }) => {
  await abrirComoNovoMestre(page);
  await page.getByRole('button', { name: 'Criar Skar de exemplo' }).click();
  await expect(page.getByRole('heading', { name: 'Skar Lionet' })).toBeVisible();
  const rotaSkar = new URL(page.url()).hash;

  // Catálogo
  await page.goto('/#/recursos');
  await page.getByRole('button', { name: 'Novo recurso' }).click();
  await page.getByLabel('Nome').fill('Ímpeto');
  await page.getByLabel('Fórmula do máximo').fill('3 + int(NIVEL/2)');
  await expect(page.getByTestId('previa-formula')).toHaveText('No Skar (nível 2): 4');
  await page.getByLabel(/Começa cheio/).uncheck();
  await page.getByRole('button', { name: 'Salvar recurso' }).click();
  await expect(page.getByRole('button', { name: 'Editar Ímpeto' })).toBeVisible();

  // Jogador e ficha
  await page.goto('/#/jogadores');
  const form = page.getByRole('form', { name: 'Nova conta de jogador' });
  await form.getByLabel('Usuário').fill('thainan');
  await form.getByLabel('Senha', { exact: true }).fill('senha-thainan');
  await form.getByLabel('Confirmar senha').fill('senha-thainan');
  await form.getByRole('button', { name: 'Criar conta de jogador' }).click();
  await expect(page.getByRole('status')).toBeVisible();
  await page.goto(`/${rotaSkar}`);
  await page.getByText('Editar ficha').click();
  await page.getByLabel('Jogador').selectOption({ label: 'thainan' });
  await page.getByRole('checkbox', { name: 'Ímpeto' }).check();
  await expect(page.getByRole('region', { name: 'Ímpeto' }).getByText('0 / 4')).toBeVisible();

  // Skill com custo de Ímpeto
  await page.getByRole('tab', { name: 'Skills' }).click();
  await page.getByRole('button', { name: 'Editar Punhos de Pedra' }).click();
  await page.getByRole('button', { name: '+ Adicionar custo' }).click();
  await page.getByLabel('Recurso do custo 1').selectOption({ label: 'Ímpeto' });
  await page.getByRole('button', { name: 'Salvar skill' }).click();
  await expect(page.getByRole('article', { name: 'Punhos de Pedra' }).getByRole('button', { name: 'Usar (−1 Ímpeto)' })).toBeVisible();
  await esperarSincronizado(page);

  // Jogador
  const ctx = await browser.newContext({ baseURL });
  const jog = await ctx.newPage();
  await entrarComo(jog, 'thainan', 'senha-thainan');
  await jog.getByRole('link', { name: /Skar Lionet/ }).click();
  const impeto = jog.getByRole('region', { name: 'Ímpeto' });
  await impeto.getByLabel('Quantidade de Ímpeto').fill('2');
  await impeto.getByRole('button', { name: 'Recuperar' }).click();
  await expect(impeto.getByText('2 / 4')).toBeVisible();
  await jog.getByRole('tab', { name: 'Skills' }).click();
  await jog.getByRole('article', { name: 'Punhos de Pedra' }).getByRole('button', { name: 'Usar (−1 Ímpeto)' }).click();
  await expect(jog.getByRole('status')).toHaveText('Usou Punhos de Pedra: −1 Ímpeto');
  await esperarSincronizado(jog);
  await expect(jog.getByRole('alert')).toHaveCount(0);

  // O Mestre vê 1 / 4
  await recarregar(page);
  await page.getByRole('tab', { name: 'Ficha' }).click();
  await expect(page.getByRole('region', { name: 'Ímpeto' }).getByText('1 / 4')).toBeVisible();
  await ctx.close();
});
