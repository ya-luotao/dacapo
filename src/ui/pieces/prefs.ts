import { isHandSelection, type PracticeMode } from '../../core/pieceRecords.ts';
import type { HandSelection } from '../../core/score.ts';
import { readPref, writePref } from '../../lib/localPrefs.ts';

// What each piece was last practised with, kept in this browser: the hands, the tempo and the
// mode.

const PIECE_PREFS = 'dacapo.pieces.byPiece';
/** The hands chosen last on any piece: the default for a piece not practised yet. */
export const HANDS_PREF = 'dacapo.pieces.hands';
export const DEFAULT_TEMPO = 100;
/** Tempo choices, in percent of the score's tempo marks. */
export const TEMPOS = [
  40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200,
] as const;

export interface PiecePrefs {
  hands: HandSelection;
  tempo: number;
  mode: PracticeMode;
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
    const { hands, tempo, mode } = value as Record<string, unknown>;
    const prefs: Partial<PiecePrefs> = {};
    if (isHandSelection(hands)) prefs.hands = hands;
    if (isTempo(tempo)) prefs.tempo = tempo;
    if (mode === 'wait' || mode === 'rhythm') prefs.mode = mode;
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
