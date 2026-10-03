# @bsv-kit/bsv

The key vault, the door client for signed Postern API calls, and the licence check. Runtime
dependencies: `@bsv/sdk` and `@scure/bip39`. It imports nothing from grist.

```ts
import { vault, door, licence } from 'bsv-kit/bsv';
```

Lifted from Postern's `src/services/` (`vault.ts`, `keySession.ts`, `session.ts`, `apiAuth.ts`,
`licence.ts`); Postern's wire formats are the law. `vault` is real (generate, wrap, unwrap, storage port, day-long session); `door` and `licence` are stubs until their stories land.
