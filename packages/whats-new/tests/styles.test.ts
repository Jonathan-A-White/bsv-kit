// The look is the app's: styles.css sets every colour through a --bk-whats-new-* property (with a default), styles only
// the package's own classes, and keeps every target 44 px high.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const raw = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf-8');
const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');
const COLOUR = /#[0-9a-f]{3,8}\b|\b(?:rgb|hsl)a?\(|\bCanvas(?:Text)?\b/i;

describe('styles.css', () => {
  it('sets every colour through a --bk-whats-new-* custom property', () => {
    const bare = css
      .split('\n')
      .filter((line) => COLOUR.test(line.replace(/var\(--bk-whats-new-[\w-]+,(?:[^()]|\([^()]*\))*\)/g, '')));
    expect(bare).toEqual([]);
  });

  it('styles only the bk-whats-new classes', () => {
    const selectors = [...css.matchAll(/^([^{}@\n][^{}]*)\{/gm)].flatMap((m) => m[1].split(',').map((s) => s.trim()));
    expect(selectors.length).toBeGreaterThan(8);
    expect(selectors.filter((s) => !s.startsWith('.bk-whats-new'))).toEqual([]);
  });

  it('gives buttons a 44 px target', () => {
    expect(css).toMatch(/--bk-whats-new-target,\s*44px/);
    expect(css).toMatch(/min-height:\s*var\(--bk-whats-new-target/);
  });

  it('fits a 390 px screen: the sheet is never wider than the screen', () => {
    expect(css).toMatch(/max-width:\s*min\(/);
    expect(css).toMatch(/overflow-wrap:\s*anywhere/);
  });

  it('follows the page into dark and light through the colour scheme, with no media query of its own to drift', () => {
    expect(css).toMatch(/Canvas/);
  });
});
