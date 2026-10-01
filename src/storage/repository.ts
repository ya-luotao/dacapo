import { byAnswerTime, type Answer } from '../core/answers.ts';
import type { FreePlaySession, OpenFreePlay } from '../core/freePlay.ts';
import { byStartDescending, byTime, sessionRuns, type SessionRecord } from '../core/log.ts';
import {
  byStepTime,
  type PieceRunHeader,
  type PieceSession,
  type PieceStep,
} from '../core/pieceRecords.ts';
import { byRunTime, type ScaleSession, type StoredScaleRun } from '../core/scaleRecords.ts';
import type { Attempt } from '../core/session.ts';
import { byImportedDescending, type StoredPiece } from '../core/storedPiece.ts';
import { byTakeChunk, type TakeChunk } from '../core/takes.ts';
import { emptyStats, statsFromAttempts, updateStats, type NoteStats } from '../core/weakness.ts';
import { canonicalText } from '../lib/canonical.ts';
import { openDacapoDB, type DacapoDB, type OpenHandlers } from './db.ts';
import { createSyncStorage, deletedPieces, type SyncStorage } from './syncStorage.ts';
import {
  outboxEntry,
  pieceDeletionKey,
  SYNC_STATE_KEY,
  type OutboxEntry,
  type PieceDeletion,
  type SyncCollection,
} from './syncTypes.ts';
import { isOpenFreePlay, validatePieceRunHeader } from './validate.ts';
import { writeAll } from './writeAll.ts';

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
  /** Ear-training, theory and chord-symbol answers, in the order they happened. */
  answers: Answer[];
}

export interface MergeResult {
  /** Added, and scale and sight-reading sessions replaced by a longer copy. */
  sessions: number;
  attempts: number;
  pieces: number;
  pieceSteps: number;
  scaleRuns: number;
  answers: number;
  takes: number;
}

/** What an import adds; records whose id is stored already are kept as they are. */
export interface MergeInput {
  sessions: readonly SessionRecord[];
  attempts: readonly Attempt[];
  pieces: readonly StoredPiece[];
  pieceSteps: readonly PieceStep[];
  scaleRuns: readonly StoredScaleRun[];
  answers: readonly Answer[];
  takes: readonly TakeChunk[];
}

/** Which step records to read: those of a piece or of one session. */
export type StepQuery = { pieceId: string } | { sessionId: string };

/** Which scale runs to read: those of an exercise (its `exerciseKey`) or of one session. */
export type ScaleRunQuery = { exercise: string } | { sessionId: string };

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
  /**
   * Deletes the piece, and with `steps` its step records and takes, in one transaction, and
   * remembers the deletion for sync (docs/SYNC.md: a deletion is final).
   */
  deletePiece: (id: string, options?: { steps: boolean; at?: number }) => Promise<void>;
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
   * Stores a scale run (one whose id is stored already changes nothing) and adds or replaces its
   * session, brought up to date with the run, in one transaction.
   */
  addScaleRun: (run: StoredScaleRun, session: ScaleSession) => Promise<void>;
  /** Scale runs by index, in the order played. Never read at startup. */
  scaleRuns: (query: ScaleRunQuery) => Promise<StoredScaleRun[]>;
  /** Every scale run, in order: for the export file. */
  allScaleRuns: () => Promise<StoredScaleRun[]>;
  scaleRunIds: () => Promise<string[]>;
  /** Stores an ear-training, theory or chord-symbol answer; one already stored changes nothing. */
  addAnswer: (answer: Answer) => Promise<void>;
  /** Stores a chunk of a take; one whose id is stored already changes nothing. */
  addTake: (chunk: TakeChunk) => Promise<void>;
  /** Take chunks by index (a piece's, or one run's), in order. Never read at startup. */
  takes: (query: StepQuery) => Promise<TakeChunk[]>;
  /** Every take chunk, in order: for the export file. */
  allTakes: () => Promise<TakeChunk[]>;
  takeIds: () => Promise<string[]>;
  /**
   * Adds the records whose id is not stored yet (stored ones are kept as they are, except a scale
   * session, which gives way to a copy with more runs), then rebuilds every note's stats from all
   * attempts, in one transaction. Returns how many were added (or replaced). A deleted piece is
   * not added again, nor, when it was deleted with them, its step records and takes.
   */
  merge: (input: MergeInput) => Promise<MergeResult>;
  /** The sync storage; null for the memory repository, which cannot sync. */
  readonly sync: SyncStorage | null;
  close: () => void;
}

