// CheckForUpdates: a button that asks the service worker for a new build: 'Checking…', then 'Up to date' or the
// app's own Update ready (the node it passes as `updateReady`: its banner or button). 'Up to date' is said only when
// the server was reached and had nothing new: offline, an unreachable server or no service worker never say it.
import { useState, type ReactNode } from 'react';
import { DEFAULT_CHECK_LABELS, type CheckLabels } from './labels.js';

/** What a ServiceWorkerRegistration offers that the button uses; a real registration fits. */
export interface UpdateWorker {
  readonly state: string;
  addEventListener(type: 'statechange', listener: () => void): void;
  removeEventListener(type: 'statechange', listener: () => void): void;
}
export interface UpdateRegistration {
  update(): Promise<unknown>;
  readonly waiting?: unknown;
  /** The running worker; its `scriptURL` is fetched after update() to know the server was reached. */
  readonly active?: { readonly scriptURL?: string } | null;
  readonly installing?: UpdateWorker | null;
}

export interface CheckForUpdatesProps {
  /** The app's service worker registration. Default: navigator.serviceWorker.getRegistration(), asked when the button is pressed. */
  registration?: UpdateRegistration | null;
  /** Shown beside the button when a new build is waiting: the app's own Update ready. */
  updateReady?: ReactNode;
  /** Called when the check found a build waiting. */
  onUpdateReady?: () => void;
  labels?: Partial<CheckLabels>;
  className?: string;
  /** Used to reach the server after update(). Default: the page's fetch. */
  fetch?: typeof fetch;
}

type Phase = 'idle' | 'checking' | 'upToDate' | 'ready' | 'failed' | 'unavailable';

/** How long a build found while checking may take to install before the answer is given from what is waiting. */
const INSTALL_WAIT_MS = 30_000;

async function currentRegistration(): Promise<UpdateRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

/** Throws unless the server answers for the worker's script: update() resolves offline, so it proves nothing alone. */
async function reachServer(registration: UpdateRegistration, fetchFn: typeof fetch | undefined): Promise<void> {
  if (offline()) throw new Error('offline');
  const url = registration.active?.scriptURL;
  const get = fetchFn ?? (typeof fetch === 'function' ? fetch : undefined);
  if (!url || !get) return;
  const answer = await get(url, { cache: 'no-store' });
  if (!answer.ok) throw new Error(`server answered ${answer.status}`);
}

/** Resolves once a build that is installing has stopped installing (it is then waiting, or it failed). */
function installed(registration: UpdateRegistration): Promise<void> {
  const worker = registration.installing;
  if (!worker || worker.state !== 'installing') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      worker.removeEventListener('statechange', onChange);
      resolve();
    };
    const onChange = () => {
      if (worker.state !== 'installing') done();
    };
    const timer = setTimeout(done, INSTALL_WAIT_MS);
    worker.addEventListener('statechange', onChange);
  });
}

export function CheckForUpdates({ registration, updateReady, onUpdateReady, labels, className, fetch: fetchFn }: CheckForUpdatesProps) {
  const words = { ...DEFAULT_CHECK_LABELS, ...labels };
  const [phase, setPhase] = useState<Phase>('idle');

  const check = async () => {
    setPhase('checking');
    try {
      const reg = registration ?? (await currentRegistration());
      if (!reg) {
        setPhase('unavailable');
        return;
      }
      if (offline()) throw new Error('offline');
      await reg.update();
      await installed(reg);
      if (reg.waiting) {
        setPhase('ready');
        onUpdateReady?.();
      } else {
        await reachServer(reg, fetchFn);
        setPhase('upToDate');
      }
    } catch {
      setPhase('failed');
    }
  };

  return (
    <div className={className ? `bk-whats-new__check ${className}` : 'bk-whats-new__check'}>
      <button type="button" className="bk-whats-new__button" disabled={phase === 'checking'} onClick={check}>
        {phase === 'checking' ? words.checking : words.check}
      </button>
      <span className="bk-whats-new__status" role="status">
        {phase === 'upToDate' ? words.upToDate : null}
        {phase === 'failed' ? words.failed : null}
        {phase === 'unavailable' ? words.unavailable : null}
        {phase === 'ready' ? (updateReady ?? words.updateReady) : null}
      </span>
    </div>
  );
}
