// What the offline worker does (docs/OFFLINE.md): storing a build's files and answering requests
// from them. The stores and the network are handed in, so all of it runs in the unit tests; sw.ts
// only connects it to the worker's events. It has no logic that belongs to one build: it answers
// by address, and the list it is given says which addresses are the build's.

import { PAGE, type OfflineGroup, type OfflineList } from './files.ts';
import { isOfflineRequest, type OfflineStatus, type StoreReply } from './messages.ts';
import { pageBelongs, route } from './route.ts';
import {
  latestStore,
  nextStore,
  obsoleteStores,
  otherStores,
  storeOf,
  storePrefix,
} from './stores.ts';

/** The parts of a `Cache` the worker uses. */
export interface Store {
  match: (url: string, options?: { ignoreVary?: boolean }) => Promise<Response | undefined>;
  put: (url: string, response: Response) => Promise<void>;
  keys: () => Promise<readonly { url: string }[]>;
}

/** The parts of `CacheStorage` the worker uses. */
export interface Stores {
  open: (name: string) => Promise<Store>;
  keys: () => Promise<string[]>;
  delete: (name: string) => Promise<boolean>;
}

export interface OfflineWorkerOptions {
  /** The worker's scope: absolute, ending in `/`. */
  scope: string;
  list: OfflineList;
  stores: Stores;
  fetch: (input: Request | string, init?: { cache?: RequestCache }) => Promise<Response>;
  wait?: (ms: number) => Promise<void>;
}

export interface OfflineWorker {
  /** Stores the app's files. Rejects when one of them could not be stored: nothing changes then. */
  install: () => Promise<void>;
  /** Deletes the stores no open tab can need any more. */
  activate: () => Promise<void>;
  /**
   * The answer to a request, or null to leave it to the browser. `keepAlive` holds the worker
   * until work that outlasts the answer (storing a copy) is done.
   */
  answer: (
    request: Request,
    keepAlive: (work: Promise<unknown>) => void,
  ) => Promise<Response> | null;
  /** The reply to a message from the page, or null for one that is not understood. */
  message: (data: unknown) => Promise<OfflineStatus | StoreReply | null>;
}

/** How long a navigation waits for the network before the stored page is shown. */
export const PAGE_WAIT = 3000;
/**
 * How long work behind an answer (renewing a copy, storing one) may hold the worker. A request
 * that is accepted and never answered would otherwise hold it for good, and with it the release
 * that is waiting to take over.
 */
export const BEHIND_WAIT = 30_000;
/** Files fetched at once while installing. */
const PARALLEL = 6;
// A copy is found by its address alone, whatever headers the request or the stored answer has.
const MATCH = { ignoreVary: true } as const;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Runs `task` on every item, a few at a time. Stops at the first failure and rejects with it. */
async function inParallel<T>(items: readonly T[], task: (item: T) => Promise<void>) {
  const queue = [...items];
  const run = async () => {
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      try {
        await task(next);
      } catch (error) {
        queue.length = 0;
        throw error;
      }
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, run));
}

