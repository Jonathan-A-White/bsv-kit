// One-off: makes and checks the vault fixtures with POSTERN's own code (src/services/vault.ts).
// Not part of the build or the tests (neither tsconfig includes scripts/). Run it with Postern's tsx:
//
//   POSTERN_DIR=/home/jwhite/postern
//   (cd $POSTERN_DIR && npx tsx <bsv-kit>/packages/bsv/scripts/postern-fixtures.ts generate) \
//     > packages/bsv/tests/fixtures/postern-vault.json
//   (cd $POSTERN_DIR && npx tsx <bsv-kit>/packages/bsv/scripts/postern-fixtures.ts verify \
//     <bsv-kit>/packages/bsv/tests/fixtures/bsvkit-vault.json)
//
// generate: fixed recorded inputs -> Postern's createMnemonic-shaped phrases, deriveMasterKey,
//   deriveAesKeyFrom*, wrapKey, publicKeyHexFromMasterKey; prints the blobs as hex JSON.
// verify: reads blobs bsv-kit made (see make-bsvkit-fixtures.ts) and unwraps each with Postern's
//   unwrapKey; exits non-zero unless every one gives the recorded key.
import { readFileSync } from 'node:fs';
import {
  deriveAesKeyFromPhrase,
  deriveAesKeyFromPrf,
  deriveMasterKey,
  publicKeyHexFromMasterKey,
  unwrapKey,
  wrapKey,
} from '/home/jwhite/postern/src/services/vault.ts';

const hex = (b: ArrayBuffer | Uint8Array): string => Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b)).toString('hex');
const bytes = (h: string): Uint8Array => new Uint8Array(Buffer.from(h, 'hex'));

// Two phrases made once with Postern's createMnemonic(); the second has a mixed-case form too.
const PHRASES = [
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  'legal winner thank year wave sausage worth useful legal winner thank yellow',
];
const PRF_SECRET = '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';
const SALT = 'a0a1a2a3a4a5a6a7a8a9aaabacadaeaf';

async function generate(): Promise<void> {
  const out: unknown[] = [];
  const prfAes = await deriveAesKeyFromPrf(bytes(PRF_SECRET).buffer as ArrayBuffer);
  for (const phrase of PHRASES) {
    const key = await deriveMasterKey(phrase);
    const publicKeyHex = publicKeyHexFromMasterKey(key);
    const prf = await wrapKey(key, prfAes);
    out.push({
      mode: 'prf', phrase, prfSecretHex: PRF_SECRET, keyHex: hex(key), publicKeyHex,
      ciphertextHex: hex(prf.ciphertext), ivHex: hex(prf.iv),
    });
    const phraseAes = await deriveAesKeyFromPhrase(phrase, bytes(SALT));
    const wrapped = await wrapKey(key, phraseAes);
    out.push({
      mode: 'phrase', phrase, saltHex: SALT, keyHex: hex(key), publicKeyHex,
      ciphertextHex: hex(wrapped.ciphertext), ivHex: hex(wrapped.iv),
    });
  }
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
}

interface Blob {
  mode: 'prf' | 'phrase';
  phrase: string;
  prfSecretHex?: string;
  passphrase?: string;
  saltHex?: string;
  keyHex: string;
  ciphertextHex: string;
  ivHex: string;
}

async function verify(file: string): Promise<void> {
  const blobs = JSON.parse(readFileSync(file, 'utf-8')) as Blob[];
  let bad = 0;
  for (const b of blobs) {
    const aes =
      b.mode === 'prf'
        ? await deriveAesKeyFromPrf(bytes(b.prfSecretHex!).buffer as ArrayBuffer)
        : await deriveAesKeyFromPhrase(b.passphrase ?? b.phrase, bytes(b.saltHex!));
    const key = await unwrapKey({ ciphertext: bytes(b.ciphertextHex).buffer as ArrayBuffer, iv: bytes(b.ivHex) }, aes);
    const ok = hex(key) === b.keyHex;
    if (!ok) bad++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} Postern unwraps bsv-kit ${b.mode} blob`);
  }
  if (bad > 0) process.exit(1);
}

const [command, file] = process.argv.slice(2);
if (command === 'generate') await generate();
else if (command === 'verify' && file) await verify(file);
else throw new Error('usage: postern-fixtures.ts generate | verify <bsvkit-vault.json>');
