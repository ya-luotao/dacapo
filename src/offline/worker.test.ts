import { describe, expect, it } from 'vitest';
import type { OfflineFile, OfflineList } from './files.ts';
import type { OfflineStatus } from './messages.ts';
import { createOfflineWorker, type Store, type Stores } from './worker.ts';

const SCOPE = 'https://playdacapo.com/';
const V1 = '111111111111';
const V2 = '222222222222';
const V3 = '333333333333';

const BUILD_1: OfflineFile[] = [
  ['', 'app', 100],
  ['assets/index-AAAA.js', 'app', 1000],
  ['assets/react-RRRR.js', 'app', 2000],
  ['assets/ReadPage-1111.js', 'app', 500],
  ['manifest.webmanifest', 'app', 50],
  ['assets/verovio-VVVV.mjs', 'engraver', 7000],
  ['assets/ja-1111.js', 'languages', 300],
  ['piano/A4-mf.mp3', 'piano', 400],
];
// The release after: React and the engraver as they were, everything of ours renamed.
const BUILD_2: OfflineFile[] = [
  ['', 'app', 110],
  ['assets/index-BBBB.js', 'app', 1100],
  ['assets/react-RRRR.js', 'app', 2000],
  ['assets/ReadPage-2222.js', 'app', 500],
  ['manifest.webmanifest', 'app', 50],
  ['assets/verovio-VVVV.mjs', 'engraver', 7000],
  ['assets/ja-2222.js', 'languages', 300],
  ['piano/A4-mf.mp3', 'piano', 400],
];

const TYPES: Record<string, string> = {
  js: 'text/javascript',
  mjs: 'text/javascript',
  mp3: 'audio/mpeg',
  webmanifest: 'application/manifest+json',
};

const pageOf = (files: readonly OfflineFile[], scope = SCOPE) =>
  `<html><script type="module" src="${new URL(scope).pathname}${files[1]![0]}"></script></html>`;

/** A server holding one build: every file of the list, each with its address as its body. */
function serverOf(files: readonly OfflineFile[], scope = SCOPE) {
  const bodies = new Map<string, { body: string; type: string }>();
  for (const [path] of files) {
    if (path === '')
      bodies.set(scope, { body: pageOf(files, scope), type: 'text/html; charset=utf-8' });
    else bodies.set(scope + path, { body: path, type: TYPES[path.split('.').pop()!]! });
  }
  return bodies;
}

function network(initial: Map<string, { body: string; type: string }>) {
  const state = {
    files: initial,
    online: true,
    /** Requests that never get an answer while this is set. */
    stalled: false,
    calls: [] as { url: string; cache?: string }[],
    /** Answers every unknown address with this page, as a host with a fallback does. */
    fallback: null as string | null,
  };
  const fetch = (input: Request | string, init?: { cache?: RequestCache }): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.url;
    state.calls.push({ url, cache: init?.cache });
    if (state.stalled) return new Promise(() => {});
    if (!state.online) return Promise.reject(new TypeError('Failed to fetch'));
    const file = state.files.get(url.split('?')[0]!);
    if (file) {
      return Promise.resolve(
        new Response(file.body, { status: 200, headers: { 'content-type': file.type } }),
      );
    }
    if (state.fallback !== null) {
      return Promise.resolve(
        new Response(state.fallback, { status: 200, headers: { 'content-type': 'text/html' } }),
      );
    }
    return Promise.resolve(new Response('not found', { status: 404 }));
  };
  return { state, fetch };
}

class FakeStore implements Store {
  readonly entries = new Map<string, Response>();
  /** Set: `put` fails as it does when the device is full. */
  full = false;
  match = (url: string) => Promise.resolve(this.entries.get(url)?.clone());
  put = async (url: string, response: Response) => {
    if (this.full) throw new DOMException('Quota exceeded', 'QuotaExceededError');
    // A real store reads the whole body before it keeps the answer.
    const body = await response.arrayBuffer();
    this.entries.set(
      url,
      new Response(body, { status: response.status, headers: response.headers }),
    );
  };
  keys = () => Promise.resolve([...this.entries.keys()].map((url) => ({ url })));
}

function fakeStores() {
  const all = new Map<string, FakeStore>();
  const stores: Stores = {
    open: (name) => {
      let store = all.get(name);
      if (!store) all.set(name, (store = new FakeStore()));
      return Promise.resolve(store);
    },
    keys: () => Promise.resolve([...all.keys()]),
    delete: (name) => Promise.resolve(all.delete(name)),
  };
  return { all, stores };
}

