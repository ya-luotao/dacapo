import { closeFreePlay, type FreePlaySession, type OpenFreePlay } from '../../core/freePlay.ts';
import {
  byStartDescending,
  byTime,
  recoverReadSessions,
  type SessionRecord,
} from '../../core/log.ts';
import {
  byStepTime,
  recoverPieceSession,
  type PieceRunHeader,
  type PieceSession,
  type PieceStep,
} from '../../core/pieceRecords.ts';
import type { Attempt } from '../../core/session.ts';
import { byImportedDescending, type StoredPiece } from '../../core/storedPiece.ts';
import { emptyStats, updateStats, type NoteStats, type StatsByKey } from '../../core/weakness.ts';
import type { OpenHandlers } from '../../storage/db.ts';
import {
  createMemoryRepository,
  type MergeInput,
  type MergeResult,
  type OpenResult,
  type PracticeRepository,
  type StoredData,
} from '../../storage/repository.ts';

/** Everything practised, as plain data: raw attempts, per-note stats and sessions. */
export interface PracticeData {
  /** In the order they happened. */
  attempts: readonly Attempt[];
  stats: StatsByKey;
  /** Most recent first. */
  sessions: readonly SessionRecord[];
  /** Imported pieces, newest first. */
  pieces: readonly StoredPiece[];
}

/**
 * - `loading`: opening storage.
 * - `blocked`: waiting for another tab to close an older version of the database.
 * - `saved`: everything is written to IndexedDB.
 * - `unavailable`: IndexedDB could not be used; progress lives in memory only.
 * - `failed`: a write failed (e.g. storage full); what could not be written lives in memory only.
 * - `outdated`: another tab upgraded or deleted the database, or the browser closed it; saving
 *   stopped until the page is reloaded.
 */
export type StorageState = 'loading' | 'blocked' | 'saved' | 'unavailable' | 'failed' | 'outdated';

export interface StorageStatus {
  state: StorageState;
  /** The stored data is in the snapshot. False only while loading. */
  loaded: boolean;
  /** Whether the browser keeps the data under storage pressure; null when unknown. */
  persisted: boolean | null;
}

export interface PracticeStore {
  getSnapshot: () => PracticeData;
  /** For `useSyncExternalStore`. */
  subscribe: (onChange: () => void) => () => void;
  getStatus: () => StorageStatus;
  subscribeStatus: (onChange: () => void) => () => void;
  recordAttempt: (attempt: Attempt) => void;
  /** Adds or replaces the session with the same id. */
  recordSession: (session: SessionRecord) => void;
  /** Saves a free-play session in progress, so it survives the tab being closed. */
  saveOpenFreePlay: (open: OpenFreePlay) => void;
  /** A free-play session ended: records it (null when too short) and drops its saved progress. */
  finishFreePlay: (id: string, session: FreePlaySession | null) => void;
  /** Adds or replaces an imported piece (a new import, a rename, other hands). */
  savePiece: (piece: StoredPiece) => void;
  /** Deletes an imported piece, and with `steps` its step records. Its sessions stay. */
  deletePiece: (id: string, options?: { steps: boolean }) => void;
  /** Stores a completed wait-mode step; `header` goes with the run's first step. */
  recordPieceStep: (step: PieceStep, header: PieceRunHeader | null) => void;
  /** A run ended: records its session (null when it had no step) and drops its header. */
  finishPieceRun: (id: string, session: PieceSession | null) => void;
  /**
   * The step records of a piece, in order, once loaded; null until then. Records are read one
   * piece at a time and only when asked for (`loadPieceSteps`), never at startup.
   */
  getPieceSteps: (pieceId: string) => readonly PieceStep[] | null;
  /** Starts reading a piece's step records unless they are loaded or loading. */
  loadPieceSteps: (pieceId: string) => void;
  subscribePieceSteps: (onChange: () => void) => () => void;
  /** Every step record, for the export file. */
  allPieceSteps: () => Promise<PieceStep[]>;
  pieceStepIds: () => Promise<Set<string>>;
  /** Merges by id, rebuilds note stats from all attempts and reloads. */
  importData: (input: MergeInput) => Promise<MergeResult>;
  /** Resolves once every write requested so far has finished (or failed). */
  settled: () => Promise<void>;
  /** Opens storage and loads. Call once; returns a function that closes everything. */
  start: () => () => void;
}

