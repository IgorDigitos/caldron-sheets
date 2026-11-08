// Mesa: o app pede a rolagem e um "bot falso" (REST do emulador, como o Admin SDK do bot) responde.

import { expect, test } from '@playwright/test';
import { abrirComoNovoMestre, limparEmulador } from './ajuda';

test.beforeEach(limparEmulador);

const DOCS = 'http://127.0.0.1:8080/v1/projects/demo-caldron/databases/(default)/documents';
// "owner" passa por cima das regras no emulador, como a conta de serviço do bot.
const DONO = { Authorization: 'Bearer owner' };

interface DocRest {
  name: string;
  fields: Record<string, { stringValue?: string; integerValue?: string; timestampValue?: string }>;
}

async function pedidos(colecao: string): Promise<DocRest[]> {
  const r = await fetch(`${DOCS}/${colecao}`, { headers: DONO });
  return ((await r.json()) as { documents?: DocRest[] }).documents ?? [];
}

/** O que o bot grava depois de rolar. */
async function botResponde(doc: DocRest, total: number, linha: string): Promise<void> {
  const campos = ['estado', 'resultado', 'totais', 'discord'];
  const mask = campos.map((c) => `updateMask.fieldPaths=${c}`).join('&');
  const r = await fetch(`http://127.0.0.1:8080/v1/${doc.name}?${mask}`, {
    method: 'PATCH',
    headers: { ...DONO, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        estado: { stringValue: 'feita' },
        resultado: { arrayValue: { values: [{ stringValue: linha }] } },
        totais: { arrayValue: { values: [{ integerValue: String(total) }] } },
        discord: { stringValue: 'enviado' },
      },
    }),
  });
  expect(r.ok).toBe(true);
}

test('Mestre rola pela aba Mesa da ficha, o bot responde e a rolagem secreta fica no canal do Mestre', async ({ page }) => {
  await abrirComoNovoMestre(page);
  await page.getByRole('button', { name: 'Criar Skar de exemplo' }).click();
  await expect(page.getByRole('heading', { name: 'Skar Lionet' })).toBeVisible();

  await page.getByRole('tab', { name: 'Mesa' }).click();
  await expect(page.getByLabel('Falar como')).toHaveValue(/.+/);
  const rapidas = page.getByLabel('Rolagens rápidas');
  await rapidas.getByRole('button', { name: 'FOR 8' }).click();

  const msg = page.getByRole('listitem').first();
  await expect(msg).toContainText('d30+FOR');
  await expect(msg).toContainText('Aguardando o bot…');

  // Chegou ao servidor como pedido pendente, com a hora do servidor.
  await expect.poll(async () => (await pedidos('mesa')).length).toBe(1);
  const [doc] = await pedidos('mesa');
  expect(doc!.fields.estado!.stringValue).toBe('pendente');
  expect(doc!.fields.nome!.stringValue).toBe('Skar Lionet');
  expect(doc!.fields.recebidoEm!.timestampValue).toBeTruthy();

  await botResponde(doc!, 25, '` 25 ` ⟵ [**17**] d30 + FOR\nFOR=+8');
  await expect(msg.getByLabel('Resultado')).toContainText('25');
  await expect(msg).not.toContainText('Aguardando o bot…');

  // Texto comum não é rolagem.
  await page.getByLabel('Mensagem ou rolagem').fill('quero rolar d30 depois');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByRole('listitem').first()).toContainText('quero rolar d30 depois');
  await expect(page.getByRole('listitem').first()).not.toContainText('Aguardando');

  // Canal do Mestre.
  await page.getByRole('tab', { name: 'Canal do Mestre' }).click();
  await expect(page.getByText('Nada por aqui ainda.')).toBeVisible();
  await page.getByLabel('Falar como').selectOption({ label: 'Mestre' });
  await page.getByLabel('Mensagem ou rolagem').fill('d30 emboscada');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByRole('listitem')).toHaveCount(1);
  await expect.poll(async () => (await pedidos('mesaMestre')).length).toBe(1);
  expect((await pedidos('mesa')).length).toBe(2);
  await expect(page.getByRole('alert')).toHaveCount(0);
});
