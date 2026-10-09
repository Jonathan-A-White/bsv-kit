// The changelog the app ships (changelog.json: an array, newest first, of { version, date, story, kind, text }):
// what is new after a version, counted for the Update ready banner, and the link to CHANGELOG.md on GitHub.
import { describe, expect, it, vi } from 'vitest';
import { compareVersions, fetchChangelog, githubAnchor, parseChangelog, summarise, versionLink, versionsSince } from '../src/index.js';
import { CHANGELOG } from './support/fixture.js';

describe('compareVersions', () => {
  it('compares dotted numbers, not text', () => {
    expect(compareVersions('0.5.10', '0.5.9')).toBeGreaterThan(0);
    expect(compareVersions('0.5.9', '0.5.9')).toBe(0);
    expect(compareVersions('0.4.12', '0.5.0')).toBeLessThan(0);
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
  });
});

describe('summarise', () => {
  it('counts the new and fixed lines of the versions after the one the app is running', () => {
    const s = summarise(CHANGELOG, '0.5.8');
    expect(s).toMatchObject({ version: '0.5.9', newCount: 1, fixedCount: 2 });
    expect(s?.text).toBe('0.5.9 · 1 new, 2 fixed');
    expect(s?.bannerText).toBe("0.5.9 · 1 new, 2 fixed · What's new");
  });

  it('counts across every version after, not only the newest', () => {
    expect(summarise(CHANGELOG, '0.5.7')).toMatchObject({ version: '0.5.9', newCount: 2, fixedCount: 3 });
    expect(summarise(CHANGELOG, '0.5.6')).toMatchObject({ version: '0.5.9', newCount: 2, fixedCount: 4 });
  });

  it('words one new line and one fixed line, and leaves out a count of none', () => {
    const one = CHANGELOG.filter((e) => e.story === 'app-9a' || e.story === 'app-9b');
    expect(summarise(one, '0.5.8')?.text).toBe('0.5.9 · 1 new, 1 fixed');
    expect(summarise(one, '0.5.8')?.bannerText).toBe("0.5.9 · 1 new, 1 fixed · What's new");
    expect(summarise(CHANGELOG, '0.5.6')?.text).toBe('0.5.9 · 2 new, 4 fixed');
    expect(summarise(CHANGELOG.filter((e) => e.kind === 'fixed'), '0.5.0')?.text).toBe('0.5.9 · 4 fixed');
    expect(summarise(CHANGELOG.filter((e) => e.kind === 'new'), '0.5.0')?.bannerText).toBe("0.5.9 · 3 new · What's new");
  });

  it('is null when nothing is after the version', () => {
    expect(summarise(CHANGELOG, '0.5.9')).toBeNull();
    expect(summarise(CHANGELOG, '0.6.0')).toBeNull();
    expect(summarise([], '0.1.0')).toBeNull();
  });

  it('takes the words of the label from the app', () => {
    const one = CHANGELOG.filter((e) => e.story === 'app-9a' || e.story === 'app-9b');
    expect(summarise(one, '0.5.8', { new: 'nouveau', fixed: 'corrigé', whatsNew: 'Nouveautés' })?.bannerText).toBe('0.5.9 · 1 nouveau, 1 corrigé · Nouveautés');
  });
});

describe('versionsSince', () => {
  it('groups the lines of each version after, newest version first, New before Fixed', () => {
    const groups = versionsSince(CHANGELOG, '0.5.6');
    expect(groups.map((g) => g.version)).toEqual(['0.5.9', '0.5.8', '0.5.7']);
    expect(groups[0].entries.map((e) => e.kind)).toEqual(['new', 'fixed', 'fixed']);
    expect(groups[0].date).toBe('2026-10-09');
  });

  it('can stop at a version, so a sheet never lists what is newer than the running build', () => {
    expect(versionsSince(CHANGELOG, '0.5.6', '0.5.8').map((g) => g.version)).toEqual(['0.5.8', '0.5.7']);
  });

  it('with no version to start from lists every version', () => {
    expect(versionsSince(CHANGELOG).map((g) => g.version)).toEqual(['0.5.9', '0.5.8', '0.5.7', '0.5.6']);
  });
});

describe('versionLink', () => {
  it("gives GitHub's CHANGELOG.md with the anchor of the version's heading for a public repo", () => {
    expect(versionLink({ repo: 'Jonathan-A-White/lampas', public: true, version: '0.5.9' })).toBe(
      'https://github.com/Jonathan-A-White/lampas/blob/main/CHANGELOG.md#059',
    );
  });

  it('is null for a private repo: the app opens its own list', () => {
    expect(versionLink({ repo: 'Jonathan-A-White/postern', public: false, version: '0.5.9' })).toBeNull();
  });

  it('links to the file without an anchor when no version is given', () => {
    expect(versionLink({ repo: 'a/b', public: true })).toBe('https://github.com/a/b/blob/main/CHANGELOG.md');
  });

  it("makes GitHub's anchor: lower case, punctuation dropped, spaces to hyphens", () => {
    expect(githubAnchor('0.5.9')).toBe('059');
    expect(githubAnchor('0.5.9 (2026-10-09)')).toBe('059-2026-10-09');
    expect(githubAnchor('1.0.0-beta.1')).toBe('100-beta1');
  });
});

describe('parseChangelog', () => {
  it('keeps the well-formed entries and drops the rest', () => {
    const parsed = parseChangelog([...CHANGELOG, { version: '9', kind: 'other', text: 'x' }, null, 'nope', { version: '0.1.0', date: 'd', story: 's', kind: 'new' }]);
    expect(parsed).toEqual(CHANGELOG);
  });

  it('is an empty list for anything that is not an array', () => {
    expect(parseChangelog({})).toEqual([]);
    expect(parseChangelog(null)).toEqual([]);
  });
});

describe('fetchChangelog', () => {
  const answer = (body: unknown, ok = true) => vi.fn(async () => ({ ok, status: ok ? 200 : 404, json: async () => body }) as Response);

  it("reads changelog.json from the app's base URL with cache 'no-store', so a waiting update's list is the new build's", async () => {
    const fetchFn = answer(CHANGELOG);
    expect(await fetchChangelog('/lampas/', fetchFn)).toEqual(CHANGELOG);
    expect(fetchFn).toHaveBeenCalledWith('/lampas/changelog.json', { cache: 'no-store' });
  });

  it('adds the slash a base URL lacks', async () => {
    const fetchFn = answer(CHANGELOG);
    await fetchChangelog('https://example.org/app', fetchFn);
    expect(fetchFn).toHaveBeenCalledWith('https://example.org/app/changelog.json', { cache: 'no-store' });
  });

  it('throws when the file is not there', async () => {
    await expect(fetchChangelog('/', answer([], false))).rejects.toThrow(/404/);
  });
});
