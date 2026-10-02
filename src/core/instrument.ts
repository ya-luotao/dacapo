// The instrument's keys (docs/PERSONAL.md, "The instrument's keys"): the keys the player's own
// keyboard has, and what follows from them. Nothing is taken away: a piece's notes beyond the
// keyboard are played for the player, a scale that runs beyond it is marked and not proposed, a
// card for a note beyond it is not drawn, and an answer asked for beyond it is right in any
// octave. Pure; the preference itself is read in `ui/instrument.ts`.

import { PIANO_HIGHEST, PIANO_LOWEST } from './note.ts';
import { SCALE_TYPES } from './scaleTypes.ts';

/** The lowest and highest key of a keyboard, as MIDI numbers, both included. */
export interface KeyRange {
  low: number;
  high: number;
}

/** A piano's 88 keys, A0–C8: the keyboard assumed until another is chosen. */
export const FULL_KEYS: KeyRange = { low: PIANO_LOWEST, high: PIANO_HIGHEST };

/** The keyboards to choose from, by their number of keys, the largest first. */
export const KEYBOARD_SIZES = [88, 76, 73, 61, 49] as const;
export type KeyboardSize = (typeof KEYBOARD_SIZES)[number];

/** Each size's keys as they are usually built: A0–C8, E1–G7, E1–E7, C2–C7, C2–C6. */
export const KEYBOARDS: Readonly<Record<KeyboardSize, KeyRange>> = {
  88: FULL_KEYS,
  76: { low: 28, high: 103 },
  73: { low: 28, high: 100 },
  61: { low: 36, high: 96 },
  49: { low: 36, high: 84 },
};

/** A keyboard has at least an octave: its highest key this many semitones over its lowest. */
export const MIN_SPAN = 12;

export const sameKeys = (a: KeyRange, b: KeyRange): boolean => a.low === b.low && a.high === b.high;

/** Every key of the piano: nothing is beyond it. */
export const isFullKeys = (keys: KeyRange): boolean =>
  keys.low <= PIANO_LOWEST && keys.high >= PIANO_HIGHEST;

export const hasKey = (keys: KeyRange, midi: number): boolean =>
  midi >= keys.low && midi <= keys.high;

/**
 * A keyboard read field by field: two whole numbers within the piano, at least an octave apart.
 * Null for anything else.
 */
export function parseKeyRange(value: unknown): KeyRange | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const { low, high } = value as Record<string, unknown>;
  if (!Number.isInteger(low) || !Number.isInteger(high)) return null;
  const range = { low: low as number, high: high as number };
  if (range.low < PIANO_LOWEST || range.high > PIANO_HIGHEST) return null;
  return range.high - range.low >= MIN_SPAN ? range : null;
}

/** The keyboard a preference names; anything that cannot be read is 88 keys. */
export function readKeyRange(value: unknown): KeyRange {
  return parseKeyRange(value) ?? FULL_KEYS;
}

/** The size whose keys these are, or `other` for a keyboard of the player's own. */
export function keyboardChoice(keys: KeyRange): KeyboardSize | 'other' {
  return KEYBOARD_SIZES.find((size) => sameKeys(KEYBOARDS[size], keys)) ?? 'other';
}

/**
 * The keyboard two keys pressed give ("press the lowest key, then the highest"): the lower of the
 * two to the higher, in whichever order they came, kept within the piano. Null when they are
 * less than an octave apart: that is no keyboard, and the second key is asked for again.
 */
export function capturedKeys(first: number, second: number): KeyRange | null {
  const clamp = (midi: number) => Math.max(PIANO_LOWEST, Math.min(PIANO_HIGHEST, midi));
  const low = clamp(Math.min(first, second));
  const high = clamp(Math.max(first, second));
  return high - low >= MIN_SPAN ? { low, high } : null;
}

// --- Pieces ---------------------------------------------------------------------------------------

/** What of some music lies beyond a keyboard: how many notes, and how far it goes. */
export interface Beyond {
  /** Notes under the lowest key, and the lowest of them; null when none. */
  below: { notes: number; lowest: number } | null;
  /** Notes over the highest key, and the highest of them; null when none. */
  above: { notes: number; highest: number } | null;
}

/** The notes of `midis` beyond the keyboard (each one counted); null when all are on it. */
export function beyondKeys(midis: Iterable<number>, keys: KeyRange): Beyond | null {
  const below = { notes: 0, lowest: Infinity };
  const above = { notes: 0, highest: -Infinity };
  for (const midi of midis) {
    if (midi < keys.low) {
      below.notes++;
      below.lowest = Math.min(below.lowest, midi);
    } else if (midi > keys.high) {
      above.notes++;
      above.highest = Math.max(above.highest, midi);
    }
  }
  if (below.notes + above.notes === 0) return null;
  return { below: below.notes > 0 ? below : null, above: above.notes > 0 ? above : null };
}

