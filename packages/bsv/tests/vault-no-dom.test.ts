// The libraries have no UI and no DOM (mw-xjwp5m.2): nothing under src/vault reaches for them,
// and no WebAuthn call lives here (the PRF secret is an input).
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const vaultDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'vault');

describe('packages/bsv/src/vault', () => {
  it('has no window, document, navigator or WebAuthn reference', () => {
    const files = readdirSync(vaultDir).filter((f) => f.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(0);
    const hits = files.flatMap((f) => {
      const code = readFileSync(join(vaultDir, f), 'utf-8');
      return [...code.matchAll(/\b(window|document|navigator|localStorage|sessionStorage|indexedDB|PublicKeyCredential)\b/g)].map((m) => `${f}: ${m[1]}`);
    });
    expect(hits).toEqual([]);
  });
});
