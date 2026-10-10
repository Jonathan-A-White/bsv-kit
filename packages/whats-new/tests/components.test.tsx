// @vitest-environment jsdom
// The What's new sheet shows once after an update and never on a first install; the list shows every version; the
// Check for updates button says Checking… then Up to date (or the app's own Update ready); the banner's summary opens the sheet.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  CheckForUpdates,
  UpdateSummary,
  WhatsNewList,
  WhatsNewSheet,
  useChangelog,
  type StorageLike,
  type UpdateRegistration,
} from '../src/index.js';
import { CHANGELOG } from './support/fixture.js';

const KEY = 'app.lastSeenVersion';

function fakeStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

afterEach(cleanup);

// compile-time: a real service worker registration is what CheckForUpdates takes
export const realRegistrationFits = (registration: ServiceWorkerRegistration): UpdateRegistration => registration;

describe('WhatsNewSheet', () => {
  it('shows nothing and remembers the version on a first install', () => {
    const storage = fakeStorage();
    render(<WhatsNewSheet entries={CHANGELOG} version="0.5.9" storageKey={KEY} storage={storage} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(storage.data[KEY]).toBe('0.5.9');
  });

  it('remembers the version on a first install even before the changelog has arrived', () => {
    const storage = fakeStorage();
    const { rerender } = render(<WhatsNewSheet entries={null} version="0.5.9" storageKey={KEY} storage={storage} />);
    expect(storage.data[KEY]).toBe('0.5.9');
    rerender(<WhatsNewSheet entries={CHANGELOG} version="0.5.9" storageKey={KEY} storage={storage} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows once after the app starts on a newer version, listing every version since the last one seen', () => {
    const storage = fakeStorage({ [KEY]: '0.5.6' });
    render(<WhatsNewSheet entries={CHANGELOG} version="0.5.9" storageKey={KEY} storage={storage} />);
    const dialog = screen.getByRole('dialog', { name: "What's new" });
    const versions = within(dialog).getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(versions).toEqual(['0.5.9', '0.5.8', '0.5.7']);
    expect(within(dialog).queryByText('The first version with a changelog.')).toBeNull();
    expect(within(dialog).getByText('2026-10-09')).toBeTruthy();
    // not stored until the sheet is closed: the app being killed with it open shows it again
    expect(storage.data[KEY]).toBe('0.5.6');
  });

  it('lists New lines before Fixed within a version', () => {
    render(<WhatsNewSheet entries={CHANGELOG} version="0.5.9" storageKey={KEY} storage={fakeStorage({ [KEY]: '0.5.8' })} />);
    const lines = within(screen.getByRole('dialog')).getAllByRole('listitem').map((li) => li.textContent);
    expect(lines).toEqual([
      'NewPin a message to the top.',
      'FixedThe list no longer jumps when a message arrives.',
      'FixedPhotos keep their turn.',
    ]);
  });

  it('closing it stores the version, and it does not show again', () => {
    const storage = fakeStorage({ [KEY]: '0.5.8' });
    const first = render(<WhatsNewSheet entries={CHANGELOG} version="0.5.9" storageKey={KEY} storage={storage} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(storage.data[KEY]).toBe('0.5.9');
    first.unmount();
    render(<WhatsNewSheet entries={CHANGELOG} version="0.5.9" storageKey={KEY} storage={storage} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes on Escape too', () => {
    const storage = fakeStorage({ [KEY]: '0.5.8' });
    render(<WhatsNewSheet entries={CHANGELOG} version="0.5.9" storageKey={KEY} storage={storage} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(storage.data[KEY]).toBe('0.5.9');
  });

  it('shows nothing when the app has not moved on, or went back', () => {
    render(<WhatsNewSheet entries={CHANGELOG} version="0.5.9" storageKey={KEY} storage={fakeStorage({ [KEY]: '0.5.9' })} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    cleanup();
    const storage = fakeStorage({ [KEY]: '0.6.0' });
    render(<WhatsNewSheet entries={CHANGELOG} version="0.5.9" storageKey={KEY} storage={storage} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(storage.data[KEY]).toBe('0.6.0');
  });

  it('waits for the changelog, then shows', () => {
    const storage = fakeStorage({ [KEY]: '0.5.8' });
    const { rerender } = render(<WhatsNewSheet entries={null} version="0.5.9" storageKey={KEY} storage={storage} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(<WhatsNewSheet entries={CHANGELOG} version="0.5.9" storageKey={KEY} storage={storage} />);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('does not list a version newer than the running build', () => {
    render(<WhatsNewSheet entries={CHANGELOG} version="0.5.8" storageKey={KEY} storage={fakeStorage({ [KEY]: '0.5.6' })} />);
    const versions = within(screen.getByRole('dialog')).getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(versions).toEqual(['0.5.8', '0.5.7']);
  });

  it('records the version quietly when the changelog has no line since the last one seen', () => {
    const storage = fakeStorage({ [KEY]: '0.5.9' });
    render(<WhatsNewSheet entries={CHANGELOG} version="0.6.0" storageKey={KEY} storage={storage} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(storage.data[KEY]).toBe('0.6.0');
  });

  it('uses localStorage when no storage is given', () => {
    localStorage.clear();
    localStorage.setItem(KEY, '0.5.7');
    render(<WhatsNewSheet entries={CHANGELOG} version="0.5.9" storageKey={KEY} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(localStorage.getItem(KEY)).toBe('0.5.9');
  });

  it('keeps working when storage throws', () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    render(<WhatsNewSheet entries={CHANGELOG} version="0.5.9" storageKey={KEY} storage={broken} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('can be opened by the app, from the banner, listing the versions after the one running', () => {
    const onClose = vi.fn();
    const storage = fakeStorage({ [KEY]: '0.5.9' });
    render(<WhatsNewSheet entries={CHANGELOG} version="0.5.7" storageKey={KEY} storage={storage} open since="0.5.7" onClose={onClose} />);
    const versions = within(screen.getByRole('dialog')).getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(versions).toEqual(['0.5.9', '0.5.8']);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(storage.data[KEY]).toBe('0.5.9');
  });

  it('says nothing when the app does not open it', () => {
    render(<WhatsNewSheet entries={CHANGELOG} version="0.5.7" storageKey={KEY} storage={fakeStorage({ [KEY]: '0.5.7' })} open={false} since="0.5.7" />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('takes its words from the app', () => {
    render(
      <WhatsNewSheet
        entries={CHANGELOG}
        version="0.5.9"
        storageKey={KEY}
        storage={fakeStorage({ [KEY]: '0.5.8' })}
        labels={{ title: 'Nouveautés', close: 'Fermer', new: 'Nouveau', fixed: 'Corrigé' }}
      />,
    );
    expect(screen.getByRole('dialog', { name: 'Nouveautés' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fermer' })).toBeTruthy();
    expect(screen.getAllByText('Corrigé', { selector: '.bk-whats-new__kind--fixed' })).toHaveLength(2);
  });
});

describe('WhatsNewList', () => {
  it('renders every version with its date and its lines', () => {
    render(<WhatsNewList entries={CHANGELOG} />);
    const versions = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(versions).toEqual(['0.5.9', '0.5.8', '0.5.7', '0.5.6']);
    expect(screen.getByText('2026-09-28')).toBeTruthy();
    for (const e of CHANGELOG) expect(screen.getByText(e.text)).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(CHANGELOG.length);
  });

  it('says so when there is no changelog', () => {
    render(<WhatsNewList entries={[]} />);
    expect(screen.getByText('No changes listed yet.')).toBeTruthy();
    cleanup();
    render(<WhatsNewList entries={null} />);
    expect(screen.getByText('No changes listed yet.')).toBeTruthy();
  });
});

describe('UpdateSummary', () => {
  it("shows the banner's summary, and What's new opens the sheet", () => {
    const onOpen = vi.fn();
    render(<UpdateSummary entries={CHANGELOG} since="0.5.8" onOpen={onOpen} />);
    expect(screen.getByText('0.5.9 · 1 new, 2 fixed ·', { exact: false })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: "What's new" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('shows nothing when there is nothing after the running version', () => {
    const { container } = render(<UpdateSummary entries={CHANGELOG} since="0.5.9" onOpen={() => {}} />);
    expect(container.textContent).toBe('');
  });
});

/** A registration whose update() the test settles by hand. */
function fakeRegistration(waiting: unknown = null) {
  let finish: () => void = () => {};
  let fail: (e: Error) => void = () => {};
  const reg = {
    waiting,
    installing: null,
    update: vi.fn(
      () =>
        new Promise<void>((resolve, reject) => {
          finish = resolve;
          fail = reject;
        }),
    ),
  };
  return { reg: reg as unknown as UpdateRegistration & { waiting: unknown }, finish: () => finish(), fail: (e: Error) => fail(e), update: reg.update };
}

describe('CheckForUpdates', () => {
  it('says Checking… while it asks, then Up to date', async () => {
    const { reg, finish, update } = fakeRegistration();
    render(<CheckForUpdates registration={reg} />);
    const button = screen.getByRole('button', { name: 'Check for updates' });
    fireEvent.click(button);
    expect(update).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Checking…' })).toHaveProperty('disabled', true);
    await act(async () => finish());
    expect(await screen.findByText('Up to date')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Check for updates' })).toBeTruthy();
  });

  it("shows the app's own Update ready when the check finds a waiting build", async () => {
    const onUpdateReady = vi.fn();
    const { reg, finish } = fakeRegistration({});
    render(<CheckForUpdates registration={reg} updateReady={<button>Update ready: restart</button>} onUpdateReady={onUpdateReady} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check for updates' }));
    await act(async () => finish());
    expect(await screen.findByRole('button', { name: 'Update ready: restart' })).toBeTruthy();
    expect(screen.queryByText('Up to date')).toBeNull();
    expect(onUpdateReady).toHaveBeenCalledTimes(1);
  });

  it('waits for a build that is installing, then reports it ready', async () => {
    const listeners: Array<() => void> = [];
    const worker = { state: 'installing', addEventListener: (_: string, fn: () => void) => listeners.push(fn), removeEventListener: () => {} };
    const reg = {
      waiting: null as unknown,
      installing: worker as unknown,
      update: vi.fn(async () => {}),
    };
    render(<CheckForUpdates registration={reg as unknown as UpdateRegistration} updateReady={<span>Update ready</span>} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check for updates' }));
    await waitFor(() => expect(listeners.length).toBe(1));
    expect(screen.getByRole('button', { name: 'Checking…' })).toBeTruthy();
    worker.state = 'installed';
    reg.waiting = worker;
    reg.installing = null;
    await act(async () => listeners[0]());
    expect(await screen.findByText('Update ready')).toBeTruthy();
  });

  it('says it could not check when the check fails, and lets him try again', async () => {
    const { reg, fail } = fakeRegistration();
    render(<CheckForUpdates registration={reg} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check for updates' }));
    await act(async () => fail(new Error('offline')));
    expect(await screen.findByText("Couldn't check")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Check for updates' })).toHaveProperty('disabled', false);
  });

  it('finds the registration itself when the app gives none', async () => {
    const reg = fakeRegistration();
    const getRegistration = vi.fn(async () => reg.reg);
    Object.defineProperty(navigator, 'serviceWorker', { value: { getRegistration }, configurable: true });
    try {
      render(<CheckForUpdates />);
      fireEvent.click(screen.getByRole('button', { name: 'Check for updates' }));
      await waitFor(() => expect(reg.update).toHaveBeenCalled());
      await act(async () => reg.finish());
      expect(await screen.findByText('Up to date')).toBeTruthy();
    } finally {
      delete (navigator as unknown as Record<string, unknown>).serviceWorker;
    }
  });

  it('does not say Up to date when there is no service worker: nothing was checked', async () => {
    const getRegistration = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'serviceWorker', { value: { getRegistration }, configurable: true });
    try {
      render(<CheckForUpdates />);
      fireEvent.click(screen.getByRole('button', { name: 'Check for updates' }));
      expect(await screen.findByText('Updates are not checked here')).toBeTruthy();
      expect(screen.queryByText('Up to date')).toBeNull();
      expect(screen.getByRole('button', { name: 'Check for updates' })).toHaveProperty('disabled', false);
      cleanup();
      delete (navigator as unknown as Record<string, unknown>).serviceWorker; // a browser with no service workers at all
      render(<CheckForUpdates />);
      fireEvent.click(screen.getByRole('button', { name: 'Check for updates' }));
      expect(await screen.findByText('Updates are not checked here')).toBeTruthy();
      expect(screen.queryByText('Up to date')).toBeNull();
    } finally {
      delete (navigator as unknown as Record<string, unknown>).serviceWorker;
    }
  });

  it('does not say Up to date when the app gave a registration of null', async () => {
    render(<CheckForUpdates registration={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check for updates' }));
    expect(await screen.findByText('Updates are not checked here')).toBeTruthy();
    expect(screen.queryByText('Up to date')).toBeNull();
  });

  describe('offline', () => {
    const setOnLine = (value: boolean) => Object.defineProperty(navigator, 'onLine', { value, configurable: true });
    afterEach(() => delete (navigator as unknown as Record<string, unknown>).onLine);

    it("says it could not check when the phone is offline, though update() resolves, and lets him try again", async () => {
      setOnLine(false);
      const reg = { waiting: null, installing: null, update: vi.fn(async () => {}) } as unknown as UpdateRegistration;
      render(<CheckForUpdates registration={reg} />);
      fireEvent.click(screen.getByRole('button', { name: 'Check for updates' }));
      expect(await screen.findByText("Couldn't check")).toBeTruthy();
      expect(screen.queryByText('Up to date')).toBeNull();
      expect(screen.getByRole('button', { name: 'Check for updates' })).toHaveProperty('disabled', false);
    });

    it('checks again once he is back online', async () => {
      setOnLine(false);
      const reg = { waiting: null, installing: null, update: vi.fn(async () => {}) } as unknown as UpdateRegistration;
      render(<CheckForUpdates registration={reg} />);
      fireEvent.click(screen.getByRole('button', { name: 'Check for updates' }));
      expect(await screen.findByText("Couldn't check")).toBeTruthy();
      setOnLine(true);
      fireEvent.click(screen.getByRole('button', { name: 'Check for updates' }));
      expect(await screen.findByText('Up to date')).toBeTruthy();
      expect(screen.queryByText("Couldn't check")).toBeNull();
    });
  });

  describe('asking the server', () => {
    const regAt = (waiting: unknown = null) =>
      ({ waiting, installing: null, active: { scriptURL: 'https://app.example/sw.js' }, update: vi.fn(async () => {}) }) as unknown as UpdateRegistration;

    it("says could not check when the worker's script cannot be fetched, though update() resolves", async () => {
      const fetchFn = vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      });
      render(<CheckForUpdates registration={regAt()} fetch={fetchFn as unknown as typeof fetch} />);
      fireEvent.click(screen.getByRole('button', { name: 'Check for updates' }));
      expect(await screen.findByText("Couldn't check")).toBeTruthy();
      expect(screen.queryByText('Up to date')).toBeNull();
      expect(fetchFn).toHaveBeenCalledWith('https://app.example/sw.js', { cache: 'no-store' });
    });

    it('says could not check when the server answers with an error', async () => {
      const fetchFn = vi.fn(async () => ({ ok: false, status: 503 }) as Response);
      render(<CheckForUpdates registration={regAt()} fetch={fetchFn as unknown as typeof fetch} />);
      fireEvent.click(screen.getByRole('button', { name: 'Check for updates' }));
      expect(await screen.findByText("Couldn't check")).toBeTruthy();
    });

    it('says Up to date when the server answered and nothing is waiting', async () => {
      const fetchFn = vi.fn(async () => ({ ok: true, status: 200 }) as Response);
      render(<CheckForUpdates registration={regAt()} fetch={fetchFn as unknown as typeof fetch} />);
      fireEvent.click(screen.getByRole('button', { name: 'Check for updates' }));
      expect(await screen.findByText('Up to date')).toBeTruthy();
    });

    it('still reports a waiting build when the server cannot be reached now', async () => {
      const fetchFn = vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      });
      render(<CheckForUpdates registration={regAt({})} fetch={fetchFn as unknown as typeof fetch} updateReady={<span>Update ready</span>} />);
      fireEvent.click(screen.getByRole('button', { name: 'Check for updates' }));
      expect(await screen.findByText('Update ready')).toBeTruthy();
    });
  });

  it('takes its words from the app', async () => {
    const { reg, finish } = fakeRegistration();
    render(<CheckForUpdates registration={reg} labels={{ check: 'Rechercher', checking: 'Recherche…', upToDate: 'À jour' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }));
    expect(screen.getByRole('button', { name: 'Recherche…' })).toBeTruthy();
    await act(async () => finish());
    expect(await screen.findByText('À jour')).toBeTruthy();
  });
});

describe('useChangelog', () => {
  beforeEach(() => vi.restoreAllMocks());

  function Probe({ fetchFn }: { fetchFn: typeof fetch }) {
    const entries = useChangelog('/app/', fetchFn);
    return <p>{entries === null ? 'loading' : `${entries.length} lines`}</p>;
  }

  it('is null while it loads, then the entries', async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, status: 200, json: async () => CHANGELOG }) as Response);
    render(<Probe fetchFn={fetchFn as unknown as typeof fetch} />);
    expect(screen.getByText('loading')).toBeTruthy();
    expect(await screen.findByText('7 lines')).toBeTruthy();
    expect(fetchFn).toHaveBeenCalledWith('/app/changelog.json', { cache: 'no-store' });
  });

  it('stays null when the file cannot be read', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('offline');
    });
    render(<Probe fetchFn={fetchFn as unknown as typeof fetch} />);
    await act(async () => {});
    expect(screen.getByText('loading')).toBeTruthy();
  });
});
