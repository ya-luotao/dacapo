import type { FreePlaySession, OpenFreePlay } from '../core/freePlay.ts';
import { byStartDescending, byTime, type SessionRecord } from '../core/log.ts';
import {
  byStepTime,
  type PieceRunHeader,
  type PieceSession,
  type PieceStep,
} from '../core/pieceRecords.ts';
import type { Attempt } from '../core/session.ts';
import { byImportedDescending, type StoredPiece } from '../core/storedPiece.ts';
import { emptyStats, statsFromAttempts, updateStats, type NoteStats } from '../core/weakness.ts';
import { openDacapoDB, type DacapoDB, type OpenHandlers } from './db.ts';
import { isOpenFreePlay, validatePieceRunHeader } from './validate.ts';

export interface StoredData {
  /** In the order they happened. */
  attempts: Attempt[];
  stats: Record<string, NoteStats>;
  /** Most recent first. */
  sessions: SessionRecord[];
  /** Free-play sessions that were still running when their tab went away. */
  openFreePlay: OpenFreePlay[];
  /** Imported pieces, newest first. */
  pieces: StoredPiece[];
  /** Wait-mode runs whose session was not recorded yet (their tab may have gone away). */
  openPieceRuns: PieceRunHeader[];
}

export interface MergeResult {
  sessions: number;
  attempts: number;
  pieces: number;
  pieceSteps: number;
}

/** What an import adds; records whose id is stored already are kept as they are. */
export interface MergeInput {
  sessions: readonly SessionRecord[];
  attempts: readonly Attempt[];
  pieces: readonly StoredPiece[];
  pieceSteps: readonly PieceStep[];
}

/** Which step records to read: those of a piece or of one session. */
export type StepQuery = { pieceId: string } | { sessionId: string };

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
  /** Adds or replaces the piece with the same id. */
  putPiece: (piece: StoredPiece) => Promise<void>;
  /** Deletes the piece, and with `steps` its step records, in one transaction. */
  deletePiece: (id: string, options?: { steps: boolean }) => Promise<void>;
  /**
   * Stores a step (one whose id is stored already changes nothing), and with the run's first step
   * the run's header, so the run can be recovered if its tab goes away.
   */
  addPieceStep: (step: PieceStep, header: PieceRunHeader | null) => Promise<void>;
  /** Records the run's session (null: nothing to record) and drops its header, in one transaction. */
  finishPieceRun: (id: string, session: PieceSession | null) => Promise<void>;
  /** Step records by index, in the order they happened. Never read at startup. */
  pieceSteps: (query: StepQuery) => Promise<PieceStep[]>;
  /** Every step record, in order: for the export file. */
  allPieceSteps: () => Promise<PieceStep[]>;
  pieceStepIds: () => Promise<string[]>;
  /**
   * Adds the records whose id is not stored yet (stored ones are kept as they are), then rebuilds
   * every note's stats from all attempts, in one transaction. Returns how many were added.
   */
  merge: (input: MergeInput) => Promise<MergeResult>;
  close: () => void;
}

const OPEN_FREE_PLAY = 'freePlay:';
const openFreePlayKey = (id: string) => OPEN_FREE_PLAY + id;
const openFreePlayRange = () => IDBKeyRange.bound(OPEN_FREE_PLAY, `${OPEN_FREE_PLAY}￿`);
const OPEN_PIECE_RUN = 'pieceRun:';
const openPieceRunKey = (id: string) => OPEN_PIECE_RUN + id;
const openPieceRunRange = () => IDBKeyRange.bound(OPEN_PIECE_RUN, `${OPEN_PIECE_RUN}￿`);

function validHeaders(values: readonly unknown[]): PieceRunHeader[] {
  return values.flatMap((value) => {
    const result = validatePieceRunHeader(value);
    return result.ok ? [result.value] : [];
  });
}

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
    pieces: data.pieces.sort(byImportedDescending),
  };
}

