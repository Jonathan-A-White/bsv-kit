# @bsv-kit/tips

A list of one-time tips and which one to show now. A tip is shown until the user dismisses it, then never
again; the dismissals are kept through a storage the app injects. No UI and no DOM: the app draws the tip
and calls `dismiss` when the user has seen it. It imports nothing from bsv or grist.

## Install

From the repo's tag (there is no registry; `prepare` builds the libraries on install). The repo's
[README](../../README.md#install) has the pinned-commit form and the npm 11 `allowScripts` note.

```bash
npm install github:Jonathan-A-White/bsv-kit#v0.2.0
```

## Use

```ts
import { tips } from 'bsv-kit/tips';

// The app draws the tip however it likes; this one just logs it.
function show(text: string, opts: { onClose: () => Promise<void> }): void {
  console.log(text);
  void opts.onClose();
}

const t = tips.createTips({
  tips: [
    { id: 'long-press', text: 'Long-press a word to hear it.', event: 'reader-opened' },
    { id: 'export', text: 'Export keeps a copy of your words.', event: 'list-opened' },
  ],
  storage: localStorage,          // any { getItem, setItem }, sync or async
  key: 'myapp:tips',              // optional: the storage key for the dismissed ids
});

const tip = await t.nextTip('reader-opened'); // the first tip of that event not yet dismissed, or null
if (tip) show(tip.text, { onClose: () => t.dismiss(tip.id) }); // dismissed for good
```

## API

- `nextTip(event)`: the first tip of `event`, in list order, that is not dismissed; `null` when there is none.
  It keeps answering with the same tip until it is dismissed.
- `dismiss(id)`: dismiss for good (twice changes nothing). An id not in the list is a `TipsError`.
- `isDismissed(id)`, `reset(id)`, `resetAll()`.
- `createTips` throws `TipsError` for a list with an empty id, text or event, or a duplicate id. Stored data it
  cannot read counts as nothing dismissed.
- The storage keeps one JSON array of dismissed ids under `key` (default `bsv-kit:tips:dismissed`). Give each
  list its own `key` when two share a storage.
