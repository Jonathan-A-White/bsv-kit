# @bsv-kit/bsv

The key vault, the door client for signed Postern API calls, and the licence check. Runtime
dependencies: `@bsv/sdk` and `@scure/bip39`. It imports nothing from grist.

```ts
import { vault, door, licence } from 'bsv-kit/bsv';
```

Lifted from Postern's `src/services/` (`vault.ts`, `keySession.ts`, `session.ts`, `apiAuth.ts`,
`licence.ts`); Postern's wire formats are the law. `vault` is real (generate, wrap, unwrap, storage port, day-long session); `door` is real (below); `licence` is a stub until its story lands.

```ts
const d = new door.Door({ baseUrl: 'https://backend.example', key /* raw 32-byte master key */ });
const me = await d.me();                       // GET /api/me, parsed
const res = await d.fetch('/messages?since=0'); // GET /api/messages?since=0, signed
```

`fetch(path)` takes the part after `/api`. With a key, each call fetches a fresh nonce from
`GET /api/challenge`, signs it, and sends `Authorization: Postern <pubkey>:<nonce>:<sig>`; a nonce
refusal is retried once. Failures are typed: `ApiTimeoutError`, `BackendUnreachableError`,
`RefusedError` (`isPermanentRefusal`), and `NoLicenceError` from `me()`. `baseUrl`, `key` and
`fetch` (and `timeoutMs`) are inputs; nothing reads the page or the browser.
