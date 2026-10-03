import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// The page calls /api on its own origin and Vite forwards it to the live backend, so the backend
// needs no CORS entry for this page. Point DEMO_BACKEND elsewhere to try another backend.
const backend = process.env.DEMO_BACKEND ?? 'https://postern.allmymind.org';
const proxy = { '/api': { target: backend, changeOrigin: true } };
const src = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      'bsv-kit/bsv': src('../../packages/bsv/src/index.ts'),
      'bsv-kit/grist': src('../../packages/grist/src/index.ts'),
    },
  },
  server: { proxy },
  preview: { proxy },
});
