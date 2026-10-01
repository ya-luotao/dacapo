// The page's side of the offline worker (docs/OFFLINE.md): registering it, what Settings shows of
// it, and "Store everything". The page never touches the stores: it asks the worker in charge,
// which may be another build's than its own, what is stored, and to store files of its list.
// Nothing here can break the page: without a worker, or with one that does not answer, the state
// is "not stored" and nothing else happens.

import { readPref, writePref } from '../lib/localPrefs.ts';
import { currentShell } from '../lib/shell.ts';
import { OFFLINE_GROUPS, PAGE, type OfflineGroup } from './files.ts';
import {
  isOfflineStatus,
  isStoreReply,
  type OfflineRequest,
  type OfflineStatus,
} from './messages.ts';

/** `unsupported`: no worker here (the browser has none or refuses it; a development build). */
export type OfflineState = 'unsupported' | 'pending' | 'stored';

export interface OfflineSnapshot {
  state: OfflineState;
  /** The list beyond the app (the engraver, the piano, …), once the worker has said. */
  rest: { bytes: number; total: number; missing: number } | null;
  /** "Store everything" at work: files done, of the files it stores. */
  progress: { done: number; total: number } | null;
}

export interface OfflineClientOptions {
  supported: boolean;
  /** The worker's scope: absolute, ending in `/`. */
  scope: string;
  /** Asks the worker in charge. Null when there is none or it does not answer. */
  ask: (message: OfflineRequest) => Promise<unknown>;
  /** The addresses the page has fetched so far. */
  loaded: () => Iterable<string>;
  /** Whether "Store everything" was ever chosen on this device. */
  everything: { read: () => boolean; write: () => void };
}

export interface OfflineClient {
  getSnapshot: () => OfflineSnapshot;
  subscribe: (onChange: () => void) => () => void;
  /** Asks the worker what is stored. */
  refresh: () => Promise<void>;
  /** After the worker took charge: stores, without a word, what the rules below want stored. */
  settle: () => Promise<void>;
  /** Stores the whole list. Resolves with the groups that have a file that could not be stored. */
  storeEverything: () => Promise<OfflineGroup[]>;
  /** The browser refused the worker. */
  refuse: () => void;
}

/** Files asked for at once. */
const PARALLEL = 4;

/**
 * What is stored without being asked for, once a worker is in charge:
 * - whatever is missing of the app (a store the browser emptied fills up again);
 * - what the page fetched before the worker could keep it: on the first visit the dictionary in
 *   use, a lesson's pictures, the engraver if a piece was opened ("stored when first fetched");
 * - everything, where "Store everything" was chosen: a release renames files, and the choice holds.
 */
export function filesToStore(
  status: OfflineStatus,
  scope: string,
  loaded: ReadonlySet<string>,
  everything: boolean,
): string[] {
  return [
    ...status.app.missing,
    ...status.rest.missing
      .filter(({ file }) => everything || loaded.has(scope + file))
      .map(({ file }) => file),
  ];
}

