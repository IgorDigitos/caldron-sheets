// Gera os PNGs do manifesto a partir de public/icon.svg usando o Chromium do Playwright.
// Uso: npm run icons
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const svg = await readFile(new URL('../public/icon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch();
for (const size of [192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<style>html,body{margin:0}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`,
  );
  await page.screenshot({ path: `public/icon-${size}.png` });
  console.log(`public/icon-${size}.png`);
}
await browser.close();
