import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { abrirComoNovoMestre, esperarServiceWorker, limparEmulador, recarregar } from './ajuda';

test.beforeEach(limparEmulador);

/** Foto "de celular": 2400×1800 com ruído, que não comprime fácil (PNG de vários MB). */
async function fotoGrande(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 2400;
    c.height = 1800;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(c.width, c.height);
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = Math.random() * 255;
      img.data[i + 1] = (i / 4) % 255;
      img.data[i + 2] = Math.random() * 255;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL('image/png').split(',')[1]!;
  });
  return Buffer.from(base64, 'base64');
}

async function criarSkar(page: Page) {
  await page.getByRole('button', { name: 'Criar Skar de exemplo' }).click();
  await expect(page.getByRole('heading', { name: 'Skar Lionet' })).toBeVisible();
}

test('item com foto criado sem rede, comprimido e salvo', async ({ page, context }) => {
  await abrirComoNovoMestre(page);
  await esperarServiceWorker(page);
  await criarSkar(page);
  const foto = await fotoGrande(page);
  expect(foto.length).toBeGreaterThan(1024 * 1024);

  await context.setOffline(true);
  await page.getByRole('tab', { name: 'Inventário' }).click();
  await page.getByRole('button', { name: 'Adicionar item' }).click();
  await page.getByLabel('Nome').fill('Cota de malha');
  await page.getByLabel('Peso (unidade)').fill('12');
  await page.getByLabel('Def. Física').fill('4');
  await page.getByLabel('Escolher foto').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: foto });

  const info = page.getByTestId('info-foto');
  await expect(info).toBeVisible({ timeout: 15_000 });
  const [, largura, altura, kb] = /^(\d+)×(\d+) · ([\d,]+) KB$/.exec((await info.textContent())!)!;
  expect(Math.max(Number(largura), Number(altura))).toBeLessThanOrEqual(400);
  expect(Number(kb!.replace(',', '.'))).toBeLessThanOrEqual(150);

  await page.getByRole('button', { name: 'Salvar item' }).click();
  await expect(page.getByText('Cota de malha')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Equipado' }).check();
  await expect(page.getByTestId('def-fisica')).toHaveText('11,5');

  // Reabre sem rede: item, foto e equipamento continuam lá.
  await recarregar(page);
  await expect(page.getByText('Cota de malha')).toBeVisible();
  await expect(page.getByTestId('def-fisica')).toHaveText('11,5');
  const src = await page.locator('img.miniatura').getAttribute('src');
  expect(src).toMatch(/^data:image\/(webp|jpeg);base64,/);
});

test('exportar, apagar e importar devolve a mesma ficha', async ({ page }) => {
  await abrirComoNovoMestre(page);
  await criarSkar(page);
  await page.getByRole('region', { name: 'Vida' }).getByLabel('Quantidade de Vida').fill('8');
  await page.getByRole('region', { name: 'Vida' }).getByRole('button', { name: 'Dano' }).click();

  await page.getByRole('tab', { name: 'Inventário' }).click();
  await page.getByRole('button', { name: 'Adicionar item' }).click();
  await page.getByLabel('Nome').fill('Lamparina mágica');
  await page.getByLabel('Escolher foto').setInputFiles({ name: 'f.png', mimeType: 'image/png', buffer: await fotoGrande(page) });
  await expect(page.getByTestId('info-foto')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Salvar item' }).click();
  await page.getByRole('region', { name: 'Carteira' }).getByLabel('Ouro').fill('2');
  await page.getByRole('region', { name: 'Carteira' }).getByLabel('Ouro').press('Tab');
  await expect(page.getByTestId('total-carteira')).toHaveText('2.000');

  await page.getByRole('tab', { name: 'Journal' }).click();
  await page.getByRole('button', { name: 'Nova entrada' }).click();
  await page.getByLabel('Título').fill('Chegada a Vel');
  await page.getByLabel('Texto').fill('Skar derrubou o ogro.');
  await page.getByLabel('Adicionar imagem').setInputFiles({ name: 'mapa.png', mimeType: 'image/png', buffer: await fotoGrande(page) });
  await expect(page.getByAltText('Imagem 1')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Salvar entrada' }).click();
  await expect(page.getByRole('heading', { name: 'Chegada a Vel' })).toBeVisible();
  await expect(page.getByAltText('Imagem 1 de Chegada a Vel')).toHaveAttribute('src', /^data:image\//);

  await page.getByRole('tab', { name: 'Ficha' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exportar ficha (JSON)' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('skar-lionet.caldron.json');
  const caminho = await download.path();
  const exportado = JSON.parse(readFileSync(caminho, 'utf8'));
  expect(exportado.ficha.carteira.moedas.ouro).toBe(2);
  expect(exportado.imagens).toHaveLength(2);

  // Apaga a ficha e importa o backup.
  await page.getByRole('link', { name: '← Fichas' }).click();
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Excluir Skar Lionet' }).click();
  await expect(page.getByText('Nenhuma ficha ainda.')).toBeVisible();
  await page.getByLabel('Importar backup (JSON)').setInputFiles(caminho);

  await expect(page.getByRole('heading', { name: 'Skar Lionet' })).toBeVisible();
  await expect(page.getByTestId('valor-VIDA')).toHaveText('37 / 45');
  await page.getByRole('tab', { name: 'Inventário' }).click();
  await expect(page.getByText('Lamparina mágica')).toBeVisible();
  await expect(page.locator('img.miniatura')).toHaveAttribute('src', /^data:image\//);
  await expect(page.getByTestId('total-carteira')).toHaveText('2.000');
  await expect(page.getByRole('region', { name: 'Histórico da carteira' })).toContainText('+2 Ouro');
  await page.getByRole('tab', { name: 'Journal' }).click();
  await expect(page.getByRole('heading', { name: 'Chegada a Vel' })).toBeVisible();
  await expect(page.getByAltText('Imagem 1 de Chegada a Vel')).toHaveAttribute('src', /^data:image\//);
});
