import { describe, expect, it } from 'vitest';
import { tips } from '../src/index.js';

/** A fake storage: a map behind the getItem / setItem pair, sync like localStorage. */
function fakeStorage(initial: Record<string, string> = {}): tips.TipStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

const LIST: tips.Tip[] = [
  { id: 'long-press', text: 'Long-press a word to hear it.', event: 'reader-opened' },
  { id: 'swipe', text: 'Swipe to turn the page.', event: 'reader-opened' },
  { id: 'export', text: 'Export keeps a copy of your words.', event: 'list-opened' },
];

describe('tips.createTips', () => {
  it('shows a tip once, then never again after it is dismissed', async () => {
    const storage = fakeStorage();
    const t = tips.createTips({ tips: [LIST[0]], storage });

    expect(await t.nextTip('reader-opened')).toEqual(LIST[0]);
    expect(await t.nextTip('reader-opened')).toEqual(LIST[0]); // not dismissed: still the one to show

    await t.dismiss('long-press');
    expect(await t.nextTip('reader-opened')).toBeNull();
    expect(await t.nextTip('reader-opened')).toBeNull();
  });

  it('keeps a dismissal through the storage, so a new instance (a reload) still does not show it', async () => {
    const storage = fakeStorage();
    await tips.createTips({ tips: LIST, storage }).dismiss('long-press');

    const reloaded = tips.createTips({ tips: LIST, storage });
    expect(await reloaded.isDismissed('long-press')).toBe(true);
    expect(await reloaded.nextTip('reader-opened')).toEqual(LIST[1]);
  });

  it('shows only the tips of the event, in list order', async () => {
    const t = tips.createTips({ tips: LIST, storage: fakeStorage() });
    expect(await t.nextTip('list-opened')).toEqual(LIST[2]);
    expect(await t.nextTip('reader-opened')).toEqual(LIST[0]);
    await t.dismiss('long-press');
    expect(await t.nextTip('reader-opened')).toEqual(LIST[1]);
    await t.dismiss('swipe');
    expect(await t.nextTip('reader-opened')).toBeNull();
    expect(await t.nextTip('list-opened')).toEqual(LIST[2]); // another event's tip is untouched
  });

  it('returns null for an event no tip names', async () => {
    const t = tips.createTips({ tips: LIST, storage: fakeStorage() });
    expect(await t.nextTip('never')).toBeNull();
  });

  it('dismissing twice stores the id once', async () => {
    const storage = fakeStorage();
    const t = tips.createTips({ tips: LIST, storage });
    await t.dismiss('swipe');
    await t.dismiss('swipe');
    const stored = [...storage.data.values()].map((v) => JSON.parse(v) as unknown);
    expect(stored).toEqual([['swipe']]);
  });

  it('refuses to dismiss an id that is not in the list', async () => {
    const t = tips.createTips({ tips: LIST, storage: fakeStorage() });
    await expect(t.dismiss('typo')).rejects.toBeInstanceOf(tips.TipsError);
  });

  it('works with an async storage', async () => {
    const data = new Map<string, string>();
    const storage: tips.TipStorage = {
      getItem: async (key) => data.get(key) ?? null,
      setItem: async (key, value) => {
        data.set(key, value);
      },
    };
    const t = tips.createTips({ tips: LIST, storage });
    await t.dismiss('long-press');
    expect(await t.nextTip('reader-opened')).toEqual(LIST[1]);
  });

  it('treats unreadable stored data as nothing dismissed', async () => {
    for (const bad of ['not json', '{"a":1}', '[1,2]', 'null']) {
      const storage = fakeStorage({ 'bsv-kit:tips:dismissed': bad });
      const t = tips.createTips({ tips: LIST, storage });
      expect(await t.nextTip('reader-opened')).toEqual(LIST[0]);
    }
  });

  it('keeps separate lists apart by storage key', async () => {
    const storage = fakeStorage();
    const a = tips.createTips({ tips: LIST, storage, key: 'app-a' });
    const b = tips.createTips({ tips: LIST, storage, key: 'app-b' });
    await a.dismiss('long-press');
    expect(await b.isDismissed('long-press')).toBe(false);
    expect(await a.isDismissed('long-press')).toBe(true);
  });

  it('forgets a dismissal with reset(id) and all of them with resetAll()', async () => {
    const t = tips.createTips({ tips: LIST, storage: fakeStorage() });
    await t.dismiss('long-press');
    await t.dismiss('swipe');
    await t.reset('long-press');
    expect(await t.nextTip('reader-opened')).toEqual(LIST[0]);
    expect(await t.isDismissed('swipe')).toBe(true);
    await t.resetAll();
    expect(await t.isDismissed('swipe')).toBe(false);
  });

  it('rejects a bad list: a duplicate id, an empty id, text or event', () => {
    const storage = fakeStorage();
    expect(() => tips.createTips({ tips: [LIST[0], { ...LIST[1], id: 'long-press' }], storage })).toThrow(tips.TipsError);
    expect(() => tips.createTips({ tips: [{ ...LIST[0], id: '' }], storage })).toThrow(tips.TipsError);
    expect(() => tips.createTips({ tips: [{ ...LIST[0], text: ' ' }], storage })).toThrow(tips.TipsError);
    expect(() => tips.createTips({ tips: [{ ...LIST[0], event: '' }], storage })).toThrow(tips.TipsError);
  });

  it('is not changed by the caller editing its list afterwards', async () => {
    const list = [...LIST];
    const t = tips.createTips({ tips: list, storage: fakeStorage() });
    list.length = 0;
    expect(await t.nextTip('reader-opened')).toEqual(LIST[0]);
  });
});