/** What the store needs from `BroadcastChannel`. */
export interface SyncChannel {
  postMessage: (message: SyncMessage) => void;
  onmessage: ((event: { data: unknown }) => void) | null;
  close: () => void;
}

export type SyncMessage =
  | { type: 'attempt'; attempt: Attempt; stats: NoteStats }
  | { type: 'session'; session: SessionRecord }
  | { type: 'piece'; piece: StoredPiece }
  | { type: 'pieceDeleted'; id: string; steps: boolean }
  | { type: 'pieceStep'; step: PieceStep }
  | { type: 'reload' };

/** What the store needs from `navigator.storage`. */
export interface PersistentStorage {
  persisted: () => Promise<boolean>;
  persist: () => Promise<boolean>;
}

export interface PracticeStoreOptions {
  open?: (handlers: OpenHandlers) => Promise<OpenResult>;
  /** Other tabs of the app; null when `BroadcastChannel` is missing. */
  channel?: () => SyncChannel | null;
  storage?: PersistentStorage | null;
}

export const SYNC_CHANNEL = 'dacapo';

export const EMPTY_PRACTICE: PracticeData = { attempts: [], stats: {}, sessions: [], pieces: [] };

const openInMemory = (): Promise<OpenResult> =>
  Promise.resolve({ repository: createMemoryRepository(), failure: null });

function insertAttempt(attempts: readonly Attempt[], attempt: Attempt): Attempt[] {
  const last = attempts.at(-1);
  if (!last || byTime(last, attempt) <= 0) return [...attempts, attempt];
  return [...attempts, attempt].sort(byTime);
}

function upsertSession(sessions: readonly SessionRecord[], session: SessionRecord) {
  return [...sessions.filter((s) => s.id !== session.id), session].sort(byStartDescending);
}

function upsertPiece(pieces: readonly StoredPiece[], piece: StoredPiece) {
  return [...pieces.filter((p) => p.id !== piece.id), piece].sort(byImportedDescending);
}

function addSteps(steps: readonly PieceStep[], added: readonly PieceStep[]): PieceStep[] {
  const ids = new Set(steps.map((s) => s.id));
  const fresh = added.filter((s) => !ids.has(s.id) && Boolean(ids.add(s.id)));
  if (fresh.length === 0) return steps as PieceStep[];
  const last = steps.at(-1);
  const merged = [...steps, ...fresh];
  return last && fresh.some((s) => byStepTime(last, s) > 0) ? merged.sort(byStepTime) : merged;
}

/** Step records of one piece: loaded, or loading with the steps recorded meanwhile. */
type StepCache =
  { ready: true; steps: readonly PieceStep[] } | { ready: false; extra: PieceStep[] };

/**
 * The practice data of the app: loaded once from storage, updated in memory at once on every
 * change (the UI never waits for storage) and written in the background, in order. Other tabs are
 * told about every write, so their snapshots stay in step.
 */
