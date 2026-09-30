import type { Answer } from '../core/earSession.ts';
import { byTime, type SessionRecord } from '../core/log.ts';
import type { PieceStep } from '../core/pieceRecords.ts';
import type { StoredScaleRun } from '../core/scaleRecords.ts';
import type { Attempt } from '../core/session.ts';
import { pieceVersion, type StoredPiece } from '../core/storedPiece.ts';
import { statsFromAttempts } from '../core/weakness.ts';
import { canonicalText } from '../lib/canonical.ts';
import type { DacapoDB } from './db.ts';
import {
  outboxEntry,
  PIECE_DELETION_PREFIX,
  pieceDeletionKey,
  SYNC_COLLECTIONS,
  SYNC_STATE_KEY,
  type OutboxEntry,
  type PieceDeletion,
  type SyncAccount,
  type SyncState,
} from './syncTypes.ts';
import { writeAll } from './writeAll.ts';

// The device's side of sync (docs/SYNC.md) on IndexedDB: the account, the outbox, and applying
// what other devices wrote. Network and protocol are in src/sync/; this is storage only.

/** An outbox entry with its record as stored now: the record, the deletion, or null when gone. */
export interface PendingRecord {
  entry: OutboxEntry;
  record: unknown;
}

/** Records pulled from the service, validated, pieces complete with their MusicXML. */
export interface PulledRecords {
  attempts: readonly Attempt[];
  sessions: readonly SessionRecord[];
  pieces: readonly StoredPiece[];
  deletions: readonly { id: string; deletion: PieceDeletion }[];
  pieceSteps: readonly PieceStep[];
  scaleRuns: readonly StoredScaleRun[];
  answers: readonly Answer[];
}

/** What applying changed here. */
export interface AppliedCounts {
  attempts: number;
  sessions: number;
  pieces: number;
  /** Pieces deleted here because another device deleted them. */
  deleted: number;
  pieceSteps: number;
  scaleRuns: number;
  answers: number;
}

export const nothingApplied = (counts: AppliedCounts) =>
  Object.values(counts).every((n) => n === 0);

export interface SyncStorage {
  state: () => Promise<SyncState | null>;
  /**
   * Signs this device in: stores the account and token with cursor 0 and puts every stored record
   * and deletion in the outbox, so the first round sends everything.
   */
  signIn: (account: SyncAccount, token: string) => Promise<void>;
  /**
   * Forgets the account and the outbox; the records stay. With `token`, only if that is still the
   * stored token (a request that got 401 must not undo a newer sign-in). Returns whether it did.
   */
  signOut: (token?: string) => Promise<boolean>;
  /**
   * Saves the cursor, the time of the last round or the profile, unless the device signed out or in again
   * meanwhile (`token` is no longer the stored one). Returns whether it saved.
   */
  /**
   * Saves `progress` for `token`'s sign-in, and with `when`, only if the stored state passes it.
   * False when nothing was saved.
   */
  saveProgress: (
    token: string,
    progress: Partial<Pick<SyncState, 'cursor' | 'schema' | 'lastSyncAt' | 'profile'>>,
    when?: (state: SyncState) => boolean,
  ) => Promise<boolean>;
  /** Up to `limit` outbox entries with their records. */
  pending: (limit: number) => Promise<PendingRecord[]>;
  /** Removes sent entries from the outbox, unless their record was written again meanwhile. */
  acknowledge: (entries: readonly OutboxEntry[]) => Promise<void>;
  /** The stored pieces among `ids`. */
  storedPieces: (ids: readonly string[]) => Promise<Map<string, StoredPiece>>;
  /**
   * Applies pulled records by the rules of docs/SYNC.md, in one transaction. Where the copy here
   * wins over a different pulled one, it goes in the outbox again, so the service ends up with it.
   */
  apply: (pulled: PulledRecords) => Promise<AppliedCounts>;
}

/**
 * Breaks a tie between two copies of a record: the longer text first (a build that did not know
 * a field kept a copy without it, and the copy with the field must win), then the text itself.
 */
function byText(a: unknown, b: unknown): number {
  const left = canonicalText(a);
  const right = canonicalText(b);
  return left.length - right.length || (left < right ? -1 : left > right ? 1 : 0);
}

