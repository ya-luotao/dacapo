import 'fake-indexeddb/auto';
import { openDB, type IDBPDatabase } from 'idb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { byStepTime, stepMode } from '../core/pieceRecords.ts';
import { byRunTime } from '../core/scaleRecords.ts';
import { statsFromAttempts } from '../core/weakness.ts';
import { DB_NAME, DB_VERSION, openDacapoDB, upgrade, type DacapoDB } from './db.ts';
import {
  resetIndexedDB,
  sampleAnswer,
  sampleAttempt,
  sampleData,
  sampleEarSession,
  sampleHeader,
  samplePiece,
  sampleRhythmRun,
  sampleRun,
  sampleScaleSession,
  sampleSightSession,
  sampleStep,
  sampleStoredAssignment,
  sampleStoredReport,
  sampleTake,
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
  it('creates the eleven stores with their keys and indexes', async () => {
    const db = await openDb();
    expect(db.version).toBe(DB_VERSION);
    expect(DB_VERSION).toBe(8);
    expect([...db.objectStoreNames].sort()).toEqual([
      'answers',
      'assignments',
      'attempts',
      'meta',
      'noteStats',
      'outbox',
      'pieceSteps',
      'pieces',
      'scaleRuns',
      'sessions',
      'takes',
    ]);
    const tx = db.transaction([
      'attempts',
      'noteStats',
      'sessions',
      'meta',
      'pieces',
      'pieceSteps',
      'scaleRuns',
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
    const runs = tx.objectStore('scaleRuns');
    expect(runs.keyPath).toBe('id');
    expect(runs.autoIncrement).toBe(false);
    expect([...runs.indexNames].sort()).toEqual(['by-exercise', 'by-session']);
    expect(runs.index('by-exercise').keyPath).toBe('exercise');
    expect(runs.index('by-session').keyPath).toBe('sessionId');
    await tx.done;
    expect(db.transaction('outbox').objectStore('outbox').keyPath).toBe('key');
    const answers = db.transaction('answers').objectStore('answers');
    expect(answers.keyPath).toBe('id');
    expect(answers.autoIncrement).toBe(false);
    expect([...answers.indexNames].sort()).toEqual(['by-item', 'by-session']);
    expect(answers.index('by-session').keyPath).toBe('sessionId');
    expect(answers.index('by-item').keyPath).toBe('item');
    const takes = db.transaction('takes').objectStore('takes');
    expect(takes.keyPath).toBe('id');
    expect(takes.autoIncrement).toBe(false);
    expect([...takes.indexNames].sort()).toEqual(['by-piece', 'by-session']);
    expect(takes.index('by-piece').keyPath).toBe('pieceId');
    expect(takes.index('by-session').keyPath).toBe('sessionId');
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
    'migrates a version %i database with data to the current version and keeps everything',
    async (version) => {
      const old = await seedOld(version);
      const db = await openDb();
      expect(db.version).toBe(DB_VERSION);
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
      const scales = sampleScaleSession('k1', 1);
      await repo.addScaleRun(scales.runs[0]!, scales.session);
      expect(await repo.scaleRuns({ exercise: 'major:C:1:right' })).toEqual(scales.runs);
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

  it('migrates a version 3 database: its records stay, scale runs are stored', async () => {
    const old = await seedV3();
    const db = await openDb();
    expect(db.version).toBe(DB_VERSION);
    const repo = createIndexedDbRepository(db);
    const data = await repo.load();
    expect(data.sessions).toEqual([old.done.session]);
    expect(data.openPieceRuns).toEqual([sampleHeader('w2')]);
    expect(await repo.allPieceSteps()).toEqual(
      [...old.done.steps, ...old.openSteps].sort(byStepTime),
    );
    expect(await repo.allScaleRuns()).toEqual([]);
    const { runs, session } = sampleScaleSession('k1', 2);
    for (const run of runs) await repo.addScaleRun(run, session);
    expect(await repo.scaleRuns({ sessionId: 'k1' })).toEqual(runs);
    expect((await repo.load()).sessions).toContainEqual(session);
  });

  it('migrates a version 4 database to version 5: its records stay, the outbox is empty', async () => {
    const old = await openDB(DB_NAME, 4, {
      upgrade: (database, oldVersion) => upgrade(database as DacapoDB, oldVersion, 4),
    });
    const { runs, session } = sampleScaleSession('k1', 2);
    const tx = old.transaction(['scaleRuns', 'sessions', 'pieces'], 'readwrite');
    for (const run of runs) void tx.objectStore('scaleRuns').put(run);
    void tx.objectStore('sessions').put(session);
    void tx.objectStore('pieces').put(samplePiece(1));
    await tx.done;
    old.close();

    const db = await openDb();
    expect(db.version).toBe(DB_VERSION);
    const repo = createIndexedDbRepository(db);
    expect((await repo.load()).sessions).toEqual([session]);
    expect(await repo.allScaleRuns()).toEqual(runs);
    expect(await db.count('outbox')).toBe(0);
    // Signed out, nothing goes to the outbox.
    await repo.addAttempt(sampleAttempt(0));
    await repo.deletePiece('p1', { steps: true, at: T0 });
    expect(await db.count('outbox')).toBe(0);
    expect(await db.get('meta', 'deleted:piece:p1')).toEqual({
      deleted: true,
      at: T0,
      withSteps: true,
    });
  });

  it('migrates a version 5 database to version 6: its records and outbox stay, answers are stored', async () => {
    const old = await openDB(DB_NAME, 5, {
      upgrade: (database, oldVersion) => upgrade(database as DacapoDB, oldVersion, 5),
    });
    const { sessions, attempts } = sampleData();
    const tx = old.transaction(['sessions', 'attempts', 'outbox'], 'readwrite');
    for (const session of sessions) void tx.objectStore('sessions').put(session);
    for (const attempt of attempts) void tx.objectStore('attempts').put(attempt);
    void tx.objectStore('outbox').put({
      key: 'attempts/a0',
      collection: 'attempts',
      id: 'a0',
      rev: 'r',
    });
    await tx.done;
    old.close();

    const db = await openDb();
    expect(db.version).toBe(DB_VERSION);
    const repo = createIndexedDbRepository(db);
    const data = await repo.load();
    expect(data.attempts).toEqual(attempts);
    expect(data.sessions).toHaveLength(sessions.length);
    expect(data.answers).toEqual([]);
    expect(await db.count('outbox')).toBe(1);
    const ear = sampleEarSession('e1', 3);
    for (const answer of ear.answers) await repo.addAnswer(answer);
    await repo.putSession(ear.session);
    expect((await repo.load()).answers).toEqual(ear.answers);
    expect(await db.countFromIndex('answers', 'by-session', 'e1')).toBe(3);
    expect(await db.countFromIndex('answers', 'by-item', 'int:P5:up')).toBe(3);
  });

  it('migrates a version 6 database to version 7: its records and outbox stay, takes are stored', async () => {
    const old = await openDB(DB_NAME, 6, {
      upgrade: (database, oldVersion) => upgrade(database as DacapoDB, oldVersion, 6),
    });
    const { steps, session } = sampleRun('r1', 3);
    const tx = old.transaction(['sessions', 'pieceSteps', 'outbox'], 'readwrite');
    void tx.objectStore('sessions').put(session);
    for (const step of steps) void tx.objectStore('pieceSteps').put(step);
    void tx
      .objectStore('outbox')
      .put({ key: 'sessions/r1', collection: 'sessions', id: 'r1', rev: 'r' });
    await tx.done;
    old.close();

    const db = await openDb();
    expect(db.version).toBe(DB_VERSION);
    const repo = createIndexedDbRepository(db);
    expect((await repo.load()).sessions).toEqual([session]);
    expect(await repo.allPieceSteps()).toEqual(steps);
    expect(await db.count('outbox')).toBe(1);
    const take = sampleTake('r1', 0);
    await repo.addTake(take);
    expect(await repo.takes({ sessionId: 'r1' })).toEqual([take]);
  });

  it('migrates a version 7 database to version 8: its records and outbox stay, assignments are stored', async () => {
    const old = await openDB(DB_NAME, 7, {
      upgrade: (database, oldVersion) => upgrade(database as DacapoDB, oldVersion, 7),
    });
    expect([...old.objectStoreNames]).not.toContain('assignments');
    const { steps, session } = sampleRun('r1', 3);
    const take = sampleTake('r1', 0);
    const tx = old.transaction(['sessions', 'pieceSteps', 'takes', 'outbox'], 'readwrite');
    void tx.objectStore('sessions').put(session);
    for (const step of steps) void tx.objectStore('pieceSteps').put(step);
    void tx.objectStore('takes').put(take);
    void tx
      .objectStore('outbox')
      .put({ key: 'sessions/r1', collection: 'sessions', id: 'r1', rev: 'r' });
    await tx.done;
    old.close();

    const db = await openDb();
    expect(db.version).toBe(8);
    expect(db.transaction('assignments').objectStore('assignments').keyPath).toBe('id');
    const repo = createIndexedDbRepository(db);
    const data = await repo.load();
    expect(data.sessions).toEqual([session]);
    expect(data.assignments).toEqual([]);
    expect(await repo.allPieceSteps()).toEqual(steps);
    expect(await repo.allTakes()).toEqual([take]);
    expect(await db.count('outbox')).toBe(1);
    await repo.putAssignment(sampleStoredAssignment(1));
    expect((await repo.load()).assignments).toEqual([sampleStoredAssignment(1)]);
  });

  it('never reads takes at startup', async () => {
    const db = await openDb();
    const repo = createIndexedDbRepository(db);
    await repo.addTake(sampleTake('r1', 0));
    const transaction = vi.spyOn(db, 'transaction');
    await repo.load();
    const stores = transaction.mock.calls.flatMap(([names]) => [names].flat());
    expect(stores).not.toContain('takes');
  });

  it('never reads scale runs at startup', async () => {
    const db = await openDb();
    const repo = createIndexedDbRepository(db);
    const { runs, session } = sampleScaleSession('k1', 20);
    for (const run of runs) await repo.addScaleRun(run, session);
    const transaction = vi.spyOn(db, 'transaction');
    const data = await repo.load();
    const stores = transaction.mock.calls.flatMap(([names]) => [names].flat());
    expect(stores).not.toContain('scaleRuns');
    expect(Object.keys(data)).not.toContain('scaleRuns');
    // The session is loaded with the others.
    expect(data.sessions).toEqual([session]);
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

  it('stores ear-training answers once each, and loads them in order', async () => {
    const repo = await create();
    const answers = [sampleAnswer(2), sampleAnswer(0), sampleAnswer(1)];
    for (const answer of answers) await repo.addAnswer(answer);
    await repo.addAnswer({ ...sampleAnswer(0), ms: 99_999 });
    const data = await repo.load();
    expect(data.answers).toEqual([sampleAnswer(0), sampleAnswer(1), sampleAnswer(2)]);
    const { session } = sampleEarSession('e1', 3);
    await repo.putSession(session);
    expect((await repo.load()).sessions).toEqual([session]);
  });

  it('merges ear-training answers by id', async () => {
    const repo = await create();
    const { answers, session } = sampleEarSession('e1', 4);
    await repo.addAnswer(answers[0]!);
    const input = {
      sessions: [session],
      attempts: [],
      pieces: [],
      pieceSteps: [],
      scaleRuns: [],
      answers: [{ ...answers[0]!, ms: 1 }, ...answers.slice(1)],
      takes: [],
      assignments: [],
    };
    expect(await repo.merge(input)).toMatchObject({ sessions: 1, answers: 3 });
    expect((await repo.load()).answers).toEqual(answers);
    expect(await repo.merge(input)).toMatchObject({ sessions: 0, answers: 0 });
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
      scaleRuns: [],
      answers: [],
      takes: [],
      assignments: [],
    });
    expect(added).toEqual({
      sessions: 2,
      attempts: attempts.length - 5,
      pieces: 0,
      pieceSteps: 0,
      scaleRuns: 0,
      answers: 0,
      takes: 0,
      assignments: 0,
    });
    const data = await repo.load();
    expect(data.attempts).toEqual(attempts);
    expect(data.sessions).toHaveLength(3);
    expect(data.stats).toEqual(statsFromAttempts(attempts));
  });

  it('merging the same records again changes nothing', async () => {
    const repo = await create();
    const { sessions, attempts } = sampleData();
    await repo.merge({
      sessions,
      attempts,
      pieces: [],
      pieceSteps: [],
      scaleRuns: [],
      answers: [],
      takes: [],
      assignments: [],
    });
    const before = await repo.load();
    expect(
      await repo.merge({
        sessions,
        attempts,
        pieces: [],
        pieceSteps: [],
        scaleRuns: [],
        answers: [],
        takes: [],
        assignments: [],
      }),
    ).toEqual({
      sessions: 0,
      attempts: 0,
      pieces: 0,
      pieceSteps: 0,
      scaleRuns: 0,
      answers: 0,
      takes: 0,
      assignments: 0,
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
      scaleRuns: [],
      answers: [],
      takes: [],
      assignments: [],
    });
    expect(added).toEqual({
      sessions: 0,
      attempts: 0,
      pieces: 1,
      pieceSteps: 0,
      scaleRuns: 0,
      answers: 0,
      takes: 0,
      assignments: 0,
    });
    const { pieces } = await repo.load();
    expect(pieces.map((p) => [p.id, p.title])).toEqual([
      ['p2', 'Piece 2'],
      ['p1', 'Mine'],
    ]);
  });

  it('stores assignments and kept reports by id, a deleted one as the record that says so', async () => {
    const repo = await create();
    const assignment = sampleStoredAssignment(2);
    const report = sampleStoredReport(1);
    await repo.putAssignment(assignment);
    await repo.putAssignment(sampleStoredAssignment(1));
    await repo.putAssignment(report);
    expect((await repo.load()).assignments).toEqual([
      sampleStoredAssignment(1),
      assignment,
      report,
    ]);
    // Changed, then deleted: one record per id throughout.
    await repo.putAssignment({ ...assignment, following: true, updatedAt: T0 + 9_000_000 });
    const gone = {
      id: report.id,
      type: 'report' as const,
      deleted: true as const,
      updatedAt: report.updatedAt + 1,
    };
    await repo.putAssignment(gone);
    const { assignments } = await repo.load();
    expect(assignments).toHaveLength(3);
    expect(assignments[1]).toMatchObject({ id: assignment.id, following: true });
    expect(assignments[2]).toEqual(gone);
  });

  it('merges assignments by id, and does not add a deleted one again', async () => {
    const repo = await create();
    const mine = sampleStoredAssignment(1, { following: true });
    await repo.putAssignment(mine);
    await repo.putAssignment({
      id: 'assignment-2',
      type: 'assignment',
      deleted: true,
      updatedAt: T0,
    });
    const added = await repo.merge({
      sessions: [],
      attempts: [],
      pieces: [],
      pieceSteps: [],
      scaleRuns: [],
      answers: [],
      takes: [],
      assignments: [
        sampleStoredAssignment(1),
        sampleStoredAssignment(2),
        sampleStoredAssignment(3),
        sampleStoredAssignment(3),
        sampleStoredReport(1),
      ],
    });
    expect(added.assignments).toBe(2);
    const { assignments } = await repo.load();
    expect(assignments.map((r) => [r.id, 'deleted' in r])).toEqual([
      ['assignment-1', false],
      ['assignment-2', true],
      ['assignment-3', false],
      ['report-0001', false],
    ]);
    expect(assignments[0]).toEqual(mine);
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

  it('does not import a deleted piece again, nor its step records if deleted with them', async () => {
    const repo = await create();
    await repo.putPiece(samplePiece(1));
    await repo.putPiece(samplePiece(2));
    await repo.deletePiece('p1', { steps: true });
    await repo.deletePiece('p2');
    const one = sampleRun('r1', 2, { pieceId: 'p1' });
    const two = sampleRun('r2', 2, { pieceId: 'p2' });
    const added = await repo.merge({
      sessions: [],
      attempts: [],
      pieces: [samplePiece(1), samplePiece(2), samplePiece(3)],
      pieceSteps: [...one.steps, ...two.steps],
      scaleRuns: [],
      answers: [],
      takes: [],
      assignments: [],
    });
    expect(added).toEqual({
      sessions: 0,
      attempts: 0,
      pieces: 1,
      pieceSteps: 2,
      scaleRuns: 0,
      answers: 0,
      takes: 0,
      assignments: 0,
    });
    expect((await repo.load()).pieces.map((p) => p.id)).toEqual(['p3']);
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
      scaleRuns: [],
      answers: [],
      takes: [],
      assignments: [],
    });
    expect(added).toEqual({
      sessions: 1,
      attempts: 0,
      pieces: 0,
      pieceSteps: 4,
      scaleRuns: 0,
      answers: 0,
      takes: 0,
      assignments: 0,
    });
    expect((await repo.pieceSteps({ sessionId: 'r1' }))[0]!.ms).toBe(5);
  });

  it('stores take chunks once, and reads them by piece and by session, in order', async () => {
    const repo = await create();
    const first = sampleTake('r1', 0);
    const second = sampleTake('r1', 1);
    const other = sampleTake('r2', 0, { pieceId: 'p2', startedAt: T0 - 60_000 });
    await repo.addTake(second);
    await repo.addTake(first);
    await repo.addTake({ ...first, tempo: 50 });
    await repo.addTake(other);
    expect(await repo.takes({ sessionId: 'r1' })).toEqual([first, second]);
    expect(await repo.takes({ pieceId: 'p2' })).toEqual([other]);
    expect(await repo.allTakes()).toEqual([other, first, second]);
    expect((await repo.takeIds()).sort()).toEqual([first.id, second.id, other.id].sort());
  });

  it('deletes a piece’s takes with its step records, and does not import them again', async () => {
    const repo = await create();
    await repo.putPiece(samplePiece(1));
    await repo.putPiece(samplePiece(2));
    const one = sampleTake('r1', 0, { pieceId: 'p1' });
    const two = sampleTake('r2', 0, { pieceId: 'p2' });
    await repo.addTake(one);
    await repo.addTake(two);
    await repo.deletePiece('p1', { steps: true });
    await repo.deletePiece('p2');
    expect(await repo.allTakes()).toEqual([two]);
    const later = sampleTake('r1', 1, { pieceId: 'p1' });
    const added = await repo.merge({
      sessions: [],
      attempts: [],
      pieces: [],
      pieceSteps: [],
      scaleRuns: [],
      answers: [],
      takes: [one, later, two, sampleTake('r3', 0, { pieceId: 'p3' })],
      assignments: [],
    });
    expect(added.takes).toBe(1);
    expect((await repo.allTakes()).map((c) => c.pieceId)).toEqual(['p2', 'p3']);
  });

  it('stores a scale run once, and its session with it', async () => {
    const repo = await create();
    const { runs, session } = sampleScaleSession('k1', 3);
    const first = sampleScaleSession('k1', 1).session;
    await repo.addScaleRun(runs[0]!, first);
    expect((await repo.load()).sessions).toEqual([first]);
    await repo.addScaleRun(runs[1]!, session);
    await repo.addScaleRun(runs[2]!, session);
    // Same id: the stored run stays, the session is still brought up to date.
    await repo.addScaleRun({ ...runs[1]!, end: 'stopped' }, session);
    expect(await repo.scaleRuns({ sessionId: 'k1' })).toEqual(runs);
    expect((await repo.load()).sessions).toEqual([session]);
  });

  it('reads scale runs by exercise and by session, in the order played', async () => {
    const repo = await create();
    const a = sampleScaleSession('k1', 3);
    const b = sampleScaleSession('k2', 2, { exercise: 'major:D:2:left', startedAt: T0 - 60_000 });
    const c = sampleScaleSession('k3', 2, { startedAt: T0 + 500 });
    for (const { runs, session } of [a, b, c]) {
      for (const run of [...runs].reverse()) await repo.addScaleRun(run, session);
    }
    expect(await repo.scaleRuns({ exercise: 'major:C:1:right' })).toEqual(
      [...a.runs, ...c.runs].sort(byRunTime),
    );
    expect(await repo.scaleRuns({ exercise: 'major:D:2:left' })).toEqual(b.runs);
    expect(await repo.scaleRuns({ exercise: 'major:D:1:right' })).toEqual([]);
    expect(await repo.scaleRuns({ sessionId: 'k3' })).toEqual(c.runs);
    expect(await repo.allScaleRuns()).toEqual([...a.runs, ...b.runs, ...c.runs].sort(byRunTime));
    expect((await repo.scaleRunIds()).sort()).toEqual(
      [...a.runs, ...b.runs, ...c.runs].map((r) => r.id).sort(),
    );
  });

  it('merges scale runs by id', async () => {
    const repo = await create();
    const { runs, session } = sampleScaleSession('k1', 4);
    await repo.addScaleRun({ ...runs[0]!, end: 'idle' }, sampleScaleSession('k1', 1).session);
    const added = await repo.merge({
      sessions: [session],
      attempts: [],
      pieces: [],
      pieceSteps: [],
      scaleRuns: runs,
      answers: [],
      takes: [],
      assignments: [],
    });
    // The imported session has more runs, so it replaces the stored one.
    expect(added).toEqual({
      sessions: 1,
      attempts: 0,
      pieces: 0,
      pieceSteps: 0,
      scaleRuns: 3,
      answers: 0,
      takes: 0,
      assignments: 0,
    });
    const stored = await repo.scaleRuns({ sessionId: 'k1' });
    expect(stored.map((r) => r.id)).toEqual(runs.map((r) => r.id));
    expect(stored[0]!.end).toBe('idle');
  });

  it('replaces a stored scale session with an imported copy that has more runs', async () => {
    const repo = await create();
    const short = sampleScaleSession('k1', 2);
    const long = sampleScaleSession('k1', 4);
    for (const run of short.runs) await repo.addScaleRun(run, short.session);
    const input = { attempts: [], pieces: [], pieceSteps: [] };
    const added = await repo.merge({
      ...input,
      sessions: [long.session, { ...long.session, runs: long.session.runs.slice(0, 3) }],
      scaleRuns: long.runs,
      answers: [],
      takes: [],
      assignments: [],
    });
    // Counted with the sessions taken from the file.
    expect(added).toEqual({
      sessions: 1,
      attempts: 0,
      pieces: 0,
      pieceSteps: 0,
      scaleRuns: 2,
      answers: 0,
      takes: 0,
      assignments: 0,
    });
    expect((await repo.load()).sessions).toEqual([long.session]);
    expect(await repo.scaleRuns({ sessionId: 'k1' })).toEqual(long.runs);
    // A copy with fewer runs, or as many, is not taken.
    for (const session of [short.session, { ...long.session, activeMs: 1 }]) {
      expect(
        await repo.merge({
          ...input,
          sessions: [session],
          scaleRuns: [],
          answers: [],
          takes: [],
          assignments: [],
        }),
      ).toEqual({
        sessions: 0,
        attempts: 0,
        pieces: 0,
        pieceSteps: 0,
        scaleRuns: 0,
        answers: 0,
        takes: 0,
        assignments: 0,
      });
    }
    expect((await repo.load()).sessions).toEqual([long.session]);
  });

  it('replaces a stored sight-reading session with an imported copy that has more runs', async () => {
    const repo = await create();
    await repo.putSession(sampleSightSession('s1', 2));
    const empty = {
      attempts: [],
      pieces: [],
      pieceSteps: [],
      scaleRuns: [],
      answers: [],
      takes: [],
      assignments: [],
    };
    const long = sampleSightSession('s1', 3);
    expect((await repo.merge({ ...empty, sessions: [long] })).sessions).toBe(1);
    expect((await repo.load()).sessions).toEqual([long]);
    expect((await repo.merge({ ...empty, sessions: [sampleSightSession('s1', 1)] })).sessions).toBe(
      0,
    );
    expect((await repo.load()).sessions).toEqual([long]);
  });

  it('keeps a stored session of another kind that has a scale session’s id', async () => {
    const repo = await create();
    const free = sampleData().sessions[2]!;
    await repo.putSession(free);
    const { session } = sampleScaleSession(free.id, 2);
    const added = await repo.merge({
      sessions: [session],
      attempts: [],
      pieces: [],
      pieceSteps: [],
      scaleRuns: [],
      answers: [],
      takes: [],
      assignments: [],
    });
    expect(added.sessions).toBe(0);
    expect((await repo.load()).sessions).toEqual([free]);
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
      scaleRuns: [],
      answers: [],
      takes: [],
      assignments: [],
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
        scaleRuns: [],
        answers: [],
        takes: [],
        assignments: [],
      }),
    ).rejects.toThrow();
    const data = await repo.load();
    expect(data.attempts.map((a) => a.id)).toEqual(['a0']);
    expect(data.sessions).toEqual([]);
    expect(data.stats['C4@treble']!.attempts).toBe(1);
  });

  it('writes neither the scale run nor its session when one of the writes fails', async () => {
    const repo = createIndexedDbRepository(await openDb());
    const { runs, session } = sampleScaleSession('k1', 1);
    const broken = { ...session, extra: () => {} };
    await expect(repo.addScaleRun(runs[0]!, broken)).rejects.toThrow();
    expect(await repo.allScaleRuns()).toEqual([]);
    expect((await repo.load()).sessions).toEqual([]);
    await repo.addScaleRun(runs[0]!, session);
    expect(await repo.allScaleRuns()).toEqual(runs);
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