export function createPracticeStore({
  open = openInMemory,
  channel: createChannel = () => null,
  storage = null,
}: PracticeStoreOptions = {}): PracticeStore {
  let data = EMPTY_PRACTICE;
  let status: StorageStatus = { state: 'loading', loaded: false, persisted: null };
  const listeners = new Set<() => void>();
  const statusListeners = new Set<() => void>();
  const stepListeners = new Set<() => void>();
  let stepCache = new Map<string, StepCache>();

  let repository: PracticeRepository | null = null;
  let channel: SyncChannel | null = null;
  let persistRequested = false;
  let resolveReady: () => void = () => {};
  const ready = new Promise<void>((resolve) => (resolveReady = resolve));
  let queue: Promise<void> = ready;

  function set(next: PracticeData) {
    data = next;
    for (const listener of [...listeners]) listener();
  }

  function setStepCache(pieceId: string, entry: StepCache | null) {
    stepCache = new Map(stepCache);
    if (entry) stepCache.set(pieceId, entry);
    else stepCache.delete(pieceId);
    for (const listener of [...stepListeners]) listener();
  }

  /** Adds steps to a piece's cache, if it is loaded or loading. */
  function cacheSteps(added: readonly PieceStep[]) {
    const byPiece = new Map<string, PieceStep[]>();
    for (const step of added) {
      if (!stepCache.has(step.pieceId)) continue;
      byPiece.set(step.pieceId, [...(byPiece.get(step.pieceId) ?? []), step]);
    }
    for (const [pieceId, steps] of byPiece) {
      const entry = stepCache.get(pieceId)!;
      if (!entry.ready) {
        entry.extra.push(...steps);
        continue;
      }
      const next = addSteps(entry.steps, steps);
      if (next !== entry.steps) setStepCache(pieceId, { ready: true, steps: next });
    }
  }

  function setStatus(next: Partial<StorageStatus>) {
    status = { ...status, ...next };
    for (const listener of [...statusListeners]) listener();
  }

  const outdated = () => status.state === 'outdated';
  const shared = () => repository?.kind === 'indexeddb' && !outdated();

  function broadcast(message: SyncMessage) {
    if (shared()) channel?.postMessage(message);
  }

  /** Runs `write` after every earlier one, once storage is open. Failures never stop the queue. */
  function enqueue<T>(write: (repo: PracticeRepository) => Promise<T>): Promise<T | undefined> {
    const result = queue.then(async () => {
      if (!repository || outdated()) return undefined;
      try {
        return await write(repository);
      } catch (error) {
        console.error('dacapo: could not save progress', error);
        if (!outdated()) setStatus({ state: 'failed' });
        return undefined;
      }
    });
    queue = result.then(() => undefined);
    return result;
  }

  /** Stored data plus what was recorded in this tab before loading finished. */
  function mergeEarly(stored: StoredData, early: PracticeData): PracticeData {
    const storedIds = new Set(stored.attempts.map((a) => a.id));
    const stats: Record<string, NoteStats> = { ...stored.stats };
    let attempts: Attempt[] = stored.attempts;
    for (const attempt of early.attempts) {
      if (storedIds.has(attempt.id)) continue;
      stats[attempt.note] = updateStats(stats[attempt.note] ?? emptyStats(attempt.note), attempt);
      attempts = insertAttempt(attempts, attempt);
    }
    let sessions: SessionRecord[] = stored.sessions;
    for (const session of early.sessions) sessions = upsertSession(sessions, session);
    let pieces: StoredPiece[] = stored.pieces;
    for (const piece of early.pieces) pieces = upsertPiece(pieces, piece);
    return { attempts, stats, sessions, pieces };
  }

  /**
   * Loads everything and repairs what a closed tab left behind: free-play sessions still open,
   * and flashcard attempts whose session summary was never written. Both are keyed by the id the
   * other tab uses, so if that tab is in fact still running, its own later write wins.
   */
  async function load(repo: PracticeRepository): Promise<StoredData> {
    const stored = await repo.load();
    let sessions = stored.sessions;
    for (const openSession of stored.openFreePlay) {
      const finished = closeFreePlay(openSession);
      const known = sessions.find((s) => s.id === openSession.id);
      // A save older than the recorded session (its tab finished it after all) is dropped.
      const keep = finished && !(known && known.endedAt >= finished.endedAt) ? finished : null;
      await repo.finishOpenFreePlay(openSession.id, keep);
      if (keep) sessions = upsertSession(sessions, keep);
    }
    for (const recovered of recoverReadSessions(stored.attempts, sessions)) {
      await repo.putSession(recovered);
      sessions = upsertSession(sessions, recovered);
    }
    for (const header of stored.openPieceRuns) {
      const recovered = recoverPieceSession(
        header,
        await repo.pieceSteps({ sessionId: header.id }),
      );
      const known = sessions.find((s) => s.id === header.id);
      const keep = recovered && !(known && known.endedAt >= recovered.endedAt) ? recovered : null;
      await repo.finishPieceRun(header.id, keep);
      if (keep) sessions = upsertSession(sessions, keep);
    }
    return { ...stored, sessions, openFreePlay: [], openPieceRuns: [] };
  }

  function reload() {
    return enqueue(async (repo) => {
      const stored = await load(repo);
      set({
        attempts: stored.attempts,
        stats: stored.stats,
        sessions: stored.sessions,
        pieces: stored.pieces,
      });
      // Loaded again when next asked for.
      stepCache = new Map();
      for (const listener of [...stepListeners]) listener();
    });
  }

  // Messages that arrive while loading wait until the stored data is in.
  let pending: unknown[] | null = [];

  function onMessage({ data: message }: { data: unknown }) {
    if (pending) {
      pending.push(message);
      return;
    }
    if (!shared() || typeof message !== 'object' || message === null) return;
    const m = message as SyncMessage;
    switch (m.type) {
      case 'attempt':
        if (data.attempts.some((a) => a.id === m.attempt.id)) return;
        set({
          ...data,
          attempts: insertAttempt(data.attempts, m.attempt),
          stats: { ...data.stats, [m.stats.key]: m.stats },
        });
        return;
      case 'session':
        set({ ...data, sessions: upsertSession(data.sessions, m.session) });
        return;
      case 'piece':
        set({ ...data, pieces: upsertPiece(data.pieces, m.piece) });
        return;
      case 'pieceDeleted':
        set({ ...data, pieces: data.pieces.filter((p) => p.id !== m.id) });
        if (m.steps && stepCache.has(m.id)) setStepCache(m.id, { ready: true, steps: [] });
        return;
      case 'pieceStep':
        cacheSteps([m.step]);
        return;
      case 'reload':
        void reload();
        return;
    }
  }

  function requestPersistence() {
    if (persistRequested || !storage || repository?.kind !== 'indexeddb') return;
    persistRequested = true;
    storage
      .persist()
      .then((persisted) => setStatus({ persisted }))
      .catch(() => {});
  }

  return {
    getSnapshot: () => data,
    subscribe(onChange) {
      listeners.add(onChange);
      return () => void listeners.delete(onChange);
    },
    getStatus: () => status,
    subscribeStatus(onChange) {
      statusListeners.add(onChange);
      return () => void statusListeners.delete(onChange);
    },
    recordAttempt(attempt) {
      if (data.attempts.some((a) => a.id === attempt.id)) return;
      const stats = updateStats(data.stats[attempt.note] ?? emptyStats(attempt.note), attempt);
      set({
        ...data,
        attempts: insertAttempt(data.attempts, attempt),
        stats: { ...data.stats, [attempt.note]: stats },
      });
      void enqueue(async (repo) => {
        const stored = await repo.addAttempt(attempt);
        if (JSON.stringify(stored) !== JSON.stringify(data.stats[attempt.note])) {
          set({ ...data, stats: { ...data.stats, [attempt.note]: stored } });
        }
        broadcast({ type: 'attempt', attempt, stats: stored });
      });
    },
    recordSession(session) {
      set({ ...data, sessions: upsertSession(data.sessions, session) });
      void enqueue(async (repo) => {
        await repo.putSession(session);
        broadcast({ type: 'session', session });
        requestPersistence();
      });
    },
    saveOpenFreePlay(openSession) {
      void enqueue((repo) => repo.saveOpenFreePlay(openSession));
    },
    finishFreePlay(id, session) {
      if (session) set({ ...data, sessions: upsertSession(data.sessions, session) });
      void enqueue(async (repo) => {
        await repo.finishOpenFreePlay(id, session);
        if (!session) return;
        broadcast({ type: 'session', session });
        requestPersistence();
      });
    },
    savePiece(piece) {
      set({ ...data, pieces: upsertPiece(data.pieces, piece) });
      void enqueue(async (repo) => {
        await repo.putPiece(piece);
        broadcast({ type: 'piece', piece });
        requestPersistence();
      });
    },
    deletePiece(id, options) {
      const steps = options?.steps ?? false;
      set({ ...data, pieces: data.pieces.filter((p) => p.id !== id) });
      if (steps && stepCache.has(id)) setStepCache(id, { ready: true, steps: [] });
      void enqueue(async (repo) => {
        await repo.deletePiece(id, { steps });
        broadcast({ type: 'pieceDeleted', id, steps });
      });
    },
    recordPieceStep(step, header) {
      cacheSteps([step]);
      void enqueue(async (repo) => {
        await repo.addPieceStep(step, header);
        broadcast({ type: 'pieceStep', step });
      });
    },
    finishPieceRun(id, session) {
      if (session) set({ ...data, sessions: upsertSession(data.sessions, session) });
      void enqueue(async (repo) => {
        await repo.finishPieceRun(id, session);
        if (!session) return;
        broadcast({ type: 'session', session });
        requestPersistence();
      });
    },
    getPieceSteps(pieceId) {
      const entry = stepCache.get(pieceId);
      return entry?.ready ? entry.steps : null;
    },
    loadPieceSteps(pieceId) {
      if (stepCache.has(pieceId)) return;
      const loading: StepCache = { ready: false, extra: [] };
      setStepCache(pieceId, loading);
      void enqueue((repo) => repo.pieceSteps({ pieceId })).then((steps) => {
        // Dropped meanwhile (a reload): the next request reads again.
        if (stepCache.get(pieceId) !== loading) return;
        setStepCache(pieceId, { ready: true, steps: addSteps(steps ?? [], loading.extra) });
      });
    },
    subscribePieceSteps(onChange) {
      stepListeners.add(onChange);
      return () => void stepListeners.delete(onChange);
    },
    async allPieceSteps() {
      const steps = await enqueue((repo) => repo.allPieceSteps());
      if (!steps) throw new Error('Step records could not be read');
      return steps;
    },
    async pieceStepIds() {
      return new Set((await enqueue((repo) => repo.pieceStepIds())) ?? []);
    },
    async importData(input) {
      const added = await enqueue((repo) => repo.merge(input));
      if (!added) throw new Error('Import could not be saved');
      await reload();
      broadcast({ type: 'reload' });
      return added;
    },
    settled: () => queue,
    start() {
      let stopped = false;
      const handlers: OpenHandlers = {
        onBlocked: () => {
          if (!status.loaded) setStatus({ state: 'blocked' });
        },
        onVersionChange: () => setStatus({ state: 'outdated' }),
        onTerminated: () => setStatus({ state: 'outdated' }),
      };

      void (async () => {
        const opened = await open(handlers);
        if (stopped) {
          opened.repository.close();
          return;
        }
        repository = opened.repository;
        if (repository.kind === 'indexeddb') {
          channel = createChannel();
          if (channel) channel.onmessage = onMessage;
        }
        let stored: StoredData | null = null;
        let state: StorageState = opened.failure ? 'unavailable' : 'saved';
        try {
          stored = await load(repository);
        } catch (error) {
          console.error('dacapo: could not load progress', error);
          state = 'failed';
        }
        if (stored) set(mergeEarly(stored, data));
        setStatus({ state: outdated() ? 'outdated' : state, loaded: true });
        resolveReady();
        const early = pending ?? [];
        pending = null;
        for (const message of early) onMessage({ data: message });

        if (repository.kind === 'indexeddb') {
          storage
            ?.persisted()
            .then((persisted) => setStatus({ persisted }))
            .catch(() => {});
        }
      })();

      return () => {
        stopped = true;
        channel?.close();
        channel = null;
        repository?.close();
      };
    },
  };
}

/** The store's view of a `BroadcastChannel` between the app's tabs; null where there is none. */
export function broadcastChannel(name = SYNC_CHANNEL): SyncChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  const native = new BroadcastChannel(name);
  const channel: SyncChannel = {
    postMessage: (message) => native.postMessage(message),
    onmessage: null,
    close: () => native.close(),
  };
  native.onmessage = (event: MessageEvent<unknown>) => channel.onmessage?.(event);
  return channel;
}