/** Whether two copies of a record differ once serialized as the service compares them. */
const differs = (a: unknown, b: unknown) => canonicalText(a) !== canonicalText(b);

const runCount = (session: SessionRecord) => (session.kind === 'scale' ? session.runs.length : 0);
const finished = (session: SessionRecord) =>
  session.kind === 'piece' && session.completed ? 1 : 0;

/**
 * Orders two copies of a session: a session grows while it is played, so the one with more runs
 * (a scale session), or else the one that ended later, is the later copy; of two that ended at the
 * same step, a run played to the end beats one rebuilt from its steps. Their text breaks a
 * remaining tie, so every device picks the same copy. 0 only for the same record.
 */
export function compareSessions(a: SessionRecord, b: SessionRecord): number {
  return (
    runCount(a) - runCount(b) || a.endedAt - b.endedAt || finished(a) - finished(b) || byText(a, b)
  );
}

// Serialized, an undefined field is left out.
const withoutFacts = (piece: StoredPiece) => ({ ...piece, facts: undefined });

/**
 * Orders two copies of a piece: the one renamed or changed later wins, their text breaks a tie.
 * Facts are derived and do not count. 0 only for the same piece.
 */
export function comparePieces(a: StoredPiece, b: StoredPiece): number {
  return pieceVersion(a) - pieceVersion(b) || byText(withoutFacts(a), withoutFacts(b));
}

const deletionRange = () =>
  IDBKeyRange.bound(PIECE_DELETION_PREFIX, `${PIECE_DELETION_PREFIX}\uffff`);

/** The pieces deleted on this device or pulled as deleted, by id. */
export async function deletedPieces(meta: {
  getAll: (query: IDBKeyRange) => Promise<unknown[]>;
  getAllKeys: (query: IDBKeyRange) => Promise<IDBValidKey[]>;
}): Promise<Map<string, PieceDeletion>> {
  const [keys, values] = await Promise.all([
    meta.getAllKeys(deletionRange()),
    meta.getAll(deletionRange()),
  ]);
  return new Map(
    keys.map((key, i) => [
      (key as string).slice(PIECE_DELETION_PREFIX.length),
      values[i] as PieceDeletion,
    ]),
  );
}