export function createIndexedDbRepository(db: DacapoDB): PracticeRepository {
  return {
    kind: 'indexeddb',
    async load() {
      const tx = db.transaction(['attempts', 'noteStats', 'sessions', 'meta', 'pieces']);
      const [attempts, stats, sessions, meta, runs, pieces] = await Promise.all([
        tx.objectStore('attempts').getAll(),
        tx.objectStore('noteStats').getAll(),
        tx.objectStore('sessions').getAll(),
        tx.objectStore('meta').getAll(openFreePlayRange()),
        tx.objectStore('meta').getAll(openPieceRunRange()),
        tx.objectStore('pieces').getAll(),
        tx.done,
      ]);
      return sorted({
        attempts,
        stats: Object.fromEntries(stats.map((s) => [s.key, s])),
        sessions,
        openFreePlay: meta.filter(isOpenFreePlay),
        pieces,
        openPieceRuns: validHeaders(runs),
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
    async putPiece(piece) {
      await db.put('pieces', piece);
    },
    async deletePiece(id, options) {
      if (!options?.steps) {
        await db.delete('pieces', id);
        return;
      }
      const tx = db.transaction(['pieces', 'pieceSteps'], 'readwrite');
      const steps = tx.objectStore('pieceSteps');
      const keys = await steps.index('by-piece').getAllKeys(id);
      await writeAll(tx, [
        () => tx.objectStore('pieces').delete(id),
        ...keys.map((key) => () => steps.delete(key)),
      ]);
    },
    async addPieceStep(step, header) {
      const tx = db.transaction(['pieceSteps', 'meta'], 'readwrite');
      const steps = tx.objectStore('pieceSteps');
      const known = await steps.getKey(step.id);
      await writeAll(tx, [
        ...(known === undefined ? [() => steps.add(step)] : []),
        ...(header ? [() => tx.objectStore('meta').put(header, openPieceRunKey(header.id))] : []),
      ]);
    },
    async finishPieceRun(id, session) {
      const tx = db.transaction(['sessions', 'meta'], 'readwrite');
      await writeAll(tx, [
        ...(session ? [() => tx.objectStore('sessions').put(session)] : []),
        () => tx.objectStore('meta').delete(openPieceRunKey(id)),
      ]);
    },
    async pieceSteps(query) {
      const steps =
        'pieceId' in query
          ? await db.getAllFromIndex('pieceSteps', 'by-piece', query.pieceId)
          : await db.getAllFromIndex('pieceSteps', 'by-session', query.sessionId);
      return steps.sort(byStepTime);
    },
    async allPieceSteps() {
      return (await db.getAll('pieceSteps')).sort(byStepTime);
    },
    pieceStepIds: () => db.getAllKeys('pieceSteps'),
    async merge(input) {
      const tx = db.transaction(
        ['sessions', 'attempts', 'noteStats', 'pieces', 'pieceSteps'],
        'readwrite',
      );
      const sessions = tx.objectStore('sessions');
      const attempts = tx.objectStore('attempts');
      const noteStats = tx.objectStore('noteStats');
      const pieces = tx.objectStore('pieces');
      const pieceSteps = tx.objectStore('pieceSteps');
      const [sessionIds, storedAttempts, pieceIds, stepIds] = await Promise.all([
        sessions.getAllKeys(),
        attempts.getAll(),
        pieces.getAllKeys(),
        pieceSteps.getAllKeys(),
      ]);
      const addedSessions = notStored(input.sessions, sessionIds);
      const addedAttempts = notStored(
        input.attempts,
        storedAttempts.map((a) => a.id),
      );
      const addedPieces = notStored(input.pieces, pieceIds);
      const addedSteps = notStored(input.pieceSteps, stepIds);
      const stats = statsFromAttempts([...storedAttempts, ...addedAttempts]);
      await writeAll(tx, [
        ...addedSessions.map((session) => () => sessions.add(session)),
        ...addedAttempts.map((attempt) => () => attempts.add(attempt)),
        ...addedPieces.map((piece) => () => pieces.add(piece)),
        ...addedSteps.map((step) => () => pieceSteps.add(step)),
        () => noteStats.clear(),
        ...Object.values(stats).map((s) => () => noteStats.put(s)),
      ]);
      return {
        sessions: addedSessions.length,
        attempts: addedAttempts.length,
        pieces: addedPieces.length,
        pieceSteps: addedSteps.length,
      };
    },
    close: () => db.close(),
  };
}

/** Same behaviour as the IndexedDB repository, kept for the lifetime of the page. */
export function createMemoryRepository(): PracticeRepository {
  const attempts = new Map<string, Attempt>();
  const sessions = new Map<string, SessionRecord>();
  const openFreePlay = new Map<string, OpenFreePlay>();
  const pieces = new Map<string, StoredPiece>();
  const steps = new Map<string, PieceStep>();
  const openRuns = new Map<string, PieceRunHeader>();
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
          pieces: [...pieces.values()].map(copy),
          openPieceRuns: [...openRuns.values()].map(copy),
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
    putPiece(piece) {
      pieces.set(piece.id, copy(piece));
      return Promise.resolve();
    },
    deletePiece(id, options) {
      pieces.delete(id);
      if (options?.steps) {
        for (const [key, step] of steps) if (step.pieceId === id) steps.delete(key);
      }
      return Promise.resolve();
    },
    addPieceStep(step, header) {
      if (!steps.has(step.id)) steps.set(step.id, copy(step));
      if (header) openRuns.set(header.id, copy(header));
      return Promise.resolve();
    },
    finishPieceRun(id, session) {
      if (session) sessions.set(session.id, copy(session));
      openRuns.delete(id);
      return Promise.resolve();
    },
    pieceSteps(query) {
      const match = (s: PieceStep) =>
        'pieceId' in query ? s.pieceId === query.pieceId : s.sessionId === query.sessionId;
      return Promise.resolve([...steps.values()].filter(match).map(copy).sort(byStepTime));
    },
    allPieceSteps: () => Promise.resolve([...steps.values()].map(copy).sort(byStepTime)),
    pieceStepIds: () => Promise.resolve([...steps.keys()]),
    merge(input) {
      const addedSessions = notStored(input.sessions, sessions.keys());
      const addedAttempts = notStored(input.attempts, attempts.keys());
      const addedPieces = notStored(input.pieces, pieces.keys());
      const addedSteps = notStored(input.pieceSteps, steps.keys());
      for (const session of addedSessions) sessions.set(session.id, copy(session));
      for (const attempt of addedAttempts) attempts.set(attempt.id, copy(attempt));
      for (const piece of addedPieces) pieces.set(piece.id, copy(piece));
      for (const step of addedSteps) steps.set(step.id, copy(step));
      stats = statsFromAttempts([...attempts.values()]);
      return Promise.resolve({
        sessions: addedSessions.length,
        attempts: addedAttempts.length,
        pieces: addedPieces.length,
        pieceSteps: addedSteps.length,
      });
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
