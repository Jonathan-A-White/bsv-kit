# @bsv-kit/grist

Send grist with photos and recordings and poll the mill's answer (Postern's `docs/protocol.md` section 19). It
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

### Recordings, names, and keeping the cursor yourself

`attachments` takes photos and recordings (`audio/webm`, `audio/ogg`, `audio/mp4`; a codec suffix
such as `;codecs=opus` is dropped), after `photos`, at most 4 files in all. All the audio of one
grist together may be at most 8 MiB (`MAX_AUDIO_BYTES`); a photo is still capped at 8 MB. Any file
may carry a `name` (a base name, no folders), which goes on the wire as protocol section 8 allows.
`sendGristRecord` returns `{ txid, seq, mill }` for an app that keeps them (in IndexedDB, say);
`sendGrist` still returns the txid. `readAnswerPage` reads one page and returns the cursor, for an
app that polls on its own schedule; `awaitAnswer` is the loop built on it. An answer may carry a
`reading_result` (typed `unknown`; narrow it yourself).

```ts
const { txid, seq, mill } = await grist.sendGristRecord({
  door: d, key, app: 'spellforge', kind: 'tutor-turn', v: '1', input: turn,
  attachments: [{ bytes: clip, mime: 'audio/webm;codecs=opus', name: 'reading.webm' }],
});
// later, from the stored txid, mill and cursor:
const { answer, next } = await grist.readAnswerPage(txid, { door: d, key, mill, since: cursor });
if (answer) show(answer.answer, answer.reading_result);
else cursor = next; // null: not yet; keep `next` for the next page
```

### `bsv-kit/testing`: the fake Postern (test-only)

`import { fakePostern } from 'bsv-kit/testing'` is a fake backend behind a `fetch`, for an app's own
tests: never import it from code that ships. It answers `/me`, `/blobs`, `/messages` (post and page)
and the challenge; `fake.seen` lists the calls, `fake.records` what the page lists, and
`fake.reply(answer)` adds the mill's sealed answer. `failBlobs`, `failPost`, `postResult` and
`onPoll` bend it.

```ts
const fake = fakePostern();
const d = new door.Door({ baseUrl: fake.base, key: fake.appKey, fetch: fake.fetch });
const sent = await grist.sendGristRecord({ door: d, key: fake.appKey, app: 'cairn', kind: 'sweep', v: '1.1', input: {}, photos: [] });
fake.reply({ re: sent.txid, status: 'answered', answer: {}, grind: { app: 'cairn', kind: 'sweep', v: '1.1' } });
const { answer } = await grist.readAnswerPage(sent.txid, { door: d, key: fake.appKey, mill: sent.mill, since: 0 });
```

Lifted from Postern's `src/services/` (`deliver.ts`, `attachments.ts`, `messages.ts`); Postern's
wire formats are the law, and `tests/fixtures/postern-grist.json` was made by Postern's own code
(`scripts/postern-grist-fixture.ts`). The consumer smoke test (`npm run smoke`, also run by
`npm test`) installs bsv-kit from a fresh clone into a scratch app and imports both entry points.
