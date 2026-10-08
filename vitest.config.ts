import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'bsv-kit/bsv': fileURLToPath(new URL('./packages/bsv/src/index.ts', import.meta.url)),
      'bsv-kit/testing': fileURLToPath(new URL('./packages/grist/src/testing.ts', import.meta.url)),
      'bsv-kit/grist': fileURLToPath(new URL('./packages/grist/src/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['packages/*/tests/**/*.test.ts', 'examples/*/tests/**/*.test.ts', 'scripts/*.test.mjs'],
  },
});
