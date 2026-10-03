// The libraries have no UI and no DOM; grist reaches bsv by package name only, never by a path into
// packages/bsv.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const files = readdirSync(srcDir).filter((f) => f.endsWith('.ts'));
const read = (f: string): string => readFileSync(join(srcDir, f), 'utf-8');

describe('packages/grist/src', () => {
  it('has source to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('has no window, document, navigator or storage reference', () => {
    const hits = files.flatMap((f) =>
      [...read(f).matchAll(/\b(window|document|navigator|localStorage|sessionStorage|indexedDB|DOMException)\b/g)].map((m) => `${f}: ${m[1]}`),
    );
    expect(hits).toEqual([]);
  });

  it('imports bsv by the package name a consumer resolves, never by a path into packages/bsv or the workspace name', () => {
    const specifiers = files.flatMap((f) => [...read(f).matchAll(/\bfrom\s*['"]([^'"]+)['"]/g)].map((m) => m[1]));
    expect([...new Set(specifiers.filter((s) => /bsv/.test(s) && !s.startsWith('@bsv/')))]).toEqual(['bsv-kit/bsv']);
    expect(specifiers.filter((s) => s.includes('packages/') || s.includes('/bsv/src') || s.startsWith('@bsv-kit/'))).toEqual([]);
  });

  it('uses only the door and vault exports of bsv', () => {
    const uses = files.flatMap((f) => [...read(f).matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*'bsv-kit\/bsv'/g)].flatMap((m) => m[1].split(',').map((s) => s.trim())));
    expect(uses.filter((u) => !['door', 'vault'].includes(u.replace(/^type /, '')))).toEqual([]);
  });
});
