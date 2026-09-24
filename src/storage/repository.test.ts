import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { statsFromAttempts } from '../core/weakness.ts';
import { DB_NAME, DB_VERSION, openDacapoDB, type DacapoDB } from './db.ts';
import { resetIndexedDB, sampleAttempt, sampleData, T0 } from './fixtures.ts';
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
  it('creates the four stores with their keys and indexes', async () => {
    const db = await openDb();
    expect(db.version).toBe(DB_VERSION);
    expect([...db.objectStoreNames].sort()).toEqual(['attempts', 'meta', 'noteStats', 'sessions']);
    const tx = db.transaction(['attempts', 'noteStats', 'sessions', 'meta']);
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
    await tx.done;
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

    const added = await repo.merge(sessions, [changed, ...attempts.slice(1)]);
    expect(added).toEqual({ sessions: 2, attempts: attempts.length - 5 });
    const data = await repo.load();
    expect(data.attempts).toEqual(attempts);
    expect(data.sessions).toHaveLength(3);
    expect(data.stats).toEqual(statsFromAttempts(attempts));
  });

  it('merging the same records again changes nothing', async () => {
    const repo = await create();
    const { sessions, attempts } = sampleData();
    await repo.merge(sessions, attempts);
    const before = await repo.load();
    expect(await repo.merge(sessions, attempts)).toEqual({ sessions: 0, attempts: 0 });
    expect(await repo.load()).toEqual(before);
  });

  it('rebuilt stats equal the stats recorded attempt by attempt', async () => {
    const incremental = await create();
    const { attempts } = sampleData();
    for (const attempt of attempts) await incremental.addAttempt(attempt);
    const rebuilt = createMemoryRepository();
    await rebuilt.merge([], [...attempts].reverse());
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
    await expect(repo.merge(sessions, [...attempts.slice(1, 3), broken])).rejects.toThrow();
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