/**
 * How far music from `lowest` to `highest` goes beyond the keyboard, where only its two ends are
 * known (a library card has a piece's facts, not its notes): the key it goes down to, the key it
 * goes up to, each null when that end is on the keyboard.
 */
export function reachBeyond(
  [lowest, highest]: readonly [number, number],
  keys: KeyRange,
): { below: number | null; above: number | null } | null {
  const below = lowest < keys.low ? lowest : null;
  const above = highest > keys.high ? highest : null;
  return below === null && above === null ? null : { below, above };
}

// --- Scales ---------------------------------------------------------------------------------------

/** Whether a run from `lowest` to `highest` (an exercise's keys) stays on the keyboard. */
export function fitsKeys([lowest, highest]: readonly [number, number], keys: KeyRange): boolean {
  return lowest >= keys.low && highest <= keys.high;
}

const TONIC_CLASS: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** The lowest key at or above `floor` with the pitch class `pitch`. */
const from = (floor: number, pitch: number) => floor + ((((pitch - floor) % 12) + 12) % 12);

/**
 * The lowest and highest key of a scale or an arpeggio, from its exercise key
 * (`major:G:2:both`), without the exercises' rules, for what proposes a scale without loading
 * them (today's plan, docs/TODAY.md). As `startingTonics` in scales.ts has it: the right hand
 * starts on the lowest tonic at or above middle C (above C3 for three and four octaves), the left
 * an octave lower, and each goes up its octaves; in contrary motion both start on the tonic from
 * A3 up and go their octaves either way. A test holds this to the notes themselves. Null for a
 * technique exercise, which has its own range: it is not judged here.
 */
export function scaleKeys(exercise: string): [number, number] | null {
  const match = /^([a-zA-Z]+):([A-G])(#|b)?:([1-4]):(right|left|both|contrary)$/.exec(exercise);
  if (!match || !(SCALE_TYPES as readonly string[]).includes(match[1]!)) return null;
  const [, , letter, sign, length, hands] = match;
  const pitch = TONIC_CLASS[letter!]! + (sign === '#' ? 1 : sign === 'b' ? -1 : 0);
  const octaves = Number(length);
  const span = 12 * octaves;
  if (hands === 'contrary') {
    const unison = from(57, pitch);
    return [unison - span, unison + span];
  }
  const right = from(octaves <= 2 ? 60 : 48, pitch);
  const lowest = hands === 'right' ? right : right - 12;
  return [lowest, (hands === 'left' ? right - 12 : right) + span];
}

/**
 * Whether a scale can be proposed on this keyboard: it stays on it, or its keys are not known
 * here (a technique exercise: the Scales page, which has the exercises' rules, judges those).
 */
export function scaleFits(exercise: string, keys: KeyRange): boolean {
  const span = scaleKeys(exercise);
  return span === null || fitsKeys(span, keys);
}

// --- Read -----------------------------------------------------------------------------------------

/** A level left with fewer notes than this on the keyboard says so. */
export const FEW_NOTES = 5;

/** The cards of a level that can be drawn: those whose key the keyboard has. */
export function notesOnKeys<T extends { midi: number }>(notes: readonly T[], keys: KeyRange): T[] {
  return notes.filter((note) => hasKey(keys, note.midi));
}

/** A level with the cards the keyboard has; the level itself when it has them all. */
export function levelOnKeys<L extends { notes: readonly { midi: number }[] }>(
  level: L,
  keys: KeyRange,
): L {
  const notes = notesOnKeys(level.notes, keys);
  return notes.length === level.notes.length ? level : { ...level, notes };
}

/** Whether cards can be drawn from these notes: there is one at least. */
export function canDraw(notes: readonly { midi: number }[]): boolean {
  return notes.length > 0;
}

// --- Ear, Harmony, sight-reading -------------------------------------------------------------------

/**
 * Whether a key played answers a key asked for: the key itself, or, when the key asked for is
 * beyond the keyboard, the same note in any octave.
 */
export function answersKey(played: number, asked: number, keys: KeyRange): boolean {
  if (played === asked) return true;
  return !hasKey(keys, asked) && (((played - asked) % 12) + 12) % 12 === 0;
}

/**
 * The key a key played stands for, of the keys asked for at this moment: itself when it is one
 * of them; else one of them beyond the keyboard that it is in another octave; else itself, which
 * answers none. So a card that asks for a key the keyboard lacks is judged, and recorded, as if
 * that key had been played: its record is the same on every keyboard.
 */
export function keyAnswered(played: number, asked: readonly number[], keys: KeyRange): number {
  if (asked.includes(played)) return played;
  return asked.find((key) => answersKey(played, key, keys)) ?? played;
}
