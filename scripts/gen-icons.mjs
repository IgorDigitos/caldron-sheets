// Gera os PNGs do manifesto a partir de public/icon.svg usando o Chromium do Playwright.
// Uso: npm run icons
//
// - icon-192/512: o desenho ocupando o quadrado todo.
// - icon-maskable-512: o Android corta o ícone em círculo/gota; o desenho fica dentro da "zona
//   segura" (80% central), com o fundo cobrindo o resto.
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const svg = await readFile(new URL('../public/icon.svg', import.meta.url), 'utf8');
const FUNDO = '#1b1420';

const alvos = [
  { arquivo: 'public/icon-192.png', lado: 192, escala: 1 },
  { arquivo: 'public/icon-512.png', lado: 512, escala: 1 },
  { arquivo: 'public/icon-maskable-512.png', lado: 512, escala: 0.72 },
  { arquivo: 'public/apple-touch-icon.png', lado: 180, escala: 0.86 },
];

const browser = await chromium.launch();
for (const { arquivo, lado, escala } of alvos) {
  const page = await browser.newPage({ viewport: { width: lado, height: lado } });
  const interno = Math.round(lado * escala);
  await page.setContent(
    `<style>html,body{margin:0;background:${FUNDO}}div{width:${lado}px;height:${lado}px;display:grid;place-items:center}` +
      `svg{width:${interno}px;height:${interno}px;display:block}</style><div>${svg}</div>`,
  );
  await page.screenshot({ path: arquivo });
  console.log(arquivo);
}
await browser.close();
