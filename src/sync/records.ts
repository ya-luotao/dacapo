import type { Answer } from '../core/answers.ts';
import type { SessionRecord } from '../core/log.ts';
import { canonical } from '../lib/canonical.ts';
import type { PieceStep } from '../core/pieceRecords.ts';
import type { StoredScaleRun } from '../core/scaleRecords.ts';
import type { Attempt } from '../core/session.ts';
import type { StoredPiece } from '../core/storedPiece.ts';
import type { TakeChunk } from '../core/takes.ts';
import type { PendingRecord } from '../storage/syncStorage.ts';
import type { PieceDeletion, SyncCollection } from '../storage/syncTypes.ts';
import {
  validateAnswer,
  validateAttempt,
  validatePiece,
  validatePieceStep,
  validateScaleRun,
  validateSession,
  validateTake,
  type Validation,
} from '../storage/validate.ts';

/**
 * What this build understands of what the service carries (docs/SYNC.md, "A build that learns a
 * collection pulls everything again"): 1, the first collections; 2, `answers` and `ear` sessions;
 * 3, echo answers and sessions (a family and levels older builds do not validate); 4, scale runs
 * and sessions with the click, arpeggios and contrary motion (older builds skip or strip them); 5,
 * `takes` (older builds skip the collection); 6, the theory cards on Read: answers of the families
 * `readInterval`, `keySignature` and `readChord` and sessions of kind `theory` (older builds skip
 * them); 7, rhythm on Read: answers of the family `rhythm` and sessions of kind `rhythm` (older
 * builds skip them); 8, the chord symbols of the Harmony page: answers of the family `chordSymbol`
 * and sessions of kind `harmony` (older builds skip them). Bump it whenever a build learns a
 * collection, a session kind, or records that older builds skipped.
 */
export const SYNC_SCHEMA = 8;

// Records as the sync service carries them (docs/SYNC.md, "What syncs"): the stored record as it
// is, except a piece, which goes without its MusicXML (sent as a file named by its hash) and
// without its facts (derived, filled in on each device).

export interface Change {
  collection: SyncCollection;
  id: string;
  body: unknown;
}

/** A piece as sent: the MusicXML is the file `xmlHash`. */
export type PieceBody = Omit<StoredPiece, 'xml' | 'facts'> & { xmlHash: string };

/** A body may be at most this large, serialized. */
export const MAX_BODY_BYTES = 64 * 1024;

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export const byteLength = (text: string) => new TextEncoder().encode(text).byteLength;

/** A piece's body: the stored piece without its MusicXML and facts. */
function pieceBody(piece: Omit<StoredPiece, 'xml' | 'facts'>, xmlHash: string): PieceBody {
  return {
    id: piece.id,
    title: piece.title,
    composer: piece.composer,
    fileName: piece.fileName,
    importedAt: piece.importedAt,
    ...(piece.updatedAt !== undefined && { updatedAt: piece.updatedAt }),
    hands: piece.hands,
    warnings: piece.warnings,
    xmlHash,
  };
}

/** What to send for a piece: its body, and its MusicXML as a file. */
export async function pieceChange(
  piece: StoredPiece,
): Promise<{ change: Change; file: { hash: string; xml: string } }> {
  const hash = await sha256Hex(piece.xml);
  const body = pieceBody(piece, hash);
  return { change: { collection: 'pieces', id: piece.id, body }, file: { hash, xml: piece.xml } };
}

/** What to send for an outbox entry, its body in canonical order; null when its record is gone. */
export async function outgoing(
  pending: PendingRecord,
): Promise<{ change: Change; file?: { hash: string; xml: string } } | null> {
  const { entry, record } = pending;
  if (record === null) return null;
  if (entry.collection === 'pieces' && !entry.deletion) {
    const { change, file } = await pieceChange(record as StoredPiece);
    return { change: { ...change, body: canonical(change.body) }, file };
  }
  return { change: { collection: entry.collection, id: entry.id, body: canonical(record) } };
}

export type Incoming =
  | { collection: 'attempts'; record: Attempt }
  | { collection: 'sessions'; record: SessionRecord }
  | { collection: 'pieceSteps'; record: PieceStep }
  | { collection: 'scaleRuns'; record: StoredScaleRun }
  | { collection: 'answers'; record: Answer }
  | { collection: 'takes'; record: TakeChunk }
  | { collection: 'pieces'; id: string; deletion: PieceDeletion }
  | { collection: 'pieces'; id: string; piece: PieceBody };

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function isDeletion(v: unknown): v is PieceDeletion {
  return (
    isObject(v) &&
    v.deleted === true &&
    typeof v.at === 'number' &&
    Number.isFinite(v.at) &&
    typeof v.withSteps === 'boolean'
  );
}

/** Validates a piece body; the MusicXML is checked once it is downloaded. */
function validatePieceBody(value: unknown): Validation<PieceBody> {
  if (!isObject(value)) return { ok: false, field: 'record' };
  if (typeof value.xmlHash !== 'string' || !/^[0-9a-f]{64}$/.test(value.xmlHash)) {
    return { ok: false, field: 'xmlHash' };
  }
  const checked = validatePiece({ ...value, xml: '<placeholder/>' });
  if (!checked.ok) return checked;
  return { ok: true, value: pieceBody(checked.value, value.xmlHash) };
}

/** The complete piece, once its MusicXML is here; null when it does not validate. */
export function pieceWithXml(body: PieceBody, xml: string): StoredPiece | null {
  // The validator keeps only the fields of a stored piece: `xmlHash` is dropped.
  const checked = validatePiece({ ...body, xml });
  return checked.ok ? checked.value : null;
}

/**
 * A change pulled from the service, validated like a record in an import file; null when it is
 * not one this version knows or does not validate (it is skipped and counted).
 */
export function incoming(value: unknown): Incoming | null {
  if (!isObject(value) || typeof value.id !== 'string') return null;
  const { id, body } = value;
  const matches = (record: { id: string }) => record.id === id;
  switch (value.collection) {
    case 'attempts': {
      const checked = validateAttempt(body);
      return checked.ok && matches(checked.value)
        ? { collection: 'attempts', record: checked.value }
        : null;
    }
    case 'sessions': {
      const checked = validateSession(body);
      return checked.ok && matches(checked.value)
        ? { collection: 'sessions', record: checked.value }
        : null;
    }
    case 'pieceSteps': {
      const checked = validatePieceStep(body);
      return checked.ok && matches(checked.value)
        ? { collection: 'pieceSteps', record: checked.value }
        : null;
    }
    case 'scaleRuns': {
      const checked = validateScaleRun(body);
      return checked.ok && matches(checked.value)
        ? { collection: 'scaleRuns', record: checked.value }
        : null;
    }
    case 'answers': {
      const checked = validateAnswer(body);
      return checked.ok && matches(checked.value)
        ? { collection: 'answers', record: checked.value }
        : null;
    }
    case 'takes': {
      const checked = validateTake(body);
      return checked.ok && matches(checked.value)
        ? { collection: 'takes', record: checked.value }
        : null;
    }
    case 'pieces': {
      if (isDeletion(body)) {
        const deletion: PieceDeletion = { deleted: true, at: body.at, withSteps: body.withSteps };
        return { collection: 'pieces', id, deletion };
      }
      const checked = validatePieceBody(body);
      return checked.ok && matches(checked.value)
        ? { collection: 'pieces', id, piece: checked.value }
        : null;
    }
    default:
      return null;
  }
}
