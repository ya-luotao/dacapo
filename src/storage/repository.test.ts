import 'fake-indexeddb/auto';
import { openDB, type IDBPDatabase } from 'idb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { byStepTime, stepMode } from '../core/pieceRecords.ts';
import { statsFromAttempts } from '../core/weakness.ts';
import { DB_NAME, DB_VERSION, openDacapoDB, type DacapoDB } from './db.ts';
import {
  resetIndexedDB,
  sampleAttempt,
  sampleData,
  sampleHeader,
  samplePiece,
  sampleRhythmRun,
  sampleRun,
  sampleStep,
  T0,
} from './fixtures.ts';
import {
  createIndexedDbRepository,
  createMemoryRepository,
  openRepository,
  type PracticeRepository,
} from './repository.ts';

let open: DacapoDB[] = [];

async function openDb(): Promise<DacapoDB> {
  const db = await openDacapoDB();
  open.push(db);
  return db;
}

beforeEach(() => {
  resetIndexedDB();
  open = [];
});

afterEach(() => {
  for (const db of open) db.close();
  vi.restoreAllMocks();
});

describe('schema', () => {
  it('creates the six stores with their keys and indexes', async () => {
    const db = await openDb();
    expect(db.version).toBe(DB_VERSION);
    expect(DB_VERSION).toBe(3);
    expect([...db.objectStoreNames].sort()).toEqual([
      'attempts',
      'meta',
      'noteStats',
      'pieceSteps',
      'pieces',
      'sessions',
    ]);
    const tx = db.transaction([
      'attempts',
      'noteStats',
      'sessions',
      'meta',
      'pieces',
      'pieceSteps',
    ]);
    expect(tx.objectStore('noteStats').keyPath).toBe('key');
    expect(tx.objectStore('sessions').keyPath).toBe('id');
    expect(tx.objectStore('attempts').keyPath).toBe('id');
    expect(tx.objectStore('meta').keyPath).toBeNull();
    expect(tx.objectStore('sessions').autoIncrement).toBe(false);
    expect(tx.objectStore('attempts').autoIncrement).toBe(false);
    expect([...tx.objectStore('sessions').indexNames]).toEqual(['by-start']);
    expect([...tx.objectStore('attempts').indexNames].sort()).toEqual(['by-note', 'by-session']);
    expect(tx.objectStore('attempts').index('by-session').keyPath).toBe('sessionId');
    expect(tx.objectStore('attempts').index('by-note').keyPath).toBe('note');
    expect(tx.objectStore('sessions').index('by-start').keyPath).toBe('startedAt');
    expect(tx.objectStore('pieces').keyPath).toBe('id');
    expect(tx.objectStore('pieces').index('by-imported').keyPath).toBe('importedAt');
    const steps = tx.objectStore('pieceSteps');
    expect(steps.keyPath).toBe('id');
    expect([...steps.indexNames].sort()).toEqual(['by-piece', 'by-session']);
    expect(steps.index('by-piece').keyPath).toBe('pieceId');
    expect(steps.index('by-session').keyPath).toBe('sessionId');
    await tx.done;
  });

  /** Version 1 exactly as release 0.1.0 created it. */
  function createV1(db: IDBPDatabase) {
    db.createObjectStore('noteStats', { keyPath: 'key' });
    const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
    sessions.createIndex('by-start', 'startedAt');
    const attempts = db.createObjectStore('attempts', { keyPath: 'id' });
    attempts.createIndex('by-session', 'sessionId');
    attempts.createIndex('by-note', 'note');
    db.createObjectStore('meta');
  }

  /** Version 2 as the Pieces release P1–P2 created it: version 1 plus the pieces store. */
  function createV2(db: IDBPDatabase, oldVersion: number) {
    if (oldVersion < 1) createV1(db);
    const pieces = db.createObjectStore('pieces', { keyPath: 'id' });
    pieces.createIndex('by-imported', 'importedAt');
  }

  async function seedOld(version: 1 | 2) {
    const old = await openDB(DB_NAME, version, {
      upgrade: (db, oldVersion) => (version === 1 ? createV1(db) : createV2(db, oldVersion)),
    });
    const { sessions, attempts } = sampleData();
    const stats = statsFromAttempts(attempts);
    const openRun = { id: 'open', startedAt: T0, lastActivityAt: T0 + 5_000, notes: 3 };
    const stores = [
      'sessions',
      'attempts',
      'noteStats',
      'meta',
      ...(version === 2 ? ['pieces'] : []),
    ];
    const tx = old.transaction(stores, 'readwrite');
    for (const session of sessions) void tx.objectStore('sessions').put(session);
    for (const attempt of attempts) void tx.objectStore('attempts').put(attempt);
    for (const s of Object.values(stats)) void tx.objectStore('noteStats').put(s);
    void tx.objectStore('meta').put(openRun, 'freePlay:open');
    const pieces =
      version === 2 ? [samplePiece(1), samplePiece(2, { hands: { '0.1': 'left' } })] : [];
    for (const piece of pieces) void tx.objectStore('pieces').put(piece);
    await tx.done;
    old.close();
    return { sessions, attempts, stats, openRun, pieces };
  }

  it.each([1, 2] as const)(
    'migrates a version %i database with data to version 3 and keeps everything',
    async (version) => {
      const old = await seedOld(version);
      const db = await openDb();
      expect(db.version).toBe(3);
      const repo = createIndexedDbRepository(db);
      const data = await repo.load();
      expect(data.attempts).toEqual(old.attempts);
      expect(data.sessions.map((s) => s.id).sort()).toEqual(old.sessions.map((s) => s.id).sort());
      expect(data.stats).toEqual(old.stats);
      expect(data.openFreePlay).toEqual([old.openRun]);
      expect(data.openPieceRuns).toEqual([]);
      expect(data.pieces).toEqual([...old.pieces].reverse());
      expect(await db.countFromIndex('attempts', 'by-session', 's2')).toBe(8);
      // The new stores work right away.
      await repo.putPiece(samplePiece(3));
      const { steps, session } = sampleRun('r1', 3);
      await repo.addPieceStep(steps[0]!, sampleHeader('r1'));
      await repo.finishPieceRun('r1', session);
      expect(await db.count('pieces')).toBe(old.pieces.length + 1);
      expect(await repo.pieceSteps({ pieceId: 'petzold-minuet-in-g' })).toEqual([steps[0]]);
      expect((await repo.load()).sessions).toContainEqual(session);
    },
  );

  /** Version 3 as P3 created it, with wait-mode records and a run still open. */
  async function seedV3() {
    const old = await openDB(DB_NAME, 3, {
      upgrade: (db, oldVersion) => {
        createV2(db, oldVersion);
        const steps = db.createObjectStore('pieceSteps', { keyPath: 'id' });
        steps.createIndex('by-piece', 'pieceId');
        steps.createIndex('by-session', 'sessionId');
      },
    });
    const done = sampleRun('w1', 6);
    const openSteps = sampleRun('w2', 2).steps;
    const tx = old.transaction(['sessions', 'pieceSteps', 'meta'], 'readwrite');
    void tx.objectStore('sessions').put(done.session);
    for (const step of [...done.steps, ...openSteps]) void tx.objectStore('pieceSteps').put(step);
    void tx.objectStore('meta').put(sampleHeader('w2'), 'pieceRun:w2');
    await tx.done;
    old.close();
    return { done, openSteps };
  }

  it('opens a version 3 database with wait-mode records, which stay wait mode’s', async () => {
    const old = await seedV3();
    const db = await openDb();
    expect(db.version).toBe(DB_VERSION);
    const repo = createIndexedDbRepository(db);
    const data = await repo.load();
    expect(data.sessions).toEqual([old.done.session]);
    expect(data.openPieceRuns).toEqual([sampleHeader('w2')]);
    // Rhythm-mode records go into the same store beside them.
    const rhythm = sampleRhythmRun('r1', 4);
    await repo.addPieceStep(rhythm.steps[0]!, sampleHeader('r1', { mode: 'rhythm' }));
    for (const step of rhythm.steps.slice(1)) await repo.addPieceStep(step, null);
    await repo.finishPieceRun('r1', rhythm.session);
    const steps = await repo.pieceSteps({ pieceId: 'petzold-minuet-in-g' });
    expect(steps).toEqual([...old.done.steps, ...old.openSteps, ...rhythm.steps].sort(byStepTime));
    expect(steps.filter((s) => stepMode(s) === 'wait')).toHaveLength(8);
    expect(steps.filter((s) => stepMode(s) === 'rhythm')).toEqual(rhythm.steps);
    expect((await repo.load()).sessions).toContainEqual(rhythm.session);
  });

  it('never reads step records at startup', async () => {
    const db = await openDb();
    const repo = createIndexedDbRepository(db);
    for (let n = 0; n < 50; n++) await repo.addPieceStep(sampleStep('r1', n), null);
    const transaction = vi.spyOn(db, 'transaction');
    const data = await repo.load();
    const stores = transaction.mock.calls.flatMap(([names]) => [names].flat());
    expect(stores).not.toContain('pieceSteps');
    expect(Object.keys(data)).not.toContain('pieceSteps');
  });

  it('keeps the data when an existing database is opened again', async () => {
    const repo = createIndexedDbRepository(await openDb());
    await repo.addAttempt(sampleAttempt(1));
    repo.close();
    const again = createIndexedDbRepository(await openDb());
    expect((await again.load()).attempts).toHaveLength(1);
  });

  it('the indexes find attempts by session and by note', async () => {
    const db = await openDb();
    const repo = createIndexedDbRepository(db);
    const { attempts } = sampleData();
    for (const attempt of attempts) await repo.addAttempt(attempt);
    expect(await db.countFromIndex('attempts', 'by-session', 's2')).toBe(8);
    expect(await db.countFromIndex('attempts', 'by-note', 'C4@treble')).toBe(
      attempts.filter((a) => a.note === 'C4@treble').length,
    );
  });
});

