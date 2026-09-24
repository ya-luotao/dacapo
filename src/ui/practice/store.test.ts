import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionRecord } from '../../core/log.ts';
import { DB_NAME, DB_VERSION, openDacapoDB } from '../../storage/db.ts';
import { resetIndexedDB, sampleAttempt, sampleData, T0 } from '../../storage/fixtures.ts';
import {
  createIndexedDbRepository,
  createMemoryRepository,
  openRepository,
  type OpenResult,
  type PracticeRepository,
} from '../../storage/repository.ts';
import {
  broadcastChannel,
  createPracticeStore,
  type PersistentStorage,
  type PracticeStore,
  type PracticeStoreOptions,
} from './store.ts';

let stops: (() => void)[] = [];
let channelName = '';
let channels = 0;

function startStore(options: PracticeStoreOptions = {}): PracticeStore {
  const store = createPracticeStore({
    open: openRepository,
    channel: () => broadcastChannel(channelName),
    ...options,
  });
  stops.push(store.start());
  return store;
}

async function loaded(store: PracticeStore) {
  await vi.waitFor(() => expect(store.getStatus().loaded).toBe(true));
}

/** Reads what is on disk through a separate connection. */
async function onDisk() {
  const db = await openDacapoDB();
  try {
    return await createIndexedDbRepository(db).load();
  } finally {
    db.close();
  }
}

async function seed(write: (repo: PracticeRepository) => Promise<unknown>) {
  const db = await openDacapoDB();
  await write(createIndexedDbRepository(db));
  db.close();
}

const freeSession = (id: string, startedAt: number): SessionRecord => ({
  kind: 'free',
  id,
  startedAt,
  endedAt: startedAt + 60_000,
  activeMs: 60_000,
  notes: 100,
});

beforeEach(() => {
  resetIndexedDB();
  stops = [];
  channelName = `dacapo-test-${++channels}`;
});

afterEach(() => {
  for (const stop of stops) stop();
  vi.restoreAllMocks();
});

describe('loading', () => {
  it('reports loading, then the stored data', async () => {
    const { sessions, attempts } = sampleData();
    await seed((repo) => repo.merge(sessions, attempts));
    const store = startStore();
    expect(store.getStatus()).toEqual({ state: 'loading', loaded: false, persisted: null });
    expect(store.getSnapshot().attempts).toEqual([]);
    await loaded(store);
    expect(store.getStatus().state).toBe('saved');
    expect(store.getSnapshot().attempts).toEqual(attempts);
    expect(store.getSnapshot().sessions.map((s) => s.id)).toEqual(['f1', 's2', 's1']);
  });

  it('keeps what was recorded before loading finished', async () => {
    await seed((repo) => repo.addAttempt(sampleAttempt(0)));
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const store = startStore({ open: (handlers) => gate.then(() => openRepository(handlers)) });
    store.recordAttempt(sampleAttempt(5, 's1', { note: 'C4@treble' }));
    store.recordSession(freeSession('early', T0));
    release();
    await loaded(store);
    await store.settled();
    const { attempts, stats, sessions } = store.getSnapshot();
    expect(attempts.map((a) => a.id)).toEqual(['a0', 'a5']);
    expect(stats['C4@treble']!.attempts).toBe(2);
    expect(sessions.map((s) => s.id)).toContain('early');
    expect((await onDisk()).stats['C4@treble']!.attempts).toBe(2);
  });

  it('finishes a free-play session a closed tab left open, and drops one too short', async () => {
    await seed(async (repo) => {
      await repo.saveOpenFreePlay({
        id: 'long',
        startedAt: T0,
        lastActivityAt: T0 + 95_000,
        notes: 70,
      });
      await repo.saveOpenFreePlay({
        id: 'short',
        startedAt: T0,
        lastActivityAt: T0 + 4_000,
        notes: 2,
      });
    });
    const store = startStore();
    await loaded(store);
    expect(store.getSnapshot().sessions).toEqual([
      {
        kind: 'free',
        id: 'long',
        startedAt: T0,
        endedAt: T0 + 95_000,
        activeMs: 95_000,
        notes: 70,
      },
    ]);
    const disk = await onDisk();
    expect(disk.openFreePlay).toEqual([]);
    expect(disk.sessions.map((s) => s.id)).toEqual(['long']);
  });

  it('never lets a stale save overwrite the session its tab finished', async () => {
    const recorded = { ...freeSession('same', T0), endedAt: T0 + 120_000, activeMs: 120_000 };
    await seed(async (repo) => {
      await repo.putSession(recorded);
      await repo.saveOpenFreePlay({
        id: 'same',
        startedAt: T0,
        lastActivityAt: T0 + 30_000,
        notes: 20,
      });
    });
    const store = startStore();
    await loaded(store);
    expect(store.getSnapshot().sessions).toEqual([recorded]);
    const disk = await onDisk();
    expect(disk.sessions).toEqual([recorded]);
    expect(disk.openFreePlay).toEqual([]);
  });

  it('rebuilds a flashcard session whose summary was never written', async () => {
    const attempts = [sampleAttempt(0, 'lost'), sampleAttempt(1, 'lost')];
    await seed(async (repo) => {
      for (const attempt of attempts) await repo.addAttempt(attempt);
    });
    const store = startStore();
    await loaded(store);
    expect(store.getSnapshot().sessions).toEqual([
      expect.objectContaining({ kind: 'read', id: 'lost', cards: 2, endedAt: attempts[1]!.at }),
    ]);
    expect((await onDisk()).sessions.map((s) => s.id)).toEqual(['lost']);
  });
});