export function createOfflineWorker(options: OfflineWorkerOptions): OfflineWorker {
  const { scope, list, stores, fetch, wait = sleep } = options;
  const prefix = storePrefix(new URL(scope).pathname);
  const groups = new Map<string, OfflineGroup>(list.files.map(([path, group]) => [path, group]));
  const listed = (path: string) => groups.has(path);
  const address = (path: string) => scope + path;
  /** Named by its content: a copy of it never goes stale. */
  const hashed = (path: string) => path.startsWith('assets/');

  // The worker is stopped and started again at any time, so the name is looked up, not kept:
  // the latest store of this version, else a new one.
  let mine: Promise<string> | null = null;
  function storeName(): Promise<string> {
    mine ??= stores.keys().then(
      (names) => storeOf(names, prefix, list.version) ?? nextStore(names, prefix, list.version),
      (error: unknown) => {
        mine = null;
        throw error;
      },
    );
    return mine;
  }

  /**
   * Whether an answer may be stored as this file. Only a whole, plain answer: not an error, not
   * one that was redirected (the browser refuses such a copy for a page), and never a page where
   * a file was asked for (a host that answers every unknown address with the app).
   */
  function storable(path: string, response: Response): boolean {
    if (response.status !== 200 || response.redirected) return false;
    const html = (response.headers.get('content-type') ?? '').includes('text/html');
    return path === PAGE ? html : !html;
  }

  /** The copy of a file: this version's, else another store's (a file of the release before). */
  async function held(path: string): Promise<{ response: Response; mine: boolean } | null> {
    const name = await storeName();
    const own = await (await stores.open(name)).match(address(path), MATCH);
    if (own) return { response: own, mine: true };
    for (const other of otherStores(await stores.keys(), prefix, name)) {
      const older = await (await stores.open(other)).match(address(path), MATCH);
      if (older) return { response: older, mine: false };
    }
    return null;
  }

  async function keep(path: string, response: Response): Promise<void> {
    await (await stores.open(await storeName())).put(address(path), response);
  }

  /**
   * Fetches a file of the list in order to store it: the page, the manifest and the icons, which
   * keep their names from build to build, past the browser's own cache. Null when the answer is
   * not this build's file: an error, or the page of another build (while a release is being
   * deployed the server may already answer with the next one's, which is not stored beside this
   * build's files; its own worker is on its way).
   */
  async function fetchListed(path: string, cache: RequestCache): Promise<Response | null> {
    const response = await fetch(address(path), hashed(path) ? undefined : { cache });
    if (!storable(path, response)) return null;
    if (path === PAGE && !pageBelongs(await response.clone().text(), scope, listed)) return null;
    return response;
  }

  async function install(): Promise<void> {
    const names = await stores.keys();
    const existing = storeOf(names, prefix, list.version);
    // A fix to the worker alone has the same list: it takes up its store again. Otherwise a new
    // store, also for a version this device ran earlier, so that the order stays the order of
    // the releases here.
    const reuse = existing !== null && existing === latestStore(names, prefix);
    const name = reuse ? existing : nextStore(names, prefix, list.version);
    mine = Promise.resolve(name);
    try {
      const store = await stores.open(name);
      const older = await Promise.all(
        otherStores(names, prefix, name).map((other) => stores.open(other)),
      );
      const have = new Set((await store.keys()).map((request) => request.url));
      /** Copies a file from an older store, where one has it. */
      const carry = async (path: string): Promise<boolean> => {
        for (const from of older) {
          const copy = await from.match(address(path), MATCH);
          if (!copy) continue;
          await store.put(address(path), copy);
          return true;
        }
        return false;
      };

      const fetched = async (path: string) => {
        const response = await fetchListed(path, 'reload');
        if (!response) throw new Error(`${path || 'the page'} could not be stored`);
        await store.put(address(path), response);
      };
      await inParallel(
        list.files.filter(([path, group]) => group === 'app' && path !== PAGE),
        async ([path]) => {
          if (hashed(path) && (have.has(address(path)) || (await carry(path)))) return;
          await fetched(path);
        },
      );
      // What an older store holds of the rest (the engraver, the piano) comes along, so that it
      // does not go with that store. Not the app's: a failure here does not fail the install.
      await inParallel(
        list.files.filter(([, group]) => group !== 'app'),
        async ([path]) => {
          if (!have.has(address(path))) await carry(path).catch(() => false);
        },
      );
      // The page last: a store that holds it is a store whose install finished (see `activate`).
      await fetched(PAGE);
    } catch (error) {
      // Nothing half done is left behind; the browser installs again at the next visit.
      if (!reuse) {
        mine = null;
        await stores.delete(name).catch(() => false);
      }
      throw error;
    }
  }

  async function activate(): Promise<void> {
    const name = await storeName();
    const names = await stores.keys();
    // A store without the page was left by an install that was cut short.
    const complete = new Set<string>();
    for (const other of otherStores(names, prefix, name)) {
      if (await (await stores.open(other)).match(address(PAGE), MATCH)) complete.add(other);
    }
    const obsolete = obsoleteStores(names, prefix, name, complete);
    await Promise.all(obsolete.map((old) => stores.delete(old)));
  }

  async function renewPage(response: Response): Promise<void> {
    const copy = response.clone();
    if (pageBelongs(await response.text(), scope, listed)) await keep(PAGE, copy);
  }

  async function page(
    request: Request,
    keepAlive: (work: Promise<unknown>) => void,
  ): Promise<Response> {
    const network = fetch(request);
    keepAlive(
      network
        .then((response) => (storable(PAGE, response) ? renewPage(response.clone()) : undefined))
        .catch(() => {}),
    );
    const none = () => null;
    const first = await Promise.race([network.catch(none), wait(PAGE_WAIT).then(none)]);
    if (first) return first;
    // No network, or none in time: the copy stored. Without one, whatever the network does.
    return (await held(PAGE))?.response ?? network;
  }

  async function asset(
    request: Request,
    path: string,
    wanted: boolean,
    keepAlive: (work: Promise<unknown>) => void,
  ): Promise<Response> {
    const copy = await held(path);
    if (copy) {
      if (wanted && !copy.mine) keepAlive(keep(path, copy.response.clone()).catch(() => {}));
      return copy.response;
    }
    const response = await fetch(request);
    if (wanted && storable(path, response)) {
      keepAlive(keep(path, response.clone()).catch(() => {}));
    }
    return response;
  }

  async function file(
    request: Request,
    path: string,
    keepAlive: (work: Promise<unknown>) => void,
  ): Promise<Response> {
    const copy = await held(path);
    if (copy) {
      // Answered from the copy, which is renewed behind it for the next time.
      keepAlive(
        fetch(request)
          .then((response) => (storable(path, response) ? keep(path, response) : undefined))
          .catch(() => {}),
      );
      return copy.response;
    }
    const response = await fetch(request);
    if (storable(path, response)) keepAlive(keep(path, response.clone()).catch(() => {}));
    return response;
  }

  function answer(
    request: Request,
    keepAlive: (work: Promise<unknown>) => void,
  ): Promise<Response> | null {
    const decision = route(
      {
        url: request.url,
        method: request.method,
        mode: request.mode,
        range: request.headers.has('range'),
      },
      scope,
      listed,
    );
    if (decision.kind === 'pass') return null;
    // Whatever goes on behind the answer holds the worker for a bounded time only.
    const behind = (task: Promise<unknown>) =>
      keepAlive(Promise.race([task.catch(() => {}), wait(BEHIND_WAIT)]));
    const work =
      decision.kind === 'page'
        ? page(request, behind)
        : decision.kind === 'asset'
          ? asset(request, decision.path, decision.keep, behind)
          : file(request, decision.path, behind);
    // An error in here never becomes the answer: the network's does.
    return work.catch(() => fetch(request));
  }

  async function status(): Promise<OfflineStatus> {
    const store = await stores.open(await storeName());
    const have = new Set((await store.keys()).map((request) => request.url));
    const result: OfflineStatus = {
      version: list.version,
      app: { total: 0, missing: [] },
      rest: { total: 0, bytes: 0, missing: [] },
    };
    for (const [path, group, bytes] of list.files) {
      const stored = have.has(address(path));
      if (group === 'app') {
        result.app.total++;
        if (!stored) result.app.missing.push(path);
      } else {
        result.rest.total++;
        result.rest.bytes += bytes;
        if (!stored) result.rest.missing.push({ file: path, group });
      }
    }
    return result;
  }

  /** Stores one file of the list on request. False when it could not be fetched or kept. */
  async function store(path: string): Promise<boolean> {
    if (!listed(path)) return false;
    const copy = await held(path);
    if (copy?.mine) return true;
    if (copy && hashed(path)) {
      await keep(path, copy.response);
      return true;
    }
    // The page marks a store as whole: only once the rest of the app is there, as in `install`.
    if (path === PAGE && (await status()).app.missing.some((missing) => missing !== PAGE)) {
      return false;
    }
    const response = await fetchListed(path, 'no-cache');
    if (!response) return false;
    await keep(path, response);
    return true;
  }

  async function message(data: unknown): Promise<OfflineStatus | StoreReply | null> {
    if (!isOfflineRequest(data)) return null;
    if (data.type === 'status') return status();
    // No network, or no space left on the device: said, not thrown.
    return { ok: await store(data.file).catch(() => false) };
  }

  return { install, activate, answer, message };
}
