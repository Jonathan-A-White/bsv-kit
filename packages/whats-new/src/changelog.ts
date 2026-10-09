// changelog.ts: the app's changelog.json and what can be said of it. Pure functions: no React, no DOM.
// The file is an array, newest first, of { version, date, story, kind, text }; each entry is one line of one version.

export type ChangeKind = 'new' | 'fixed';

export interface ChangelogEntry {
  version: string;
  /** The day the version went out, as the app wrote it (2026-10-09). */
  date: string;
  /** The story that made the change; for the app's own use, not shown. */
  story: string;
  kind: ChangeKind;
  text: string;
}

/** The lines of one version, New before Fixed. */
export interface VersionGroup {
  version: string;
  date: string;
  entries: ChangelogEntry[];
}

/** Compares dotted version numbers by number, not by text: 0.5.10 is after 0.5.9. */
export function compareVersions(a: string, b: string): number {
  const part = (v: string, i: number) => Number.parseInt(v.split('.')[i] ?? '0', 10) || 0;
  const length = Math.max(a.split('.').length, b.split('.').length);
  for (let i = 0; i < length; i++) {
    const difference = part(a, i) - part(b, i);
    if (difference !== 0) return difference;
  }
  return 0;
}

const isEntry = (value: unknown): value is ChangelogEntry => {
  if (typeof value !== 'object' || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.version === 'string' &&
    typeof e.date === 'string' &&
    typeof e.story === 'string' &&
    typeof e.text === 'string' &&
    (e.kind === 'new' || e.kind === 'fixed')
  );
};

/** The well-formed entries of a parsed changelog.json; anything else is dropped. */
export function parseChangelog(json: unknown): ChangelogEntry[] {
  return Array.isArray(json) ? json.filter(isEntry) : [];
}

/** The versions after `since` (and up to `upTo`, when given), newest first, each with its New lines before its Fixed. */
export function versionsSince(entries: readonly ChangelogEntry[], since?: string, upTo?: string): VersionGroup[] {
  const groups = new Map<string, VersionGroup>();
  for (const entry of entries) {
    if (since !== undefined && compareVersions(entry.version, since) <= 0) continue;
    if (upTo !== undefined && compareVersions(entry.version, upTo) > 0) continue;
    const group = groups.get(entry.version) ?? { version: entry.version, date: entry.date, entries: [] };
    group.entries.push(entry);
    groups.set(entry.version, group);
  }
  const kindOrder = (e: ChangelogEntry) => (e.kind === 'new' ? 0 : 1);
  return [...groups.values()]
    .sort((a, b) => compareVersions(b.version, a.version))
    .map((g) => ({ ...g, entries: g.entries.map((e, i) => ({ e, i })).sort((x, y) => kindOrder(x.e) - kindOrder(y.e) || x.i - y.i).map((x) => x.e) }));
}

export interface SummaryWords {
  new: string;
  fixed: string;
  whatsNew: string;
}

export const DEFAULT_SUMMARY_WORDS: SummaryWords = { new: 'new', fixed: 'fixed', whatsNew: "What's new" };

export interface Summary {
  /** The newest version in the list. */
  version: string;
  newCount: number;
  fixedCount: number;
  /** '0.5.9 · 1 new, 2 fixed': a count of none is left out. */
  text: string;
  /** The Update ready banner's line: '0.5.9 · 1 new, 2 fixed · What's new'. */
  bannerText: string;
}

/** What the update brings to an app running `fromVersion`: the newest version, and its lines counted; null when nothing is after it. */
export function summarise(entries: readonly ChangelogEntry[], fromVersion: string, words: Partial<SummaryWords> = {}): Summary | null {
  const w = { ...DEFAULT_SUMMARY_WORDS, ...words };
  const groups = versionsSince(entries, fromVersion);
  if (groups.length === 0) return null;
  const lines = groups.flatMap((g) => g.entries);
  const newCount = lines.filter((e) => e.kind === 'new').length;
  const fixedCount = lines.length - newCount;
  const counts = [newCount > 0 ? `${newCount} ${w.new}` : '', fixedCount > 0 ? `${fixedCount} ${w.fixed}` : ''].filter(Boolean).join(', ');
  const text = counts ? `${groups[0].version} · ${counts}` : groups[0].version;
  return { version: groups[0].version, newCount, fixedCount, text, bannerText: `${text} · ${w.whatsNew}` };
}

/** GitHub's anchor for a heading: lower case, anything but letters, digits, spaces and hyphens dropped, spaces to hyphens ('0.5.9' is '059'). */
export function githubAnchor(heading: string): string {
  return heading.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s/g, '-');
}

export interface VersionLinkOptions {
  /** 'owner/name' on GitHub. */
  repo: string;
  /** Is the repo public? A private repo cannot be linked to: null, and the app opens its own list. */
  public: boolean;
  /** The version whose '## 0.5.9' heading to land on; without it, the top of the file. */
  version?: string;
}

/** The link from the version in About to its place in CHANGELOG.md on GitHub; null for a private repo. */
export function versionLink({ repo, public: isPublic, version }: VersionLinkOptions): string | null {
  if (!isPublic) return null;
  const file = `https://github.com/${repo}/blob/main/CHANGELOG.md`;
  return version === undefined ? file : `${file}#${githubAnchor(version)}`;
}

/** Reads changelog.json from the app's base URL. cache 'no-store': a waiting update's list is the new build's, not the cached one. */
export async function fetchChangelog(baseUrl: string, fetchFn: typeof fetch = (...args) => fetch(...args)): Promise<ChangelogEntry[]> {
  const url = `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}changelog.json`;
  const response = await fetchFn(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return parseChangelog(await response.json());
}
