import type { ProfileSettings } from '../core/profile.ts';

// What the device keeps for sync (docs/SYNC.md): the account it is signed in to, the records still
// to send, and the pieces deleted here or on another device.

/** The collections sent to the sync service, named as the stores that hold them. */
export type SyncCollection =
  'attempts' | 'sessions' | 'pieces' | 'pieceSteps' | 'scaleRuns' | 'answers';

export const SYNC_COLLECTIONS: readonly SyncCollection[] = [
  'attempts',
  'sessions',
  'pieces',
  'pieceSteps',
  'scaleRuns',
  'answers',
];

/** A deleted piece, sent under the piece's id. A deletion is final. */
export interface PieceDeletion {
  deleted: true;
  /** Epoch ms. */
  at: number;
  /** Its step records were deleted with it. */
  withSteps: boolean;
}

/** A record written while signed in and not yet sent. */
export interface OutboxEntry {
  /** `collection/id`. */
  key: string;
  collection: SyncCollection;
  id: string;
  /** Changes with every write, so a record written again while being sent is sent again. */
  rev: string;
  /** Only for a piece's deletion: the record itself is gone. */
  deletion?: PieceDeletion;
}

export interface SyncAccount {
  id: string;
  email: string;
}

/** Stored while signed in; its presence is what makes writes go to the outbox. */
export interface SyncState {
  account: SyncAccount;
  token: string;
  /** The service's `seq` up to which everything is applied here. */
  cursor: number;
  /**
   * The `SYNC_SCHEMA` of the build that reached `cursor`; absent means 1. A build that understands
   * more pulls everything again (docs/SYNC.md, "A build that learns a collection").
   */
  schema?: number;
  /** Epoch ms of the last round that finished; null before the first. */
  lastSyncAt: number | null;
  /** The public profile (docs/PROFILE.md) as last heard from the service; absent until then. */
  profile?: ProfileState;
}

export interface ProfileState {
  username: string | null;
  settings: ProfileSettings;
  /** SHA-256 of the last document this device published under these settings; null when none. */
  sentHash: string | null;
}

export const SYNC_STATE_KEY = 'sync:state';
export const PIECE_DELETION_PREFIX = 'deleted:piece:';
export const pieceDeletionKey = (id: string) => PIECE_DELETION_PREFIX + id;
export const outboxKey = (collection: SyncCollection, id: string) => `${collection}/${id}`;

export function outboxEntry(
  collection: SyncCollection,
  id: string,
  deletion?: PieceDeletion,
): OutboxEntry {
  return {
    key: outboxKey(collection, id),
    collection,
    id,
    rev: crypto.randomUUID(),
    ...(deletion && { deletion }),
  };
}
