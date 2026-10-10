import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// The page imports the composer the way an app does ('bsv-kit/composer'); here it resolves to this workspace's source.
const src = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  base: './',
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: [
      { find: 'bsv-kit/composer/styles.css', replacement: src('../../packages/composer/src/styles.css') },
      { find: 'bsv-kit/composer', replacement: src('../../packages/composer/src/index.ts') },
    ],
  },
});
