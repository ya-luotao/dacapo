// Transposing a piece (docs/HARMONY.md, "Transposing (H4)"): the arithmetic of moving a key
// signature and its notes by a number of semitones, spelled as the new key spells them. Pure;
// transposeXml.ts applies it to a MusicXML document.

import { LETTERS, type Letter } from './note.ts';
import type { Score, SpelledPitch } from './score.ts';
import type { Root } from './theoryItems.ts';

/** A piece is moved at most a tritone either way. */
export const MAX_TRANSPOSE = 6;

/** Semitones a piece may be moved by: −6 … 6. */
export const TRANSPOSITIONS: readonly number[] = Array.from(
  { length: 2 * MAX_TRANSPOSE + 1 },
  (_, i) => i - MAX_TRANSPOSE,
);

/** A transposition a record may carry: a whole number of semitones up to a tritone, never 0. */
export const isTransposition = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v !== 0 && Math.abs(v) <= MAX_TRANSPOSE;

const STEP_PC: Readonly<Record<Letter, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const mod = (n: number, m: number) => ((n % m) + m) % m;

/**
 * The key signature (sharps +, flats −) of a key with `fifths` moved by `semitones`: of the two
 * signatures that name the new key, the one with fewer signs (D♭ major with five flats, not C♯
 * major with seven sharps). Six sharps stand for six flats: in F♯ major and D♯ minor every common
 * chord has a root the app writes symbols on, while G♭ major's IV and E♭ minor's VI are on C♭.
 */
export function transposedFifths(fifths: number, semitones: number): number {
  // A semitone up is seven fifths up (C to C♯), counted round the circle of twelve.
  const moved = mod(fifths + 7 * semitones, 12);
  return moved > 6 ? moved - 12 : moved;
}

/** How far every note of a key moves: letters (staff steps) and semitones. */
export interface Interval {
  steps: number;
  semitones: number;
}

/**
 * The interval that takes a key with `fifths` to its transposition by `semitones`: the letters
 * follow from the two signatures (a fifth up is four letters up), so every note keeps its place
 * in the key (the leading note of the old key is the leading note of the new one).
 */
export function transposeInterval(fifths: number, semitones: number): Interval {
  const delta = transposedFifths(fifths, semitones) - fifths;
  const base = mod(4 * delta, 7);
  // The letters nearest to the semitones: an augmented fourth up is three letters, a diminished
  // fifth four.
  const steps = base + 7 * Math.round(((7 * semitones) / 12 - base) / 7);
  return { steps, semitones };
}

/** A pitch moved by the interval, spelled on the letter it lands on. */
export function transposePitch(pitch: SpelledPitch, { steps, semitones }: Interval): SpelledPitch {
  const position = pitch.octave * 7 + LETTERS.indexOf(pitch.step) + steps;
  const octave = Math.floor(position / 7);
  const step = LETTERS[mod(position, 7)]!;
  const key = pitch.octave * 12 + STEP_PC[pitch.step] + pitch.alter + semitones;
  return { step, alter: key - (octave * 12 + STEP_PC[step]), octave };
}

/** A note name (a chord symbol's root or bass) moved by the interval. */
export function transposeRoot(root: Root, interval: Interval): Root {
  const { step, alter } = transposePitch({ ...root, octave: 4 }, interval);
  return { step, alter };
}

/**
 * The same key on the letter next to it, for a note that would need more than a double sign:
 * B♯♯♯ as C𝄪.
 */
export function respelled(pitch: SpelledPitch): SpelledPitch {
  let out = pitch;
  while (Math.abs(out.alter) > 2) {
    const up = out.alter > 0;
    const position = out.octave * 7 + LETTERS.indexOf(out.step) + (up ? 1 : -1);
    const octave = Math.floor(position / 7);
    const step = LETTERS[mod(position, 7)]!;
    const key = out.octave * 12 + STEP_PC[out.step] + out.alter;
    out = { step, alter: key - (octave * 12 + STEP_PC[step]), octave };
  }
  return out;
}

// --- Naming the key --------------------------------------------------------------------------

export type KeyMode = 'major' | 'minor';

/** The tonic of the major or minor key with this signature. */
export function keyTonic(fifths: number, mode: KeyMode): Root {
  // A minor key has the signature of the major key three fifths flatter.
  const f = mode === 'minor' ? fifths + 3 : fifths;
  const step = LETTERS[mod(4 * f, 7)]!;
  const natural = STEP_PC[step];
  let alter = mod(7 * f - natural, 12);
  if (alter > 6) alter -= 12;
  return { step, alter };
}

const pcOf = (root: Root) => mod(STEP_PC[root.step] + root.alter, 12);

/** A key as the Key control names it: its signature, and its mode when the score tells. */
export interface PieceKey {
  fifths: number;
  /** Null: the score does not say, so the signature's major and minor keys are both named. */
  mode: KeyMode | null;
}

/**
 * The key a piece is written in: its first key signature (none is C major or A minor), and its
 * mode as the file gives it (`<mode>`). A file that gives none is read by its ending, where it
 * keeps one signature throughout: the root of its last chord symbol, or else the lowest note it
 * ends on, is the tonic of the signature's major key or of its minor key. Anything else is left
 * open.
 */
export function pieceKey(score: Pick<Score, 'keys' | 'notes' | 'harmonies'>): PieceKey {
  const keys = score.keys ?? [];
  const fifths = keys[0]?.fifths ?? 0;
  const given = keys[0]?.mode ?? null;
  if (given !== null) return { fifths, mode: given };
  if (keys.some((k) => k.fifths !== fifths)) return { fifths, mode: null };
  const lastSymbol = score.harmonies?.at(-1);
  let ending: number | null = lastSymbol ? pcOf(lastSymbol.root) : null;
  if (ending === null) {
    const practised = score.notes.filter((n) => n.hand !== null);
    const last = Math.max(...practised.map((n) => n.onset));
    const lowest = Math.min(...practised.filter((n) => n.onset === last).map((n) => n.midi));
    ending = Number.isFinite(lowest) ? mod(lowest, 12) : null;
  }
  const mode =
    ending === pcOf(keyTonic(fifths, 'major'))
      ? 'major'
      : ending === pcOf(keyTonic(fifths, 'minor'))
        ? 'minor'
        : null;
  return { fifths, mode };
}

/** The key `key` becomes when the piece is moved by `semitones`. */
export const transposedKey = (key: PieceKey, semitones: number): PieceKey => ({
  fifths: semitones === 0 ? key.fifths : transposedFifths(key.fifths, semitones),
  mode: key.mode,
});