function request(url: string, facts: { mode?: string; range?: boolean; method?: string } = {}) {
  return {
    url,
    method: facts.method ?? 'GET',
    mode: facts.mode ?? 'cors',
    headers: new Headers(facts.range ? { range: 'bytes=0-99' } : {}),
  } as unknown as Request;
}

const name = (order: number, version: string, path = '/') =>
  `dacapo-offline:${path}:${order}:${version}`;

function setup(files = BUILD_1, version = V1, shared?: ReturnType<typeof fakeStores>) {
  const caches = shared ?? fakeStores();
  const net = network(serverOf(files));
  const list: OfflineList = { version, files };
  const waits: number[] = [];
  const worker = createOfflineWorker({
    scope: SCOPE,
    list,
    stores: caches.stores,
    fetch: net.fetch,
    wait: (ms) => {
      waits.push(ms);
      // Only a stalled network loses the race against the clock.
      return net.state.stalled ? Promise.resolve() : new Promise(() => {});
    },
  });
  const pending: Promise<unknown>[] = [];
  const keepAlive = (work: Promise<unknown>) => void pending.push(work);
  /** Answers a request as the worker's fetch event does, and waits for the work behind it. */
  async function ask(url: string, facts?: Parameters<typeof request>[1]) {
    const answer = worker.answer(request(url, facts), keepAlive);
    if (!answer) return null;
    const response = await answer;
    await Promise.all(pending.splice(0));
    return response;
  }
  return { ...caches, net: net.state, worker, ask, waits };
}

const text = async (response: Response | null | undefined) => (response ? response.text() : null);
const stored = (store: FakeStore | undefined) => [...(store?.entries.keys() ?? [])].sort();

describe('install', () => {
  it('stores the app’s files, and only those, in a store named by the version', async () => {
    const { worker, all, net } = setup();
    await worker.install();
    expect([...all.keys()]).toEqual([name(1, V1)]);
    expect(stored(all.get(name(1, V1)))).toEqual(
      [
        SCOPE,
        `${SCOPE}assets/index-AAAA.js`,
        `${SCOPE}assets/react-RRRR.js`,
        `${SCOPE}assets/ReadPage-1111.js`,
        `${SCOPE}manifest.webmanifest`,
      ].sort(),
    );
    // The engraver, the piano and the languages are not fetched.
    expect(net.calls.map((call) => call.url).sort()).toEqual(stored(all.get(name(1, V1))));
  });

  it('fetches the page at the scope and the unhashed files past the browser’s cache', async () => {
    const { worker, net } = setup();
    await worker.install();
    const cacheOf = (url: string) => net.calls.find((call) => call.url === url)?.cache;
    expect(cacheOf(SCOPE)).toBe('reload');
    expect(cacheOf(`${SCOPE}manifest.webmanifest`)).toBe('reload');
    expect(cacheOf(`${SCOPE}assets/index-AAAA.js`)).toBeUndefined();
    expect(net.calls.some((call) => call.url.endsWith('index.html'))).toBe(false);
  });

  it('stores the page last: a store that holds it is one whose install finished', async () => {
    const { worker, net } = setup();
    await worker.install();
    expect(net.calls.at(-1)?.url).toBe(SCOPE);
  });

  it('fails, and leaves nothing behind, when a file is missing', async () => {
    const { worker, all, net } = setup();
    net.files.delete(`${SCOPE}assets/ReadPage-1111.js`);
    await expect(worker.install()).rejects.toThrow('assets/ReadPage-1111.js');
    expect([...all.keys()]).toEqual([]);
  });

  it('fails without a network', async () => {
    const { worker, all, net } = setup();
    net.online = false;
    await expect(worker.install()).rejects.toThrow();
    expect([...all.keys()]).toEqual([]);
  });

  it('fails when the device has no space left', async () => {
    const caches = fakeStores();
    const full = new FakeStore();
    full.full = true;
    caches.all.set(name(1, V1), full);
    // The store is there (empty) and is this version's: taken up, and not deleted on failure.
    const { worker } = setup(BUILD_1, V1, caches);
    await expect(worker.install()).rejects.toThrow('Quota');
    expect(stored(full)).toEqual([]);
  });

  it('refuses a page answered in place of a file', async () => {
    const { worker, all, net } = setup();
    net.files.delete(`${SCOPE}assets/react-RRRR.js`);
    net.fallback = pageOf(BUILD_1);
    await expect(worker.install()).rejects.toThrow('assets/react-RRRR.js');
    expect([...all.keys()]).toEqual([]);
  });

  it('refuses a redirected answer for the page', async () => {
    const { all, stores } = fakeStores();
    const net = network(serverOf(BUILD_1));
    const worker = createOfflineWorker({
      scope: SCOPE,
      list: { version: V1, files: BUILD_1 },
      stores,
      fetch: async (input, init) => {
        const response = await net.fetch(input, init);
        if (input === SCOPE) Object.defineProperty(response, 'redirected', { value: true });
        return response;
      },
    });
    await expect(worker.install()).rejects.toThrow();
    expect([...all.keys()]).toEqual([]);
  });

  it('refuses the next build’s page, served while a release is being deployed', async () => {
    const { worker, all, net } = setup();
    net.files.set(SCOPE, { body: pageOf(BUILD_2), type: 'text/html' });
    await expect(worker.install()).rejects.toThrow('the page could not be stored');
    expect([...all.keys()]).toEqual([]);
  });

  it('leaves the stores of the release before alone when it fails', async () => {
    const first = setup();
    await first.worker.install();
    const before = stored(first.all.get(name(1, V1)));
    const second = setup(BUILD_2, V2, first);
    second.net.files.delete(`${SCOPE}assets/index-BBBB.js`);
    await expect(second.worker.install()).rejects.toThrow();
    expect([...first.all.keys()]).toEqual([name(1, V1)]);
    expect(stored(first.all.get(name(1, V1)))).toEqual(before);
  });
});