describe.each([
  ['indexeddb', async () => createIndexedDbRepository(await openDb())],
  ['memory', () => Promise.resolve(createMemoryRepository())],
] as const)('%s repository', (_kind, create: () => Promise<PracticeRepository>) => {
  it('records an attempt together with its note stats', async () => {
    const repo = await create();
    const stats = await repo.addAttempt(sampleAttempt(0));
    expect(stats).toMatchObject({ key: 'C4@treble', attempts: 1, correct: 1, ewmaMs: 600 });
    const second = await repo.addAttempt(sampleAttempt(5, 's1', { note: 'C4@treble' }));
    expect(second).toMatchObject({ attempts: 2 });
    const data = await repo.load();
    expect(data.attempts.map((a) => a.id)).toEqual(['a0', 'a5']);
    expect(data.stats['C4@treble']).toEqual(second);
  });

  it('does not count an attempt twice when it is recorded again', async () => {
    const repo = await create();
    const first = await repo.addAttempt(sampleAttempt(0));
    expect(await repo.addAttempt(sampleAttempt(0))).toEqual(first);
    const data = await repo.load();
    expect(data.attempts).toHaveLength(1);
    expect(data.stats['C4@treble']!.attempts).toBe(1);
  });

  it('round-trips everything through a reload, sorted', async () => {
    const repo = await create();
    const { sessions, attempts } = sampleData();
    for (const attempt of attempts) await repo.addAttempt(attempt);
    for (const session of sessions) await repo.putSession(session);
    await repo.saveOpenFreePlay({
      id: 'open',
      startedAt: T0,
      lastActivityAt: T0 + 50_000,
      notes: 9,
    });
    const data = await repo.load();
    expect(data.attempts).toEqual([...attempts].sort((a, b) => a.at - b.at));
    expect(data.sessions.map((s) => s.id)).toEqual(['f1', 's2', 's1']);
    expect(data.sessions.find((s) => s.id === 's1')).toEqual(sessions[0]);
    expect(data.stats).toEqual(statsFromAttempts(attempts));
    expect(data.openFreePlay).toEqual([
      { id: 'open', startedAt: T0, lastActivityAt: T0 + 50_000, notes: 9 },
    ]);
    const finished = {
      kind: 'free',
      id: 'open',
      startedAt: T0,
      endedAt: T0 + 50_000,
      activeMs: 50_000,
      notes: 9,
    } as const;
    await repo.finishOpenFreePlay('open', finished);
    const after = await repo.load();
    expect(after.openFreePlay).toEqual([]);
    expect(after.sessions.find((s) => s.id === 'open')).toEqual(finished);
    await repo.saveOpenFreePlay({ id: 'x', startedAt: T0, lastActivityAt: T0 + 1, notes: 1 });
    await repo.finishOpenFreePlay('x', null);
    expect((await repo.load()).openFreePlay).toEqual([]);
  });

  it('replaces a session with the same id', async () => {
    const repo = await create();
    const [session] = sampleData().sessions;
    await repo.putSession(session!);
    await repo.putSession({ ...session!, endedAt: session!.endedAt + 1 });
    const { sessions } = await repo.load();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.endedAt).toBe(session!.endedAt + 1);
  });

  it('merges by id, keeps stored records and rebuilds the stats from all attempts', async () => {
    const repo = await create();
    const { sessions, attempts } = sampleData();
    for (const attempt of attempts.slice(0, 5)) await repo.addAttempt(attempt);
    await repo.putSession(sessions[0]!);
    const changed = { ...attempts[0]!, ms: 99_999 }; // same id, different content: stored wins

    const added = await repo.merge({
      sessions,
      attempts: [changed, ...attempts.slice(1)],
      pieces: [],
      pieceSteps: [],
    });
    expect(added).toEqual({
      sessions: 2,
      attempts: attempts.length - 5,
      pieces: 0,
      pieceSteps: 0,
    });
    const data = await repo.load();
    expect(data.attempts).toEqual(attempts);
    expect(data.sessions).toHaveLength(3);
    expect(data.stats).toEqual(statsFromAttempts(attempts));
  });

  it('merging the same records again changes nothing', async () => {
    const repo = await create();
    const { sessions, attempts } = sampleData();
    await repo.merge({ sessions, attempts, pieces: [], pieceSteps: [] });
    const before = await repo.load();
    expect(await repo.merge({ sessions, attempts, pieces: [], pieceSteps: [] })).toEqual({
      sessions: 0,
      attempts: 0,
      pieces: 0,
      pieceSteps: 0,
    });
    expect(await repo.load()).toEqual(before);
  });

  it('stores, replaces and deletes pieces, newest first', async () => {
    const repo = await create();
    await repo.putPiece(samplePiece(1));
    await repo.putPiece(samplePiece(2));
    await repo.putPiece({ ...samplePiece(1), title: 'Renamed', hands: { '0.1': 'left' } });
    let { pieces } = await repo.load();
    expect(pieces.map((p) => [p.id, p.title])).toEqual([
      ['p2', 'Piece 2'],
      ['p1', 'Renamed'],
    ]);
    expect(pieces[1]!.hands).toEqual({ '0.1': 'left' });
    await repo.deletePiece('p2');
    await repo.deletePiece('missing');
    ({ pieces } = await repo.load());
    expect(pieces.map((p) => p.id)).toEqual(['p1']);
  });

  it('merges pieces by id and keeps a stored piece as it is', async () => {
    const repo = await create();
    await repo.putPiece({ ...samplePiece(1), title: 'Mine' });
    const added = await repo.merge({
      sessions: [],
      attempts: [],
      pieces: [samplePiece(1), samplePiece(2)],
      pieceSteps: [],
    });
    expect(added).toEqual({ sessions: 0, attempts: 0, pieces: 1, pieceSteps: 0 });
    const { pieces } = await repo.load();
    expect(pieces.map((p) => [p.id, p.title])).toEqual([
      ['p2', 'Piece 2'],
      ['p1', 'Mine'],
    ]);
  });

  it('stores step records once, with the run header until the run is finished', async () => {
    const repo = await create();
    const { steps, session } = sampleRun('r1', 4);
    await repo.addPieceStep(steps[0]!, sampleHeader('r1'));
    for (const step of steps.slice(1)) await repo.addPieceStep(step, null);
    await repo.addPieceStep({ ...steps[1]!, ms: 1 }, null); // same id: the stored one stays
    expect((await repo.load()).openPieceRuns).toEqual([sampleHeader('r1')]);
    expect(await repo.pieceSteps({ sessionId: 'r1' })).toEqual(steps);
    await repo.finishPieceRun('r1', session);
    const data = await repo.load();
    expect(data.openPieceRuns).toEqual([]);
    expect(data.sessions).toEqual([session]);
  });

  it('reads step records by piece and by session, in the order they happened', async () => {
    const repo = await create();
    const a = sampleRun('r1', 3).steps;
    const b = sampleRun('r2', 2, { pieceId: 'other', at: T0 - 5_000 }).steps;
    const c = sampleRun('r3', 2, { at: T0 + 500 }).steps;
    for (const step of [...a, ...b, ...c].reverse()) await repo.addPieceStep(step, null);
    expect(await repo.pieceSteps({ pieceId: 'petzold-minuet-in-g' })).toEqual(
      [...a, ...c].sort(byStepTime),
    );
    expect(await repo.pieceSteps({ pieceId: 'other' })).toEqual(b);
    expect(await repo.pieceSteps({ sessionId: 'r3' })).toEqual(c);
    expect(await repo.allPieceSteps()).toHaveLength(7);
    expect((await repo.pieceStepIds()).sort()).toEqual([...a, ...b, ...c].map((s) => s.id).sort());
  });

  it('deletes a piece with or without its step records; its sessions stay', async () => {
    const repo = await create();
    await repo.putPiece(samplePiece(1));
    await repo.putPiece(samplePiece(2));
    const one = sampleRun('r1', 3, { pieceId: 'p1' });
    const two = sampleRun('r2', 2, { pieceId: 'p2' });
    for (const step of [...one.steps, ...two.steps]) await repo.addPieceStep(step, null);
    await repo.putSession(one.session);
    await repo.deletePiece('p1', { steps: true });
    await repo.deletePiece('p2');
    const data = await repo.load();
    expect(data.pieces).toEqual([]);
    expect(data.sessions).toEqual([one.session]);
    expect(await repo.pieceSteps({ pieceId: 'p1' })).toEqual([]);
    expect(await repo.pieceSteps({ pieceId: 'p2' })).toEqual(two.steps);
  });

  it('merges step records by id', async () => {
    const repo = await create();
    const { steps, session } = sampleRun('r1', 5);
    await repo.addPieceStep({ ...steps[0]!, ms: 5 }, null);
    const added = await repo.merge({
      sessions: [session],
      attempts: [],
      pieces: [],
      pieceSteps: steps,
    });
    expect(added).toEqual({ sessions: 1, attempts: 0, pieces: 0, pieceSteps: 4 });
    expect((await repo.pieceSteps({ sessionId: 'r1' }))[0]!.ms).toBe(5);
  });

  it('rebuilt stats equal the stats recorded attempt by attempt', async () => {
    const incremental = await create();
    const { attempts } = sampleData();
    for (const attempt of attempts) await incremental.addAttempt(attempt);
    const rebuilt = createMemoryRepository();
    await rebuilt.merge({
      sessions: [],
      attempts: [...attempts].reverse(),
      pieces: [],
      pieceSteps: [],
    });
    expect((await rebuilt.load()).stats).toEqual((await incremental.load()).stats);
  });
});

