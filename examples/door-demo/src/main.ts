// The door demo's page: wires the form to bsv (key, licence, door) and grist (send, answer).
import { door, licence } from 'bsv-kit/bsv';
import { grist } from 'bsv-kit/grist';
import { browserStorage, forgetKey, hasStoredKey, makeKey, unlockKey } from './keys.js';
import type { UnlockedKey } from './keys.js';
import { DEFAULTS, readPhoto, sweepInput } from './request.js';
import { describeAnswer, describeError, describeLicence } from './text.js';

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`The page has no #${id}.`);
  return found as T;
}
const input = (id: string): HTMLInputElement => el<HTMLInputElement>(id);
const say = (id: string, text: string): void => {
  el(id).textContent = text;
};

const storage = browserStorage();
let unlocked: UnlockedKey | null = null;
let waiting: AbortController | null = null;

/** Runs one button's work, saying any failure in `target` rather than leaving it in the console. */
async function guarded(target: string, work: () => Promise<void>): Promise<void> {
  try {
    await work();
  } catch (err) {
    say(target, describeError(err));
  }
}

function shown(k: UnlockedKey): void {
  unlocked = k;
  input('pubkey').value = k.publicKeyHex;
  say('copy-status', '');
}

el('make').addEventListener('click', () =>
  guarded('key-status', async () => {
    const made = await makeKey(storage, input('passphrase').value);
    shown(made);
    say('key-status', 'Key made and stored in this browser, locked by your passphrase.');
    say('phrase', `Recovery phrase (write it down; it is shown once and never stored):\n${made.phrase}`);
  }),
);

el('unlock').addEventListener('click', () =>
  guarded('key-status', async () => {
    shown(await unlockKey(storage, input('passphrase').value));
    say('key-status', 'Key unlocked.');
    say('phrase', '');
  }),
);

el('forget').addEventListener('click', () =>
  guarded('key-status', async () => {
    if (!confirm('Forget the stored key? Without its recovery phrase it is gone for good.')) return;
    await forgetKey(storage);
    unlocked = null;
    input('pubkey').value = '';
    say('phrase', '');
    say('key-status', 'The stored key was forgotten.');
  }),
);

el('copy').addEventListener('click', () =>
  guarded('copy-status', async () => {
    if (!unlocked) throw new Error('Make or unlock a key first.');
    await navigator.clipboard.writeText(unlocked.publicKeyHex);
    say('copy-status', 'Copied.');
  }),
);

el('check').addEventListener('click', () =>
  guarded('licence-status', async () => {
    if (!unlocked) throw new Error('Make or unlock a key first.');
    const collection = input('collection').value.trim();
    if (!collection) throw new Error('Type a collection first.');
    say('licence-status', 'Asking the chain ...');
    say('licence-status', describeLicence(await licence.licenceStatus(unlocked.publicKeyHex, collection)));
  }),
);

el('stop').addEventListener('click', () => waiting?.abort());

el('send').addEventListener('click', () =>
  guarded('send-status', async () => {
    if (!unlocked) throw new Error('Make or unlock a key first.');
    const file = input('photo').files?.[0];
    if (!file) throw new Error('Choose a photo first.');
    const photo = await readPhoto(file);
    const app = input('app').value.trim();
    const kind = input('kind').value.trim();
    const v = input('version').value.trim();
    const d = new door.Door({ baseUrl: input('backend').value.trim(), key: unlocked.key });

    say('answer', '');
    say('send-status', 'Sending ...');
    const txid = await grist.sendGrist({ door: d, key: unlocked.key, app, kind, v, input: sweepInput(v), photos: [photo] });
    say('send-status', `Sent (record ${txid}). Waiting for the mill's answer; it is looked for every ${grist.POLL_INTERVAL_MS / 1000} seconds.`);

    waiting = new AbortController();
    el('stop').hidden = false;
    try {
      const answer = await grist.awaitAnswer(txid, { door: d, key: unlocked.key, signal: waiting.signal });
      say('send-status', `Answer received for record ${txid}.`);
      say('answer', describeAnswer(answer));
    } finally {
      el('stop').hidden = true;
      waiting = null;
    }
  }),
);

input('app').value = DEFAULTS.app;
input('kind').value = DEFAULTS.kind;
input('version').value = DEFAULTS.v;
input('collection').value = DEFAULTS.collection;
void hasStoredKey(storage).then((stored) => {
  say('key-status', stored ? 'A key is stored in this browser. Type its passphrase and press Unlock.' : 'No key yet. Type a passphrase and press Make.');
});
