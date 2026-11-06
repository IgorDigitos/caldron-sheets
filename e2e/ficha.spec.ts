import { expect, test, type Page } from '@playwright/test';

async function esperarServiceWorker(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }),
      );
    }
  });
}

async function aplicar(page: Page, recurso: string, valor: string, botao: string) {
  const secao = page.getByRole('region', { name: recurso });
  await secao.getByLabel(`Quantidade de ${recurso}`).fill(valor);
  await secao.getByRole('button', { name: botao }).click();
}

test('dano e cura funcionam offline e continuam lá depois de reabrir', async ({ page, context }) => {
  await page.goto('/');
  await esperarServiceWorker(page);

  await page.getByRole('button', { name: 'Criar Skar de exemplo' }).click();
  await expect(page.getByRole('heading', { name: 'Skar Lionet' })).toBeVisible();
  await expect(page.getByTestId('valor-VIDA')).toHaveText('45 / 45');

  await context.setOffline(true);

  await aplicar(page, 'Vida', '8', 'Dano');
  await expect(page.getByTestId('valor-VIDA')).toHaveText('37 / 45');
  await expect(page.getByRole('region', { name: 'Histórico' })).toContainText('−8 dano');

  await aplicar(page, 'Stamina', '5', 'Gastar');
  await expect(page.getByTestId('valor-STA')).toHaveText('15 / 20');

  // "Fecha e reabre" o app ainda sem rede.
  await page.reload();
  await expect(page.getByTestId('status')).toHaveAttribute('data-online', 'false');
  await expect(page.getByTestId('valor-VIDA')).toHaveText('37 / 45');
  await expect(page.getByTestId('valor-STA')).toHaveText('15 / 20');
  await expect(page.getByRole('region', { name: 'Histórico' })).toContainText('−8 dano');

  await aplicar(page, 'Vida', '100', 'Cura');
  await expect(page.getByTestId('valor-VIDA')).toHaveText('45 / 45');

  // A lista também abre offline.
  await page.getByRole('link', { name: '← Fichas' }).click();
  await expect(page.getByRole('link', { name: /Skar Lionet/ })).toBeVisible();
});

test('funciona aberto pelo IP da rede (sem crypto.randomUUID, como em http://192.168.x.x)', async ({
  page,
}) => {
  // Fora de HTTPS/localhost o navegador não oferece randomUUID; simulamos isso.
  await page.addInitScript(() => {
    Object.defineProperty(Crypto.prototype, 'randomUUID', { value: undefined });
  });
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(e.message));

  await page.goto('/');
  await page.getByRole('button', { name: 'Criar Skar de exemplo' }).click();
  await expect(page.getByRole('heading', { name: 'Skar Lionet' })).toBeVisible();
  await aplicar(page, 'Vida', '8', 'Dano');
  await expect(page.getByTestId('valor-VIDA')).toHaveText('37 / 45');
  expect(erros).toEqual([]);
});

test('dano maior que a Vida deixa negativa', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Criar Skar de exemplo' }).click();
  await aplicar(page, 'Vida', '49', 'Dano');
  await expect(page.getByTestId('valor-VIDA')).toHaveText('-4 / 45');
});

test('editar atributo recalcula e persiste', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Criar Skar de exemplo' }).click();
  await page.getByText('Editar ficha').click();
  await page.getByLabel('Nível').fill('3');
  await page.getByLabel('Nível').press('Tab');
  await expect(page.getByTestId('valor-VIDA')).toHaveText('45 / 50');
  await page.reload();
  await expect(page.getByTestId('valor-VIDA')).toHaveText('45 / 50');
  const alteracoes = page.getByRole('region', { name: 'Alterações de atributos' });
  await expect(alteracoes).toContainText('Nível 2 → 3');
  await expect(alteracoes).toContainText('Vida máx. 45 → 50');
});