describe('transactions', () => {
  it('writes neither the attempt nor the stats when one of the writes fails', async () => {
    const repo = createIndexedDbRepository(await openDb());
    // A function cannot be stored, so adding the attempt throws after the stats were written.
    const broken = { ...sampleAttempt(0), extra: () => {} };
    await expect(repo.addAttempt(broken)).rejects.toThrow();
    const data = await repo.load();
    expect(data.attempts).toEqual([]);
    expect(data.stats).toEqual({});
    // The store still works afterwards.
    await repo.addAttempt(sampleAttempt(0));
    expect((await repo.load()).stats['C4@treble']!.attempts).toBe(1);
  });

  it('rolls back a whole import when one record cannot be stored', async () => {
    const repo = createIndexedDbRepository(await openDb());
    await repo.addAttempt(sampleAttempt(0));
    const { sessions, attempts } = sampleData();
    const broken = { ...attempts[3]!, extra: () => {} };
    await expect(
      repo.merge({
        sessions,
        attempts: [...attempts.slice(1, 3), broken],
        pieces: [],
        pieceSteps: [],
      }),
    ).rejects.toThrow();
    const data = await repo.load();
    expect(data.attempts.map((a) => a.id)).toEqual(['a0']);
    expect(data.sessions).toEqual([]);
    expect(data.stats['C4@treble']!.attempts).toBe(1);
  });

  it('keeps note stats right when two tabs record attempts at the same time', async () => {
    const tabA = createIndexedDbRepository(await openDb());
    const tabB = createIndexedDbRepository(await openDb());
    const attempts = Array.from({ length: 30 }, (_, i) =>
      sampleAttempt(i, 's', { note: 'G4@treble' }),
    );
    await Promise.all(attempts.map((a, i) => (i % 2 ? tabA : tabB).addAttempt(a)));
    const { stats } = await tabA.load();
    expect(stats['G4@treble']!.attempts).toBe(30);
    expect(stats['G4@treble']!.correct).toBe(attempts.filter((a) => a.correct).length);
  });
});

