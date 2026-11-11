// Board do Mestre: fichas lado a lado, dano pelo cartão e atualização ao vivo vinda de outro aparelho.

import { expect, test, type Browser, type Page } from '@playwright/test';
import { abrirComoNovoMestre, entrarComoMestre, limparEmulador } from './ajuda';

test.beforeEach(limparEmulador);

async function criar(page: Page, botao: string, nome: string): Promise<void> {
  await page.getByRole('button', { name: botao }).click();
  await expect(page.getByRole('heading', { name: nome })).toBeVisible();
  await page.getByRole('link', { name: '← Fichas' }).click();
  await expect(page.getByRole('link', { name: new RegExp(nome) })).toBeVisible();
}

async function dano(escopo: Page | ReturnType<Page['getByRole']>, valor: string): Promise<void> {
  const vida = escopo.getByRole('region', { name: 'Vida' });
  await vida.getByLabel('Quantidade de Vida').fill(valor);
  await vida.getByRole('button', { name: 'Dano' }).click();
}

test('board: cartões lado a lado, dano pelo cartão, ao vivo de outro aparelho e escolha guardada', async ({
  page,
  browser,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await abrirComoNovoMestre(page);
  await criar(page, 'Criar Skar de exemplo', 'Skar Lionet');
  await criar(page, 'Nova ficha', 'Novo personagem');

  await page.getByRole('link', { name: 'Board do Mestre' }).click();
  await expect(page).toHaveURL(/#\/board$/);
  const skar = page.getByRole('article', { name: 'Skar Lionet' });
  const novo = page.getByRole('article', { name: 'Novo personagem' });
  await expect(skar).toBeVisible();
  await expect(novo).toBeVisible();
  await expect(skar.getByTestId('board-FOR')).toHaveText('8');
  await expect(skar.getByTestId('board-DEF_FISICA')).toHaveText('7,5');

  // Dano pelo cartão.
  await dano(skar, '8');
  await expect(skar.getByTestId('valor-VIDA')).toHaveText('37 / 45');
  await expect(skar.getByRole('region', { name: 'Histórico' })).toContainText('−8 dano');

  // Outro aparelho (o celular do jogador) mexe na ficha: o board muda sem recarregar.
  const outro = await (async (b: Browser) => {
    const ctx = await b.newContext({ baseURL });
    const p = await ctx.newPage();
    await entrarComoMestre(p);
    return { ctx, page: p };
  })(browser);
  await outro.page.getByRole('link', { name: /Skar Lionet/ }).click();
  await expect(outro.page.getByTestId('valor-VIDA')).toHaveText('37 / 45');
  await dano(outro.page, '5');
  await expect(outro.page.getByTestId('valor-VIDA')).toHaveText('32 / 45');
  await expect(skar.getByTestId('valor-VIDA')).toHaveText('32 / 45', { timeout: 15_000 });
  await expect(skar.getByRole('region', { name: 'Histórico' })).toContainText('−5 dano');
  await outro.ctx.close();

  // Escolher fichas: desmarcar some, e a escolha sobrevive a recarregar.
  await page.getByText('Escolher fichas (2 de 2)').click();
  await page.getByRole('checkbox', { name: 'Novo personagem' }).uncheck();
  await expect(novo).toBeHidden();
  await page.reload();
  await expect(page.getByRole('article', { name: 'Skar Lionet' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Novo personagem' })).toBeHidden();
  await expect(page.getByText('Escolher fichas (1 de 2)')).toBeVisible();
});
