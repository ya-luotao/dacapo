import { isMelody, type Melody } from '../../core/expression.ts';
import { isLeftHandChoice, type LeftHandChoice } from '../../core/leadSheet.ts';
import { isMemoryStage, type MemoryStage } from '../../core/memory.ts';
import type { TrillStart } from '../../core/ornaments.ts';
import { isHandSelection, type PieceFacts, type PracticeMode } from '../../core/pieceRecords.ts';
import { SCORE_TEMPO, TEMPOS } from '../../core/tempoLadder.ts';
import { isTransposition } from '../../core/transpose.ts';
import type { HandSelection } from '../../core/score.ts';
import { readPref, writePref } from '../../lib/localPrefs.ts';
import type { PieceStart } from '../startParams.ts';

// What each piece was last practised with, kept in this browser: the hands, the tempo and the
// mode; which note is its melody, for the balance, and where its trills start (docs/EXPRESSION.md);
// how much of the score memory mode shows (P7); what its left hand plays, the written one or a
// pattern from its chord symbols (H3); the key it is moved to (H4).

const PIECE_PREFS = 'dacapo.pieces.byPiece';
/**
 * Weak bars and the library's steady bars count the runs in every key, not only those in the
 * written key (docs/HARMONY.md, "Transposing (H4)").
 */
export const WEAK_ALL_KEYS_PREF = 'dacapo.pieces.weakAllKeys';
/** The hands chosen last on any piece: the default for a piece not practised yet. */
export const HANDS_PREF = 'dacapo.pieces.hands';
/** A piece's page shows its plan (docs/PIECES.md, "A piece's plan"): off unless turned on. */
export const PLAN_PREF = 'dacapo.pieces.plan';
export const DEFAULT_TEMPO = SCORE_TEMPO;
/** The tempo choices (the ladder's rungs are among them: `core/tempoLadder.ts`). */
export { TEMPOS };

export interface PiecePrefs {
  hands: HandSelection;
  tempo: number;
  mode: PracticeMode;
  melody: Melody;
  /** On the note (the default) or on the note above, as in Baroque music. */
  trillStart: TrillStart;
  memoryStage: MemoryStage;
  /** The left hand chosen; null until the player chooses (the piece's default then). */
  leftHand: LeftHandChoice | null;
  /**
   * The checksum and bar counts of the piece as practised with a left hand from the symbols, for
   * its line in the library (which does not open the file); null with the written left hand.
   */
  practised: PractisedFacts | null;
  /** Semitones the piece is moved by, −6 … 6; 0 in its written key. */
  transpose: number;
}

export type PractisedFacts = Pick<PieceFacts, 'checksum' | 'bars'>;

const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

function isPractisedFacts(v: unknown): v is PractisedFacts {
  if (typeof v !== 'object' || v === null) return false;
  const { checksum, bars } = v as { checksum?: unknown; bars?: Record<string, unknown> | null };
  return (
    typeof checksum === 'string' &&
    /^[0-9a-f]{8}$/.test(checksum) &&
    typeof bars === 'object' &&
    bars !== null &&
    isCount(bars.right) &&
    isCount(bars.left) &&
    isCount(bars.both)
  );
}

type Stored = Record<string, Partial<PiecePrefs>>;

const isTempo = (v: unknown): v is number => TEMPOS.includes(v as (typeof TEMPOS)[number]);

/** The stored map, with anything unreadable left out. */
export function parsePiecePrefs(text: string | null): Stored {
  let json: unknown;
  try {
    json = JSON.parse(text ?? '{}');
  } catch {
    return {};
  }
  if (typeof json !== 'object' || json === null || Array.isArray(json)) return {};
  const out: Stored = {};
  for (const [id, value] of Object.entries(json as Record<string, unknown>)) {
    if (typeof value !== 'object' || value === null) continue;
    const { hands, tempo, mode, melody, trillStart, memoryStage, leftHand, practised, transpose } =
      value as Record<string, unknown>;
    const prefs: Partial<PiecePrefs> = {};
    if (isHandSelection(hands)) prefs.hands = hands;
    if (isTempo(tempo)) prefs.tempo = tempo;
    if (mode === 'wait' || mode === 'rhythm' || mode === 'memory') prefs.mode = mode;
    if (isMemoryStage(memoryStage)) prefs.memoryStage = memoryStage;
    if (isMelody(melody)) prefs.melody = melody;
    if (trillStart === 'principal' || trillStart === 'upper') prefs.trillStart = trillStart;
    if (isLeftHandChoice(leftHand)) prefs.leftHand = leftHand;
    if (isTransposition(transpose)) prefs.transpose = transpose;
    if (isPractisedFacts(practised))
      prefs.practised = { checksum: practised.checksum, bars: { ...practised.bars } };
    if (Object.keys(prefs).length > 0) out[id] = prefs;
  }
  return out;
}

export function readPiecePrefs(pieceId: string): PiecePrefs {
  const own = parsePiecePrefs(readPref(PIECE_PREFS))[pieceId];
  const last = readPref(HANDS_PREF);
  return {
    hands: own?.hands ?? (isHandSelection(last) ? last : 'right'),
    tempo: own?.tempo ?? DEFAULT_TEMPO,
    mode: own?.mode ?? 'wait',
    melody: own?.melody ?? 'right',
    trillStart: own?.trillStart ?? 'principal',
    memoryStage: own?.memoryStage ?? 'alternate',
    leftHand: own?.leftHand ?? null,
    practised: own?.practised ?? null,
    transpose: own?.transpose ?? 0,
  };
}

/**
 * The settings a piece opens with when it is opened with some (a task of an assignment): those,
 * where the piece can take them, over what it remembers, and in its written key (a run in
 * another key is no run of the task); the left hand stays the one chosen for the piece. Nothing
 * is stored until one is changed.
 */
export function withStart(prefs: PiecePrefs, start: PieceStart | null | undefined): PiecePrefs {
  if (!start) return prefs;
  return {
    ...prefs,
    transpose: 0,
    ...(start.hands && { hands: start.hands }),
    ...(start.mode && { mode: start.mode }),
    ...(isTempo(start.tempo) && { tempo: start.tempo }),
  };
}

/** Remembers a change for the piece; a new hand choice also becomes the default for others. */
export function writePiecePrefs(pieceId: string, patch: Partial<PiecePrefs>): void {
  const all = parsePiecePrefs(readPref(PIECE_PREFS));
  all[pieceId] = { ...all[pieceId], ...patch };
  writePref(PIECE_PREFS, JSON.stringify(all));
  if (patch.hands) writePref(HANDS_PREF, patch.hands);
}

export function forgetPiecePrefs(pieceId: string): void {
  const all = parsePiecePrefs(readPref(PIECE_PREFS));
  if (!(pieceId in all)) return;
  delete all[pieceId];
  writePref(PIECE_PREFS, JSON.stringify(all));
}