describe('recording', () => {
  it('updates the snapshot at once and saves in the background', async () => {
    const store = startStore();
    await loaded(store);
    store.recordAttempt(sampleAttempt(0));
    expect(store.getSnapshot().stats['C4@treble']!.attempts).toBe(1);
    store.recordAttempt(sampleAttempt(0)); // the same attempt again is ignored
    store.recordSession(freeSession('f', T0));
    await store.settled();
    const disk = await onDisk();
    expect(disk.attempts).toEqual([sampleAttempt(0)]);
    expect(disk.sessions).toEqual([freeSession('f', T0)]);
    expect(store.getStatus().state).toBe('saved');
  });

  it('reports a failed write and keeps the data in memory', async () => {
    const repository: PracticeRepository = {
      ...createMemoryRepository(),
      addAttempt: () => Promise.reject(new DOMException('full', 'QuotaExceededError')),
    };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = startStore({ open: () => Promise.resolve({ repository, failure: null }) });
    await loaded(store);
    store.recordAttempt(sampleAttempt(0));
    await store.settled();
    expect(store.getStatus().state).toBe('failed');
    expect(store.getSnapshot().attempts).toHaveLength(1);
    store.recordSession(freeSession('f', T0)); // later writes are still tried
    await store.settled();
    expect((await repository.load()).sessions).toHaveLength(1);
  });
});

describe('when IndexedDB cannot be used', () => {
  it('works in memory and says so', async () => {
    vi.spyOn(indexedDB, 'open').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    const store = startStore();
    await loaded(store);
    expect(store.getStatus().state).toBe('unavailable');
    store.recordAttempt(sampleAttempt(0));
    store.recordSession(freeSession('f', T0));
    await store.settled();
    expect(store.getSnapshot().attempts).toHaveLength(1);
    expect(store.getSnapshot().sessions).toHaveLength(1);
  });

  it('does not ask for persistent storage', async () => {
    const storage = {
      persisted: vi.fn(() => Promise.resolve(false)),
      persist: vi.fn(() => Promise.resolve(true)),
    };
    const store = startStore({
      open: (): Promise<OpenResult> =>
        Promise.resolve({ repository: createMemoryRepository(), failure: 'unsupported' }),
      storage,
    });
    await loaded(store);
    store.recordSession(freeSession('f', T0));
    await store.settled();
    expect(storage.persist).not.toHaveBeenCalled();
  });
});

describe('several tabs', () => {
  it('keeps the other tab in step after every write', async () => {
    const tabA = startStore();
    const tabB = startStore();
    await loaded(tabA);
    await loaded(tabB);

    tabA.recordAttempt(sampleAttempt(0));
    tabA.recordSession(freeSession('f', T0));
    await vi.waitFor(() => {
      expect(tabB.getSnapshot().attempts.map((a) => a.id)).toEqual(['a0']);
      expect(tabB.getSnapshot().sessions.map((s) => s.id)).toEqual(['f']);
    });
    expect(tabB.getSnapshot().stats).toEqual(tabA.getSnapshot().stats);

    // B continues on the same note: its stats build on A's.
    tabB.recordAttempt(sampleAttempt(5, 's1', { note: 'C4@treble' }));
    await vi.waitFor(() => expect(tabA.getSnapshot().stats['C4@treble']!.attempts).toBe(2));
    expect(tabB.getSnapshot().stats['C4@treble']!.attempts).toBe(2);

    const { sessions, attempts } = sampleData();
    await tabA.importData(sessions, attempts);
    await vi.waitFor(() => expect(tabB.getSnapshot()).toEqual(tabA.getSnapshot()));
  });

  it('stops saving and asks for a reload when another tab upgrades the database', async () => {
    const store = startStore();
    await loaded(store);
    const newer = await openDB(DB_NAME, DB_VERSION + 1);
    expect(store.getStatus().state).toBe('outdated');
    store.recordAttempt(sampleAttempt(0));
    await store.settled();
    expect(store.getSnapshot().attempts).toHaveLength(1);
    expect(store.getStatus().state).toBe('outdated');
    expect(await newer.count('attempts')).toBe(0);
    newer.close();
  });

  it('says so while an older tab blocks opening, then loads', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const store = startStore({
      open: async (handlers) => {
        handlers.onBlocked?.();
        await gate;
        return openRepository(handlers);
      },
    });
    expect(store.getStatus()).toMatchObject({ state: 'blocked', loaded: false });
    release();
    await loaded(store);
    expect(store.getStatus().state).toBe('saved');
  });
});

describe('persistent storage', () => {
  it('is requested once, after the first recorded session, never on start', async () => {
    const storage: PersistentStorage & { persist: ReturnType<typeof vi.fn> } = {
      persisted: vi.fn(() => Promise.resolve(false)),
      persist: vi.fn(() => Promise.resolve(true)),
    };
    const store = startStore({ storage });
    await loaded(store);
    await vi.waitFor(() => expect(store.getStatus().persisted).toBe(false));
    store.recordAttempt(sampleAttempt(0));
    await store.settled();
    expect(storage.persist).not.toHaveBeenCalled();
    store.recordSession(freeSession('a', T0));
    store.recordSession(freeSession('b', T0 + 1));
    await store.settled();
    await vi.waitFor(() => expect(store.getStatus().persisted).toBe(true));
    expect(storage.persist).toHaveBeenCalledOnce();
  });
});
