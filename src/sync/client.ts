import type { StoredPiece } from '../core/storedPiece.ts';
import type { AppliedCounts, PulledRecords, SyncStorage } from '../storage/syncStorage.ts';
import { nothingApplied } from '../storage/syncStorage.ts';
import type { OutboxEntry, SyncAccount, SyncState } from '../storage/syncTypes.ts';
import { ApiError, type ApiErrorCode, type PulledPage, type SyncApi } from './api.ts';
import {
  byteLength,
  incoming,
  MAX_BODY_BYTES,
  outgoing,
  pieceWithXml,
  sha256Hex,
  type Change,
  type Incoming,
} from './records.ts';

// The sync engine (docs/SYNC.md, "The client"): rounds of push-then-pull against the service,
// run on the practice store's write queue so they never interleave with a write, never while
// something is being practised, and in one tab at a time.

/** Outbox entries per request (the service takes 500). */
export const PUSH_LIMIT = 500;
/** Bodies per request, serialized; the service takes 8 MB. */
export const PUSH_BYTES = 6 * 1024 * 1024;
/** Requests per round at most; a round that needs more goes on at the next one. */
export const MAX_REQUESTS = 200;
export const INTERVAL_MS = 5 * 60_000;
export const START_DELAY_MS = 3_000;
const RETRY_MS = 30_000;

/** `offline`: the service could not be reached; the next round tries again. */
export type SyncPhase = 'signedOut' | 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncStatus {
  /** False until the stored account has been read, and when this storage cannot sync. */
  available: boolean;
  phase: SyncPhase;
  account: SyncAccount | null;
  /** Epoch ms of the last round that finished. */
  lastSyncAt: number | null;
  /** Why the last round failed; null after a good one. */
  error: ApiErrorCode | 'storage' | null;
}

/** What the engine needs from the practice store. */
export interface SyncHost {
  withSync: <T>(task: (sync: SyncStorage) => Promise<T>) => Promise<T | null>;
  reloadAll: () => Promise<void>;
}

/** Other tabs of the app, told when the account or the last sync changed. */
export interface SyncBroadcast {
  postMessage: (message: 'changed') => void;
  onmessage: ((event: { data: unknown }) => void) | null;
  close: () => void;
}

export interface SyncClientOptions {
  api: SyncApi;
  host: SyncHost;
  now?: () => number;
  /** Something is being practised: rounds wait (src/lib/shell.ts). */
  isBusy?: () => boolean;
  /** Calls back when practising stops; returns the function that stops listening. */
  onIdle?: (listener: () => void) => () => void;
  /** Runs `task` unless another tab holds the sync lock (then null). */
  lock?: <T>(task: () => Promise<T>) => Promise<T | null>;
  broadcast?: () => SyncBroadcast | null;
  /** For tests: the document whose visibility triggers rounds. */
  document?: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'> | null;
}

export interface SyncClient {
  getStatus: () => SyncStatus;
  subscribe: (listener: () => void) => () => void;
  /** Emails a sign-in code. Rejects with an `ApiError`. */
  requestCode: (email: string, locale: string) => Promise<void>;
  /** Signs in with the code and starts the first round. Rejects with an `ApiError`. */
  signIn: (email: string, code: string, device: string) => Promise<void>;
  /** Signs this device out; its records stay. */
  signOut: () => Promise<void>;
  /** Deletes the account on the service, then signs out. Rejects with an `ApiError`. */
  deleteAccount: () => Promise<void>;
  /** A round now (or right after the one running). */
  syncNow: () => Promise<void>;
  /** Reads the account and starts syncing. Returns the function that stops. */
  start: () => () => void;
}

/** Web Locks: one tab syncs at a time; the others skip their round. */
export function webLock<T>(task: () => Promise<T>): Promise<T | null> {
  const locks = globalThis.navigator?.locks;
  if (!locks) return task();
  return locks.request('dacapo-sync', { ifAvailable: true }, (lock) => (lock ? task() : null));
}

export function syncBroadcast(): SyncBroadcast | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  const native = new BroadcastChannel('dacapo-sync');
  const channel: SyncBroadcast = {
    postMessage: (message) => native.postMessage(message),
    onmessage: null,
    close: () => native.close(),
  };
  native.onmessage = (event: MessageEvent<unknown>) => channel.onmessage?.(event);
  return channel;
}

const SIGNED_OUT: SyncStatus = {
  available: true,
  phase: 'signedOut',
  account: null,
  lastSyncAt: null,
  error: null,
};

class StorageUnavailable extends Error {}

