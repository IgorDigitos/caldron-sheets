import { expect, test } from '@playwright/test';
import { abrirComoNovoMestre, esperarServiceWorker, limparEmulador } from './ajuda';

test.beforeEach(limparEmulador);

test('tela de login aparece sem rede', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Caldron Sheets' })).toBeVisible();
  await esperarServiceWorker(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Caldron Sheets' })).toBeVisible();
  await expect(page.getByLabel('Usuário')).toBeVisible();
});

test('logado, abre sem rede depois da primeira visita', async ({ page, context }) => {
  await abrirComoNovoMestre(page);
  await esperarServiceWorker(page);

  await context.setOffline(true);
  await page.reload();

  await expect(page.getByRole('button', { name: 'Nova ficha' })).toBeVisible();
  await expect(page.getByTestId('status')).toHaveAttribute('data-online', 'false');
});

test('manifesto é instalável', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest.display).toBe('standalone');
  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toContain('192x192');
  expect(sizes).toContain('512x512');
  for (const icon of manifest.icons) {
    expect(icon.src).toBeTruthy();
    expect((await request.get(`/${icon.src}`)).ok()).toBe(true);
  }
});
