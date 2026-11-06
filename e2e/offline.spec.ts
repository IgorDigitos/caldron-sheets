import { expect, test } from '@playwright/test';

test('abre sem rede depois da primeira visita', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Caldron Sheets' })).toBeVisible();

  // Espera o service worker assumir a página (precache pronto).
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }),
      );
    }
  });

  await context.setOffline(true);
  await page.reload();

  await expect(page.getByRole('heading', { name: 'Caldron Sheets' })).toBeVisible();
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
    expect((await request.get(`/${icon.src}`)).ok()).toBe(true);
  }
});
