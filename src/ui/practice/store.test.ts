import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionRecord } from '../../core/log.ts';
import type { LessonDone } from '../../core/lessonRecords.ts';
import { DB_NAME, DB_VERSION, openDacapoDB, upgrade, type DacapoDB } from '../../storage/db.ts';
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
  sampleChordSymbolAnswers,
  sampleTheoryAnswers,
  sampleRhythmAnswers,
  sampleStoredAssignment,
  sampleStoredReport,
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
        assignments: [],
        lessons: [],
      }),
    );
    const store = startStore();
    expect(store.getStatus()).toEqual({
      state: 'loading',
      loaded: false,
      read: false,
      persisted: null,
    });
    expect(store.getSnapshot().attempts).toEqual([]);
    await loaded(store);
    expect(store.getStatus()).toMatchObject({ state: 'saved', read: true });
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

  it('rebuilds a theory session beside an ear one, each from its own answers', async () => {
    const theory = [...sampleTheoryAnswers(0, 'cards'), ...sampleTheoryAnswers(1, 'cards')];
    const ear = [sampleAnswer(0, 'heard'), sampleAnswer(1, 'heard')];
    await seed(async (repo) => {
      for (const answer of [...theory, ...ear]) await repo.addAnswer(answer);
    });
    const store = startStore();
    await loaded(store);
    const { sessions } = store.getSnapshot();
    expect(sessions).toContainEqual(
      expect.objectContaining({ kind: 'theory', id: 'cards', cards: 8, correct: 4 }),
    );
    expect(sessions).toContainEqual(
      expect.objectContaining({ kind: 'ear', id: 'heard', items: 2 }),
    );
    expect((await onDisk()).sessions.map((s) => s.id).sort()).toEqual(['cards', 'heard']);
  });

  it('rebuilds a rhythm session from its answers, apart from the others', async () => {
    const rhythm = [...sampleRhythmAnswers(0, 'lines'), ...sampleRhythmAnswers(1, 'lines')];
    const ear = [sampleAnswer(0, 'heard')];
    await seed(async (repo) => {
      for (const answer of [...rhythm, ...ear]) await repo.addAnswer(answer);
    });
    const store = startStore();
    await loaded(store);
    const { sessions } = store.getSnapshot();
    expect(sessions).toContainEqual(
      expect.objectContaining({ kind: 'rhythm', id: 'lines', cells: 8, correct: 6, runs: 2 }),
    );
    expect(sessions).toContainEqual(
      expect.objectContaining({ kind: 'ear', id: 'heard', items: 1 }),
    );
    expect((await onDisk()).sessions.map((s) => s.id).sort()).toEqual(['heard', 'lines']);
  });

  it('rebuilds a Harmony session from its chord-symbol answers', async () => {
    const symbols = [
      ...sampleChordSymbolAnswers(0, 'chords'),
      ...sampleChordSymbolAnswers(1, 'chords'),
    ];
    await seed(async (repo) => {
      for (const answer of symbols) await repo.addAnswer(answer);
    });
    const store = startStore();
    await loaded(store);
    expect(store.getSnapshot().sessions).toEqual([
      expect.objectContaining({ kind: 'harmony', id: 'chords', cards: 4, correct: 2 }),
    ]);
    expect((await onDisk()).sessions.map((s) => s.id)).toEqual(['chords']);
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
      assignments: [],
      lessons: [],
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

  it('takes pieces out of review: an imported one on itself, a built-in one on this device', async () => {
    const tabA = startStore();
    const tabB = startStore();
    await loaded(tabA);
    await loaded(tabB);
    tabA.savePiece(samplePiece(1));
    tabA.setPieceReview('p1', false);
    tabA.setPieceReview('petzold-minuet-in-g', false);
    const piece = tabA.getSnapshot().pieces[0]!;
    expect(piece.review).toBe(false);
    // A change of the piece: later than its import, so it syncs and wins.
    expect(piece.updatedAt).toBeGreaterThan(samplePiece(1).importedAt);
    expect(tabA.getSnapshot().reviewOff).toEqual(['petzold-minuet-in-g']);
    await vi.waitFor(() => {
      expect(tabB.getSnapshot().reviewOff).toEqual(['petzold-minuet-in-g']);
      expect(tabB.getSnapshot().pieces[0]?.review).toBe(false);
    });
    await tabA.settled();
    expect((await onDisk()).reviewOff).toEqual(['petzold-minuet-in-g']);

    // And back.
    tabB.setPieceReview('p1', true);
    tabB.setPieceReview('petzold-minuet-in-g', true);
    expect('review' in tabB.getSnapshot().pieces[0]!).toBe(false);
    await vi.waitFor(() => expect(tabA.getSnapshot().reviewOff).toEqual([]));
    await tabB.settled();
    const stored = await onDisk();
    expect(stored.reviewOff).toEqual([]);
    expect(stored.pieces[0]!.review).toBeUndefined();
  });

  it('saves, changes and deletes assignments and kept reports, each change the later copy', async () => {
    const tabA = startStore();
    const tabB = startStore();
    await loaded(tabA);
    await loaded(tabB);
    const now = vi.spyOn(Date, 'now').mockReturnValue(T0 + 5_000_000);
    const assignment = sampleStoredAssignment(1);
    tabA.saveAssignment(assignment);
    tabA.saveAssignment(sampleStoredReport(1));
    // The store gives each record its version: the moment it was saved.
    expect(tabA.getSnapshot().assignments.map((r) => [r.id, r.updatedAt])).toEqual([
      [assignment.id, T0 + 5_000_000],
      ['report-0001', T0 + 5_000_000],
    ]);
    await vi.waitFor(() =>
      expect(tabB.getSnapshot().assignments).toEqual(tabA.getSnapshot().assignments),
    );
    // A change on a device whose clock is behind is still later than the copy it changes.
    now.mockReturnValue(T0);
    tabB.saveAssignment({ ...assignment, following: true });
    expect(tabB.getSnapshot().assignments[0]).toMatchObject({
      following: true,
      updatedAt: T0 + 5_000_001,
    });
    tabB.deleteAssignment('report-0001');
    tabB.deleteAssignment('never-stored');
    await vi.waitFor(() =>
      expect(tabA.getSnapshot().assignments).toEqual(tabB.getSnapshot().assignments),
    );
    expect(tabA.getSnapshot().assignments[1]).toEqual({
      id: 'report-0001',
      type: 'report',
      deleted: true,
      updatedAt: T0 + 5_000_001,
    });
    // Deleting it again changes nothing; adding it again is later than its deletion.
    tabA.deleteAssignment('report-0001');
    tabA.saveAssignment(sampleStoredReport(1));
    expect(tabA.getSnapshot().assignments[1]).toMatchObject({
      type: 'report',
      updatedAt: T0 + 5_000_002,
    });
    await tabA.settled();
    await tabB.settled();
    expect((await onDisk()).assignments).toEqual(tabA.getSnapshot().assignments);
    // And the next start finds them.
    const later = startStore();
    await loaded(later);
    expect(later.getSnapshot().assignments).toEqual(tabA.getSnapshot().assignments);
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

describe('lessons finished', () => {
  const tick = (slug: string, doneAt: number): LessonDone => ({ slug, doneAt });
  /** The ticks an earlier version kept in the preferences: slugs without a time. */
  const legacy =
    (...slugs: string[]) =>
    () =>
      slugs.map((slug) => tick(slug, 0));

  /** A repository whose calls to `markLessons` are counted, and can be held or made to fail. */
  function watched(hold: Promise<void> = Promise.resolve(), fail = false) {
    const calls: LessonDone[][] = [];
    const open: PracticeStoreOptions['open'] = async (handlers) => {
      const opened = await openRepository(handlers);
      const { repository } = opened;
      const markLessons: PracticeRepository['markLessons'] = async (records) => {
        calls.push([...records]);
        await hold;
        if (fail) throw new DOMException('full', 'QuotaExceededError');
        return repository.markLessons(records);
      };
      return { ...opened, repository: { ...repository, markLessons } };
    };
    return { calls, open };
  }

  it('ticks a lesson once, with now as its time, and keeps the other tab in step', async () => {
    const tabA = startStore();
    const tabB = startStore();
    await loaded(tabA);
    await loaded(tabB);
    const now = vi.spyOn(Date, 'now').mockReturnValue(T0 + 1000);
    tabA.markLesson('staff');
    // Ticked at once; saved in the background.
    expect(tabA.getSnapshot().lessons).toEqual([tick('staff', T0 + 1000)]);
    await vi.waitFor(() => expect(tabB.getSnapshot().lessons).toEqual([tick('staff', T0 + 1000)]));
    // Finished again, here or in the other tab: the tick is not moved.
    now.mockReturnValue(T0 + 9000);
    tabA.markLesson('staff');
    tabB.markLesson('staff');
    tabB.markLesson('keyboard');
    // Not a lesson's slug (an exercise outside a lesson): nothing is ticked.
    tabB.markLesson('');
    tabB.markLesson('Not a slug');
    await tabA.settled();
    await tabB.settled();
    const ticked = [tick('keyboard', T0 + 9000), tick('staff', T0 + 1000)];
    await vi.waitFor(() => expect(tabA.getSnapshot().lessons).toEqual(ticked));
    expect(tabB.getSnapshot().lessons).toEqual(ticked);
    expect((await onDisk()).lessons).toEqual(ticked);
    expect(tabA.getStatus().state).toBe('saved');
    // And the next start finds them.
    const later = startStore();
    await loaded(later);
    expect(later.getSnapshot().lessons).toEqual(ticked);
  });

  it('keeps the earlier time when two tabs finish the same lesson at once', async () => {
    const tabA = startStore();
    const tabB = startStore();
    await loaded(tabA);
    await loaded(tabB);
    const now = vi.spyOn(Date, 'now').mockReturnValue(T0 + 2000);
    tabA.markLesson('staff');
    now.mockReturnValue(T0 + 1000);
    tabB.markLesson('staff');
    await tabA.settled();
    await tabB.settled();
    expect((await onDisk()).lessons).toEqual([tick('staff', T0 + 1000)]);
    await vi.waitFor(() => expect(tabA.getSnapshot().lessons).toEqual([tick('staff', T0 + 1000)]));
    expect(tabB.getSnapshot().lessons).toEqual([tick('staff', T0 + 1000)]);
  });

  it('moves the ticks an earlier version kept in the preferences into a version 8 database, with everything else as it was', async () => {
    // What a version 8 build left: a database without the store, and its records.
    const old = await openDB(DB_NAME, 8, {
      upgrade: (database, oldVersion) => upgrade(database as DacapoDB, oldVersion, 8),
    });
    const { sessions, attempts } = sampleData();
    const tx = old.transaction(['sessions', 'attempts'], 'readwrite');
    for (const session of sessions) void tx.objectStore('sessions').put(session);
    for (const attempt of attempts) void tx.objectStore('attempts').put(attempt);
    await tx.done;
    old.close();

    const source = vi.fn(legacy('staff', 'keyboard', 'inside'));
    const store = startStore({ legacyLessons: source });
    await loaded(store);
    // In the snapshot the moment the stored data is: nothing is made from records without them.
    const moved = [tick('inside', 0), tick('keyboard', 0), tick('staff', 0)];
    expect(store.getSnapshot().lessons).toEqual(moved);
    expect(store.getSnapshot().attempts).toEqual(attempts);
    expect(store.getSnapshot().sessions).toHaveLength(sessions.length);
    expect(store.getStatus().state).toBe('saved');
    await store.settled();
    const disk = await onDisk();
    expect(disk.lessons).toEqual(moved);
    expect(disk.attempts).toEqual(attempts);
    expect(disk.sessions).toHaveLength(sessions.length);
    // The preference is read, once per start; the store has no way to change it.
    expect(source).toHaveBeenCalledTimes(1);
  });

  it('moves them once: a later start writes nothing, and a tick added to the preference since is taken in', async () => {
    const first = watched();
    const one = startStore({ open: first.open, legacyLessons: legacy('staff', 'keyboard') });
    await loaded(one);
    expect(first.calls).toEqual([[tick('staff', 0), tick('keyboard', 0)]]);
    const now = vi.spyOn(Date, 'now').mockReturnValue(T0 + 1000);
    one.markLesson('rhythm');
    now.mockRestore();
    await one.settled();
    const ticked = [tick('keyboard', 0), tick('rhythm', T0 + 1000), tick('staff', 0)];
    expect((await onDisk()).lessons).toEqual(ticked);

    // The preference is still there, as it was: nothing is moved again.
    const second = watched();
    const two = startStore({ open: second.open, legacyLessons: legacy('staff', 'keyboard') });
    await loaded(two);
    expect(second.calls).toEqual([]);
    expect(two.getSnapshot().lessons).toEqual(ticked);

    // A tab of the earlier version, still open, ticked two more in the preference: one not
    // ticked here (taken in), one ticked here with its time (before anything else from now on).
    const third = watched();
    const three = startStore({
      open: third.open,
      legacyLessons: legacy('staff', 'keyboard', 'landmarks', 'rhythm'),
    });
    await loaded(three);
    expect(third.calls).toEqual([[tick('landmarks', 0), tick('rhythm', 0)]]);
    const all = [tick('keyboard', 0), tick('landmarks', 0), tick('rhythm', 0), tick('staff', 0)];
    expect(three.getSnapshot().lessons).toEqual(all);
    expect((await onDisk()).lessons).toEqual(all);
  });

  it('never un-ticks: what is stored stays, and a stored time gives way only to no time', async () => {
    await seed((repo) =>
      repo.markLessons([tick('staff', T0), tick('rhythm', T0 + 5), tick('later-build', T0)]),
    );
    const store = startStore({ legacyLessons: legacy('staff', 'keyboard') });
    await loaded(store);
    const after = [
      tick('keyboard', 0),
      tick('later-build', T0),
      tick('rhythm', T0 + 5),
      tick('staff', 0),
    ];
    expect(store.getSnapshot().lessons).toEqual(after);
    expect((await onDisk()).lessons).toEqual(after);
    // No preference at all (a new browser): the stored ticks are simply read.
    const fresh = startStore();
    await loaded(fresh);
    expect(fresh.getSnapshot().lessons).toEqual(after);
  });

  it('loses no tick earned while the move runs, in this tab or another', async () => {
    let release: () => void = () => {};
    const hold = new Promise<void>((resolve) => (release = resolve));
    const moving = watched(hold);
    const store = startStore({ open: moving.open, legacyLessons: legacy('staff', 'keyboard') });
    // The move has begun and waits: storage is open, the stored data is not in yet.
    await vi.waitFor(() => expect(moving.calls).toHaveLength(1));
    expect(store.getStatus().loaded).toBe(false);
    const now = vi.spyOn(Date, 'now').mockReturnValue(T0 + 1000);
    // In this tab: a lesson finished before the stored data is in.
    store.markLesson('rhythm');
    // In another tab, whose own move went through already: a lesson that is not in the
    // preference, and one of those being moved here, finished again there with a time.
    const other = startStore();
    await loaded(other);
    other.markLesson('landmarks');
    other.markLesson('staff');
    await other.settled();
    expect((await onDisk()).lessons).toEqual([
      tick('landmarks', T0 + 1000),
      tick('staff', T0 + 1000),
    ]);
    now.mockRestore();
    release();
    await loaded(store);
    await store.settled();

    const all = [
      tick('keyboard', 0),
      tick('landmarks', T0 + 1000),
      tick('rhythm', T0 + 1000),
      tick('staff', 0),
    ];
    expect((await onDisk()).lessons).toEqual(all);
    await vi.waitFor(() => expect(store.getSnapshot().lessons).toEqual(all));
    expect(store.getStatus().state).toBe('saved');
  });

  it('shows the ticks even when the move cannot be written, and says that saving failed', async () => {
    await seed((repo) => repo.markLessons([tick('rhythm', T0)]));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const failing = watched(Promise.resolve(), true);
    const store = startStore({ open: failing.open, legacyLessons: legacy('staff') });
    await loaded(store);
    expect(store.getSnapshot().lessons).toEqual([tick('rhythm', T0), tick('staff', 0)]);
    expect(store.getStatus().state).toBe('failed');
    // Nothing stored was touched; the next start tries again.
    expect((await onDisk()).lessons).toEqual([tick('rhythm', T0)]);
    const next = startStore({ legacyLessons: legacy('staff') });
    await loaded(next);
    expect(next.getStatus().state).toBe('saved');
    expect((await onDisk()).lessons).toEqual([tick('rhythm', T0), tick('staff', 0)]);
  });

  it('keeps the ticks on screen through a reload when the move could not be written', async () => {
    await seed((repo) => repo.markLessons([tick('rhythm', T0)]));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const failing = watched(Promise.resolve(), true);
    const source = vi.fn(legacy('staff', 'rhythm'));
    const store = startStore({ open: failing.open, legacyLessons: source });
    await loaded(store);
    // Shown, not stored: `rhythm` without a time is before the stored copy, as at every merge.
    const shown = [tick('rhythm', 0), tick('staff', 0)];
    expect(store.getSnapshot().lessons).toEqual(shown);
    expect((await onDisk()).lessons).toEqual([tick('rhythm', T0)]);

    // A sync pull reads everything again.
    await store.reloadAll();
    expect(store.getSnapshot().lessons).toEqual(shown);
    // An import in this tab: what it adds arrives, and the ticks shown stay.
    const empty = {
      sessions: [],
      attempts: [],
      pieces: [],
      pieceSteps: [],
      scaleRuns: [],
      answers: [],
      takes: [],
      assignments: [],
    };
    await store.importData({ ...empty, lessons: [tick('keyboard', T0 + 5)] });
    const withImport = [tick('keyboard', T0 + 5), ...shown];
    expect(store.getSnapshot().lessons).toEqual(withImport);
    // An import in another tab, which tells this one to read again.
    const other = startStore();
    await loaded(other);
    await other.importData({ ...empty, lessons: [tick('landmarks', T0 + 6)] });
    const all = [tick('keyboard', T0 + 5), tick('landmarks', T0 + 6), ...shown];
    await vi.waitFor(() => expect(store.getSnapshot().lessons).toEqual(all));
    await store.settled();
    expect(store.getSnapshot().lessons).toEqual(all);
    // Reading again wrote nothing: what is stored is what the imports and nothing else left.
    expect(failing.calls).toHaveLength(1);
    expect((await onDisk()).lessons).toEqual([
      tick('keyboard', T0 + 5),
      tick('landmarks', T0 + 6),
      tick('rhythm', T0),
    ]);
    // The preference was only ever read.
    expect(source.mock.calls.every((args) => args.length === 0)).toBe(true);
  });

  it('reads again as it reads at startup when the move went through: nothing is added twice', async () => {
    const moving = watched();
    const store = startStore({ open: moving.open, legacyLessons: legacy('staff') });
    await loaded(store);
    const now = vi.spyOn(Date, 'now').mockReturnValue(T0 + 1000);
    store.markLesson('keyboard');
    now.mockRestore();
    await store.reloadAll();
    await store.reloadAll();
    const ticked = [tick('keyboard', T0 + 1000), tick('staff', 0)];
    expect(store.getSnapshot().lessons).toEqual(ticked);
    expect((await onDisk()).lessons).toEqual(ticked);
    expect(moving.calls).toEqual([[tick('staff', 0)], [tick('keyboard', T0 + 1000)]]);
  });

  it('shows the ticks of the preference when the stored data cannot be loaded', async () => {
    await seed((repo) => repo.markLessons([tick('rhythm', T0)]));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const marked: LessonDone[][] = [];
    const open: PracticeStoreOptions['open'] = async (handlers) => {
      await gate;
      const opened = await openRepository(handlers);
      const { repository } = opened;
      return {
        ...opened,
        repository: {
          ...repository,
          load: () => Promise.reject(new DOMException('broken', 'UnknownError')),
          markLessons: (records) => {
            marked.push([...records]);
            return repository.markLessons(records);
          },
        },
      };
    };
    const store = startStore({ open, legacyLessons: legacy('staff', 'keyboard') });
    // A lesson finished before storage opened.
    const now = vi.spyOn(Date, 'now').mockReturnValue(T0 + 1000);
    store.markLesson('landmarks');
    now.mockRestore();
    release();
    await loaded(store);
    await store.settled();
    // Nothing stored could be read: the preference's ticks and the one earned here are shown,
    // the status says the records were not read, and nothing of the preference was written.
    expect(store.getSnapshot().lessons).toEqual([
      tick('keyboard', 0),
      tick('landmarks', T0 + 1000),
      tick('staff', 0),
    ]);
    expect(store.getStatus()).toMatchObject({ state: 'failed', loaded: true, read: false });
    expect(marked).toEqual([[tick('landmarks', T0 + 1000)]]);
    expect((await onDisk()).lessons).toEqual([tick('landmarks', T0 + 1000), tick('rhythm', T0)]);
  });

  it('keeps them in memory when IndexedDB cannot be used', async () => {
    vi.spyOn(indexedDB, 'open').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    const store = startStore({ legacyLessons: legacy('staff') });
    await loaded(store);
    // Nothing stored was read: what is here is this tab's alone.
    expect(store.getStatus()).toMatchObject({ state: 'unavailable', loaded: true, read: false });
    store.markLesson('keyboard');
    expect(store.getSnapshot().lessons.map((l) => l.slug)).toEqual(['keyboard', 'staff']);
  });

  it('runs in memory over a database of a later version, says so, and leaves it untouched', async () => {
    // What a later build left: records, an account signed in to sync (a write would be queued),
    // a version this build does not know and a store it does not know.
    await seed(async (repo) => {
      const { sessions, attempts } = sampleData();
      for (const attempt of attempts) await repo.addAttempt(attempt);
      for (const session of sessions) await repo.putSession(session);
      await repo.putPiece(samplePiece(1));
      await repo.markLessons([tick('rhythm', T0)]);
      await repo.sync!.signIn({ id: 'acc', email: 'pianist@example.com' }, 'token-1');
    });
    const later = await openDB(DB_NAME, DB_VERSION + 1, {
      upgrade: (db) => void db.createObjectStore('later'),
    });
    await later.put('later', { made: 'by a later build' }, 'record');
    /** The version, and every store's keys and records, as text. */
    const dump = async () => {
      const names = [...later.objectStoreNames];
      const read = later.transaction(names);
      const out: Record<string, string> = { version: String(later.version) };
      for (const name of names) {
        const store = read.objectStore(name);
        out[`store ${name}`] = JSON.stringify([await store.getAllKeys(), await store.getAll()]);
      }
      await read.done;
      return out;
    };
    const before = await dump();
    expect(before['store outbox']).not.toBe('[[],[]]');
    expect(before['store lessons']).toContain('rhythm');

    const channel = vi.fn(() => broadcastChannel(channelName));
    const persistent: PersistentStorage = { persisted: vi.fn(), persist: vi.fn() };
    const store = startStore({ channel, storage: persistent, legacyLessons: legacy('staff') });
    await loaded(store);
    // The notice with Reload (the state the page reads); nothing of what is stored was read.
    expect(store.getStatus()).toEqual({
      state: 'newer',
      loaded: true,
      read: false,
      persisted: null,
    });
    expect(store.getSnapshot().attempts).toEqual([]);
    expect(store.getSnapshot().lessons).toEqual([tick('staff', 0)]);

    // The app runs: everything a page can ask of the store, held in this tab alone.
    const now = vi.spyOn(Date, 'now').mockReturnValue(T0 + 1000);
    store.markLesson('keyboard');
    store.recordAttempt(sampleAttempt(40));
    store.recordSession(freeSession('here', T0));
    store.savePiece(samplePiece(2));
    store.deletePiece('p1', { steps: true });
    store.saveAssignment(sampleStoredAssignment(1));
    store.deleteAssignment(sampleStoredAssignment(1).id);
    const added = await store.importData({
      sessions: [],
      attempts: [sampleAttempt(41)],
      pieces: [],
      pieceSteps: [],
      scaleRuns: [],
      answers: [],
      takes: [],
      assignments: [],
      lessons: [tick('landmarks', T0)],
    });
    now.mockRestore();
    await store.reloadAll();
    await store.settled();
    expect(added).toMatchObject({ attempts: 1, lessons: 1 });
    expect(store.getSnapshot().lessons).toEqual([
      tick('keyboard', T0 + 1000),
      tick('landmarks', T0),
      tick('staff', 0),
    ]);
    expect(store.getSnapshot().attempts.map((a) => a.id)).toEqual(['a40', 'a41']);
    expect(store.getStatus().state).toBe('newer');

    // Sync is off: there is no sync storage to run a task on, so nothing is sent or queued.
    const task = vi.fn(() => Promise.resolve('ran'));
    expect(await store.withSync(task)).toBeNull();
    expect(task).not.toHaveBeenCalled();
    // No other tab is told anything, and the browser is not asked to keep what it cannot hold.
    expect(channel).not.toHaveBeenCalled();
    expect(persistent.persisted).not.toHaveBeenCalled();
    expect(persistent.persist).not.toHaveBeenCalled();

    // The database is as the later build left it: byte for byte, at its version.
    expect(await dump()).toEqual(before);
    later.close();
    const again = await openDB(DB_NAME);
    expect(again.version).toBe(DB_VERSION + 1);
    again.close();
  });

  it('takes in the ticks of an imported file, the earlier time kept, in every tab', async () => {
    const tabA = startStore();
    const tabB = startStore();
    await loaded(tabA);
    await loaded(tabB);
    const now = vi.spyOn(Date, 'now').mockReturnValue(T0 + 5000);
    tabA.markLesson('staff');
    tabA.markLesson('keyboard');
    now.mockRestore();
    const added = await tabA.importData({
      sessions: [],
      attempts: [],
      pieces: [],
      pieceSteps: [],
      scaleRuns: [],
      answers: [],
      takes: [],
      assignments: [],
      lessons: [tick('staff', T0), tick('keyboard', T0 + 9000), tick('rhythm', 0)],
    });
    expect(added.lessons).toBe(2);
    const merged = [tick('keyboard', T0 + 5000), tick('rhythm', 0), tick('staff', T0)];
    expect(tabA.getSnapshot().lessons).toEqual(merged);
    await vi.waitFor(() => expect(tabB.getSnapshot().lessons).toEqual(merged));
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

  it('reads the steps of the runs asked for, across pieces, without keeping them', async () => {
    const r1 = sampleRun('r1', 4);
    const r2 = sampleRun('r2', 3, { pieceId: 'other' });
    const r3 = sampleRun('r3', 2);
    await seed(async (repo) => {
      for (const step of [...r1.steps, ...r2.steps, ...r3.steps])
        await repo.addPieceStep(step, null);
    });
    const store = startStore();
    await loaded(store);
    expect(await store.sessionPieceSteps(['r2', 'r1'])).toEqual([...r2.steps, ...r1.steps]);
    expect(await store.sessionPieceSteps([])).toEqual([]);
    expect(store.getPieceSteps('petzold-minuet-in-g')).toBeNull();
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
      assignments: [],
      lessons: [],
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
      assignments: [],
      lessons: [],
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

  it('reads the runs of the sessions asked for, across exercises, without keeping them', async () => {
    const k1 = sampleScaleSession('k1', 2);
    const k2 = sampleScaleSession('k2', 1, { exercise: 'major:D:2:left' });
    const k3 = sampleScaleSession('k3', 1);
    await seed(async (repo) => {
      for (const { runs, session } of [k1, k2, k3]) {
        for (const run of runs) await repo.addScaleRun(run, session);
      }
    });
    const store = startStore();
    await loaded(store);
    expect(await store.sessionScaleRuns(['k1', 'k2'])).toEqual([...k1.runs, ...k2.runs]);
    expect(store.getScaleRuns('major:C:1:right')).toBeNull();
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
      assignments: [],
      lessons: [],
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
