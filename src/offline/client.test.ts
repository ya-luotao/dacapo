import { describe, expect, it } from 'vitest';
import { createOfflineClient, filesToStore, type OfflineSnapshot } from './client.ts';
import type { OfflineRequest, OfflineStatus } from './messages.ts';

const SCOPE = 'https://playdacapo.com/';

const STATUS: OfflineStatus = {
  version: '111111111111',
  app: { total: 3, missing: [] },
  rest: {
    total: 5,
    bytes: 12_686_558,
    missing: [
      { file: 'assets/verovio-VVVV.mjs', group: 'engraver' },
      { file: 'assets/ja-1111.js', group: 'languages' },
      { file: 'assets/ko-1111.js', group: 'languages' },
      { file: 'piano/A4-mf.mp3', group: 'piano' },
    ],
  },
};

/** A worker that stores what it is asked to, but for the files in `refused`. */
function fakeWorker(status: OfflineStatus | null, refused: string[] = []) {
  const state = { status: status && structuredClone(status), asked: [] as string[], silent: false };
  const ask = (message: OfflineRequest): Promise<unknown> => {
    if (state.silent || !state.status) return Promise.resolve(null);
    if (message.type === 'status') return Promise.resolve(structuredClone(state.status));
    state.asked.push(message.file);
    if (refused.includes(message.file)) return Promise.resolve({ ok: false });
    const { app, rest } = state.status;
    app.missing = app.missing.filter((file) => file !== message.file);
    rest.missing = rest.missing.filter(({ file }) => file !== message.file);
    return Promise.resolve({ ok: true });
  };
  return { state, ask };
}

function client(
  worker: ReturnType<typeof fakeWorker>,
  options: { supported?: boolean; loaded?: string[]; everything?: boolean } = {},
) {
  const pref = { on: options.everything ?? false };
  const offline = createOfflineClient({
    supported: options.supported ?? true,
    scope: SCOPE,
    ask: worker.ask,
    loaded: () => options.loaded ?? [],
    everything: { read: () => pref.on, write: () => (pref.on = true) },
  });
  const seen: OfflineSnapshot[] = [];
  offline.subscribe(() => seen.push(offline.getSnapshot()));
  return { offline, pref, seen };
}

describe('filesToStore', () => {
  it('nothing, when the app is stored and nothing else was fetched', () => {
    expect(filesToStore(STATUS, SCOPE, new Set(), false)).toEqual([]);
  });

  it('what the page fetched before the worker could keep it', () => {
    const loaded = new Set([
      `${SCOPE}assets/ja-1111.js`,
      `${SCOPE}assets/index-AAAA.js`,
      'https://api.playdacapo.com/v1/records',
    ]);
    expect(filesToStore(STATUS, SCOPE, loaded, false)).toEqual(['assets/ja-1111.js']);
  });

  it('whatever is missing of the app', () => {
    const status = { ...STATUS, app: { total: 3, missing: ['', 'assets/index-AAAA.js'] } };
    expect(filesToStore(status, SCOPE, new Set(), false)).toEqual(['', 'assets/index-AAAA.js']);
  });

  it('everything, where everything was asked for once', () => {
    expect(filesToStore(STATUS, SCOPE, new Set(), true)).toEqual([
      'assets/verovio-VVVV.mjs',
      'assets/ja-1111.js',
      'assets/ko-1111.js',
      'piano/A4-mf.mp3',
    ]);
  });

  it('below a sub-path', () => {
    const scope = 'https://example.org/dacapo/';
    const loaded = new Set([`${scope}piano/A4-mf.mp3`, 'https://example.org/assets/ja-1111.js']);
    expect(filesToStore(STATUS, scope, loaded, false)).toEqual(['piano/A4-mf.mp3']);
  });
});

describe('the state Settings shows', () => {
  it('unsupported, and nothing is asked, without service workers', async () => {
    const worker = fakeWorker(STATUS);
    const { offline } = client(worker, { supported: false });
    await offline.refresh();
    await offline.settle();
    expect(await offline.storeEverything()).toEqual([]);
    expect(offline.getSnapshot()).toEqual({ state: 'unsupported', rest: null, progress: null });
    expect(worker.state.asked).toEqual([]);
  });

  it('not stored yet, until a worker answers', async () => {
    const worker = fakeWorker(null);
    const { offline } = client(worker);
    expect(offline.getSnapshot().state).toBe('pending');
    await offline.refresh();
    expect(offline.getSnapshot()).toEqual({ state: 'pending', rest: null, progress: null });
  });

  it('not stored yet, while a file of the app is missing', async () => {
    const worker = fakeWorker({ ...STATUS, app: { total: 3, missing: ['assets/index-AAAA.js'] } });
    const { offline } = client(worker);
    await offline.refresh();
    expect(offline.getSnapshot().state).toBe('pending');
  });

  it('stored, with what is left of the rest', async () => {
    const { offline } = client(fakeWorker(STATUS));
    await offline.refresh();
    expect(offline.getSnapshot()).toEqual({
      state: 'stored',
      rest: { bytes: 12_686_558, total: 5, missing: 4 },
      progress: null,
    });
  });

  it('an answer that is not a status is no answer', async () => {
    const worker = fakeWorker(STATUS);
    const { offline } = client({ ...worker, ask: () => Promise.resolve({ version: 2 }) });
    await offline.refresh();
    expect(offline.getSnapshot().state).toBe('pending');
    const failing = client({ ...worker, ask: () => Promise.reject(new Error('gone')) });
    await failing.offline.refresh();
    expect(failing.offline.getSnapshot().state).toBe('pending');
  });

  it('unsupported once the browser has refused the worker', async () => {
    const worker = fakeWorker(STATUS);
    const { offline } = client(worker);
    offline.refuse();
    await offline.refresh();
    expect(offline.getSnapshot()).toEqual({ state: 'unsupported', rest: null, progress: null });
  });
});

