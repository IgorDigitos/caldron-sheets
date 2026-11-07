// Etapa 4: dois aparelhos (dois navegadores) logados na mesma conta de Mestre.

import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { abrirComoNovoMestre, entrarComoMestre, esperarSincronizado, limparEmulador, recarregar } from './ajuda';

test.beforeEach(limparEmulador);

async function outroAparelho(browser: Browser, baseURL: string | undefined): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ baseURL });
  const page = await ctx.newPage();
  await entrarComoMestre(page);
  return { ctx, page };
}

async function aplicar(page: Page, recurso: string, valor: string, botao: string) {
  const secao = page.getByRole('region', { name: recurso });
  await secao.getByLabel(`Quantidade de ${recurso}`).fill(valor);
  await secao.getByRole('button', { name: botao }).click();
}

async function criarSkar(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Criar Skar de exemplo' }).click();
  await expect(page.getByRole('heading', { name: 'Skar Lionet' })).toBeVisible();
  await esperarSincronizado(page);
  return new URL(page.url()).hash;
}

test('edição feita offline num aparelho aparece no outro quando a rede volta', async ({ page, context, browser, baseURL }) => {
  await abrirComoNovoMestre(page);
  const rotaSkar = await criarSkar(page);

  const b = await outroAparelho(browser, baseURL);
  await expect(b.page.getByRole('link', { name: /Skar Lionet/ })).toBeVisible();

  // A perde a rede e toma dano.
  await context.setOffline(true);
  await aplicar(page, 'Vida', '8', 'Dano');
  await expect(page.getByTestId('valor-VIDA')).toHaveText('37 / 45');
  await expect(page.getByTestId('status')).toHaveText('Offline · 1 pendente');
  await expect(page.getByTestId('status')).toHaveAttribute('data-sync', 'pendente');

  // B ainda não vê.
  await b.page.goto(`/${rotaSkar}`);
  await expect(b.page.getByTestId('valor-VIDA')).toHaveText('45 / 45');

  // A volta: a alteração sobe sozinha.
  await context.setOffline(false);
  await esperarSincronizado(page);
  await expect(page.getByTestId('status')).toHaveText('Sincronizado');

  await recarregar(b.page);
  await expect(b.page.getByTestId('valor-VIDA')).toHaveText('37 / 45');
  await expect(b.page.getByRole('region', { name: 'Histórico' })).toContainText('−8 dano');
  await b.ctx.close();
});

test('edição offline sobrevive a fechar o app sem rede e sobe depois', async ({ page, context, browser, baseURL }) => {
  await abrirComoNovoMestre(page);
  const rotaSkar = await criarSkar(page);

  await context.setOffline(true);
  await aplicar(page, 'Vida', '5', 'Dano');
  await recarregar(page); // "fecha e abre" ainda sem rede
  await expect(page.getByTestId('valor-VIDA')).toHaveText('40 / 45');
  await expect(page.getByTestId('status')).toHaveAttribute('data-sync', 'pendente');

  await context.setOffline(false);
  await esperarSincronizado(page);

  const b = await outroAparelho(browser, baseURL);
  await b.page.goto(`/${rotaSkar}`);
  await expect(b.page.getByTestId('valor-VIDA')).toHaveText('40 / 45');
  await b.ctx.close();
});

test('conflito: a edição mais nova ganha e o aparelho atrasado é avisado', async ({ page, context, browser, baseURL }) => {
  await abrirComoNovoMestre(page);
  const rotaSkar = await criarSkar(page);
  const b = await outroAparelho(browser, baseURL);
  await b.page.goto(`/${rotaSkar}`);
  await expect(b.page.getByTestId('valor-VIDA')).toHaveText('45 / 45');

  // A edita offline primeiro…
  await context.setOffline(true);
  await aplicar(page, 'Vida', '10', 'Dano');
  await expect(page.getByTestId('valor-VIDA')).toHaveText('35 / 45');
  await page.waitForTimeout(50);

  // …B edita depois, online.
  await aplicar(b.page, 'Vida', '5', 'Dano');
  await esperarSincronizado(b.page);

  // A volta: a edição dele é mais velha e é descartada.
  await context.setOffline(false);
  await expect(page.getByRole('alert')).toContainText('outro aparelho fez uma edição mais nova', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Fechar aviso' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);

  await recarregar(page);
  await expect(page.getByTestId('valor-VIDA')).toHaveText('40 / 45');
  await recarregar(b.page);
  await expect(b.page.getByTestId('valor-VIDA')).toHaveText('40 / 45');
  await b.ctx.close();
});

test('login: senha errada avisa; sair volta para a tela de login', async ({ page }) => {
  await abrirComoNovoMestre(page);
  await page.getByRole('button', { name: 'Sair' }).click();
  const form = page.getByRole('form', { name: 'Entrar' });
  await form.getByLabel('Usuário').fill('mestre');
  await form.getByLabel('Senha').fill('errada');
  await form.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert')).toHaveText('Usuário ou senha incorretos');
});