describe('a release', () => {
  async function released() {
    const first = setup();
    await first.worker.install();
    await first.worker.activate();
    // Fetched while the first release ran: the engraver and a sample.
    await first.ask(`${SCOPE}assets/verovio-VVVV.mjs`);
    await first.ask(`${SCOPE}piano/A4-mf.mp3`);
    const second = setup(BUILD_2, V2, first);
    await second.worker.install();
    return { first, second, all: first.all };
  }

  it('installs beside the store in charge, in a store of its own', async () => {
    const { all } = await released();
    expect([...all.keys()]).toEqual([name(1, V1), name(2, V2)]);
  });

  it('takes along what the older store has, and fetches only what is new', async () => {
    const { second, all } = await released();
    expect(second.net.calls.map((call) => call.url).sort()).toEqual(
      [
        SCOPE,
        `${SCOPE}assets/index-BBBB.js`,
        `${SCOPE}assets/ReadPage-2222.js`,
        `${SCOPE}manifest.webmanifest`,
      ].sort(),
    );
    expect(stored(all.get(name(2, V2)))).toEqual(
      [
        SCOPE,
        `${SCOPE}assets/index-BBBB.js`,
        `${SCOPE}assets/react-RRRR.js`,
        `${SCOPE}assets/ReadPage-2222.js`,
        `${SCOPE}manifest.webmanifest`,
        // Not the app's, but the older store had them.
        `${SCOPE}assets/verovio-VVVV.mjs`,
        `${SCOPE}piano/A4-mf.mp3`,
      ].sort(),
    );
    expect(await text(await all.get(name(2, V2))!.match(SCOPE))).toBe(pageOf(BUILD_2));
  });

  it('a tab still open on the release before finds its files in that release’s store', async () => {
    const { second } = await released();
    await second.worker.activate();
    second.net.calls.length = 0;
    // The new server no longer has the old release's files.
    const lazy = await second.ask(`${SCOPE}assets/ReadPage-1111.js`);
    expect(await text(lazy)).toBe('assets/ReadPage-1111.js');
    expect(second.net.calls).toEqual([]);
  });

  it('keeps its own store and the one before, and deletes what is older', async () => {
    const { second, all } = await released();
    await second.worker.activate();
    expect([...all.keys()]).toEqual([name(1, V1), name(2, V2)]);

    const build3: OfflineFile[] = [...BUILD_2.slice(0, 7), ['piano/C4-mf.mp3', 'piano', 1]];
    const third = setup(build3, V3, second);
    await third.worker.install();
    expect([...all.keys()]).toEqual([name(1, V1), name(2, V2), name(3, V3)]);
    await third.worker.activate();
    expect([...all.keys()]).toEqual([name(2, V2), name(3, V3)]);
  });

  it('a store left by an install that was cut short is not kept in a release’s place', async () => {
    const first = setup();
    await first.worker.install();
    await first.worker.activate();
    // The second release's install is cut short (the browser is closed): files, but no page.
    const cut = new FakeStore();
    await cut.put(`${SCOPE}assets/index-BBBB.js`, new Response('assets/index-BBBB.js'));
    first.all.set(name(2, V2), cut);
    const build3: OfflineFile[] = [...BUILD_2.slice(0, 7), ['piano/C4-mf.mp3', 'piano', 1]];
    const third = setup(build3, V3, first);
    await third.worker.install();
    await third.worker.activate();
    // The first release's store is the one before: a tab still open on it finds its files.
    expect([...first.all.keys()]).toEqual([name(1, V1), name(3, V3)]);
    third.net.calls.length = 0;
    expect(await text(await third.ask(`${SCOPE}assets/ReadPage-1111.js`))).toBe(
      'assets/ReadPage-1111.js',
    );
    expect(third.net.calls).toEqual([]);
  });

  it('an install cut short is taken up again by the same worker, and then counts', async () => {
    const first = setup();
    await first.worker.install();
    const cut = new FakeStore();
    await cut.put(`${SCOPE}assets/index-BBBB.js`, new Response('assets/index-BBBB.js'));
    first.all.set(name(2, V2), cut);
    const second = setup(BUILD_2, V2, first);
    await second.worker.install();
    await second.worker.activate();
    expect([...first.all.keys()]).toEqual([name(1, V1), name(2, V2)]);
    expect(await text(await cut.match(SCOPE))).toBe(pageOf(BUILD_2));
  });

  it('never deletes a store that is not its own', async () => {
    const { second, all } = await released();
    all.set('some-other-cache', new FakeStore());
    all.set(name(1, V1, '/other/'), new FakeStore());
    all.set(name(9, V1, '/other/'), new FakeStore());
    const third = setup(BUILD_1, V3, second);
    await third.worker.install();
    await third.worker.activate();
    expect([...all.keys()].sort()).toEqual(
      [
        'some-other-cache',
        name(1, V1, '/other/'),
        name(9, V1, '/other/'),
        name(2, V2),
        name(3, V3),
      ].sort(),
    );
  });

  it('a fix to the worker alone takes up the same store', async () => {
    const first = setup();
    await first.worker.install();
    const fixed = setup(BUILD_1, V1, first);
    await fixed.worker.install();
    await fixed.worker.activate();
    expect([...first.all.keys()]).toEqual([name(1, V1)]);
    // Only the files that keep their names are fetched again.
    expect(fixed.net.calls.map((call) => call.url).sort()).toEqual(
      [SCOPE, `${SCOPE}manifest.webmanifest`].sort(),
    );
  });

  it('going back to an earlier version makes a new store, so the order stays', async () => {
    const { second, all } = await released();
    await second.worker.activate();
    const back = setup(BUILD_1, V1, second);
    await back.worker.install();
    expect([...all.keys()]).toEqual([name(1, V1), name(2, V2), name(3, V1)]);
    await back.worker.activate();
    expect([...all.keys()]).toEqual([name(2, V2), name(3, V1)]);
    // Nothing but the unhashed files came from the network.
    expect(back.net.calls.map((call) => call.url).sort()).toEqual(
      [SCOPE, `${SCOPE}manifest.webmanifest`].sort(),
    );
  });

  it('a worker started again finds its store by its version', async () => {
    const { second, all } = await released();
    await second.worker.activate();
    const again = setup(BUILD_2, V2, second);
    again.net.online = false;
    expect(await text(await again.ask(`${SCOPE}assets/index-BBBB.js`))).toBe(
      'assets/index-BBBB.js',
    );
    expect([...all.keys()]).toEqual([name(1, V1), name(2, V2)]);
  });
});

