# @bsv-kit/whats-new

Every app's What's new, once. It reads the app's `changelog.json` and gives an app: the **summary** for its Update ready
banner (`0.5.9 · 1 new, 2 fixed · What's new`), a **sheet** shown once after an update, the **list** of versions for
Settings or About, a **Check for updates** button, and the **link** from the version to `CHANGELOG.md` on GitHub.
It needs React 18 or later (`react` and `react-dom`, peer dependencies) and imports nothing from bsv, grist, tips or
composer. It keeps one string in the page's `localStorage`, under a key the app names, and nothing else.

An app wires it in five lines:

```tsx
import { WhatsNewSheet, WhatsNewList, CheckForUpdates, useChangelog } from 'bsv-kit/whats-new';
import 'bsv-kit/whats-new/styles.css';

const entries = useChangelog(import.meta.env.BASE_URL);                                  // 1: read changelog.json
<WhatsNewSheet entries={entries} version={APP_VERSION} storageKey="myapp.lastSeenVersion" />  // 2: once after an update
<WhatsNewList entries={entries} />                                                       // 3: Settings / About
<CheckForUpdates updateReady={<UpdateReadyBanner />} />                                  // 4: the button
<a href={versionLink({ repo: 'me/myapp', public: true, version: APP_VERSION }) ?? '#'}>{APP_VERSION}</a> // 5: the version
```

`versionLink` comes from the same import. `APP_VERSION` is the app's own build version (its `package.json` version).

## changelog.json

An array, newest first, one entry per line of a version:

```json
[
  { "version": "0.5.9", "date": "2026-10-09", "story": "app-9b", "kind": "new", "text": "Pin a message to the top." },
  { "version": "0.5.9", "date": "2026-10-09", "story": "app-9a", "kind": "fixed", "text": "The list no longer jumps." }
]
```

`kind` is `"new"` or `"fixed"`; `story` is the app's own reference and is not shown. Entries that do not fit are
dropped. `useChangelog(baseUrl)` fetches `<baseUrl>/changelog.json` with `cache: 'no-store'`, so a waiting update's
list is the new build's, not the cached one. It is `null` while loading and if the file cannot be read: What's new
then hides, and the app carries on.

## What the app passes

| Piece | What it does |
| ----- | ------------ |
| `useChangelog(baseUrl, fetch?)` | The entries, or `null`. |
| `<WhatsNewSheet entries version storageKey>` | Shown once when the app starts on a `version` newer than the last one seen (kept under `storageKey`): every version since, newest first, **New** lines before **Fixed**. Closing it (the button, Escape, a tap outside) stores `version`. Never on a first install: the version is just remembered. `storage` swaps `localStorage` for another `{ getItem, setItem }`; `labels` replaces `title`, `close`, `new`, `fixed`, `empty`. |
| `<WhatsNewSheet open since onClose …>` | The app opens it itself, from the banner's What's new: the versions after `since` (the running version). Nothing is stored; `onClose` says when it is closed. |
| `<UpdateSummary entries since onOpen>` | The banner's line from a waiting build's changelog; `What's new` is a button calling `onOpen` (set `open` on the sheet). Nothing when no version is after `since`. `words` replaces `new`, `fixed`, `whatsNew`. |
| `<WhatsNewList entries>` | Every version, its date and its lines, for Settings or About. |
| `<CheckForUpdates>` | A button calling `registration.update()`. `registration` is optional: it asks `navigator.serviceWorker.getRegistration()`. Its states, each a `labels` key: **Checking…** (`checking`) while it asks; **Up to date** (`upToDate`) only when the server answered (it fetches the worker's script, `registration.active.scriptURL`, with `cache: 'no-store'`; `fetch` swaps the page's fetch) and nothing is waiting; `updateReady` (the app's own Update ready node, default label `updateReady`) when a build is waiting, and `onUpdateReady` is called; **Couldn't check** (`failed`) when the phone is offline (`navigator.onLine` false), the server cannot be reached or answers an error, or `update()` rejects; **Updates are not checked here** (`unavailable`) when there is no service worker to ask. After either of the last two the button is live again to try once more. `labels` replaces `check`, `checking`, `upToDate`, `updateReady`, `failed`, `unavailable`. |
| `summarise(entries, fromVersion)` | `{ version, newCount, fixedCount, text, bannerText }` for the versions after `fromVersion`, or `null`. A count of none is left out: `0.5.9 · 3 fixed`. |
| `versionLink({ repo, public, version })` | Public repo: `https://github.com/<repo>/blob/main/CHANGELOG.md#<anchor>`, where GitHub's anchor of `## 0.5.9` is `059`. Private repo: `null`, and the app opens the list. |
| `versionsSince`, `compareVersions`, `githubAnchor`, `fetchChangelog`, `parseChangelog` | The functions behind them. Versions compare by number: 0.5.10 is after 0.5.9. |

Opened from the banner, the sheet stores nothing, so after the update starts it shows once more for the versions
since the last one *stored*. That is right for a build that updated without anyone opening the banner's sheet.

## The look

Class names and CSS custom properties only: 44 px targets, a sheet that fits a 390 px screen, and dark and light
through `Canvas` and `CanvasText` (the page's `color-scheme`). `styles.css` (import it once) reads every colour and
size from a `--bk-whats-new-*` property with a default:

```css
:root {
  --bk-whats-new-accent: #0f766e;   /* the buttons */
  --bk-whats-new-surface: #fffdf7;  /* the sheet */
  --bk-whats-new-new: #166534;      /* the New tag */
  --bk-whats-new-fixed: #9a3412;    /* the Fixed tag */
}
```

The full list is at the top of `styles.css`. Or leave the file out and style the classes: `bk-whats-new`,
`__backdrop`, `__sheet`, `__title`, `__groups`, `__group`, `__version`, `__date`, `__lines`, `__line`, `__kind`
(`--new`, `--fixed`), `__text`, `__empty`, `__button`, `__close`, `__summary`, `__link`, `__check`, `__status`.