export function createSyncStorage(db: DacapoDB): SyncStorage {
  return {
    async state() {
      return ((await db.get('meta', SYNC_STATE_KEY)) as SyncState | undefined) ?? null;
    },

    async signIn(account, token) {
      const tx = db.transaction([...SYNC_COLLECTIONS, 'meta', 'outbox'], 'readwrite');
      const meta = tx.objectStore('meta');
      const outbox = tx.objectStore('outbox');
      const [keys, deletions] = await Promise.all([
        Promise.all(SYNC_COLLECTIONS.map((name) => tx.objectStore(name).getAllKeys())),
        deletedPieces(meta),
      ]);
      const state: SyncState = { account, token, cursor: 0, lastSyncAt: null };
      const entries = [
        ...SYNC_COLLECTIONS.flatMap((name, i) =>
          keys[i]!.map((key) => outboxEntry(name, String(key))),
        ),
        ...[...deletions].map(([id, deletion]) => outboxEntry('pieces', id, deletion)),
      ];
      await Promise.all([
        outbox.clear(),
        ...entries.map((entry) => outbox.put(entry)),
        meta.put(state, SYNC_STATE_KEY),
        tx.done,
      ]);
    },

    async signOut(token) {
      const tx = db.transaction(['meta', 'outbox'], 'readwrite');
      const meta = tx.objectStore('meta');
      const state = (await meta.get(SYNC_STATE_KEY)) as SyncState | undefined;
      if (token !== undefined && state?.token !== token) {
        await tx.done;
        return false;
      }
      await Promise.all([meta.delete(SYNC_STATE_KEY), tx.objectStore('outbox').clear(), tx.done]);
      return true;
    },

    async saveProgress(token, progress, when) {
      const tx = db.transaction('meta', 'readwrite');
      const meta = tx.objectStore('meta');
      const state = (await meta.get(SYNC_STATE_KEY)) as SyncState | undefined;
      if (!state || state.token !== token || (when && !when(state))) {
        await tx.done;
        return false;
      }
      await Promise.all([meta.put({ ...state, ...progress }, SYNC_STATE_KEY), tx.done]);
      return true;
    },

    async pending(limit) {
      const tx = db.transaction([...SYNC_COLLECTIONS, 'meta', 'outbox']);
      const entries = await tx.objectStore('outbox').getAll(undefined, limit);
      // A deletion as it is now: a pulled one may have added its step records to it.
      const records = await Promise.all(
        entries.map(async (entry) =>
          entry.deletion
            ? (((await tx.objectStore('meta').get(pieceDeletionKey(entry.id))) as
                PieceDeletion | undefined) ?? entry.deletion)
            : tx.objectStore(entry.collection).get(entry.id),
        ),
      );
      await tx.done;
      return entries.map((entry, i) => ({ entry, record: records[i] ?? null }));
    },

    async acknowledge(entries) {
      const tx = db.transaction('outbox', 'readwrite');
      const outbox = tx.objectStore('outbox');
      const current = await Promise.all(entries.map((entry) => outbox.get(entry.key)));
      await Promise.all([
        ...entries.flatMap((entry, i) =>
          current[i]?.rev === entry.rev ? [outbox.delete(entry.key)] : [],
        ),
        tx.done,
      ]);
    },

    async storedPieces(ids) {
      const tx = db.transaction('pieces');
      const pieces = await Promise.all(ids.map((id) => tx.objectStore('pieces').get(id)));
      await tx.done;
      return new Map(pieces.flatMap((piece) => (piece ? [[piece.id, piece] as const] : [])));
    },

    async apply(pulled) {
      const tx = db.transaction(
        [
          'sessions',
          'attempts',
          'noteStats',
          'pieces',
          'pieceSteps',
          'scaleRuns',
          'answers',
          'meta',
          'outbox',
        ],
        'readwrite',
      );
      const sessions = tx.objectStore('sessions');
      const attempts = tx.objectStore('attempts');
      const pieces = tx.objectStore('pieces');
      const steps = tx.objectStore('pieceSteps');
      const runs = tx.objectStore('scaleRuns');
      const answers = tx.objectStore('answers');
      const meta = tx.objectStore('meta');

      const [
        knownDeletions,
        syncing,
        storedSessions,
        storedAttempts,
        storedPieces,
        storedSteps,
        storedRuns,
        storedAnswers,
      ] = await Promise.all([
        deletedPieces(meta),
        meta.getKey(SYNC_STATE_KEY).then((key) => key !== undefined),
        Promise.all(pulled.sessions.map((s) => sessions.get(s.id))),
        Promise.all(pulled.attempts.map((a) => attempts.get(a.id))),
        Promise.all(pulled.pieces.map((p) => pieces.get(p.id))),
        Promise.all(pulled.pieceSteps.map((s) => steps.get(s.id))),
        Promise.all(pulled.scaleRuns.map((r) => runs.get(r.id))),
        Promise.all(pulled.answers.map((a) => answers.get(a.id))),
      ]);

      // Records whose copy here wins over a different pulled one: sent again.
      const requeued: OutboxEntry[] = [];

      // Deletions first: a piece, or a step record of it, in the same page is then dropped.
      const deletions = new Map(knownDeletions);
      const newlyDeleted: { id: string; deletion: PieceDeletion; stepsToo: boolean }[] = [];
      for (const { id, deletion } of pulled.deletions) {
        const known = deletions.get(id);
        const merged: PieceDeletion = {
          deleted: true,
          at: known?.at ?? deletion.at,
          withSteps: Boolean(known?.withSteps || deletion.withSteps),
        };
        if (merged.withSteps !== deletion.withSteps) {
          requeued.push(outboxEntry('pieces', id, merged));
        }
        if (known && known.withSteps === merged.withSteps) continue;
        deletions.set(id, merged);
        newlyDeleted.push({ id, deletion: merged, stepsToo: merged.withSteps });
      }
      const stepKeysToDelete = (
        await Promise.all(
          newlyDeleted.map((d) =>
            d.stepsToo ? steps.index('by-piece').getAllKeys(d.id) : Promise.resolve([]),
          ),
        )
      ).flat();
      const piecesToDelete = (
        await Promise.all(newlyDeleted.map((d) => pieces.getKey(d.id)))
      ).filter((key) => key !== undefined);

      const seen = new Set<string>();
      const first = <T extends { id: string }>(record: T, prefix: string) =>
        !seen.has(prefix + record.id) && Boolean(seen.add(prefix + record.id));

      const addedSessions = pulled.sessions.filter((session, i) => {
        if (!first(session, 's:')) return false;
        const known = storedSessions[i];
        const order = known ? compareSessions(session, known) : 1;
        if (order < 0) requeued.push(outboxEntry('sessions', session.id));
        return order > 0;
      });
      // A record that never changes is added when it is not stored, and replaces a stored copy
      // that differs: that copy was kept by a build that did not know some of its fields.
      const takes = (stored: unknown, record: unknown) =>
        stored === undefined || differs(stored, record);
      const addedAttempts = pulled.attempts.filter(
        (attempt, i) => takes(storedAttempts[i], attempt) && first(attempt, 'a:'),
      );
      // A newer copy keeps the facts filled in here: the MusicXML of a piece never changes.
      const addedPieces = pulled.pieces.flatMap((piece, i) => {
        if (!first(piece, 'p:')) return [];
        const deletion = deletions.get(piece.id);
        if (deletion) {
          // The service has the piece where this device has its deletion: the deletion goes again.
          requeued.push(outboxEntry('pieces', piece.id, deletion));
          return [];
        }
        const known = storedPieces[i];
        const order = known ? comparePieces(piece, known) : 1;
        if (order < 0) requeued.push(outboxEntry('pieces', piece.id));
        if (order <= 0) return [];
        return [known?.facts && !piece.facts ? { ...piece, facts: known.facts } : piece];
      });
      const addedSteps = pulled.pieceSteps.filter(
        (step, i) =>
          takes(storedSteps[i], step) &&
          !deletions.get(step.pieceId)?.withSteps &&
          first(step, 'st:'),
      );
      const addedRuns = pulled.scaleRuns.filter(
        (run, i) => takes(storedRuns[i], run) && first(run, 'r:'),
      );
      const addedAnswers = pulled.answers.filter(
        (answer, i) => takes(storedAnswers[i], answer) && first(answer, 'an:'),
      );

      // Note stats depend on the order of answers: rebuilt from all attempts, only when some
      // were added (or replaced).
      const replaced = new Set(addedAttempts.map((a) => a.id));
      const stats =
        addedAttempts.length > 0
          ? statsFromAttempts(
              [
                ...(await attempts.getAll()).filter((a) => !replaced.has(a.id)),
                ...addedAttempts,
              ].sort(byTime),
            )
          : null;
      const noteStats = tx.objectStore('noteStats');

      const writes: (() => Promise<unknown>)[] = [
        ...newlyDeleted.map((d) => () => meta.put(d.deletion, pieceDeletionKey(d.id))),
        ...piecesToDelete.map((key) => () => pieces.delete(key)),
        ...stepKeysToDelete.map((key) => () => steps.delete(key)),
        ...addedSessions.map((session) => () => sessions.put(session)),
        ...addedAttempts.map((attempt) => () => attempts.put(attempt)),
        ...addedPieces.map((piece) => () => pieces.put(piece)),
        ...addedSteps.map((step) => () => steps.put(step)),
        ...addedRuns.map((run) => () => runs.put(run)),
        ...addedAnswers.map((answer) => () => answers.put(answer)),
        ...(stats
          ? [() => noteStats.clear(), ...Object.values(stats).map((s) => () => noteStats.put(s))]
          : []),
        ...(syncing ? requeued.map((entry) => () => tx.objectStore('outbox').put(entry)) : []),
      ];
      await writeAll(tx, writes);

      return {
        attempts: addedAttempts.length,
        sessions: addedSessions.length,
        pieces: addedPieces.length,
        deleted: piecesToDelete.length,
        pieceSteps: addedSteps.length,
        scaleRuns: addedRuns.length,
        answers: addedAnswers.length,
      };
    },
  };
}
