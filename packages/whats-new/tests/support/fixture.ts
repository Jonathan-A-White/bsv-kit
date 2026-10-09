import type { ChangelogEntry } from '../../src/index.js';

/** An app's changelog.json, newest first: 0.5.9 has one new and two fixed lines. */
export const CHANGELOG: ChangelogEntry[] = [
  { version: '0.5.9', date: '2026-10-09', story: 'app-9a', kind: 'fixed', text: 'The list no longer jumps when a message arrives.' },
  { version: '0.5.9', date: '2026-10-09', story: 'app-9b', kind: 'new', text: 'Pin a message to the top.' },
  { version: '0.5.9', date: '2026-10-09', story: 'app-9c', kind: 'fixed', text: 'Photos keep their turn.' },
  { version: '0.5.8', date: '2026-10-05', story: 'app-8a', kind: 'fixed', text: 'Dark mode no longer flashes white.' },
  { version: '0.5.8', date: '2026-10-05', story: 'app-8b', kind: 'new', text: 'Share a message out of the app.' },
  { version: '0.5.7', date: '2026-10-01', story: 'app-7a', kind: 'fixed', text: 'Sending twice in a row works.' },
  { version: '0.5.6', date: '2026-09-28', story: 'app-6a', kind: 'new', text: 'The first version with a changelog.' },
];
