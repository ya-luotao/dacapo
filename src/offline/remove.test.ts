import { describe, expect, it } from 'vitest';
import source from '../../scripts/offline/sw-remove.js?raw';
import { nextStore, storePrefix } from './stores.ts';

// The withdrawal worker is a plain script outside the build (scripts/offline/sw-remove.js); it is
// run here as a browser would run it, against the store names the real worker makes.

interface Listeners {
  install?: () => void;
  activate?: (event: { waitUntil: (work: Promise<unknown>) => void }) => void;
  fetch?: unknown;
}

async function run(scope: string, names: string[]) {
  const listeners: Listeners = {};
  const stores = new Set(names);
  const calls = { skipWaiting: 0, unregister: 0 };
  const self = {
    addEventListener: (type: keyof Listeners, listener: never) => {
      listeners[type] = listener;
    },
    skipWaiting: () => {
      calls.skipWaiting++;
      return Promise.resolve();
    },
    registration: {
      scope,
      unregister: () => {
        calls.unregister++;
        return Promise.resolve(true);
      },
    },
  };
  const caches = {
    keys: () => Promise.resolve([...stores]),
    delete: (name: string) => Promise.resolve(stores.delete(name)),
  };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- the script, as it is shipped
  const script = new Function('self', 'caches', source) as (...globals: unknown[]) => void;
  script(self, caches);
  listeners.install?.();
  let work: Promise<unknown> = Promise.resolve();
  listeners.activate?.({
    waitUntil: (promise) => {
      work = promise;
    },
  });
  await work;
  return { stores: [...stores], calls, listeners };
}

describe('the withdrawal worker', () => {
  const A = 'aaaaaaaaaaaa';
  const B = 'bbbbbbbbbbbb';

  it('deletes the worker’s stores at its scope, and unregisters itself', async () => {
    const prefix = storePrefix('/');
    const first = nextStore([], prefix, A);
    const second = nextStore([first], prefix, B);
    const { stores, calls } = await run('https://playdacapo.com/', [first, second]);
    expect(stores).toEqual([]);
    expect(calls).toEqual({ skipWaiting: 1, unregister: 1 });
  });

  it('leaves everything else on the origin alone', async () => {
    const mine = nextStore([], storePrefix('/dacapo/'), A);
    const others = [
      nextStore([], storePrefix('/'), A),
      nextStore([], storePrefix('/dacapo-two/'), B),
      'some-other-cache',
    ];
    const { stores } = await run('https://example.org/dacapo/', [mine, ...others]);
    expect(stores).toEqual(others);
  });

  it('answers no request', async () => {
    const { listeners } = await run('https://playdacapo.com/', []);
    expect(listeners.fetch).toBeUndefined();
  });
});
