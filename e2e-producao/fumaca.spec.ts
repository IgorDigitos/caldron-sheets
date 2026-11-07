// Teste de fumaça contra o site PUBLICADO (produção ou canal de preview). Não faz login nem grava
// nada: só confere que o app abre, é instalável e funciona sem rede.
// Uso: BASE_URL=https://caldron-sheets.web.app npx playwright test -c playwright.producao.config.ts

import { expect, test } from '@playwright/test';

test('abre na tela de login de uma campanha que já tem Mestre', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Caldron Sheets' })).toBeVisible();
  await expect(page.getByRole('form', { name: 'Entrar' })).toBeVisible();
  await expect(page.getByText('Primeiro acesso')).toHaveCount(0);
});

test('manifesto instalável com ícones', async ({ request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ name: 'Caldron Sheets', display: 'standalone', start_url: '/' });
  const purposes = manifest.icons.map((i: { purpose?: string }) => i.purpose ?? 'any');
  expect(purposes).toContain('maskable');
  for (const icon of manifest.icons) expect((await request.get(`/${icon.src}`)).ok()).toBe(true);
});

test('service worker sem cache e o app abre sem rede', async ({ page, context, request }) => {
  const sw = await request.get('/sw.js');
  expect(sw.headers()['cache-control']).toContain('no-cache');

  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
    }
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Caldron Sheets' })).toBeVisible();
  await expect(page.getByLabel('Usuário')).toBeVisible();
});
