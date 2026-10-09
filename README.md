# bsv-kit

Shared TypeScript libraries for the Governor's PWAs, lifted from the working code in
[Postern](https://github.com/Jonathan-A-White/postern). One repo, three separate libraries:

- `@bsv-kit/bsv`: key vault, door client for signed Postern API calls, licence check.
- `@bsv-kit/grist`: send grist with photos and recordings, poll the mill's answer (and a one-page read
  for apps that keep their own cursor). It may use bsv only
  through bsv's public exports; bsv imports nothing from grist, so an app can use bsv alone.
- `@bsv-kit/tips`: a list of one-time tips, which one to show now, and dismissed for good, through a
  storage the app injects. It imports nothing from bsv or grist.

No UI and no DOM live in the libraries; the example page lives under `examples/` (see
[examples/door-demo](examples/door-demo/README.md); `npm run demo` serves it).

## Install

From GitHub, pinned to a commit (there is no registry and no tag yet; tags come later, and the line
becomes `#vX.Y.Z`). `prepare` builds both packages on install:

```bash
npm install github:Jonathan-A-White/bsv-kit#20077847f5af718c83d9912f935f644a2cbbe2b0
```

npm 11 warns that `bsv-kit` has an install script (`prepare`, the build) not yet covered by
`allowScripts`. Allow it with `npm install-scripts approve bsv-kit`, which adds an entry to your
`package.json` keyed by the install line, for example:

```json
"allowScripts": { "github:Jonathan-A-White/bsv-kit#20077847f5af718c83d9912f935f644a2cbbe2b0": true }
```

```ts
import { vault, door, licence } from 'bsv-kit/bsv';
import { grist } from 'bsv-kit/grist';
import { tips } from 'bsv-kit/tips';
import { fakePostern } from 'bsv-kit/testing'; // in tests only: a fake Postern behind a fetch
```

## Modules

Postern's wire formats are the law; each module is lifted from the Postern file named here.

| Entry point      | Namespace | What it is                                   | Postern source (`src/services/`)               |
| ---------------- | --------- | -------------------------------------------- | ---------------------------------------------- |
| `bsv-kit/bsv`    | `vault`   | the BSV key, wrapped at rest, unlocked a day | `vault.ts`, `keySession.ts`, `session.ts`      |
| `bsv-kit/bsv`    | `door`    | challenge-signed `/api` calls                | `apiAuth.ts`                                   |
| `bsv-kit/bsv`    | `licence` | does a key hold a License token              | `licence.ts`                                   |
| `bsv-kit/grist`  | `grist`   | send grist with photos, poll the answer      | `send.ts`, `attachments.ts`, `talk.ts`         |
| `bsv-kit/tips`   | `tips`    | one-time tips, dismissed for good            | (new; not from Postern)                        |
| `bsv-kit/testing`| `fakePostern` | TEST-ONLY fake backend for an app's tests | (the grist tests' own fake)                    |

All namespaces are stubs until their stories land.

## Develop

```bash
npm ci --no-audit --no-fund && npm run lint && npm run typecheck && npm test && npm run build
```

See [CLAUDE.md](CLAUDE.md) for conventions. MIT licensed.
