// Keys: the tonics, how a scale's notes are spelled from one, and key signatures. Everything here is
// theory that the whole app reads (the theory cards, the ear page, harmony, sight-reading, the
// lessons), so it stands apart from scales.ts, whose exercises bring Hanon's fingering and plates
// with them. See docs/SCALES.md ("Exercises", Keys).

import { midiOf } from './musicxml.ts';
import { LETTERS, type Letter } from './note.ts';
import type { Direction, ExerciseType, ScaleType, Tonic } from './scaleTypes.ts';
import type { SpelledPitch } from './score.ts';

// One spelling per key, as graded exam syllabuses list them, in circle-of-fifths order.
export const MAJOR_TONICS = [
  'C',
  'G',
  'D',
  'A',
  'E',
  'B',
  'F#',
  'Db',
  'Ab',
  'Eb',
  'Bb',
  'F',
] as const;
export const MINOR_TONICS = [
  'A',
  'E',
  'B',
  'F#',
  'C#',
  'G#',
  'Eb',
  'Bb',
  'F',
  'C',
  'G',
  'D',
] as const;
/** Chromatic scales start on every key, named as the keyboard usually is. */
export const CHROMATIC_TONICS = [
  'C',
  'C#',
  'D',
  'Eb',
  'E',
  'F',
  'F#',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
] as const;

// Spelling ------------------------------------------------------------------------------------

/** Semitones from each degree to the next, from the tonic round to the octave. */
const STEPS: Record<
  Exclude<ScaleType, 'chromatic' | 'majorArpeggio' | 'minorArpeggio'>,
  { up: number[]; down: number[] }
> = {
  major: { up: [2, 2, 1, 2, 2, 2, 1], down: [2, 2, 1, 2, 2, 2, 1] },
  naturalMinor: { up: [2, 1, 2, 2, 1, 2, 2], down: [2, 1, 2, 2, 1, 2, 2] },
  harmonicMinor: { up: [2, 1, 2, 2, 1, 3, 1], down: [2, 1, 2, 2, 1, 3, 1] },
  // Raised 6th and 7th going up, natural going down.
  melodicMinor: { up: [2, 1, 2, 2, 2, 2, 1], down: [2, 1, 2, 2, 1, 2, 2] },
};

/** Chromatic notes are spelled with sharps going up and flats going down (the tonic as named). */
const SHARPS: readonly (readonly [Letter, number])[] = [
  ['C', 0],
  ['C', 1],
  ['D', 0],
  ['D', 1],
  ['E', 0],
  ['F', 0],
  ['F', 1],
  ['G', 0],
  ['G', 1],
  ['A', 0],
  ['A', 1],
  ['B', 0],
];
const FLATS: readonly (readonly [Letter, number])[] = [
  ['C', 0],
  ['D', -1],
  ['D', 0],
  ['E', -1],
  ['E', 0],
  ['F', 0],
  ['G', -1],
  ['G', 0],
  ['A', -1],
  ['A', 0],
  ['B', -1],
  ['B', 0],
];

