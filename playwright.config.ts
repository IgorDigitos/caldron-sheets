import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'e2e',
  // Todos os testes usam o mesmo Firebase Emulator e o limpam antes de começar: um por vez.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'pixel7', use: { ...devices['Pixel 7'] } },
  ],
  // O service worker só existe no build de produção, então o E2E roda contra o preview.
  // O build `--mode emulador` aponta para o Firebase Emulator, que sobe junto.
  webServer: {
    command: `npx firebase emulators:exec --only auth,firestore --project demo-caldron "npm run build:emulador && npx vite preview --port ${PORT} --strictPort"`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
