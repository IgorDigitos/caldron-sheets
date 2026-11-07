import { defineConfig, devices } from '@playwright/test';

// Fumaça contra o site publicado. BASE_URL vem do deploy (produção ou canal de preview).
export default defineConfig({
  testDir: 'e2e-producao',
  retries: 2,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: { baseURL: process.env.BASE_URL ?? 'https://caldron-sheets.web.app' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'pixel7', use: { ...devices['Pixel 7'] } },
  ],
});
