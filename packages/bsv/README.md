# @bsv-kit/bsv

The key vault, the door client for signed Postern API calls, and the licence check. Runtime
dependencies: `@bsv/sdk` and `@scure/bip39`. It imports nothing from grist.

```ts
import { vault, door, licence } from 'bsv-kit/bsv';
```

Lifted from Postern's `src/services/` (`vault.ts`, `keySession.ts`, `session.ts`, `apiAuth.ts`,
`licence.ts`); Postern's wire formats are the law. `vault` is real (generate, wrap, unwrap, storage port, day-long session); `door` is real (below); `licence` is real (further below).

```ts
const d = new door.Door({ baseUrl: 'https://backend.example', key /* raw 32-byte master key */ });
const me = await d.me();                       // GET /api/me, parsed
const res = await d.fetch('/messages?since=0'); // GET /api/messages?since=0, signed
```

`fetch(path)` takes the part after `/api`. With a key, each call fetches a fresh nonce from
`GET /api/challenge`, signs the whole request with it (method, request target, body sha256, nonce: Postern's v2 message) and sends `Authorization: Postern2 <pubkey>:<nonce>:<sig>`; a nonce
refusal is retried once. Failures are typed: `ApiTimeoutError`, `BackendUnreachableError`,
`RefusedError` (`isPermanentRefusal`), and `NoLicenceError` from `me()`. `baseUrl`, `key` and
`fetch` (and `timeoutMs`) are inputs; nothing reads the page or the browser.

```ts
const held = await licence.hasLicence(publicKeyHex, 'postern');           // a mint, no later transfer
const status = await licence.licenceStatus(publicKeyHex, 'postern', {     // held | revoked | indexing | none
  pending: { txid, broadcastAt },                                         // a mint just broadcast, if any
});
```

The chain is read through a `ChainReader` (`getAddressHistory`, optional `getUnconfirmedAddressHistory`,
`getTransactionHex`, optional `getTransactionHexes`, a bulk read). The default is `WhatsOnChainReader` (testnet,
`fetch` and the base URL are inputs; paced and retried as Postern's provider is; it reads transactions in bulk,
20 a request, through WhatsOnChain's `/txs/hex`); `FakeChainReader` is the in-memory double for tests. One check
reads each transaction once.
`collection` may be a list in order of preference. A key holds a licence when a type-M record in
its own address history names it holder of the collection and no type-TR record moves that mint away.
`indexing` means no mint shows yet but `pending` names one broadcast within `graceMs` (default 10
minutes) - Postern's "licence is on its way" (mw-1589l.24). The app keeps the pending marker and any cache.

A licence an issuer minted to the key (Postern's Issue a licence) is funded by the issuer, so the holder's
own history never lists it: pass `issuer: <the issuer's public key hex>` and the check also reads the issuer's
history, counts only a mint the issuer signed and honours the issuer's signed revoke record, as Postern's
backend does. Without `issuer` only the holder's own history is read. A revoke's signature is checked only when
it names one of the holder's mints, so the issuer's revokes of other licences cost nothing. `findLicenceForAddress` is
`findLicence` for a holder known by testnet address.

A transaction never changes, so an app may keep the ones a check reads and pass them to the next: `txCache`
takes `get(txid)` and `set(txid, hex)` (either may return a promise, so IndexedDB will do). The next check then
reads only the histories and whatever is new in them. A kept copy that is not the transaction its txid names is
read again, and a cache that throws is passed over; the chain is the source of truth.

```ts
const status = await licence.licenceStatus(publicKeyHex, 'legend', {
  issuer: issuerPublicKeyHex,
  txCache: { get: (txid) => db.get('txs', txid), set: (txid, hex) => db.put('txs', hex, txid) },
});
```
