# @bsv-kit/grist

Send grist with photos and poll the mill's answer (Postern's `docs/protocol.md` section 19). It
uses bsv only through its public exports, imported by the name a consumer's install resolves:
`'bsv-kit/bsv'`.

```ts
import { door, vault } from 'bsv-kit/bsv';
import { grist } from 'bsv-kit/grist';

const d = new door.Door({ baseUrl: 'https://postern.example', key });
const txid = await grist.sendGrist({
  door: d, key,                       // the app's door and its raw 32-byte key
  app: 'cairn', kind: 'sweep', v: '1.1',
  input: request,                     // the app's own request
  photos: [{ bytes, mime: 'image/jpeg' }], // at most 4; jpeg, png or webp; 8 MB each
  model: 'sonnet', effort: 'high',    // optional asks, within the factory's caps
});
const answer = await grist.awaitAnswer(txid, { door: d, key, signal }); // polls every 20 s
// answer: { re, status: 'answered' | 'refused' | 'failed', answer?, reason?, grind }
```

- `sendGrist` asks `GET /api/me` for the mill key (or takes `mill`), seals and uploads each photo to
  it (`POST /api/blobs`), seals `{grist, input, attachments}` (BRC-78) in a `grist` envelope and
  posts it (`POST /api/messages`). A grist it could not send (5 photos, a type the mill does not
  take, a record over the 10 KiB payload cap) is refused with `GristInputError` before any upload.
- `awaitAnswer` pages `GET /api/messages?since=` until a grist record from the mill, sealed by the
  mill, whose `re` is `txid` arrives. `refused` and `failed` resolve too. Aborting `signal` rejects
  with `AwaitAbortedError` (name `AbortError`).
- `decryptAnswer(ct, key)` opens one answer record's `ct`.

Lifted from Postern's `src/services/` (`deliver.ts`, `attachments.ts`, `messages.ts`); Postern's
wire formats are the law, and `tests/fixtures/postern-grist.json` was made by Postern's own code
(`scripts/postern-grist-fixture.ts`). The consumer smoke test (`npm run smoke`, also run by
`npm test`) installs bsv-kit from a fresh clone into a scratch app and imports both entry points.