describe('answering: what is not the app’s', () => {
  it('is not answered', async () => {
    const { worker, ask } = setup();
    await worker.install();
    expect(await ask(`${SCOPE}privacy`, { mode: 'navigate' })).toBeNull();
    expect(await ask(`${SCOPE}u/someone`, { mode: 'navigate' })).toBeNull();
    expect(await ask('https://api.playdacapo.com/v1/records')).toBeNull();
    expect(await ask(`${SCOPE}robots.txt`)).toBeNull();
    expect(await ask(`${SCOPE}assets/index-AAAA.js`, { method: 'POST' })).toBeNull();
    expect(await ask(`${SCOPE}piano/A4-mf.mp3`, { range: true })).toBeNull();
  });
});

describe('answering: the page', () => {
  it('comes from the network when there is one', async () => {
    const { worker, ask, net } = setup();
    await worker.install();
    net.files.set(SCOPE, { body: `${pageOf(BUILD_1)}<!-- edited -->`, type: 'text/html' });
    const response = await ask(SCOPE, { mode: 'navigate' });
    expect(await text(response)).toBe(`${pageOf(BUILD_1)}<!-- edited -->`);
  });

  it('renews the copy stored when it is this build’s page', async () => {
    const { worker, ask, net, all } = setup();
    await worker.install();
    net.files.set(SCOPE, { body: `${pageOf(BUILD_1)}<!-- edited -->`, type: 'text/html' });
    await ask(`${SCOPE}?from=somewhere`, { mode: 'navigate' });
    const copy = await all.get(name(1, V1))!.match(SCOPE);
    expect(await text(copy)).toBe(`${pageOf(BUILD_1)}<!-- edited -->`);
    // Under the scope's address only.
    expect(stored(all.get(name(1, V1))).filter((url) => url.includes('?'))).toEqual([]);
  });

  it('passes on a newer release’s page without storing it beside this build’s files', async () => {
    const { worker, ask, net, all } = setup();
    await worker.install();
    net.files = serverOf(BUILD_2);
    const response = await ask(SCOPE, { mode: 'navigate' });
    expect(await text(response)).toBe(pageOf(BUILD_2));
    expect(await text(await all.get(name(1, V1))!.match(SCOPE))).toBe(pageOf(BUILD_1));
    // So that, without a network, the page stored still finds its files.
    net.online = false;
    expect(await text(await ask(SCOPE, { mode: 'navigate' }))).toBe(pageOf(BUILD_1));
    expect(await text(await ask(`${SCOPE}assets/index-AAAA.js`))).toBe('assets/index-AAAA.js');
  });

  it('comes from the store without a network', async () => {
    const { worker, ask, net } = setup();
    await worker.install();
    net.online = false;
    expect(await text(await ask(SCOPE, { mode: 'navigate' }))).toBe(pageOf(BUILD_1));
    expect(await text(await ask(`${SCOPE}index.html`, { mode: 'navigate' }))).toBe(pageOf(BUILD_1));
    expect(await text(await ask(`${SCOPE}?x=1`, { mode: 'navigate' }))).toBe(pageOf(BUILD_1));
  });

  it('comes from the store after three seconds without an answer', async () => {
    const { worker, net, waits } = setup();
    await worker.install();
    net.stalled = true;
    const answer = worker.answer(request(SCOPE, { mode: 'navigate' }), () => {});
    expect(await text(await answer)).toBe(pageOf(BUILD_1));
    expect(waits).toContain(3000);
  });

  it('a request that is never answered does not hold the worker beyond the bound', async () => {
    const { worker, net, waits } = setup();
    await worker.install();
    net.stalled = true;
    const behind: Promise<unknown>[] = [];
    const answer = worker.answer(request(SCOPE, { mode: 'navigate' }), (work) => behind.push(work));
    expect(await text(await answer)).toBe(pageOf(BUILD_1));
    // The network's promise is still pending; what the event waits for is not.
    expect(behind).toHaveLength(1);
    await expect(Promise.all(behind)).resolves.toBeDefined();
    expect(waits).toContain(30_000);
  });

  it('is the server’s answer, error or not, when it has one', async () => {
    const { worker, ask, net, all } = setup();
    await worker.install();
    net.files.delete(SCOPE);
    const response = await ask(SCOPE, { mode: 'navigate' });
    expect(response?.status).toBe(404);
    // And an error is never stored.
    expect(await text(await all.get(name(1, V1))!.match(SCOPE))).toBe(pageOf(BUILD_1));
  });

  it('does not store a page that is not the app (a sign-in page of the network)', async () => {
    const { worker, ask, net, all } = setup();
    await worker.install();
    net.files.set(SCOPE, { body: '<html>Sign in to this network</html>', type: 'text/html' });
    await ask(SCOPE, { mode: 'navigate' });
    expect(await text(await all.get(name(1, V1))!.match(SCOPE))).toBe(pageOf(BUILD_1));
  });

  it('fails as it would without a worker when nothing is stored and there is no network', async () => {
    const { worker, net } = setup();
    net.online = false;
    const answer = worker.answer(request(SCOPE, { mode: 'navigate' }), () => {});
    await expect(answer).rejects.toThrow('Failed to fetch');
  });
});

