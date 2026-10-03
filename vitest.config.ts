import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'bsv-kit/bsv': fileURLToPath(new URL('./packages/bsv/src/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['packages/*/tests/**/*.test.ts'],
  },
});
