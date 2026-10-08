// One-off: makes wrapped-key blobs with BSV-KIT's vault.wrap, for Postern to unwrap
// (postern-fixtures.ts verify). Run from the Postern checkout with its tsx, as that script says:
//
//   (cd <postern-checkout> && npx tsx <bsv-kit>/packages/bsv/scripts/make-bsvkit-fixtures.ts) \
//     > packages/bsv/tests/fixtures/bsvkit-vault.json
import { vault } from '../src/index.js';

const hex = (b: ArrayBuffer | Uint8Array): string => Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b)).toString('hex');

const PHRASE = 'letter advice cage absurd amount doctor acoustic avoid letter advice cage above';
const PRF_SECRET = Uint8Array.from({ length: 32 }, (_, i) => 255 - i);

const key = await vault.keyFromPhrase(PHRASE);
const prf = await vault.wrap(key, { prfSecret: PRF_SECRET });
const phrase = await vault.wrap(key, { passphrase: PHRASE });

console.log(
  JSON.stringify(
    [
      { mode: 'prf', phrase: PHRASE, prfSecretHex: hex(PRF_SECRET), keyHex: hex(key), publicKeyHex: prf.publicKeyHex, ciphertextHex: hex(prf.ciphertext), ivHex: hex(prf.iv) },
      { mode: 'phrase', phrase: PHRASE, passphrase: PHRASE, saltHex: hex(phrase.salt!), keyHex: hex(key), publicKeyHex: phrase.publicKeyHex, ciphertextHex: hex(phrase.ciphertext), ivHex: hex(phrase.iv) },
    ],
    null,
    2,
  ),
);