describe('answering: files under assets/', () => {
  it('come from the store, without the network', async () => {
    const { worker, ask, net } = setup();
    await worker.install();
    net.calls.length = 0;
    expect(await text(await ask(`${SCOPE}assets/index-AAAA.js`))).toBe('assets/index-AAAA.js');
    expect(net.calls).toEqual([]);
  });

  it('one of the list not stored yet is fetched and kept', async () => {
    const { worker, ask, net, all } = setup();
    await worker.install();
    expect(await text(await ask(`${SCOPE}assets/verovio-VVVV.mjs`))).toBe(
      'assets/verovio-VVVV.mjs',
    );
    expect(stored(all.get(name(1, V1)))).toContain(`${SCOPE}assets/verovio-VVVV.mjs`);
    net.online = false;
    expect(await text(await ask(`${SCOPE}assets/verovio-VVVV.mjs`))).toBe(
      'assets/verovio-VVVV.mjs',
    );
  });

  it('one not stored fails without a network as it would without a worker', async () => {
    const { worker, net } = setup();
    await worker.install();
    net.online = false;
    const answer = worker.answer(request(`${SCOPE}assets/verovio-VVVV.mjs`), () => {});
    await expect(answer).rejects.toThrow('Failed to fetch');
  });

  it('one the list does not have goes to the network and is not kept', async () => {
    const { worker, ask, net, all } = setup();
    await worker.install();
    net.files.set(`${SCOPE}assets/index-NEW0.js`, { body: 'new', type: 'text/javascript' });
    expect(await text(await ask(`${SCOPE}assets/index-NEW0.js`))).toBe('new');
    expect(stored(all.get(name(1, V1)))).not.toContain(`${SCOPE}assets/index-NEW0.js`);
  });

  it('an error or a page in place of a file is passed on and not kept', async () => {
    const { worker, ask, net, all } = setup();
    await worker.install();
    net.files.delete(`${SCOPE}assets/ja-1111.js`);
    expect((await ask(`${SCOPE}assets/ja-1111.js`))?.status).toBe(404);
    net.fallback = '<html>the app</html>';
    expect(await text(await ask(`${SCOPE}assets/ja-1111.js`))).toBe('<html>the app</html>');
    expect(stored(all.get(name(1, V1)))).not.toContain(`${SCOPE}assets/ja-1111.js`);
  });

  it('a full device does not stop the answer', async () => {
    const { worker, ask, all } = setup();
    await worker.install();
    all.get(name(1, V1))!.full = true;
    expect(await text(await ask(`${SCOPE}assets/verovio-VVVV.mjs`))).toBe(
      'assets/verovio-VVVV.mjs',
    );
    expect(stored(all.get(name(1, V1)))).not.toContain(`${SCOPE}assets/verovio-VVVV.mjs`);
  });
});

