// Descanso curto: o botão pede as rolagens à Mesa e um "bot falso" (REST do emulador) responde.

import { expect, test, type Page } from '@playwright/test';
import { abrirComoNovoMestre, limparEmulador } from './ajuda';

test.beforeEach(limparEmulador);

const DOCS = 'http://127.0.0.1:8080/v1/projects/demo-caldron/databases/(default)/documents';
const DONO = { Authorization: 'Bearer owner' };

interface DocRest {
  name: string;
  fields: Record<string, { stringValue?: string }>;
}

async function pedidos(): Promise<DocRest[]> {
  const r = await fetch(`${DOCS}/mesa`, { headers: DONO });
  return ((await r.json()) as { documents?: DocRest[] }).documents ?? [];
}

async function botResponde(doc: DocRest, total: number): Promise<void> {
  const mask = ['estado', 'totais'].map((c) => `updateMask.fieldPaths=${c}`).join('&');
  const r = await fetch(`http://127.0.0.1:8080/v1/${doc.name}?${mask}`, {
    method: 'PATCH',
    headers: { ...DONO, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        estado: { stringValue: 'feita' },
        totais: { arrayValue: { values: [{ integerValue: String(total) }] } },
      },
    }),
  });
  expect(r.ok).toBe(true);
}

async function aplicar(page: Page, recurso: string, valor: string, botao: string) {
  const secao = page.getByRole('region', { name: recurso });
  await secao.getByLabel(`Quantidade de ${recurso}`).fill(valor);
  await secao.getByRole('button', { name: botao }).click();
}

test('descanso curto rola pelo bot e soma na ficha', async ({ page }) => {
  await abrirComoNovoMestre(page);
  await page.getByRole('button', { name: 'Criar Skar de exemplo' }).click();
  await expect(page.getByRole('heading', { name: 'Skar Lionet' })).toBeVisible();

  const botao = page.getByRole('button', { name: 'Descanso curto' });
  await expect(botao).toBeVisible();
  await expect(botao).toBeDisabled();
  await expect(page.getByText('Vida, Stamina e Mana já estão cheias.')).toBeVisible();

  await aplicar(page, 'Vida', '40', 'Dano');
  await expect(page.getByText('Rola 2d5 Vida.')).toBeVisible();
  await botao.click();
  await expect(page.getByText('Descanso curto: aguardando o bot…')).toBeVisible();

  await expect.poll(async () => (await pedidos()).length).toBe(1);
  const [doc] = await pedidos();
  expect(doc!.fields.texto!.stringValue).toBe('2d5 Vida (descanso curto)');
  expect(doc!.fields.descanso!.stringValue).toBe('VIDA');
  await botResponde(doc!, 7);

  await expect(page.getByTestId('valor-VIDA')).toHaveText('12 / 45');
  await expect(page.getByText('+7 descanso curto (2d5)')).toBeVisible();
});
