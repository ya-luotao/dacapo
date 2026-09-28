import type { PieceFacts } from './pieceRecords.ts';
import type { ScoreWarning, StaffHands } from './score.ts';

/** A piece the user imported, as stored in the browser and in the export file. */
export interface StoredPiece {
  id: string;
  title: string;
  composer: string;
  /** Name of the imported file. */
  fileName: string;
  /** The MusicXML text (an `.mxl` is stored unzipped). */
  xml: string;
  /** Epoch ms. */
  importedAt: number;
  /**
   * Epoch ms of the last rename or change of hands; absent until then, when `importedAt` counts.
   * Of two copies of a piece from two devices, the later one wins (docs/SYNC.md).
   */
  updatedAt?: number;
  /** The user's choice of hands per staff; null: as detected. */
  hands: StaffHands | null;
  /** What the parser reported when the piece was imported. */
  warnings: ScoreWarning[];
  /**
   * Checksum and bar counts for the library, from the import on (absent in older records and
   * files; filled in when the piece is next listed or opened).
   */
  facts?: PieceFacts;
}

/** A piece's version, for "the later copy wins" (docs/SYNC.md). */
export const pieceVersion = (piece: Pick<StoredPiece, 'updatedAt' | 'importedAt'>): number =>
  piece.updatedAt ?? piece.importedAt;

/**
 * The version for a change made now: later than the piece's own, even on a device whose clock
 * is behind the one that made the last change.
 */
export const nextPieceVersion = (piece: StoredPiece, now: number): number =>
  Math.max(now, pieceVersion(piece) + 1);

export const SCORE_WARNINGS: readonly ScoreWarning[] = [
  'finer-than-ticks',
  'grace-notes',
  'ornaments',
  'unknown-step',
  'microtones',
  'tie-mismatch',
  'jumps',
  'hands-guessed',
];

export function isScoreWarning(value: unknown): value is ScoreWarning {
  return SCORE_WARNINGS.includes(value as ScoreWarning);
}

/** Newest first. */
export function byImportedDescending(a: StoredPiece, b: StoredPiece): number {
  return b.importedAt - a.importedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
