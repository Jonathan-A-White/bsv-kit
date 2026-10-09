import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { creditsSection, parseCredits, problemsWithCredits, runtimeDependencies } from './credits.mjs';

const NEWTON = 'If I have seen further it is by standing on the shoulders of Giants.';

const GOOD = `# x

## Credits

> "${NEWTON}"
> Isaac Newton, letter to Robert Hooke, 1675

- [alpha](https://example.org/alpha): used for a. Licence: [MIT](https://example.org/mit). No changes.
- [@scope/beta](https://example.org/beta): used for b. Licence: [Apache-2.0](https://example.org/apache). No changes.

## Develop
`;

describe('README Credits', () => {
  it('passes a section that opens with Newton and credits every dependency', () => {
    expect(problemsWithCredits(GOOD, ['alpha', '@scope/beta'])).toEqual([]);
  });

  it('fails when a runtime dependency is missing from Credits', () => {
    expect(problemsWithCredits(GOOD, ['alpha', '@scope/beta', 'gamma'])).toEqual([
      'runtime dependency gamma is not credited (add a credit whose link text is "gamma")',
    ]);
  });

  it('fails when there is no Credits section', () => {
    expect(problemsWithCredits('# x\n\n## Develop\n', [])).toEqual(['README.md has no "## Credits" section']);
  });

  it("fails when the section does not open with Newton's line and attribution", () => {
    const text = GOOD.replace(NEWTON, 'Something else.');
    expect(problemsWithCredits(text, ['alpha', '@scope/beta'])).toEqual([
      "Credits must open with Newton's line, \"If I have seen further it is by standing on the shoulders of Giants\", attributed to Isaac Newton",
    ]);
  });

  it('fails a credit with a raw URL as its link text, no licence link or no use', () => {
    const text = GOOD.replace('[alpha](https://example.org/alpha)', '[https://example.org/alpha](https://example.org/alpha)').replace(
      'Licence: [Apache-2.0](https://example.org/apache).',
      'Licence: Apache-2.0.',
    );
    expect(problemsWithCredits(text, ['@scope/beta'])).toEqual([
      'credit "https://example.org/alpha" has a URL as its link text',
      'credit "@scope/beta" has no licence link ("Licence: [name](url)")',
    ]);
  });

  it('reads the credits as link text, with the rest of the line', () => {
    expect(parseCredits(creditsSection(GOOD)).map((c) => c.name)).toEqual(['alpha', '@scope/beta']);
  });

  it('holds for this repo: every package.json dependency is credited', () => {
    const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
    expect(runtimeDependencies()).toContain('@bsv/sdk');
    expect(problemsWithCredits(readme, runtimeDependencies())).toEqual([]);
  });
});
