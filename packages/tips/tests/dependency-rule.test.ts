// tips stands alone (mw-5r3p30.81): it imports nothing from bsv or grist, and has no UI and no DOM.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'src');
const files = readdirSync(srcDir).filter((f) => f.endsWith('.ts'));
const read = (f: string): string => readFileSync(join(srcDir, f), 'utf-8');

describe('packages/tips', () => {
  it('has source to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('imports only its own files', () => {
    const specifiers = files.flatMap((f) => [...read(f).matchAll(/\b(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]));
    expect(specifiers.filter((s) => !s.startsWith('./'))).toEqual([]);
  });

  it('has no window, document, navigator or storage reference', () => {
    const hits = files.flatMap((f) =>
      [...read(f).matchAll(/\b(window|document|navigator|localStorage|sessionStorage|indexedDB|DOMException)\b/g)].map((m) => `${f}: ${m[1]}`),
    );
    expect(hits).toEqual([]);
  });

  it('declares no dependency in its package.json', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8')) as Record<string, unknown>;
    for (const k of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      expect(Object.keys((pkg[k] as Record<string, string> | undefined) ?? {})).toEqual([]);
    }
  });
});