describe('openRepository', () => {
  it('uses IndexedDB when it works', async () => {
    const result = await openRepository();
    expect(result.failure).toBeNull();
    expect(result.repository.kind).toBe('indexeddb');
    result.repository.close();
  });

  it('falls back to memory when IndexedDB is missing', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const result = await openRepository();
    vi.unstubAllGlobals();
    expect(result).toMatchObject({ failure: 'unsupported' });
    expect(result.repository.kind).toBe('memory');
  });

  it('falls back to memory when indexedDB.open throws', async () => {
    vi.spyOn(indexedDB, 'open').mockImplementation(() => {
      throw new DOMException('The user denied permission to access the database.', 'SecurityError');
    });
    const result = await openRepository();
    expect(result).toMatchObject({ failure: 'error' });
    expect(result.repository.kind).toBe('memory');
    await result.repository.addAttempt(sampleAttempt(0));
    expect((await result.repository.load()).attempts).toHaveLength(1);
  });

  it('falls back to memory when the open request fails', async () => {
    // A newer version on disk makes opening version 1 fail with a VersionError event.
    const newer = await openDB(DB_NAME, DB_VERSION + 1);
    newer.close();
    const result = await openRepository();
    expect(result).toMatchObject({ failure: 'error' });
    expect((result as { error: DOMException }).error.name).toBe('VersionError');
    expect(result.repository.kind).toBe('memory');
  });

  it('closes itself and reports it when another tab upgrades the database', async () => {
    const onVersionChange = vi.fn();
    const result = await openRepository({ onVersionChange });
    const newer = await openDB(DB_NAME, DB_VERSION + 1);
    expect(onVersionChange).toHaveBeenCalledOnce();
    newer.close();
    await expect(result.repository.putSession(sampleData().sessions[0]!)).rejects.toThrow();
  });

  it('reports being blocked by an older connection that does not close', async () => {
    // Opened without our handlers, so it ignores versionchange like an old tab might.
    const old = await openDB(DB_NAME, 1, {
      upgrade: (db) => void db.createObjectStore('x'),
      blocking: () => {},
    });
    const onBlocked = vi.fn();
    const pending = openDB(DB_NAME, 2, { blocked: onBlocked });
    await vi.waitFor(() => expect(onBlocked).toHaveBeenCalled());
    old.close();
    (await pending).close();
  });
});
