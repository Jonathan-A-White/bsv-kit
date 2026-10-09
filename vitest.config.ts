import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'bsv-kit/bsv': fileURLToPath(new URL('./packages/bsv/src/index.ts', import.meta.url)),
      'bsv-kit/testing': fileURLToPath(new URL('./packages/grist/src/testing.ts', import.meta.url)),
      'bsv-kit/tips': fileURLToPath(new URL('./packages/tips/src/index.ts', import.meta.url)),
      'bsv-kit/grist': fileURLToPath(new URL('./packages/grist/src/index.ts', import.meta.url)),
      'bsv-kit/composer': fileURLToPath(new URL('./packages/composer/src/index.ts', import.meta.url)),
    },
  },
  // the composer's .tsx: React's automatic JSX runtime, as its tsconfig says (jsx: react-jsx)
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    environment: 'node',
    include: ['packages/*/tests/**/*.test.{ts,tsx}', 'examples/*/tests/**/*.test.ts', 'scripts/*.test.mjs'],
  },
});
