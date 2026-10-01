import { canonical } from '../lib/canonical.ts';
import type { StoredPiece } from '../core/storedPiece.ts';
import type { PendingRecord } from '../storage/syncStorage.ts';
import type { SyncCollection } from '../storage/syncTypes.ts';

/**
 * What this build understands of what the service carries (docs/SYNC.md, "A build that learns a
 * collection pulls everything again"): 1, the first collections; 2, `answers` and `ear` sessions;
 * 3, echo answers and sessions (a family and levels older builds do not validate); 4, scale runs
 * and sessions with the click, arpeggios and contrary motion (older builds skip or strip them); 5,
 * `takes` (older builds skip the collection); 6, the theory cards on Read: answers of the families
 * `readInterval`, `keySignature` and `readChord` and sessions of kind `theory` (older builds skip
 * them); 7, rhythm on Read: answers of the family `rhythm` and sessions of kind `rhythm` (older
 * builds skip them); 8, the chord symbols of the Harmony page: answers of the family `chordSymbol`
 * and sessions of kind `harmony` (older builds skip them); 9, the technique exercises' runs and
 * sessions (five-finger patterns, Hanon's Part I, block and broken chords: exercise keys older
 * builds do not validate); 10, Hanon's sevenths, repeated notes, trills, thirds and octaves, and
 * the trill on a pair (S7, the same); 11, cadences by ear: answers and ear sessions of the family
 * `cadence` (older builds skip them); 13, sight-reading on Read: sessions of kind `sight` (older
 * builds skip them); 14, rhythm dictation on Ear: answers of the family `rhythmEar` and `ear`
 * sessions of that family (older builds skip them); 15, improvising on Harmony: sessions of kind
 * `improv` and their takes (older builds skip the sessions; the takes they keep); 16, a piece taken
 * out of the review schedule (`review: false`, which older builds strip); 17, memory mode's steps,
 * sessions and takes (`mode: 'memory'`, which older builds refuse); 18, a piece run's left hand
 * from the chord symbols (`leftHand` on the session, which older builds strip). Bump it whenever a
 * build learns a collection, a session kind, or records that older builds skipped or stripped.
 */
export const SYNC_SCHEMA = 18;

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
export function pieceBody(piece: Omit<StoredPiece, 'xml' | 'facts'>, xmlHash: string): PieceBody {
  return {
    id: piece.id,
    title: piece.title,
    composer: piece.composer,
    fileName: piece.fileName,
    importedAt: piece.importedAt,
    ...(piece.updatedAt !== undefined && { updatedAt: piece.updatedAt }),
    hands: piece.hands,
    warnings: piece.warnings,
    ...(piece.review === false && { review: false as const }),
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