export function createSyncClient({
  api,
  host,
  now = Date.now,
  isBusy = () => false,
  onIdle = () => () => {},
  lock = webLock,
  broadcast: createBroadcast = syncBroadcast,
  document: doc = globalThis.document ?? null,
}: SyncClientOptions): SyncClient {
  let status: SyncStatus = { ...SIGNED_OUT, available: false };
  const listeners = new Set<() => void>();
  let channel: SyncBroadcast | null = null;
  let running: Promise<void> | null = null;
  let again = false;
  let failures = 0;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let stopped = true;

  function setStatus(next: Partial<SyncStatus>) {
    status = { ...status, ...next };
    for (const listener of [...listeners]) listener();
  }

  async function storage<T>(task: (sync: SyncStorage) => Promise<T>): Promise<T> {
    const result = await host.withSync(async (sync) => ({ value: await task(sync) }));
    if (result === null) throw new StorageUnavailable();
    return result.value;
  }

  async function readState(): Promise<SyncState | null> {
    try {
      const state = await storage((sync) => sync.state());
      setStatus({
        available: true,
        account: state?.account ?? null,
        lastSyncAt: state?.lastSyncAt ?? null,
        phase: state ? (status.phase === 'signedOut' ? 'idle' : status.phase) : 'signedOut',
        ...(!state && { error: null }),
      });
      return state;
    } catch {
      setStatus({ ...SIGNED_OUT, available: false });
      return null;
    }
  }

  /**
   * Forgets the account here: signed out, or the service answered 401 for `token` (signed out
   * elsewhere, or deleted), unless another sign-in has replaced that token meanwhile.
   */
  async function signOutHere(token?: string) {
    const done = await storage((sync) => sync.signOut(token)).catch(() => false);
    if (!done) {
      await readState();
      return;
    }
    setStatus({ ...SIGNED_OUT });
    channel?.postMessage('changed');
  }

  /** The changes of the outbox entries that fit in one request. */
  async function prepare(pending: Awaited<ReturnType<SyncStorage['pending']>>) {
    const changes: Change[] = [];
    const files = new Map<string, string>();
    const sent: OutboxEntry[] = [];
    const skipped: OutboxEntry[] = [];
    let bytes = 0;
    for (const item of pending) {
      const out = await outgoing(item);
      if (!out) {
        skipped.push(item.entry);
        continue;
      }
      const size = byteLength(JSON.stringify(out.change.body));
      if (size > MAX_BODY_BYTES) {
        console.warn(`dacapo: ${item.entry.key} is too large to sync (${size} bytes)`);
        skipped.push(item.entry);
        continue;
      }
      if (bytes + size > PUSH_BYTES && changes.length > 0) break;
      bytes += size;
      changes.push(out.change);
      if (out.file) files.set(out.file.hash, out.file.xml);
      sent.push(item.entry);
    }
    return { changes, files, sent, skipped };
  }

  /** Validates a pulled page, completes its pieces with their MusicXML, and applies it. */
  async function applyPage(token: string, page: PulledPage): Promise<AppliedCounts> {
    const parsed = page.changes.map(incoming).filter((c): c is Incoming => c !== null);
    const skipped = page.changes.length - parsed.length;
    if (skipped > 0) console.warn(`dacapo: skipped ${skipped} synced records that do not validate`);

    const livePieces = parsed.flatMap((c) =>
      c.collection === 'pieces' && 'piece' in c ? [c] : [],
    );
    const stored = livePieces.length
      ? await storage((sync) => sync.storedPieces(livePieces.map((c) => c.id)))
      : new Map<string, StoredPiece>();
    const pieces: StoredPiece[] = [];
    for (const { piece } of livePieces) {
      // The MusicXML of a piece never changes: a copy here has it already.
      let xml = stored.get(piece.id)?.xml ?? null;
      if (xml === null) {
        xml = await api.getFile(token, piece.xmlHash);
        if (xml !== null && (await sha256Hex(xml)) !== piece.xmlHash) xml = null;
      }
      const complete = xml === null ? null : pieceWithXml(piece, xml);
      if (complete) pieces.push(complete);
      else console.warn(`dacapo: the MusicXML of synced piece ${piece.id} is missing or invalid`);
    }

    const pulled: PulledRecords = {
      attempts: parsed.flatMap((c) => (c.collection === 'attempts' ? [c.record] : [])),
      sessions: parsed.flatMap((c) => (c.collection === 'sessions' ? [c.record] : [])),
      pieces,
      deletions: parsed.flatMap((c) =>
        c.collection === 'pieces' && 'deletion' in c ? [{ id: c.id, deletion: c.deletion }] : [],
      ),
      pieceSteps: parsed.flatMap((c) => (c.collection === 'pieceSteps' ? [c.record] : [])),
      scaleRuns: parsed.flatMap((c) => (c.collection === 'scaleRuns' ? [c.record] : [])),
    };
    return storage((sync) => sync.apply(pulled));
  }

  async function runRound(): Promise<void> {
    const state = await readState();
    if (!state) return;
    setStatus({ phase: 'syncing' });
    let cursor = state.cursor;
    let changed = false;
    try {
      for (let request = 0; request < MAX_REQUESTS; request++) {
        const pending = await storage((sync) => sync.pending(PUSH_LIMIT));
        const { changes, files, sent, skipped } = await prepare(pending);
        // A piece's file goes first, so a device that pulls the piece can download it.
        for (const [hash, xml] of files) {
          if (!(await api.hasFile(state.token, hash))) await api.putFile(state.token, hash, xml);
        }
        const page = await api.sync(state.token, cursor, changes);
        const counts = await applyPage(state.token, page);
        changed ||= !nothingApplied(counts);
        // A rejected entry stays: after this pull it is sent again, as the record is here now.
        const rejected = new Set(page.rejected.map((r) => `${r.collection}/${r.id}`));
        const done = [...sent.filter((entry) => !rejected.has(entry.key)), ...skipped];
        await storage((sync) => sync.acknowledge(done));
        cursor = page.cursor;
        // Signed out or in again meanwhile: this round is over.
        if (!(await storage((sync) => sync.saveProgress(state.token, { cursor })))) return;
        const drained =
          pending.length < PUSH_LIMIT && sent.length + skipped.length === pending.length;
        if (!page.more && rejected.size === 0 && drained) break;
        // Practising started meanwhile: the rest waits until it stops.
        if (isBusy()) break;
      }
      const lastSyncAt = now();
      await storage((sync) => sync.saveProgress(state.token, { lastSyncAt }));
      failures = 0;
      setStatus({ phase: 'idle', lastSyncAt, error: null });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'unauthorized') {
        await signOutHere(state.token);
        return;
      }
      if (!(error instanceof ApiError)) console.error('dacapo: sync failed', error);
      failures++;
      const code = error instanceof ApiError ? error.code : 'storage';
      setStatus({ phase: code === 'network' ? 'offline' : 'error', error: code });
      const backoff = Math.min(INTERVAL_MS, RETRY_MS * 2 ** (failures - 1));
      const asked = error instanceof ApiError && error.retryAfter ? error.retryAfter * 1000 : 0;
      clearTimeout(retry);
      if (!stopped) retry = setTimeout(() => void round(), Math.max(backoff, asked));
    } finally {
      if (changed) await host.reloadAll().catch(() => {});
      channel?.postMessage('changed');
    }
  }

  /** A round; while one runs, another right after it, and both are awaited. */
  function round(): Promise<void> {
    if (running) {
      again = true;
      return running;
    }
    if (isBusy()) return Promise.resolve();
    running = (async () => {
      try {
        do {
          again = false;
          await lock(runRound);
        } while (again && !isBusy());
      } finally {
        running = null;
      }
    })();
    return running;
  }

  return {
    getStatus: () => status,
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    requestCode: (email, locale) => api.requestCode(email, locale),
    async signIn(email, code, device) {
      const { token, account } = await api.verify(email, code, device);
      try {
        await storage((sync) => sync.signIn(account, token));
      } catch (error) {
        await api.signOut(token).catch(() => {});
        throw error;
      }
      setStatus({ available: true, phase: 'idle', account, lastSyncAt: null, error: null });
      channel?.postMessage('changed');
      void round();
    },
    async signOut() {
      const state = await readState();
      await signOutHere();
      if (state) await api.signOut(state.token).catch(() => {});
    },
    async deleteAccount() {
      const state = await readState();
      if (!state) return;
      try {
        await api.deleteAccount(state.token);
      } catch (error) {
        // 401: deleted already (a retry after an answer that never arrived).
        if (!(error instanceof ApiError && error.code === 'unauthorized')) throw error;
      }
      await signOutHere();
    },
    syncNow: () => round(),
    start() {
      stopped = false;
      channel = createBroadcast();
      if (channel) channel.onmessage = () => void readState();
      void readState();
      const first = setTimeout(() => void round(), START_DELAY_MS);
      const interval = setInterval(() => void round(), INTERVAL_MS);
      const stopIdle = onIdle(() => void round());
      const onVisibility = () => void round();
      doc?.addEventListener('visibilitychange', onVisibility);
      return () => {
        stopped = true;
        clearTimeout(first);
        clearTimeout(retry);
        clearInterval(interval);
        stopIdle();
        doc?.removeEventListener('visibilitychange', onVisibility);
        channel?.close();
        channel = null;
      };
    },
  };
}