describe('settle', () => {
  it('stores what the page had fetched already, and nothing else', async () => {
    const worker = fakeWorker(STATUS);
    const { offline } = client(worker, { loaded: [`${SCOPE}assets/ja-1111.js`] });
    await offline.settle();
    expect(worker.state.asked).toEqual(['assets/ja-1111.js']);
    expect(offline.getSnapshot().rest?.missing).toBe(3);
    // Never shown as "Store everything" at work.
    expect(offline.getSnapshot().progress).toBeNull();
  });

  it('fills the app up again when a file of it is gone', async () => {
    const worker = fakeWorker({ ...STATUS, app: { total: 3, missing: ['assets/index-AAAA.js'] } });
    const { offline } = client(worker);
    await offline.settle();
    expect(worker.state.asked).toEqual(['assets/index-AAAA.js']);
    expect(offline.getSnapshot().state).toBe('stored');
  });

  it('stores everything again after a release, where everything was asked for', async () => {
    const worker = fakeWorker(STATUS);
    const { offline } = client(worker, { everything: true });
    await offline.settle();
    expect(worker.state.asked.sort()).toEqual(STATUS.rest.missing.map(({ file }) => file).sort());
    expect(offline.getSnapshot().rest?.missing).toBe(0);
  });

  it('does nothing without a worker', async () => {
    const worker = fakeWorker(null);
    const { offline } = client(worker, { everything: true });
    await offline.settle();
    expect(worker.state.asked).toEqual([]);
  });
});

describe('storeEverything', () => {
  it('stores the whole list, counting as it goes', async () => {
    const worker = fakeWorker(STATUS);
    const { offline, pref, seen } = client(worker);
    expect(await offline.storeEverything()).toEqual([]);
    expect(worker.state.asked.sort()).toEqual(STATUS.rest.missing.map(({ file }) => file).sort());
    const counts = seen.flatMap((snapshot) => (snapshot.progress ? [snapshot.progress] : []));
    expect(counts[0]).toEqual({ done: 0, total: 4 });
    expect(counts.at(-1)).toEqual({ done: 4, total: 4 });
    expect(offline.getSnapshot()).toEqual({
      state: 'stored',
      rest: { bytes: 12_686_558, total: 5, missing: 0 },
      progress: null,
    });
    expect(pref.on).toBe(true);
  });

  it('says which groups could not be stored, in the list’s order', async () => {
    const worker = fakeWorker(STATUS, ['piano/A4-mf.mp3', 'assets/ko-1111.js']);
    const { offline, pref } = client(worker);
    expect(await offline.storeEverything()).toEqual(['piano', 'languages']);
    expect(offline.getSnapshot().rest?.missing).toBe(2);
    expect(offline.getSnapshot().progress).toBeNull();
    // The choice is kept all the same: a later visit tries again.
    expect(pref.on).toBe(true);
  });

  it('a worker that stops answering fails every file, and the count still ends', async () => {
    const worker = fakeWorker(STATUS);
    const { offline } = client({
      ...worker,
      ask: (message) => (message.type === 'status' ? worker.ask(message) : Promise.resolve(null)),
    });
    expect(await offline.storeEverything()).toEqual(['engraver', 'piano', 'languages']);
    expect(offline.getSnapshot().progress).toBeNull();
  });

  it('asks for the page after everything else: the worker takes it only then', async () => {
    const worker = fakeWorker({
      ...STATUS,
      app: { total: 3, missing: ['', 'assets/index-AAAA.js'] },
    });
    const { offline } = client(worker, { everything: true });
    await offline.settle();
    expect(worker.state.asked).toHaveLength(6);
    expect(worker.state.asked.at(-1)).toBe('');
    expect(offline.getSnapshot().state).toBe('stored');
  });

  it('includes what is missing of the app', async () => {
    const worker = fakeWorker({ ...STATUS, app: { total: 3, missing: [''] } }, ['']);
    const { offline } = client(worker);
    expect(await offline.storeEverything()).toEqual(['app']);
    expect(worker.state.asked).toContain('');
  });

  it('does not start twice', async () => {
    const worker = fakeWorker(STATUS);
    const { offline } = client(worker);
    const [first, second] = await Promise.all([
      offline.storeEverything(),
      offline.storeEverything(),
    ]);
    expect(first).toEqual([]);
    expect(second).toEqual([]);
    expect(worker.state.asked).toHaveLength(4);
  });
});
