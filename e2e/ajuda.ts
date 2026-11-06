// Ajudantes do E2E. O app de teste é o build `--mode emulador`, ligado ao Firebase Emulator.

import { expect, type Page } from '@playwright/test';

const PROJETO = 'demo-caldron';
export const MESTRE = { usuario: 'mestre', senha: 'senha-do-mestre' };

/** Zera o Firestore e o Auth do emulador (cada teste começa do zero). */
export async function limparEmulador(): Promise<void> {
  const base = (porta: number) => `http://127.0.0.1:${porta}/emulator/v1/projects/${PROJETO}`;
  for (let i = 0; ; i++) {
    const r = await fetch(`${base(8080)}/databases/(default)/documents`, { method: 'DELETE' });
    if (r.ok) break;
    if (i >= 10) throw new Error(`limpar Firestore: ${r.status}`);
    await new Promise((ok) => setTimeout(ok, 200));
  }
  const a = await fetch(`${base(9099)}/accounts`, { method: 'DELETE' });
  if (!a.ok) throw new Error(`limpar Auth: ${a.status}`);
}

/** Primeiro acesso: abre o app e cria a conta de Mestre. Termina na lista de fichas. */
export async function abrirComoNovoMestre(page: Page): Promise<void> {
  await page.goto('/');
  const form = page.getByRole('form', { name: 'Criar conta de Mestre' });
  await expect(form).toBeVisible();
  await form.getByLabel('Usuário').fill(MESTRE.usuario);
  await form.getByLabel('Senha', { exact: true }).fill(MESTRE.senha);
  await form.getByLabel('Confirmar senha').fill(MESTRE.senha);
  await form.getByRole('button', { name: 'Criar conta de Mestre' }).click();
  await expect(page.getByRole('button', { name: 'Nova ficha' })).toBeVisible();
}

/** Entra com a conta de Mestre que já existe (outro aparelho). */
export async function entrarComoMestre(page: Page): Promise<void> {
  await page.goto('/');
  const form = page.getByRole('form', { name: 'Entrar' });
  await expect(form).toBeVisible();
  await form.getByLabel('Usuário').fill(MESTRE.usuario);
  await form.getByLabel('Senha').fill(MESTRE.senha);
  await form.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('button', { name: 'Nova ficha' })).toBeVisible();
}

export async function esperarServiceWorker(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }),
      );
    }
  });
}

/** Espera o indicador dizer que tudo foi confirmado pelo servidor. */
export async function esperarSincronizado(page: Page): Promise<void> {
  await expect(page.getByTestId('status')).toHaveAttribute('data-sync', 'ok', { timeout: 20_000 });
}

/** Espera o app terminar de gravar no aparelho (IndexedDB) e recarrega — como fechar e abrir o app. */
export async function recarregar(page: Page): Promise<void> {
  await expect(page.getByTestId('status')).toHaveAttribute('data-gravando', '0');
  await page.reload();
}
