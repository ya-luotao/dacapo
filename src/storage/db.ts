import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { SessionRecord } from '../core/log.ts';
import type { PieceStep } from '../core/pieceRecords.ts';
import type { Attempt } from '../core/session.ts';
import type { StoredPiece } from '../core/storedPiece.ts';
import type { NoteStats } from '../core/weakness.ts';

export const DB_NAME = 'dacapo';
/** Bump when the schema changes and add a `case` to `upgrade`. */
export const DB_VERSION = 3;

export interface DacapoSchema extends DBSchema {
  noteStats: { key: string; value: NoteStats };
  sessions: { key: string; value: SessionRecord; indexes: { 'by-start': number } };
  attempts: {
    key: string;
    value: Attempt;
    indexes: { 'by-session': string; 'by-note': string };
  };
  /** Small values under string keys, e.g. a free-play session still in progress. */
  meta: { key: string; value: unknown };
  /** Imported pieces (version 2). */
  pieces: { key: string; value: StoredPiece; indexes: { 'by-imported': number } };
  /** Wait-mode step records (version 3), read one piece or one session at a time. */
  pieceSteps: {
    key: string;
    value: PieceStep;
    indexes: { 'by-piece': string; 'by-session': string };
  };
}

export type DacapoDB = IDBPDatabase<DacapoSchema>;

/**
 * Runs every migration from `oldVersion` up to `DB_VERSION`, one version at a time, so a database
 * of any older version ends up in the current shape. `case n` migrates version n to n + 1.
 * (A migration that rewrites records will need the upgrade transaction passed in as well.)
 */
export function upgrade(db: DacapoDB, oldVersion: number): void {
  for (let version = oldVersion; version < DB_VERSION; version++) {
    switch (version) {
      case 0: {
        db.createObjectStore('noteStats', { keyPath: 'key' });
        const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
        sessions.createIndex('by-start', 'startedAt');
        const attempts = db.createObjectStore('attempts', { keyPath: 'id' });
        attempts.createIndex('by-session', 'sessionId');
        attempts.createIndex('by-note', 'note');
        db.createObjectStore('meta');
        break;
      }
      case 1: {
        const pieces = db.createObjectStore('pieces', { keyPath: 'id' });
        pieces.createIndex('by-imported', 'importedAt');
        break;
      }
      case 2: {
        const steps = db.createObjectStore('pieceSteps', { keyPath: 'id' });
        steps.createIndex('by-piece', 'pieceId');
        steps.createIndex('by-session', 'sessionId');
        break;
      }
    }
  }
}

export interface OpenHandlers {
  /** Another tab still has an older version open and has not closed it yet. */
  onBlocked?: () => void;
  /** Another tab wants a newer version or is deleting the database; this connection is closed. */
  onVersionChange?: () => void;
  /** The browser closed the connection (storage cleared, disk error). */
  onTerminated?: () => void;
}

export async function openDacapoDB(handlers: OpenHandlers = {}): Promise<DacapoDB> {
  // `blocking` can only fire once the connection is open, so `db` is initialised by then.
  const db: DacapoDB = await openDB<DacapoSchema>(DB_NAME, DB_VERSION, {
    upgrade: (database, oldVersion) => upgrade(database, oldVersion),
    blocked: () => handlers.onBlocked?.(),
    blocking() {
      db.close();
      handlers.onVersionChange?.();
    },
    terminated: () => handlers.onTerminated?.(),
  });
  return db;
}
