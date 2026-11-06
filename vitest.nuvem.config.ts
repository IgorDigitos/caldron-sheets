// Testes contra o Firebase Emulator. Rode com `npm run test:nuvem` (sobe o emulador sozinho).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.nuvem.test.ts'],
    // Todos usam o mesmo emulador: um arquivo por vez.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