describe('answering: the other files of the list', () => {
  it('are fetched and kept the first time', async () => {
    const { worker, ask, all } = setup();
    await worker.install();
    expect(await text(await ask(`${SCOPE}piano/A4-mf.mp3`))).toBe('piano/A4-mf.mp3');
    expect(stored(all.get(name(1, V1)))).toContain(`${SCOPE}piano/A4-mf.mp3`);
  });

  it('then come from the store, and are renewed behind the answer', async () => {
    const { worker, ask, net, all } = setup();
    await worker.install();
    await ask(`${SCOPE}piano/A4-mf.mp3`);
    net.files.set(`${SCOPE}piano/A4-mf.mp3`, { body: 'recorded again', type: 'audio/mpeg' });
    expect(await text(await ask(`${SCOPE}piano/A4-mf.mp3`))).toBe('piano/A4-mf.mp3');
    expect(await text(await all.get(name(1, V1))!.match(`${SCOPE}piano/A4-mf.mp3`))).toBe(
      'recorded again',
    );
    expect(await text(await ask(`${SCOPE}piano/A4-mf.mp3`))).toBe('recorded again');
  });

  it('a renewal that is never answered does not hold the worker beyond the bound', async () => {
    const { worker, ask, net, waits } = setup();
    await worker.install();
    await ask(`${SCOPE}piano/A4-mf.mp3`);
    net.stalled = true;
    waits.length = 0;
    const behind: Promise<unknown>[] = [];
    const answer = worker.answer(request(`${SCOPE}piano/A4-mf.mp3`), (work) => behind.push(work));
    expect(await text(await answer)).toBe('piano/A4-mf.mp3');
    expect(behind).toHaveLength(1);
    await expect(Promise.all(behind)).resolves.toBeDefined();
    expect(waits).toEqual([30_000]);
  });

  it('come from the store without a network, and the copy stays', async () => {
    const { worker, ask, net } = setup();
    await worker.install();
    net.online = false;
    expect(await text(await ask(`${SCOPE}manifest.webmanifest`))).toBe('manifest.webmanifest');
    expect(await text(await ask(`${SCOPE}manifest.webmanifest`))).toBe('manifest.webmanifest');
  });

  it('an error does not replace the copy', async () => {
    const { worker, ask, net } = setup();
    await worker.install();
    net.files.delete(`${SCOPE}manifest.webmanifest`);
    await ask(`${SCOPE}manifest.webmanifest`);
    expect(await text(await ask(`${SCOPE}manifest.webmanifest`))).toBe('manifest.webmanifest');
  });
});

