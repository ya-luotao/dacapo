import type { FreePlaySession, OpenFreePlay } from '../core/freePlay.ts';
import { byStartDescending, byTime, type SessionRecord } from '../core/log.ts';
import type { Attempt } from '../core/session.ts';
import { emptyStats, statsFromAttempts, updateStats, type NoteStats } from '../core/weakness.ts';
import { openDacapoDB, type DacapoDB, type OpenHandlers } from './db.ts';
import { isOpenFreePlay } from './validate.ts';

export interface StoredData {
  /** In the order they happened. */
  attempts: Attempt[];
  stats: Record<string, NoteStats>;
  /** Most recent first. */
  sessions: SessionRecord[];
  /** Free-play sessions that were still running when their tab went away. */
  openFreePlay: OpenFreePlay[];
}

export interface MergeResult {
  sessions: number;
  attempts: number;
}

export interface PracticeRepository {
  readonly kind: 'indexeddb' | 'memory';
  load: () => Promise<StoredData>;
  /**
   * Stores the attempt and updates its note's stats in one transaction, and returns the stats.
   * An attempt whose id is already stored changes nothing.
   */
  addAttempt: (attempt: Attempt) => Promise<NoteStats>;
  /** Adds or replaces the session with the same id. */
  putSession: (session: SessionRecord) => Promise<void>;
  saveOpenFreePlay: (open: OpenFreePlay) => Promise<void>;
  /**
   * Drops the saved progress of free-play session `id` and stores `session` (null when it was
   * too short) in one transaction, so a stale save can never outlive the finished session.
   */
  finishOpenFreePlay: (id: string, session: FreePlaySession | null) => Promise<void>;
  /**
   * Adds the records whose id is not stored yet (stored ones are kept as they are), then rebuilds
   * every note's stats from all attempts, in one transaction. Returns how many were added.
   */
  merge: (sessions: readonly SessionRecord[], attempts: readonly Attempt[]) => Promise<MergeResult>;
  close: () => void;
}

const OPEN_FREE_PLAY = 'freePlay:';
const openFreePlayKey = (id: string) => OPEN_FREE_PLAY + id;
const openFreePlayRange = () => IDBKeyRange.bound(OPEN_FREE_PLAY, `${OPEN_FREE_PLAY}￿`);

/** The records whose id is not in `storedIds`, first occurrence only. */
function notStored<T extends { id: string }>(
  records: readonly T[],
  storedIds: Iterable<string>,
): T[] {
  const ids = new Set(storedIds);
  return records.filter((record) => !ids.has(record.id) && Boolean(ids.add(record.id)));
}

/**
 * Issues the writes in order and waits for the transaction to commit. If any write fails, even
 * synchronously, the transaction is aborted so none of them is kept.
 */
async function writeAll(
  tx: { done: Promise<void>; abort: () => void },
  writes: readonly (() => Promise<unknown>)[],
): Promise<void> {
  const pending: Promise<unknown>[] = [];
  try {
    for (const write of writes) pending.push(write());
  } catch (error) {
    tx.abort();
    await Promise.allSettled([...pending, tx.done]);
    throw error;
  }
  await Promise.all([...pending, tx.done]);
}

function sorted(data: StoredData): StoredData {
  return {
    ...data,
    attempts: data.attempts.sort(byTime),
    sessions: data.sessions.sort(byStartDescending),
  };
}

