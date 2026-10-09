// The README's Credits section is the About of a library. This checks it: it opens with Newton's line,
// attributed; each credit has its name as link text (never a raw URL) and a licence link; and every
// runtime dependency in a package.json is credited. Run through npm test (scripts/credits.test.mjs).
import { readdirSync, readFileSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);

/** Names of every runtime dependency in the root package.json and in packages/*\/package.json. */
export function runtimeDependencies() {
  const manifests = [new URL('package.json', ROOT)];
  for (const dir of readdirSync(new URL('packages/', ROOT), { withFileTypes: true })) {
    if (dir.isDirectory()) manifests.push(new URL(`packages/${dir.name}/package.json`, ROOT));
  }
  const names = new Set();
  for (const url of manifests) {
    const { dependencies = {} } = JSON.parse(readFileSync(url, 'utf8'));
    for (const name of Object.keys(dependencies)) names.add(name);
  }
  return [...names].sort();
}

/** The text under "## Credits", up to the next "## " heading; null when there is none. */
export function creditsSection(readme) {
  const lines = readme.split('\n');
  const start = lines.findIndex((line) => /^## Credits\s*$/.test(line));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^## /.test(line));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n');
}

/** Each "- [Name](url) ..." list item (with its continuation lines) as { name, text }. */
export function parseCredits(section) {
  const items = [];
  for (const line of section.split('\n')) {
    if (/^- /.test(line)) items.push(line);
    else if (items.length > 0 && /^\s+\S/.test(line)) items[items.length - 1] += ' ' + line.trim();
  }
  return items.map((text) => ({ name: /^- \[([^\]]+)\]\(/.exec(text)?.[1] ?? '', text }));
}

/** What is wrong with the README's Credits, as sentences; empty when it is right. */
export function problemsWithCredits(readme, dependencies) {
  const section = creditsSection(readme);
  if (section === null) return ['README.md has no "## Credits" section'];
  const problems = [];
  const opening = section.trim().split('\n').filter((line) => line.startsWith('>')).join(' ');
  if (!opening.includes('If I have seen further it is by standing on the shoulders of Giants') || !opening.includes('Isaac Newton')) {
    problems.push(
      'Credits must open with Newton\'s line, "If I have seen further it is by standing on the shoulders of Giants", attributed to Isaac Newton',
    );
  }
  const credits = parseCredits(section);
  for (const { name, text } of credits) {
    if (name === '') problems.push(`a credit does not start with its name as link text: ${text.slice(0, 60)}`);
    else if (/^https?:/i.test(name)) problems.push(`credit "${name}" has a URL as its link text`);
    else if (!/Licen[cs]e: \[[^\]]+\]\(https?:\/\/[^)]+\)/.test(text)) {
      problems.push(`credit "${name}" has no licence link ("Licence: [name](url)")`);
    }
  }
  const credited = new Set(credits.map((c) => c.name));
  for (const dependency of dependencies) {
    if (!credited.has(dependency)) {
      problems.push(`runtime dependency ${dependency} is not credited (add a credit whose link text is "${dependency}")`);
    }
  }
  return problems;
}