describe('answering: when the stores fail', () => {
  it('the network answers', async () => {
    const net = network(serverOf(BUILD_1));
    const broken: Stores = {
      open: () => Promise.reject(new Error('no storage')),
      keys: () => Promise.reject(new Error('no storage')),
      delete: () => Promise.reject(new Error('no storage')),
    };
    const worker = createOfflineWorker({
      scope: SCOPE,
      list: { version: V1, files: BUILD_1 },
      stores: broken,
      fetch: net.fetch,
    });
    const keepAlive = () => {};
    const asset = worker.answer(request(`${SCOPE}assets/index-AAAA.js`), keepAlive);
    expect(await text(await asset)).toBe('assets/index-AAAA.js');
    const sample = worker.answer(request(`${SCOPE}piano/A4-mf.mp3`), keepAlive);
    expect(await text(await sample)).toBe('piano/A4-mf.mp3');
    const page = worker.answer(request(SCOPE, { mode: 'navigate' }), keepAlive);
    expect(await text(await page)).toBe(pageOf(BUILD_1));
    await expect(worker.install()).rejects.toThrow('no storage');
    await expect(worker.activate()).rejects.toThrow('no storage');
  });
});

describe('messages from the page', () => {
  const statusOf = async (worker: ReturnType<typeof setup>['worker']) =>
    (await worker.message({ type: 'status' })) as OfflineStatus;

  it('status: what is stored of the app and of the rest', async () => {
    const { worker, ask } = setup();
    expect(await statusOf(worker)).toEqual({
      version: V1,
      app: {
        total: 5,
        missing: [
          '',
          'assets/index-AAAA.js',
          'assets/react-RRRR.js',
          'assets/ReadPage-1111.js',
          'manifest.webmanifest',
        ],
      },
      rest: {
        total: 3,
        bytes: 7700,
        missing: [
          { file: 'assets/verovio-VVVV.mjs', group: 'engraver' },
          { file: 'assets/ja-1111.js', group: 'languages' },
          { file: 'piano/A4-mf.mp3', group: 'piano' },
        ],
      },
    });
    await worker.install();
    await ask(`${SCOPE}piano/A4-mf.mp3`);
    const after = await statusOf(worker);
    expect(after.app).toEqual({ total: 5, missing: [] });
    expect(after.rest.missing.map((entry) => entry.file)).toEqual([
      'assets/verovio-VVVV.mjs',
      'assets/ja-1111.js',
    ]);
  });

  it('store: fetches a file of the list and keeps it', async () => {
    const { worker, net, ask } = setup();
    await worker.install();
    expect(await worker.message({ type: 'store', file: 'assets/verovio-VVVV.mjs' })).toEqual({
      ok: true,
    });
    expect(await worker.message({ type: 'store', file: 'piano/A4-mf.mp3' })).toEqual({ ok: true });
    expect((await statusOf(worker)).rest.missing.map((entry) => entry.file)).toEqual([
      'assets/ja-1111.js',
    ]);
    net.online = false;
    expect(await text(await ask(`${SCOPE}assets/verovio-VVVV.mjs`))).toBe(
      'assets/verovio-VVVV.mjs',
    );
    // Stored already: nothing to do, network or not.
    expect(await worker.message({ type: 'store', file: 'piano/A4-mf.mp3' })).toEqual({ ok: true });
  });

  it('store: says so when the file could not be fetched or kept', async () => {
    const { worker, net, all } = setup();
    await worker.install();
    expect(await worker.message({ type: 'store', file: 'assets/not-listed.js' })).toEqual({
      ok: false,
    });
    expect(await worker.message({ type: 'store', file: '../privacy' })).toEqual({ ok: false });
    all.get(name(1, V1))!.full = true;
    expect(await worker.message({ type: 'store', file: 'piano/A4-mf.mp3' })).toEqual({ ok: false });
    all.get(name(1, V1))!.full = false;
    net.online = false;
    expect(await worker.message({ type: 'store', file: 'piano/A4-mf.mp3' })).toEqual({ ok: false });
    net.online = true;
    net.files.delete(`${SCOPE}piano/A4-mf.mp3`);
    expect(await worker.message({ type: 'store', file: 'piano/A4-mf.mp3' })).toEqual({ ok: false });
  });

  it('store: the page of another build is not kept', async () => {
    const { worker, net, all } = setup();
    await worker.install();
    const mine = all.get(name(1, V1))!;
    mine.entries.delete(SCOPE);
    net.files = serverOf(BUILD_2);
    expect(await worker.message({ type: 'store', file: '' })).toEqual({ ok: false });
    expect(await mine.match(SCOPE)).toBeUndefined();
    // Nor a page that is not the app at all, nor an error.
    net.files.set(SCOPE, { body: '<html>Sign in to this network</html>', type: 'text/html' });
    expect(await worker.message({ type: 'store', file: '' })).toEqual({ ok: false });
    net.files.delete(SCOPE);
    expect(await worker.message({ type: 'store', file: '' })).toEqual({ ok: false });
    // This build's own is.
    net.files = serverOf(BUILD_1);
    expect(await worker.message({ type: 'store', file: '' })).toEqual({ ok: true });
    expect(await text(await mine.match(SCOPE))).toBe(pageOf(BUILD_1));
  });

  it('store: the page is taken only once the rest of the app is there', async () => {
    const { worker, all } = setup();
    await worker.install();
    const mine = all.get(name(1, V1))!;
    mine.entries.delete(SCOPE);
    mine.entries.delete(`${SCOPE}assets/react-RRRR.js`);
    expect(await worker.message({ type: 'store', file: '' })).toEqual({ ok: false });
    expect(await worker.message({ type: 'store', file: 'assets/react-RRRR.js' })).toEqual({
      ok: true,
    });
    expect(await worker.message({ type: 'store', file: '' })).toEqual({ ok: true });
  });

  it('anything else is not understood', async () => {
    const { worker } = setup();
    expect(await worker.message(null)).toBeNull();
    expect(await worker.message('status')).toBeNull();
    expect(await worker.message({ type: 'delete-everything' })).toBeNull();
    expect(await worker.message({ type: 'store' })).toBeNull();
  });
});

describe('below a sub-path', () => {
  it('stores and answers under its own scope and store names', async () => {
    const scope = 'https://example.org/dacapo/';
    const { all, stores } = fakeStores();
    const net = network(serverOf(BUILD_1, scope));
    const worker = createOfflineWorker({
      scope,
      list: { version: V1, files: BUILD_1 },
      stores,
      fetch: net.fetch,
    });
    await worker.install();
    expect([...all.keys()]).toEqual([name(1, V1, '/dacapo/')]);
    net.state.online = false;
    const page = worker.answer(request(`${scope}?x`, { mode: 'navigate' }), () => {});
    expect(await text(await page)).toBe(pageOf(BUILD_1, scope));
    const file = worker.answer(request(`${scope}assets/index-AAAA.js`), () => {});
    expect(await text(await file)).toBe('assets/index-AAAA.js');
    expect(
      worker.answer(request('https://example.org/', { mode: 'navigate' }), () => {}),
    ).toBeNull();
    expect(worker.answer(request('https://example.org/assets/index-AAAA.js'), () => {})).toBeNull();
  });
});