export function createOfflineClient(options: OfflineClientOptions): OfflineClient {
  let supported = options.supported;
  let snapshot: OfflineSnapshot = {
    state: supported ? 'pending' : 'unsupported',
    rest: null,
    progress: null,
  };
  let settling = false;
  let storing = false;
  const listeners = new Set<() => void>();

  function set(next: Partial<OfflineSnapshot>) {
    snapshot = { ...snapshot, ...next };
    for (const listener of [...listeners]) listener();
  }

  async function readStatus(): Promise<OfflineStatus | null> {
    if (!supported) return null;
    const reply = await options.ask({ type: 'status' }).catch(() => null);
    return isOfflineStatus(reply) ? reply : null;
  }

  function show(status: OfflineStatus | null) {
    if (!supported) return;
    if (!status) {
      set({ state: 'pending', rest: null });
      return;
    }
    const { bytes, total, missing } = status.rest;
    set({
      state: status.app.missing.length === 0 ? 'stored' : 'pending',
      rest: { bytes, total, missing: missing.length },
    });
  }

  /** Asks the worker for each file, a few at a time. Resolves with those it could not store. */
  async function store(files: readonly string[], onDone?: (done: number) => void) {
    const queue = files.filter((file) => file !== PAGE);
    const failed: string[] = [];
    let done = 0;
    const one = async (file: string) => {
      const reply = await options.ask({ type: 'store', file }).catch(() => null);
      if (!isStoreReply(reply) || !reply.ok) failed.push(file);
      onDone?.(++done);
    };
    const run = async () => {
      for (let file = queue.shift(); file !== undefined; file = queue.shift()) await one(file);
    };
    await Promise.all(Array.from({ length: PARALLEL }, run));
    // The page after everything else: the worker takes it only once the app's files are there.
    if (files.includes(PAGE)) await one(PAGE);
    return failed;
  }

  async function refresh() {
    show(await readStatus());
  }

  async function settle() {
    const status = await readStatus();
    show(status);
    if (!status || settling) return;
    const loaded = new Set(options.loaded());
    const files = filesToStore(status, options.scope, loaded, options.everything.read());
    if (files.length === 0) return;
    settling = true;
    try {
      await store(files);
    } finally {
      settling = false;
    }
    await refresh();
  }

  async function storeEverything(): Promise<OfflineGroup[]> {
    if (storing) return [];
    storing = true;
    try {
      const status = await readStatus();
      show(status);
      if (!status) return [];
      // Kept before the first file: what fails now is fetched at a later visit.
      options.everything.write();
      const groups = new Map(status.rest.missing.map(({ file, group }) => [file, group]));
      const files = [...status.app.missing, ...groups.keys()];
      set({ progress: { done: 0, total: files.length } });
      const failed = await store(files, (done) => set({ progress: { done, total: files.length } }));
      await refresh();
      const missed = new Set(failed.map((file) => groups.get(file) ?? 'app'));
      return OFFLINE_GROUPS.filter((group) => missed.has(group));
    } finally {
      storing = false;
      if (snapshot.progress) set({ progress: null });
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(onChange) {
      listeners.add(onChange);
      return () => void listeners.delete(onChange);
    },
    refresh,
    settle,
    storeEverything,
    refuse() {
      supported = false;
      set({ state: 'unsupported', rest: null });
    },
  };
}

/**
 * How long the worker has to answer. Storing a file may take long (the engraver's 7 MB over a
 * slow line); saying what is stored takes no time, and a worker that says nothing (the
 * withdrawal worker has no ear for messages) is given up on soon.
 */
const ANSWER_WAIT = { status: 10_000, store: 120_000 } as const;
const EVERYTHING_KEY = 'dacapo.offline.everything';

/** The web app in a production build, in a browser with service workers. Never the Apple app. */
function workerSupported(): boolean {
  return (
    import.meta.env.PROD &&
    currentShell() === 'web' &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator
  );
}

function askWorker(message: OfflineRequest): Promise<unknown> {
  return new Promise((resolve) => {
    const none = () => resolve(null);
    try {
      navigator.serviceWorker.getRegistration().then((registration) => {
        const worker = registration?.active;
        if (!worker) return none();
        const channel = new MessageChannel();
        const timer = setTimeout(none, ANSWER_WAIT[message.type]);
        channel.port1.onmessage = (event) => {
          clearTimeout(timer);
          resolve(event.data);
        };
        worker.postMessage(message, [channel.port2]);
      }, none);
    } catch {
      none();
    }
  });
}

export const offline = createOfflineClient({
  supported: workerSupported(),
  scope: typeof document === 'undefined' ? '' : new URL('./', document.baseURI).href,
  ask: askWorker,
  loaded: () => performance.getEntriesByType('resource').map((entry) => entry.name),
  everything: {
    read: () => readPref(EVERYTHING_KEY) === '1',
    write: () => writePref(EVERYTHING_KEY, '1'),
  },
});

/**
 * Registers the worker: the web app only, in a production build, once the page has loaded, so
 * that storing the app never competes with showing it. A build below a sub-path registers it
 * there (the address and the scope are relative to the page). A browser that refuses is left as
 * it is: the page works as it does without a worker.
 */
export function registerOffline(): void {
  if (!workerSupported()) return;
  const start = () => {
    try {
      const container = navigator.serviceWorker;
      // A worker took charge: the first one, or a release's.
      container.addEventListener('controllerchange', () => void offline.settle());
      container.register('sw.js', { scope: './' }).then(
        () => void offline.settle(),
        () => offline.refuse(),
      );
    } catch {
      offline.refuse();
    }
  };
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}
