// One-off: records what POSTERN's own code (src/services/messages.ts encryptMessage/encryptAttachment,
// spell-forge-bsv's encodeRecordScript) makes for a grist, as packages/grist/tests/fixtures/postern-grist.json:
// a grist envelope sealed to the mill (and the script that carries it), the mill's three answers sealed to
// the app, and a sealed photo. The keys, the grist and the answers are Postern's docs/fixtures/grist-vectors.json
// (copied beside it as postern-grist-vectors.json). Not part of the build or the tests (neither tsconfig
// includes scripts/). Run it with Postern's tsx:
//
//   (cd <postern-checkout> && npx tsx <bsv-kit>/packages/grist/scripts/postern-grist-fixture.ts) \
//     > packages/grist/tests/fixtures/postern-grist.json
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Postern's checkout: POSTERN_DIR, or the current directory (run these from the Postern checkout).
const POSTERN = resolve(process.env.POSTERN_DIR ?? process.cwd());
const postern = (path: string) => import(pathToFileURL(resolve(POSTERN, path)).href);
const { Utils } = await postern('node_modules/@bsv/sdk/dist/esm/mod.js');
const { encodeRecordScript } = await postern('node_modules/spell-forge-bsv/dist/index.js');
const { encryptAttachment, encryptMessage } = await postern('src/services/messages.ts');

const vectors = JSON.parse(readFileSync(resolve(POSTERN, 'docs/fixtures/grist-vectors.json'), 'utf-8'));
const { mill, cairnPhone } = vectors.keys;
const TS = 1790000000;
const script = (payload: unknown): string => encodeRecordScript(Utils.toArray(JSON.stringify(payload), 'utf8')).toHex();

const gristText = JSON.stringify(vectors.grist);
const gristEnvelope = encryptMessage({
  text: gristText, class: 'grist', senderPrivateKeyHex: cairnPhone.privateKeyHex, recipientPublicKeyHex: mill.publicKeyHex, ts: TS,
});

const answers = Object.fromEntries(
  Object.entries(vectors.answers as Record<string, unknown>).map(([status, answer]) => {
    const envelope = encryptMessage({
      text: JSON.stringify(answer), class: 'grist', senderPrivateKeyHex: mill.privateKeyHex, recipientPublicKeyHex: cairnPhone.publicKeyHex, ts: TS,
    });
    return [status, { envelope, scriptHex: script(envelope), plaintext: answer }];
  }),
);

const photoBytes = Uint8Array.from({ length: 64 }, (_, i) => i * 3 + 1);
const sealedPhoto = encryptAttachment({
  bytes: photoBytes, senderPrivateKeyHex: cairnPhone.privateKeyHex, recipientPublicKeyHex: mill.publicKeyHex,
});

process.stdout.write(
  JSON.stringify(
    {
      ts: TS,
      grist: { plaintext: gristText, envelope: gristEnvelope, scriptHex: script(gristEnvelope) },
      answers,
      photo: { bytesHex: Buffer.from(photoBytes).toString('hex'), sealedHex: Buffer.from(sealedPhoto).toString('hex') },
    },
    null,
    2,
  ) + '\n',
);
