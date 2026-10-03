// The dependency rule (mw-6ww.65): bsv imports nothing from grist, so an app can use bsv alone.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const bsvRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const gristRoot = resolve(bsvRoot, '..', 'grist');
const SKIP_DIRS = new Set(['node_modules', 'dist']);
const SOURCE_FILE = /\.(ts|tsx|js|mjs|cjs)$/;

/** Every module specifier a source text imports, re-exports, requires or dynamically imports. */
export function specifiersOf(source: string): string[] {
  const patterns = [
    /\b(?:import|export)\s[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\b(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  return patterns.flatMap((re) => [...source.matchAll(re)].map((m) => m[1]));
}

/** True when a specifier reaches grist: by package name, or by a path into packages/grist. */
export function reachesGrist(specifier: string, fromFile: string): boolean {
  if (/^@bsv-kit\/grist(\/|$)/.test(specifier) || /^bsv-kit\/grist(\/|$)/.test(specifier)) return true;
  if (specifier.startsWith('.')) {
    const target = resolve(dirname(fromFile), specifier);
    return target === gristRoot || target.startsWith(gristRoot + '/');
  }
  return false;
}

function sourceFilesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return SKIP_DIRS.has(name) ? [] : sourceFilesUnder(full);
    return SOURCE_FILE.test(name) ? [full] : [];
  });
}

describe('the checker itself', () => {
  const from = join(bsvRoot, 'src', 'x.ts');
  it('finds every import form', () => {
    // The fixture is a .txt so this scan of packages/bsv does not trip over it.
    const text = readFileSync(join(bsvRoot, 'tests', 'fixtures', 'imports.txt'), 'utf-8');
    expect(specifiersOf(text)).toHaveLength(7);
  });
  it('recognises grist by name and by path, and nothing else', () => {
    expect(reachesGrist('@bsv-kit/grist', from)).toBe(true);
    expect(reachesGrist('bsv-kit/grist', from)).toBe(true);
    expect(reachesGrist('../../grist/src/index.js', from)).toBe(true);
    expect(reachesGrist('@bsv/sdk', from)).toBe(false);
    expect(reachesGrist('./vault.js', from)).toBe(false);
  });
});

describe('packages/bsv', () => {
  it('has source to check', () => {
    expect(sourceFilesUnder(join(bsvRoot, 'src')).length).toBeGreaterThan(0);
  });

  it('imports nothing from grist, in src, tests or a built dist', () => {
    const files = sourceFilesUnder(bsvRoot);
    try {
      files.push(...sourceFilesUnder(join(bsvRoot, 'dist')));
    } catch {
      // not built: nothing more to check
    }
    const offenders = files.flatMap((file) =>
      specifiersOf(readFileSync(file, 'utf-8'))
        .filter((s) => reachesGrist(s, file))
        .map((s) => `${relative(bsvRoot, file)} imports ${s}`),
    );
    expect(offenders).toEqual([]);
  });

  it('does not depend on grist in its package.json', () => {
    const pkg = JSON.parse(readFileSync(join(bsvRoot, 'package.json'), 'utf-8')) as Record<string, Record<string, string> | undefined>;
    const declared = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'].flatMap((k) =>
      Object.keys(pkg[k] ?? {}),
    );
    expect(declared.filter((n) => /grist/.test(n))).toEqual([]);
  });
});