// While signed in to sync, every write also puts its records in the outbox, in the same
// transaction, so nothing written is left unsent. Whether the device is signed in is read in that
// transaction too: another tab may have signed in or out a moment ago.

async function isSyncing(meta: { getKey: (key: string) => Promise<unknown> }): Promise<boolean> {
  return (await meta.getKey(SYNC_STATE_KEY)) !== undefined;
}

type Tracked = readonly [SyncCollection, string] | OutboxEntry;

// Serialized, an undefined field is left out.
const sameBesidesFacts = (a: StoredPiece, b: StoredPiece) =>
  canonicalText({ ...a, facts: undefined }) === canonicalText({ ...b, facts: undefined });

/** The writes that put `records` in the outbox, when signed in. */
function track(
  outbox: { put: (entry: OutboxEntry) => Promise<unknown> },
  syncing: boolean,
  records: readonly Tracked[],
): (() => Promise<unknown>)[] {
  if (!syncing) return [];
  return records.map((record) => {
    const entry = 'key' in record ? record : outboxEntry(record[0], record[1]);
    return () => outbox.put(entry);
  });
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

/**
 * The scale and sight-reading sessions of `records` that are stored with fewer runs, first
 * occurrence only. Such a session grows while it is played (it is stored again after every run),
 * so a longer copy (from another device, say) is the later one.
 */
function longerSessions(
  records: readonly SessionRecord[],
  stored: (id: string) => SessionRecord | undefined,
): SessionRecord[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    if ((record.kind !== 'scale' && record.kind !== 'sight') || seen.has(record.id)) return false;
    seen.add(record.id);
    const known = stored(record.id);
    return known?.kind === record.kind && sessionRuns(record) > sessionRuns(known);
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

function sorted(data: StoredData): StoredData {
  return {
    ...data,
    attempts: data.attempts.sort(byTime),
    sessions: data.sessions.sort(byStartDescending),
    pieces: data.pieces.sort(byImportedDescending),
    answers: data.answers.sort(byAnswerTime),
  };
}

export function createIndexedDbRepository(db: DacapoDB): PracticeRepository {
  return {
    kind: 'indexeddb',
    async load() {
      const tx = db.transaction(['attempts', 'noteStats', 'sessions', 'meta', 'pieces', 'answers']);
      const [attempts, stats, sessions, meta, runs, pieces, answers] = await Promise.all([
        tx.objectStore('attempts').getAll(),
        tx.objectStore('noteStats').getAll(),
        tx.objectStore('sessions').getAll(),
        tx.objectStore('meta').getAll(openFreePlayRange()),
        tx.objectStore('meta').getAll(openPieceRunRange()),
        tx.objectStore('pieces').getAll(),
        tx.objectStore('answers').getAll(),
        tx.done,
      ]);
      return sorted({
        attempts,
        stats: Object.fromEntries(stats.map((s) => [s.key, s])),
        sessions,
        openFreePlay: meta.filter(isOpenFreePlay),
        pieces,
        openPieceRuns: validHeaders(runs),
        answers,
      });
    },
    async addAttempt(attempt) {
      const tx = db.transaction(['attempts', 'noteStats', 'meta', 'outbox'], 'readwrite');
      const attempts = tx.objectStore('attempts');
      const noteStats = tx.objectStore('noteStats');
      const [known, current, syncing] = await Promise.all([
        attempts.getKey(attempt.id),
        noteStats.get(attempt.note),
        isSyncing(tx.objectStore('meta')),
      ]);
      if (known !== undefined) {
        await tx.done;
        return current ?? emptyStats(attempt.note);
      }
      const stats = updateStats(current ?? emptyStats(attempt.note), attempt);
      await writeAll(tx, [
        () => noteStats.put(stats),
        () => attempts.add(attempt),
        ...track(tx.objectStore('outbox'), syncing, [['attempts', attempt.id]]),
      ]);
      return stats;
    },
    async putSession(session) {
      const tx = db.transaction(['sessions', 'meta', 'outbox'], 'readwrite');
      const syncing = await isSyncing(tx.objectStore('meta'));
      await writeAll(tx, [
        () => tx.objectStore('sessions').put(session),
        ...track(tx.objectStore('outbox'), syncing, [['sessions', session.id]]),
      ]);
    },
    async saveOpenFreePlay(open) {
      await db.put('meta', open, openFreePlayKey(open.id));
    },
    async finishOpenFreePlay(id, session) {
      const tx = db.transaction(['sessions', 'meta', 'outbox'], 'readwrite');
      const syncing = await isSyncing(tx.objectStore('meta'));
      await writeAll(tx, [
        ...(session ? [() => tx.objectStore('sessions').put(session)] : []),
        () => tx.objectStore('meta').delete(openFreePlayKey(id)),
        ...track(tx.objectStore('outbox'), syncing, session ? [['sessions', session.id]] : []),
      ]);
    },
    async putPiece(piece) {
      const tx = db.transaction(['pieces', 'meta', 'outbox'], 'readwrite');
      const pieces = tx.objectStore('pieces');
      const [syncing, stored] = await Promise.all([
        isSyncing(tx.objectStore('meta')),
        pieces.get(piece.id),
      ]);
      // Facts are derived and not synced: filling them in sends nothing.
      const changed = !stored || !sameBesidesFacts(stored, piece);
      await writeAll(tx, [
        () => pieces.put(piece),
        ...track(tx.objectStore('outbox'), syncing && changed, [['pieces', piece.id]]),
      ]);
    },
    async deletePiece(id, options) {
      const withSteps = options?.steps ?? false;
      const deletion: PieceDeletion = { deleted: true, at: options?.at ?? Date.now(), withSteps };
      const tx = db.transaction(['pieces', 'pieceSteps', 'takes', 'meta', 'outbox'], 'readwrite');
      const steps = tx.objectStore('pieceSteps');
      const takes = tx.objectStore('takes');
      const meta = tx.objectStore('meta');
      const [keys, takeKeys, syncing] = await Promise.all([
        withSteps ? steps.index('by-piece').getAllKeys(id) : Promise.resolve([]),
        withSteps ? takes.index('by-piece').getAllKeys(id) : Promise.resolve([]),
        isSyncing(meta),
      ]);
      await writeAll(tx, [
        () => tx.objectStore('pieces').delete(id),
        ...keys.map((key) => () => steps.delete(key)),
        ...takeKeys.map((key) => () => takes.delete(key)),
        () => meta.put(deletion, pieceDeletionKey(id)),
        ...track(tx.objectStore('outbox'), syncing, [outboxEntry('pieces', id, deletion)]),
      ]);
    },
    async addPieceStep(step, header) {
      const tx = db.transaction(['pieceSteps', 'meta', 'outbox'], 'readwrite');
      const steps = tx.objectStore('pieceSteps');
      const [known, syncing] = await Promise.all([
        steps.getKey(step.id),
        isSyncing(tx.objectStore('meta')),
      ]);
      await writeAll(tx, [
        ...(known === undefined ? [() => steps.add(step)] : []),
        ...(header ? [() => tx.objectStore('meta').put(header, openPieceRunKey(header.id))] : []),
        ...track(tx.objectStore('outbox'), syncing && known === undefined, [
          ['pieceSteps', step.id],
        ]),
      ]);
    },
    async finishPieceRun(id, session) {
      const tx = db.transaction(['sessions', 'meta', 'outbox'], 'readwrite');
      const syncing = await isSyncing(tx.objectStore('meta'));
      await writeAll(tx, [
        ...(session ? [() => tx.objectStore('sessions').put(session)] : []),
        () => tx.objectStore('meta').delete(openPieceRunKey(id)),
        ...track(tx.objectStore('outbox'), syncing, session ? [['sessions', session.id]] : []),
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
    async addScaleRun(run, session) {
      const tx = db.transaction(['scaleRuns', 'sessions', 'meta', 'outbox'], 'readwrite');
      const runs = tx.objectStore('scaleRuns');
      const [known, syncing] = await Promise.all([
        runs.getKey(run.id),
        isSyncing(tx.objectStore('meta')),
      ]);
      await writeAll(tx, [
        ...(known === undefined ? [() => runs.add(run)] : []),
        () => tx.objectStore('sessions').put(session),
        ...track(tx.objectStore('outbox'), syncing, [
          ...(known === undefined ? [['scaleRuns', run.id] as const] : []),
          ['sessions', session.id],
        ]),
      ]);
    },
    async scaleRuns(query) {
      const runs =
        'exercise' in query
          ? await db.getAllFromIndex('scaleRuns', 'by-exercise', query.exercise)
          : await db.getAllFromIndex('scaleRuns', 'by-session', query.sessionId);
      return runs.sort(byRunTime);
    },
    async allScaleRuns() {
      return (await db.getAll('scaleRuns')).sort(byRunTime);
    },
    scaleRunIds: () => db.getAllKeys('scaleRuns'),
    async addAnswer(answer) {
      const tx = db.transaction(['answers', 'meta', 'outbox'], 'readwrite');
      const answers = tx.objectStore('answers');
      const [known, syncing] = await Promise.all([
        answers.getKey(answer.id),
        isSyncing(tx.objectStore('meta')),
      ]);
      if (known !== undefined) {
        await tx.done;
        return;
      }
      await writeAll(tx, [
        () => answers.add(answer),
        ...track(tx.objectStore('outbox'), syncing, [['answers', answer.id]]),
      ]);
    },
    async addTake(chunk) {
      const tx = db.transaction(['takes', 'meta', 'outbox'], 'readwrite');
      const takes = tx.objectStore('takes');
      const [known, syncing] = await Promise.all([
        takes.getKey(chunk.id),
        isSyncing(tx.objectStore('meta')),
      ]);
      if (known !== undefined) {
        await tx.done;
        return;
      }
      await writeAll(tx, [
        () => takes.add(chunk),
        ...track(tx.objectStore('outbox'), syncing, [['takes', chunk.id]]),
      ]);
    },
    async takes(query) {
      const chunks =
        'pieceId' in query
          ? await db.getAllFromIndex('takes', 'by-piece', query.pieceId)
          : await db.getAllFromIndex('takes', 'by-session', query.sessionId);
      return chunks.sort(byTakeChunk);
    },
    async allTakes() {
      return (await db.getAll('takes')).sort(byTakeChunk);
    },
    takeIds: () => db.getAllKeys('takes'),
    async merge(input) {
      const tx = db.transaction(
        [
          'sessions',
          'attempts',
          'noteStats',
          'pieces',
          'pieceSteps',
          'scaleRuns',
          'answers',
          'takes',
          'meta',
          'outbox',
        ],
        'readwrite',
      );
      const sessions = tx.objectStore('sessions');
      const attempts = tx.objectStore('attempts');
      const noteStats = tx.objectStore('noteStats');
      const pieces = tx.objectStore('pieces');
      const pieceSteps = tx.objectStore('pieceSteps');
      const scaleRuns = tx.objectStore('scaleRuns');
      const answers = tx.objectStore('answers');
      const takes = tx.objectStore('takes');
      const meta = tx.objectStore('meta');
      const [
        storedSessions,
        storedAttempts,
        pieceIds,
        stepIds,
        runIds,
        answerIds,
        takeIds,
        deletions,
        syncing,
      ] = await Promise.all([
        sessions.getAll(),
        attempts.getAll(),
        pieces.getAllKeys(),
        pieceSteps.getAllKeys(),
        scaleRuns.getAllKeys(),
        answers.getAllKeys(),
        takes.getAllKeys(),
        deletedPieces(meta),
        isSyncing(meta),
      ]);
      const byId = new Map(storedSessions.map((s) => [s.id, s]));
      const addedSessions = notStored(input.sessions, byId.keys());
      const longer = longerSessions(input.sessions, (id) => byId.get(id));
      const addedAttempts = notStored(
        input.attempts,
        storedAttempts.map((a) => a.id),
      );
      const addedPieces = notStored(input.pieces, pieceIds).filter((p) => !deletions.has(p.id));
      const addedSteps = notStored(input.pieceSteps, stepIds).filter(
        (step) => !deletions.get(step.pieceId)?.withSteps,
      );
      const addedRuns = notStored(input.scaleRuns, runIds);
      const addedAnswers = notStored(input.answers, answerIds);
      const addedTakes = notStored(input.takes, takeIds).filter(
        (chunk) => !deletions.get(chunk.pieceId)?.withSteps,
      );
      const stats = statsFromAttempts([...storedAttempts, ...addedAttempts]);
      const tracked: Tracked[] = [
        ...[...addedSessions, ...longer].map((r) => ['sessions', r.id] as const),
        ...addedAttempts.map((r) => ['attempts', r.id] as const),
        ...addedPieces.map((r) => ['pieces', r.id] as const),
        ...addedSteps.map((r) => ['pieceSteps', r.id] as const),
        ...addedRuns.map((r) => ['scaleRuns', r.id] as const),
        ...addedAnswers.map((r) => ['answers', r.id] as const),
        ...addedTakes.map((r) => ['takes', r.id] as const),
      ];
      await writeAll(tx, [
        ...addedSessions.map((session) => () => sessions.add(session)),
        ...longer.map((session) => () => sessions.put(session)),
        ...addedAttempts.map((attempt) => () => attempts.add(attempt)),
        ...addedPieces.map((piece) => () => pieces.add(piece)),
        ...addedSteps.map((step) => () => pieceSteps.add(step)),
        ...addedRuns.map((run) => () => scaleRuns.add(run)),
        ...addedAnswers.map((answer) => () => answers.add(answer)),
        ...addedTakes.map((chunk) => () => takes.add(chunk)),
        () => noteStats.clear(),
        ...Object.values(stats).map((s) => () => noteStats.put(s)),
        ...track(tx.objectStore('outbox'), syncing, tracked),
      ]);
      return {
        sessions: addedSessions.length + longer.length,
        attempts: addedAttempts.length,
        pieces: addedPieces.length,
        pieceSteps: addedSteps.length,
        scaleRuns: addedRuns.length,
        answers: addedAnswers.length,
        takes: addedTakes.length,
      };
    },
    sync: createSyncStorage(db),
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
  const scaleRuns = new Map<string, StoredScaleRun>();
  const answers = new Map<string, Answer>();
  const takes = new Map<string, TakeChunk>();
  const deletions = new Map<string, PieceDeletion>();
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
          answers: [...answers.values()].map(copy),
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
      deletions.set(id, {
        deleted: true,
        at: options?.at ?? Date.now(),
        withSteps: options?.steps ?? false,
      });
      if (options?.steps) {
        for (const [key, step] of steps) if (step.pieceId === id) steps.delete(key);
        for (const [key, chunk] of takes) if (chunk.pieceId === id) takes.delete(key);
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
    addScaleRun(run, session) {
      if (!scaleRuns.has(run.id)) scaleRuns.set(run.id, copy(run));
      sessions.set(session.id, copy(session));
      return Promise.resolve();
    },
    scaleRuns(query) {
      const match = (r: StoredScaleRun) =>
        'exercise' in query ? r.exercise === query.exercise : r.sessionId === query.sessionId;
      return Promise.resolve([...scaleRuns.values()].filter(match).map(copy).sort(byRunTime));
    },
    allScaleRuns: () => Promise.resolve([...scaleRuns.values()].map(copy).sort(byRunTime)),
    scaleRunIds: () => Promise.resolve([...scaleRuns.keys()]),
    addAnswer(answer) {
      if (!answers.has(answer.id)) answers.set(answer.id, copy(answer));
      return Promise.resolve();
    },
    addTake(chunk) {
      if (!takes.has(chunk.id)) takes.set(chunk.id, copy(chunk));
      return Promise.resolve();
    },
    takes(query) {
      const match = (c: TakeChunk) =>
        'pieceId' in query ? c.pieceId === query.pieceId : c.sessionId === query.sessionId;
      return Promise.resolve([...takes.values()].filter(match).map(copy).sort(byTakeChunk));
    },
    allTakes: () => Promise.resolve([...takes.values()].map(copy).sort(byTakeChunk)),
    takeIds: () => Promise.resolve([...takes.keys()]),
    merge(input) {
      const addedSessions = notStored(input.sessions, sessions.keys());
      const longer = longerSessions(input.sessions, (id) => sessions.get(id));
      const addedAttempts = notStored(input.attempts, attempts.keys());
      const addedPieces = notStored(input.pieces, pieces.keys()).filter(
        (p) => !deletions.has(p.id),
      );
      const addedSteps = notStored(input.pieceSteps, steps.keys()).filter(
        (step) => !deletions.get(step.pieceId)?.withSteps,
      );
      const addedRuns = notStored(input.scaleRuns, scaleRuns.keys());
      const addedAnswers = notStored(input.answers, answers.keys());
      const addedTakes = notStored(input.takes, takes.keys()).filter(
        (chunk) => !deletions.get(chunk.pieceId)?.withSteps,
      );
      for (const session of [...addedSessions, ...longer]) {
        sessions.set(session.id, copy(session));
      }
      for (const attempt of addedAttempts) attempts.set(attempt.id, copy(attempt));
      for (const piece of addedPieces) pieces.set(piece.id, copy(piece));
      for (const step of addedSteps) steps.set(step.id, copy(step));
      for (const run of addedRuns) scaleRuns.set(run.id, copy(run));
      for (const answer of addedAnswers) answers.set(answer.id, copy(answer));
      for (const chunk of addedTakes) takes.set(chunk.id, copy(chunk));
      stats = statsFromAttempts([...attempts.values()]);
      return Promise.resolve({
        sessions: addedSessions.length + longer.length,
        attempts: addedAttempts.length,
        pieces: addedPieces.length,
        pieceSteps: addedSteps.length,
        scaleRuns: addedRuns.length,
        answers: addedAnswers.length,
        takes: addedTakes.length,
      });
    },
    sync: null,
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
