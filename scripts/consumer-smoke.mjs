// The consumer smoke test: installs bsv-kit the way an app does, `npm install git+file://<a fresh clone>`,
// into a scratch directory, and checks from there what a git install must deliver:
//   - 'bsv-kit/grist' imports and sendGrist (which reaches bsv's door) sends a grist to a fake backend;
//   - 'bsv-kit/bsv' alone imports, and its import graph holds no grist file.
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
  console.log('consumer smoke test passed');
} catch (err) {
  console.error(String(err?.stderr ?? '') || err);
  process.exitCode = 1;
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
