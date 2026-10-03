# bsv-kit

Shared TypeScript libraries for the Governor's PWAs, lifted from the working code in
[Postern](https://github.com/Jonathan-A-White/postern). One repo, two separate libraries:

- `@bsv-kit/bsv`: key vault, door client for signed Postern API calls, licence check.
- `@bsv-kit/grist`: send grist with photos, poll the mill's answer. It may use bsv only
  through bsv's public exports; bsv imports nothing from grist, so an app can use bsv alone.

No UI and no DOM live in the libraries; the example page lives under `examples/` (see
[examples/door-demo](examples/door-demo/README.md); `npm run demo` serves it).

## Install

From GitHub, by tag (there is no registry; `prepare` builds both packages on install):

```bash
npm install github:Jonathan-A-White/bsv-kit#v0.1.0
```

```ts
import { vault, door, licence } from 'bsv-kit/bsv';
import { grist } from 'bsv-kit/grist';
```

## Modules

Postern's wire formats are the law; each module is lifted from the Postern file named here.

| Entry point      | Namespace | What it is                                   | Postern source (`src/services/`)               |
| ---------------- | --------- | -------------------------------------------- | ---------------------------------------------- |
| `bsv-kit/bsv`    | `vault`   | the BSV key, wrapped at rest, unlocked a day | `vault.ts`, `keySession.ts`, `session.ts`      |
| `bsv-kit/bsv`    | `door`    | challenge-signed `/api` calls                | `apiAuth.ts`                                   |
| `bsv-kit/bsv`    | `licence` | does a key hold a License token              | `licence.ts`                                   |
| `bsv-kit/grist`  | `grist`   | send grist with photos, poll the answer      | `send.ts`, `attachments.ts`, `talk.ts`         |

All namespaces are stubs until their stories land.

## Develop

```bash
npm ci --no-audit --no-fund && npm run lint && npm run typecheck && npm test && npm run build
```

See [CLAUDE.md](CLAUDE.md) for conventions. MIT licensed.