export function createIndexedDbRepository(db: DacapoDB): PracticeRepository {
  return {
    kind: 'indexeddb',
    async load() {
      const tx = db.transaction(['attempts', 'noteStats', 'sessions', 'meta']);
      const [attempts, stats, sessions, meta] = await Promise.all([
        tx.objectStore('attempts').getAll(),
        tx.objectStore('noteStats').getAll(),
        tx.objectStore('sessions').getAll(),
        tx.objectStore('meta').getAll(openFreePlayRange()),
        tx.done,
      ]);
      return sorted({
        attempts,
        stats: Object.fromEntries(stats.map((s) => [s.key, s])),
        sessions,
        openFreePlay: meta.filter(isOpenFreePlay),
      });
    },
    async addAttempt(attempt) {
      const tx = db.transaction(['attempts', 'noteStats'], 'readwrite');
      const attempts = tx.objectStore('attempts');
      const noteStats = tx.objectStore('noteStats');
      const [known, current] = await Promise.all([
        attempts.getKey(attempt.id),
        noteStats.get(attempt.note),
      ]);
      if (known !== undefined) {
        await tx.done;
        return current ?? emptyStats(attempt.note);
      }
      const stats = updateStats(current ?? emptyStats(attempt.note), attempt);
      await writeAll(tx, [() => noteStats.put(stats), () => attempts.add(attempt)]);
      return stats;
    },
    async putSession(session) {
      await db.put('sessions', session);
    },
    async saveOpenFreePlay(open) {
      await db.put('meta', open, openFreePlayKey(open.id));
    },
    async finishOpenFreePlay(id, session) {
      const tx = db.transaction(['sessions', 'meta'], 'readwrite');
      await writeAll(tx, [
        ...(session ? [() => tx.objectStore('sessions').put(session)] : []),
        () => tx.objectStore('meta').delete(openFreePlayKey(id)),
      ]);
    },
    async merge(newSessions, newAttempts) {
      const tx = db.transaction(['sessions', 'attempts', 'noteStats'], 'readwrite');
      const sessions = tx.objectStore('sessions');
      const attempts = tx.objectStore('attempts');
      const noteStats = tx.objectStore('noteStats');
      const [sessionIds, storedAttempts] = await Promise.all([
        sessions.getAllKeys(),
        attempts.getAll(),
      ]);
      const addedSessions = notStored(newSessions, sessionIds);
      const addedAttempts = notStored(
        newAttempts,
        storedAttempts.map((a) => a.id),
      );
      const stats = statsFromAttempts([...storedAttempts, ...addedAttempts]);
      await writeAll(tx, [
        ...addedSessions.map((session) => () => sessions.add(session)),
        ...addedAttempts.map((attempt) => () => attempts.add(attempt)),
        () => noteStats.clear(),
        ...Object.values(stats).map((s) => () => noteStats.put(s)),
      ]);
      return { sessions: addedSessions.length, attempts: addedAttempts.length };
    },
    close: () => db.close(),
  };
}

/** Same behaviour as the IndexedDB repository, kept for the lifetime of the page. */
export function createMemoryRepository(): PracticeRepository {
  const attempts = new Map<string, Attempt>();
  const sessions = new Map<string, SessionRecord>();
  const openFreePlay = new Map<string, OpenFreePlay>();
  let stats: Record<string, NoteStats> = {};
  const copy = <T>(value: T): T => structuredClone(value);

  return {
    kind: 'memory',
    load: () =>
      Promise.resolve(
        sorted({
          attempts: [...attempts.values()].map(copy),
          stats: copy(stats),
          sessions: [...sessions.values()].map(copy),
          openFreePlay: [...openFreePlay.values()].map(copy),
        }),
      ),
    addAttempt(attempt) {
      const current = stats[attempt.note] ?? emptyStats(attempt.note);
      if (attempts.has(attempt.id)) return Promise.resolve(copy(current));
      attempts.set(attempt.id, copy(attempt));
      stats = { ...stats, [attempt.note]: updateStats(current, attempt) };
      return Promise.resolve(copy(stats[attempt.note]!));
    },
    putSession(session) {
      sessions.set(session.id, copy(session));
      return Promise.resolve();
    },
    saveOpenFreePlay(open) {
      openFreePlay.set(open.id, copy(open));
      return Promise.resolve();
    },
    finishOpenFreePlay(id, session) {
      if (session) sessions.set(session.id, copy(session));
      openFreePlay.delete(id);
      return Promise.resolve();
    },
    merge(newSessions, newAttempts) {
      const addedSessions = notStored(newSessions, sessions.keys());
      const addedAttempts = notStored(newAttempts, attempts.keys());
      for (const session of addedSessions) sessions.set(session.id, copy(session));
      for (const attempt of addedAttempts) attempts.set(attempt.id, copy(attempt));
      stats = statsFromAttempts([...attempts.values()]);
      return Promise.resolve({ sessions: addedSessions.length, attempts: addedAttempts.length });
    },
    close() {},
  };
}

export type StorageFailure = 'unsupported' | 'error';

export type OpenResult =
  | { repository: PracticeRepository; failure: null }
  | { repository: PracticeRepository; failure: StorageFailure; error?: unknown };

/**
 * Opens the IndexedDB repository, or falls back to one in memory when IndexedDB is missing or
 * cannot be opened (private mode, blocked site data, quota, a broken profile). Never rejects.
 */
export async function openRepository(handlers: OpenHandlers = {}): Promise<OpenResult> {
  if (typeof indexedDB === 'undefined') {
    return { repository: createMemoryRepository(), failure: 'unsupported' };
  }
  try {
    const db = await openDacapoDB(handlers);
    return { repository: createIndexedDbRepository(db), failure: null };
  } catch (error) {
    return { repository: createMemoryRepository(), failure: 'error', error };
  }
}