/** The tonic as written, in `octave`: `Bb` in 3 is B♭3. */
export function tonicPitch(tonic: Tonic, octave: number): SpelledPitch {
  const match = /^([A-G])(#|b)?$/.exec(tonic);
  if (!match) throw new Error(`not a tonic: ${tonic}`);
  const alter = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
  return { step: match[1] as Letter, alter, octave };
}

/** The note `position` steps above the tonic, spelled for the given direction. */
export function spell(
  type: ScaleType,
  tonic: SpelledPitch,
  position: number,
  dir: Direction,
): SpelledPitch {
  // An arpeggio's notes are the 1st, 3rd and 5th degrees of its key's scale.
  if (type === 'majorArpeggio' || type === 'minorArpeggio') {
    const scale = type === 'majorArpeggio' ? 'major' : 'naturalMinor';
    return spell(scale, tonic, 7 * Math.floor(position / 3) + 2 * (position % 3), dir);
  }
  const tonicMidi = midiOf(tonic);
  if (type === 'chromatic') {
    const offset = position % 12;
    const octaves = (position - offset) / 12;
    if (offset === 0) return { ...tonic, octave: tonic.octave + octaves };
    const midi = tonicMidi + position;
    const [step, alter] = (dir === 'up' ? SHARPS : FLATS)[midi % 12]!;
    return { step, alter, octave: Math.floor(midi / 12) - 1 };
  }
  // Seven letters from the tonic's; the alteration is whatever the semitone pattern needs.
  const steps = STEPS[type][dir];
  let semitones = 0;
  for (let i = 0; i < position; i++) semitones += steps[i % 7]!;
  const letterIndex = LETTERS.indexOf(tonic.step) + position;
  const step = LETTERS[letterIndex % 7]!;
  const octave = tonic.octave + Math.floor(letterIndex / 7);
  const alter = tonicMidi + semitones - midiOf({ step, alter: 0, octave });
  return { step, alter, octave };
}

/**
 * The note `position` scale steps from `tonic` (below it when negative) in a major or minor
 * scale, spelled as the scale going up is: `scaleDegree('major', D4, -3)` is A3.
 */
export function scaleDegree(
  type: Exclude<ScaleType, 'chromatic'>,
  tonic: SpelledPitch,
  position: number,
): SpelledPitch {
  const octaves = Math.floor(position / 7);
  const pitch = spell(type, tonic, position - 7 * octaves, 'up');
  return { ...pitch, octave: pitch.octave + octaves };
}

// Key signature -------------------------------------------------------------------------------

const LETTER_FIFTHS: Record<Letter, number> = { F: -1, C: 0, G: 1, D: 2, A: 3, E: 4, B: 5 };

/** The key signature: sharps (+) or flats (−), and the mode. The chromatic scale has none. */
export function keySignature(
  type: ExerciseType,
  tonic: Tonic,
): { fifths: number; mode: 'major' | 'minor' } {
  // The chromatic scale has none; Hanon writes his sevenths in C with accidentals.
  if (type === 'chromatic' || type === 'diminishedSevenths' || type === 'dominantSevenths')
    return { fifths: 0, mode: 'major' };
  const t = tonicPitch(tonic, 4);
  const major = LETTER_FIFTHS[t.step] + 7 * t.alter;
  // The minors say so in their names; everything else is in its major key (Hanon's other
  // technique in C, a trill on a pair in the key of its tonic).
  const minor =
    type === 'naturalMinor' ||
    type === 'harmonicMinor' ||
    type === 'melodicMinor' ||
    type.startsWith('minor');
  return minor ? { fifths: major - 3, mode: 'minor' } : { fifths: major, mode: 'major' };
}

/** The circle of fifths from seven flats (C♭ major, A♭ minor) to seven sharps (C♯, A♯ minor). */
export const SIGNATURE_FIFTHS = [-7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7] as const;

const FIFTHS_LETTERS: readonly Letter[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];

/**
 * The tonic of the key with a signature of `fifths` sharps (+) or flats (−): the inverse of
 * `keySignature`, for every key from seven flats to seven sharps (C♭ and C♯ major, A♭ and A♯
 * minor included). A minor key's tonic is its relative major's sixth, three fifths on.
 */
export function signatureTonic(fifths: number, mode: 'major' | 'minor'): Tonic {
  if (!Number.isInteger(fifths) || Math.abs(fifths) > 7) throw new RangeError(`fifths: ${fifths}`);
  // F is −1: one fifth below C.
  const n = fifths + (mode === 'minor' ? 3 : 0) + 1;
  const letter = FIFTHS_LETTERS[((n % 7) + 7) % 7]!;
  const alter = Math.floor(n / 7);
  return `${letter}${alter > 0 ? '#' : alter < 0 ? 'b' : ''}`;
}

/** The alteration the key signature gives each letter. */
export function keyAlters(fifths: number): Record<Letter, number> {
  const out: Record<Letter, number> = { C: 0, D: 0, E: 0, F: 0, G: 0, A: 0, B: 0 };
  const order: Letter[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
  for (let i = 0; i < Math.abs(fifths); i++) {
    const letter = fifths > 0 ? order[i]! : order[6 - i]!;
    out[letter] = Math.sign(fifths);
  }
  return out;
}
