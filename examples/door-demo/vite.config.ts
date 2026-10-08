import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// The page calls /api on its own origin and Vite forwards it to your Postern backend, so the backend
// needs no CORS entry for this page. Name the backend with DEMO_BACKEND (no default: the demo ships
// with nobody's host). DEMO_ISSUER optionally prefills the page's issuer public key.
const src = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig(({ command }) => {
  const backend = process.env.DEMO_BACKEND?.trim();
  if (command === 'serve' && !backend) {
    throw new Error(
      'DEMO_BACKEND is not set. Name your Postern backend, e.g. DEMO_BACKEND=https://postern.example.com npm run demo ' +
        '(see examples/door-demo/README.md).',
    );
  }
  const proxy = backend ? { '/api': { target: backend, changeOrigin: true } } : undefined;
  return {
    resolve: {
      alias: {
        'bsv-kit/bsv': src('../../packages/bsv/src/index.ts'),
        'bsv-kit/grist': src('../../packages/grist/src/index.ts'),
      },
    },
    define: { __DEMO_ISSUER__: JSON.stringify(process.env.DEMO_ISSUER?.trim() ?? '') },
    server: { proxy },
    preview: { proxy },
  };
});
