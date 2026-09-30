import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionRecord } from '../../core/log.ts';
import { DB_NAME, DB_VERSION, openDacapoDB } from '../../storage/db.ts';
import {
  resetIndexedDB,
  sampleAnswer,
  sampleAttempt,
  sampleData,
  sampleHeader,
  samplePiece,
  sampleRun,
  sampleScaleRun,
  sampleScaleSession,
  T0,
} from '../../storage/fixtures.ts';
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
    await seed((repo) =>
      repo.merge({
        sessions,
        attempts,
        pieces: [],
        pieceSteps: [],
        scaleRuns: [],
        answers: [],
        takes: [],
      }),
    );
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

describe('ear-training answers', () => {
  it('rebuilds an ear session whose summary was never written', async () => {
    const answers = [sampleAnswer(0, 'lost'), sampleAnswer(1, 'lost'), sampleAnswer(2, 'kept')];
    await seed(async (repo) => {
      for (const answer of answers) await repo.addAnswer(answer);
      await repo.putSession({ ...freeSession('kept', T0) });
    });
    const store = startStore();
    await loaded(store);
    expect(store.getSnapshot().answers).toEqual(answers);
    expect(store.getSnapshot().sessions).toContainEqual(
      expect.objectContaining({ kind: 'ear', id: 'lost', items: 2, endedAt: answers[1]!.at }),
    );
    expect((await onDisk()).sessions.map((s) => s.id).sort()).toEqual(['kept', 'lost']);
  });

  it('records answers once, in order, and keeps the other tab in step', async () => {
    const tabA = startStore();
    const tabB = startStore();
    await loaded(tabA);
    await loaded(tabB);
    tabA.recordAnswer(sampleAnswer(1));
    tabA.recordAnswer(sampleAnswer(0));
    tabA.recordAnswer(sampleAnswer(0));
    expect(tabA.getSnapshot().answers).toEqual([sampleAnswer(0), sampleAnswer(1)]);
    await tabA.settled();
    expect((await onDisk()).answers).toEqual([sampleAnswer(0), sampleAnswer(1)]);
    await vi.waitFor(() =>
      expect(tabB.getSnapshot().answers).toEqual([sampleAnswer(0), sampleAnswer(1)]),
    );
  });

  it('keeps answers recorded before loading finished', async () => {
    await seed((repo) => repo.addAnswer(sampleAnswer(0)));
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const store = startStore({ open: (handlers) => gate.then(() => openRepository(handlers)) });
    store.recordAnswer(sampleAnswer(1));
    release();
    await loaded(store);
    await store.settled();
    expect(store.getSnapshot().answers).toEqual([sampleAnswer(0), sampleAnswer(1)]);
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
    await tabA.importData({
      sessions,
      attempts,
      pieces: [samplePiece(3)],
      pieceSteps: [],
      scaleRuns: [],
      answers: [],
      takes: [],
    });
    await vi.waitFor(() => expect(tabB.getSnapshot()).toEqual(tabA.getSnapshot()));
    expect(tabB.getSnapshot().pieces.map((p) => p.id)).toEqual(['p3']);
  });

  it('saves, renames and deletes pieces, and tells the other tab', async () => {
    const tabA = startStore();
    const tabB = startStore();
    await loaded(tabA);
    await loaded(tabB);
    tabA.savePiece(samplePiece(1));
    tabA.savePiece(samplePiece(2));
    expect(tabA.getSnapshot().pieces.map((p) => p.id)).toEqual(['p2', 'p1']);
    await vi.waitFor(() =>
      expect(tabB.getSnapshot().pieces.map((p) => p.id)).toEqual(['p2', 'p1']),
    );
    tabB.savePiece({ ...samplePiece(1), title: 'Renamed' });
    tabB.deletePiece('p2');
    await vi.waitFor(() =>
      expect(tabA.getSnapshot().pieces.map((p) => p.title)).toEqual(['Renamed']),
    );
    await tabA.settled();
    await tabB.settled();
    expect((await onDisk()).pieces.map((p) => p.title)).toEqual(['Renamed']);
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

describe('piece runs', () => {
  it('records the steps as they happen and the session at the end', async () => {
    const store = startStore();
    await loaded(store);
    const { steps, session } = sampleRun('r1', 3);
    store.recordPieceStep(steps[0]!, sampleHeader('r1'));
    store.recordPieceStep(steps[1]!, null);
    await store.settled();
    // The tab could go away now: the header and the steps are on disk.
    expect((await onDisk()).openPieceRuns).toEqual([sampleHeader('r1')]);
    store.recordPieceStep(steps[2]!, null);
    store.finishPieceRun('r1', session);
    expect(store.getSnapshot().sessions).toEqual([session]);
    await store.settled();
    const disk = await onDisk();
    expect(disk.openPieceRuns).toEqual([]);
    expect(disk.sessions).toEqual([session]);
  });

  it('rebuilds the session of a run whose tab went away, from its header and steps', async () => {
    const { steps } = sampleRun('r1', 5, {}, {});
    const header = sampleHeader('r1', {
      loop: { from: 0, to: 3, fromLabel: '1', toLabel: '4' },
      tempo: 70,
      startedAt: steps[0]!.at - steps[0]!.ms,
    });
    await seed(async (repo) => {
      await repo.addPieceStep(steps[0]!, header);
      for (const step of steps.slice(1)) await repo.addPieceStep(step, null);
    });
    const store = startStore();
    await loaded(store);
    const [recovered] = store.getSnapshot().sessions;
    expect(recovered).toEqual({
      kind: 'piece',
      ...header,
      endedAt: steps.at(-1)!.at,
      activeMs: steps.reduce((n, s) => n + s.ms, 0),
      steps: 5,
      wrong: steps.reduce((n, s) => n + s.wrong, 0),
      completed: false,
    });
    const disk = await onDisk();
    expect(disk.sessions).toEqual([recovered]);
    expect(disk.openPieceRuns).toEqual([]);
  });

  it('drops the header of a run that recorded no step, and keeps a session recorded later', async () => {
    const { steps, session } = sampleRun('r2', 4);
    await seed(async (repo) => {
      await repo.finishPieceRun('none', null);
      await repo.addPieceStep(steps[0]!, sampleHeader('r2'));
      await repo.putSession(session);
    });
    // A header without steps (a run whose first step never reached the disk).
    const db = await openDacapoDB();
    await db.put('meta', sampleHeader('empty'), 'pieceRun:empty');
    db.close();
    const store = startStore();
    await loaded(store);
    expect(store.getSnapshot().sessions).toEqual([session]);
    expect((await onDisk()).openPieceRuns).toEqual([]);
  });

  it('reads step records lazily, one piece at a time', async () => {
    const minuet = sampleRun('r1', 4);
    const other = sampleRun('r2', 3, { pieceId: 'other' });
    await seed(async (repo) => {
      for (const step of [...minuet.steps, ...other.steps]) await repo.addPieceStep(step, null);
    });
    const store = startStore();
    await loaded(store);
    expect(store.getPieceSteps('petzold-minuet-in-g')).toBeNull();
    store.loadPieceSteps('petzold-minuet-in-g');
    // A step recorded while the piece is being read is not lost.
    const late = { ...minuet.steps[0]!, id: 'late', at: T0 + 99_000 };
    store.recordPieceStep(late, null);
    await vi.waitFor(() => expect(store.getPieceSteps('petzold-minuet-in-g')).not.toBeNull());
    expect(store.getPieceSteps('petzold-minuet-in-g')).toEqual([...minuet.steps, late]);
    expect(store.getPieceSteps('other')).toBeNull();
    const before = store.getPieceSteps('petzold-minuet-in-g');
    store.loadPieceSteps('petzold-minuet-in-g');
    expect(store.getPieceSteps('petzold-minuet-in-g')).toBe(before);
  });

  it('keeps two tabs in step: new steps, sessions, deleted records and imports', async () => {
    const tabA = startStore();
    const tabB = startStore();
    await loaded(tabA);
    await loaded(tabB);
    tabA.savePiece(samplePiece(1));
    tabB.loadPieceSteps('p1');
    await vi.waitFor(() => expect(tabB.getPieceSteps('p1')).toEqual([]));

    const { steps, session } = sampleRun('r1', 3, { pieceId: 'p1' });
    tabA.recordPieceStep(steps[0]!, sampleHeader('r1', { pieceId: 'p1' }));
    tabA.recordPieceStep(steps[1]!, null);
    tabA.recordPieceStep(steps[2]!, null);
    tabA.finishPieceRun('r1', session);
    await vi.waitFor(() => expect(tabB.getPieceSteps('p1')).toEqual(steps));
    await vi.waitFor(() => expect(tabB.getSnapshot().sessions).toEqual([session]));

    tabA.deletePiece('p1', { steps: true });
    await vi.waitFor(() => expect(tabB.getPieceSteps('p1')).toEqual([]));
    expect(tabB.getSnapshot().sessions).toEqual([session]);
    await tabA.settled();
    expect(await tabA.allPieceSteps()).toEqual([]);

    // An import elsewhere: the cache is read again when next asked for. (Step records of p1 would
    // not come back: it was deleted with them.)
    const more = sampleRun('r2', 2, { pieceId: 'p2' });
    await tabA.importData({
      sessions: [],
      attempts: [],
      pieces: [],
      pieceSteps: [...more.steps, ...sampleRun('r3', 1, { pieceId: 'p1' }).steps],
      scaleRuns: [],
      answers: [],
      takes: [],
    });
    await vi.waitFor(() => expect(tabB.getPieceSteps('p1')).toBeNull());
    tabB.loadPieceSteps('p2');
    await vi.waitFor(() => expect(tabB.getPieceSteps('p2')).toEqual(more.steps));
    expect(await tabB.pieceStepIds()).toEqual(new Set(more.steps.map((s) => s.id)));
  });
});

describe('reloads', () => {
  it('wait until this tab stops practising when another tab asks for one', async () => {
    let practising = true;
    const ends = new Set<() => void>();
    const tabA = startStore();
    const tabB = startStore({
      practice: {
        isPractising: () => practising,
        onPracticeEnd: (listener) => {
          ends.add(listener);
          return () => void ends.delete(listener);
        },
      },
    });
    await loaded(tabA);
    await loaded(tabB);
    await tabA.importData({
      sessions: [freeSession('f1', T0)],
      attempts: [],
      pieces: [],
      pieceSteps: [],
      scaleRuns: [],
      answers: [],
      takes: [],
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(tabB.getSnapshot().sessions).toEqual([]);
    practising = false;
    for (const end of ends) end();
    await vi.waitFor(() => expect(tabB.getSnapshot().sessions).toEqual([freeSession('f1', T0)]));
  });

  it('wait until this tab stops practising when sync asks for one', async () => {
    let practising = true;
    const ends = new Set<() => void>();
    const store = startStore({
      practice: {
        isPractising: () => practising,
        onPracticeEnd: (listener) => {
          ends.add(listener);
          return () => void ends.delete(listener);
        },
      },
    });
    await loaded(store);
    await seed((repo) => repo.putSession(freeSession('f1', T0)));
    await store.reloadAll();
    expect(store.getSnapshot().sessions).toEqual([]);
    practising = false;
    for (const end of ends) end();
    await vi.waitFor(() => expect(store.getSnapshot().sessions).toEqual([freeSession('f1', T0)]));
  });

  it('never finish a run that is still being played', async () => {
    const store = startStore();
    await loaded(store);
    const { steps } = sampleRun('r1', 2, { pieceId: 'p1' });
    store.recordPieceStep(steps[0]!, sampleHeader('r1', { pieceId: 'p1' }));
    await store.settled();
    await store.reloadAll();
    expect(store.getSnapshot().sessions).toEqual([]);
    expect((await onDisk()).openPieceRuns).toEqual([sampleHeader('r1', { pieceId: 'p1' })]);
  });
});

describe('scale runs', () => {
  it('records each run with its session, which the snapshot has at once', async () => {
    const store = startStore();
    await loaded(store);
    const one = sampleScaleSession('k1', 1);
    const two = sampleScaleSession('k1', 2);
    store.recordScaleRun(one.runs[0]!, one.session);
    expect(store.getSnapshot().sessions).toEqual([one.session]);
    store.recordScaleRun(two.runs[1]!, two.session);
    // The same session, brought up to date.
    expect(store.getSnapshot().sessions).toEqual([two.session]);
    await store.settled();
    expect((await onDisk()).sessions).toEqual([two.session]);
    expect(await store.allScaleRuns()).toEqual(two.runs);
    expect(await store.scaleRunIds()).toEqual(new Set(['k1:0', 'k1:1']));
  });

  it('reads scale runs lazily, one exercise at a time', async () => {
    const { runs, session } = sampleScaleSession('k1', 3);
    const other = sampleScaleRun('k2', 0, { exercise: 'major:D:2:left' });
    await seed(async (repo) => {
      for (const run of runs) await repo.addScaleRun(run, session);
      await repo.addScaleRun(other, { ...session, id: 'k2' });
    });
    const store = startStore();
    await loaded(store);
    expect(store.getScaleRuns('major:C:1:right')).toBeNull();
    store.loadScaleRuns('major:C:1:right');
    // A run recorded while the exercise is being read is not lost.
    const late = sampleScaleRun('k1', 3);
    store.recordScaleRun(late, session);
    await vi.waitFor(() => expect(store.getScaleRuns('major:C:1:right')).not.toBeNull());
    expect(store.getScaleRuns('major:C:1:right')).toEqual([...runs, late]);
    expect(store.getScaleRuns('major:D:2:left')).toBeNull();
    const before = store.getScaleRuns('major:C:1:right');
    store.loadScaleRuns('major:C:1:right');
    expect(store.getScaleRuns('major:C:1:right')).toBe(before);
    // Recorded once loaded: appended.
    const later = sampleScaleRun('k1', 4);
    store.recordScaleRun(later, session);
    expect(store.getScaleRuns('major:C:1:right')).toEqual([...runs, late, later]);
  });

  it('keeps two tabs in step: new runs, their sessions and imports', async () => {
    const tabA = startStore();
    const tabB = startStore();
    await loaded(tabA);
    await loaded(tabB);
    tabB.loadScaleRuns('major:C:1:right');
    await vi.waitFor(() => expect(tabB.getScaleRuns('major:C:1:right')).toEqual([]));

    const one = sampleScaleSession('k1', 1);
    const two = sampleScaleSession('k1', 2);
    tabA.recordScaleRun(one.runs[0]!, one.session);
    tabA.recordScaleRun(two.runs[1]!, two.session);
    await vi.waitFor(() => expect(tabB.getScaleRuns('major:C:1:right')).toEqual(two.runs));
    expect(tabB.getSnapshot().sessions).toEqual([two.session]);

    // An import elsewhere: the cache is read again when next asked for.
    const more = sampleScaleSession('k2', 2, { startedAt: T0 + 3_600_000 });
    await tabA.importData({
      sessions: [more.session],
      attempts: [],
      pieces: [],
      pieceSteps: [],
      scaleRuns: more.runs,
      answers: [],
      takes: [],
    });
    await vi.waitFor(() => expect(tabB.getScaleRuns('major:C:1:right')).toBeNull());
    expect(tabB.getSnapshot().sessions).toEqual([more.session, two.session]);
    tabB.loadScaleRuns('major:C:1:right');
    await vi.waitFor(() =>
      expect(tabB.getScaleRuns('major:C:1:right')).toEqual([...two.runs, ...more.runs]),
    );
    expect(await tabB.scaleRunIds()).toEqual(new Set(['k1:0', 'k1:1', 'k2:0', 'k2:1']));
  });

  it('reports a failed write and keeps the session in memory', async () => {
    const repository: PracticeRepository = {
      ...createMemoryRepository(),
      addScaleRun: () => Promise.reject(new DOMException('full', 'QuotaExceededError')),
    };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = startStore({ open: () => Promise.resolve({ repository, failure: null }) });
    await loaded(store);
    const { runs, session } = sampleScaleSession('k1', 1);
    store.recordScaleRun(runs[0]!, session);
    await store.settled();
    expect(store.getStatus().state).toBe('failed');
    expect(store.getSnapshot().sessions).toEqual([session]);
  });

  it('works in memory when IndexedDB cannot be used', async () => {
    vi.spyOn(indexedDB, 'open').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    const store = startStore();
    await loaded(store);
    expect(store.getStatus().state).toBe('unavailable');
    const { runs, session } = sampleScaleSession('k1', 2);
    for (const run of runs) store.recordScaleRun(run, session);
    store.loadScaleRuns('major:C:1:right');
    await vi.waitFor(() => expect(store.getScaleRuns('major:C:1:right')).toEqual(runs));
    expect(store.getSnapshot().sessions).toEqual([session]);
    expect(await store.allScaleRuns()).toEqual(runs);
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
