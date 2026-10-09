// The consumer smoke test: installs bsv-kit the way an app does, `npm install git+file://<a fresh clone>`,
// into a scratch directory, and checks from there what a git install must deliver:
//   - 'bsv-kit/grist' imports and sendGrist (which reaches bsv's door) sends a grist to a fake backend;
//   - 'bsv-kit/bsv' alone imports, and its import graph holds no grist file;
//   - 'bsv-kit/tips' imports and keeps a dismissal;
//   - 'bsv-kit/composer' renders with the React the app installs, and its styles.css is packed.
//   - 'bsv-kit/whats-new' renders with the same React, its styles.css is packed, and its import graph holds no other library.
// The "fresh clone" is the working tree as it stands (tracked and untracked files, minus what git ignores),
// committed into a scratch repository, so an edit not yet committed is smoke-tested too.
// Run: npm run smoke   (needs the network or a warm npm cache: the install runs the build with devDependencies)
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scratch = mkdtempSync(join(tmpdir(), 'bsv-kit-smoke-'));
const run = (cmd, args, cwd, extra = {}) =>
  execFileSync(cmd, args, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], ...extra });

try {
  // 1. A fresh clone of the tree.
  const clone = join(scratch, 'clone');
  mkdirSync(clone);
  const files = run('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], root).split('\0').filter(Boolean);
  for (const f of files) {
    if (!existsSync(join(root, f))) continue; // deleted in the working tree
    mkdirSync(dirname(join(clone, f)), { recursive: true });
    cpSync(join(root, f), join(clone, f));
  }
  const git = (...args) => run('git', ['-c', 'user.name=smoke', '-c', 'user.email=smoke@example.invalid', ...args], clone);
  git('init', '-q', '-b', 'main');
  git('add', '-A');
  git('commit', '-q', '-m', 'smoke');

  // 2. An app's scratch directory that installs it.
  const app = join(scratch, 'app');
  mkdirSync(app);
  writeFileSync(join(app, 'package.json'), JSON.stringify({ name: 'smoke-app', private: true, type: 'module' }));
  console.log('installing bsv-kit from a fresh clone ...');
  run('npm', ['install', '--no-audit', '--no-fund', `git+file://${clone}`], app, { timeout: 480_000 });
  const installed = join(app, 'node_modules', 'bsv-kit');

  // 3. 'bsv-kit/bsv' alone pulls in no grist file: walk its import graph from the installed entry point.
  const seen = new Set();
  const specifier = /\b(?:import|export)\s[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  const walk = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const m of readFileSync(file, 'utf-8').matchAll(specifier)) {
      const s = m[1] ?? m[2] ?? m[3];
      if (/^(@bsv-kit\/grist|bsv-kit\/grist)(\/|$)/.test(s)) throw new Error(`${relative(installed, file)} imports ${s}`);
      if (s.startsWith('.')) walk(resolve(dirname(file), s));
    }
  };
  walk(join(installed, 'packages/bsv/dist/index.js'));
  const grist = [...seen].filter((f) => f.includes('/packages/grist/'));
  if (grist.length) throw new Error(`'bsv-kit/bsv' reaches grist files: ${grist.join(', ')}`);

  // 4. In node, as the app: import both entry points and send a grist through a fake door.
  writeFileSync(
    join(app, 'smoke.mjs'),
    `
import { door } from 'bsv-kit/bsv';
import { grist } from 'bsv-kit/grist';
import { PrivateKey } from '@bsv/sdk';

const phone = PrivateKey.fromRandom();
const mill = PrivateKey.fromRandom().toPublicKey().toString();
const calls = [];
const fakeFetch = async (url, init) => {
  const path = String(url).replace('https://backend.example/api', '');
  const method = init?.method ?? 'GET';
  calls.push(method + ' ' + path);
  const json = (b, status = 200) => new Response(JSON.stringify(b), { status });
  if (path === '/challenge') return json({ nonce: 'ab'.repeat(32) });
  if (path === '/me') return json({ pubkey: phone.toPublicKey().toString(), mill, network: 'testnet', features: [] });
  if (path === '/blobs') return json({ hash: 'c'.repeat(64), size: 1 }, 201);
  if (path === '/messages' && method === 'POST') return json({ txid: 'direct:' + 'd'.repeat(64), seq: 1 }, 201);
  return json({ error: 'unexpected ' + method + ' ' + path }, 404);
};
const key = Uint8Array.from(Buffer.from(phone.toHex(), 'hex'));
const d = new door.Door({ baseUrl: 'https://backend.example', key, fetch: fakeFetch });
const txid = await grist.sendGrist({ door: d, key, app: 'cairn', kind: 'sweep', v: '1.1', input: { hello: 'drawer' }, photos: [{ bytes: Uint8Array.of(1, 2, 3), mime: 'image/jpeg' }] });
if (txid !== 'direct:' + 'd'.repeat(64)) throw new Error('unexpected txid ' + txid);
if (!calls.includes('POST /blobs') || !calls.includes('POST /messages')) throw new Error('calls: ' + calls.join(', '));
console.log('sendGrist reached the door and posted:', txid);
`,
  );
  console.log(run('node', ['smoke.mjs'], app).trim());

  // 5. 'bsv-kit/bsv' on its own, in a process that never names grist.
  writeFileSync(join(app, 'bsv-only.mjs'), `import { door, vault, licence } from 'bsv-kit/bsv';\nif (!door.Door || !vault.generate || !licence.hasLicence) throw new Error('bsv exports missing');\nconsole.log('bsv alone imports');\n`);
  console.log(run('node', ['bsv-only.mjs'], app).trim());

  // 6. 'bsv-kit/testing' resolves, and its fake Postern takes a grist and an answer.
  writeFileSync(
    join(app, 'testing.mjs'),
    `
import { door } from 'bsv-kit/bsv';
import { grist } from 'bsv-kit/grist';
import { fakePostern } from 'bsv-kit/testing';

const fake = fakePostern();
const d = new door.Door({ baseUrl: fake.base, key: fake.appKey, fetch: fake.fetch });
const sent = await grist.sendGristRecord({ door: d, key: fake.appKey, app: 'cairn', kind: 'sweep', v: '1.1', input: {}, attachments: [{ bytes: Uint8Array.of(1), mime: 'audio/webm', name: 'clip.webm' }] });
fake.reply({ re: sent.txid, status: 'answered', answer: {}, grind: { app: 'cairn', kind: 'sweep', v: '1.1' } });
const page = await grist.readAnswerPage(sent.txid, { door: d, key: fake.appKey, mill: sent.mill, since: 0 });
if (page.answer?.status !== 'answered') throw new Error('no answer from the fake');
console.log('bsv-kit/testing imports');
`,
  );
  console.log(run('node', ['testing.mjs'], app).trim());
  // 7. 'bsv-kit/tips' resolves and keeps a dismissal through an injected storage.
  writeFileSync(
    join(app, 'tips.mjs'),
    `
import { tips } from 'bsv-kit/tips';

const data = new Map();
const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
const t = tips.createTips({ tips: [{ id: 'one', text: 'A tip.', event: 'opened' }], storage });
if ((await t.nextTip('opened'))?.id !== 'one') throw new Error('tip not shown');
await t.dismiss('one');
if ((await t.nextTip('opened')) !== null) throw new Error('tip shown after dismiss');
console.log('bsv-kit/tips imports');
`,
  );
  console.log(run('node', ['tips.mjs'], app).trim());

  // 8. 'bsv-kit/composer' with the React the app brings: it renders, its stylesheet is packed, and its import
  // graph reaches no bsv, grist or tips file.
  run('npm', ['install', '--no-audit', '--no-fund', 'react@19', 'react-dom@19'], app, { timeout: 480_000 });
  const composerSeen = new Set();
  const walkComposer = (file) => {
    if (composerSeen.has(file)) return;
    composerSeen.add(file);
    for (const m of readFileSync(file, 'utf-8').matchAll(specifier)) {
      const s = m[1] ?? m[2] ?? m[3];
      if (/^(@bsv-kit\/|bsv-kit\/)/.test(s)) throw new Error(`${relative(installed, file)} imports ${s}`);
      if (s.startsWith('.')) walkComposer(resolve(dirname(file), s));
    }
  };
  walkComposer(join(installed, 'packages/composer/dist/index.js'));
  writeFileSync(
    join(app, 'composer.mjs'),
    `
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { Composer, browserSpeech } from 'bsv-kit/composer';

const html = renderToString(createElement(Composer, { mode: 'type', attach: true, onSend: () => true }));
if (!html.includes('bk-composer') || !html.includes('aria-label="Send"') || !html.includes('aria-label="Attach files"')) throw new Error('composer html: ' + html);
if (browserSpeech.supported()) throw new Error('node has no speech recogniser');
const css = createRequire(import.meta.url).resolve('bsv-kit/composer/styles.css');
if (!existsSync(css)) throw new Error('styles.css is not packed');
console.log('bsv-kit/composer renders');
`,
  );
  console.log(run('node', ['composer.mjs'], app).trim());

  // 9. 'bsv-kit/whats-new' with the same React: it renders, its stylesheet is packed, and its import graph reaches
  // no other library.
  const whatsNewSeen = new Set();
  const walkWhatsNew = (file) => {
    if (whatsNewSeen.has(file)) return;
    whatsNewSeen.add(file);
    for (const m of readFileSync(file, 'utf-8').matchAll(specifier)) {
      const s = m[1] ?? m[2] ?? m[3];
      if (/^(@bsv-kit\/|bsv-kit\/)/.test(s)) throw new Error(`${relative(installed, file)} imports ${s}`);
      if (s.startsWith('.')) walkWhatsNew(resolve(dirname(file), s));
    }
  };
  walkWhatsNew(join(installed, 'packages/whats-new/dist/index.js'));
  writeFileSync(
    join(app, 'whats-new.mjs'),
    `
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { WhatsNewList, summarise, versionLink } from 'bsv-kit/whats-new';

const entries = [
  { version: '0.5.9', date: '2026-10-09', story: 's', kind: 'new', text: 'Pin a message.' },
  { version: '0.5.9', date: '2026-10-09', story: 's', kind: 'fixed', text: 'No more jumping.' },
];
const html = renderToString(createElement(WhatsNewList, { entries }));
if (!html.includes('bk-whats-new') || !html.includes('Pin a message.') || !html.includes('0.5.9')) throw new Error('whats-new html: ' + html);
if (summarise(entries, '0.5.8')?.bannerText !== "0.5.9 · 1 new, 1 fixed · What's new") throw new Error('summary');
if (versionLink({ repo: 'a/b', public: true, version: '0.5.9' }) !== 'https://github.com/a/b/blob/main/CHANGELOG.md#059') throw new Error('link');
const css = createRequire(import.meta.url).resolve('bsv-kit/whats-new/styles.css');
if (!existsSync(css)) throw new Error('styles.css is not packed');
console.log('bsv-kit/whats-new renders');
`,
  );
  console.log(run('node', ['whats-new.mjs'], app).trim());
  console.log('consumer smoke test passed');
} catch (err) {
  console.error(String(err?.stderr ?? '') || err);
  process.exitCode = 1;
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
