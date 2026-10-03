// The libraries have no UI and no DOM (mw-xjwp5m.3): nothing under src/licence reaches for them.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const licenceDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'licence');

describe('packages/bsv/src/licence', () => {
  it('has no window, document or navigator reference', () => {
    const files = readdirSync(licenceDir).filter((f) => f.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(0);
    const hits = files.flatMap((f) => {
      const code = readFileSync(join(licenceDir, f), 'utf-8');
      return [...code.matchAll(/\b(window|document|navigator|localStorage|sessionStorage|indexedDB)\b/g)].map((m) => `${f}: ${m[1]}`);
    });
    expect(hits).toEqual([]);
  });
});
