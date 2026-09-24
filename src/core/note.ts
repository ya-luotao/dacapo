// Pitches use scientific pitch notation: C4 = middle C = MIDI 60.
// The octave number belongs to the letter, so B#3 = MIDI 60 and Cb4 = MIDI 59.

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
export type Letter = (typeof LETTERS)[number];

/** Semitones added to the natural letter: -1 flat, 0 natural, +1 sharp. */
export type Accidental = -1 | 0 | 1;

export interface Pitch {
  letter: Letter;
  accidental: Accidental;
  octave: number;
}

export type Clef = 'treble' | 'bass';
export type Spelling = 'sharp' | 'flat';

export const MIDI_MIN = 0;
export const MIDI_MAX = 127;
/** Lowest key of an 88-key piano (A0). */
export const PIANO_LOWEST = 21;
/** Highest key of an 88-key piano (C8). */
export const PIANO_HIGHEST = 108;
export const PIANO_KEY_COUNT = PIANO_HIGHEST - PIANO_LOWEST + 1;
export const MIDDLE_C = 60;

const LETTER_SEMITONES: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);
const SHARP_NAMES: readonly (readonly [Letter, Accidental])[] = [
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
const FLAT_NAMES: readonly (readonly [Letter, Accidental])[] = [
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

export function isMidiNote(value: number): boolean {
  return Number.isInteger(value) && value >= MIDI_MIN && value <= MIDI_MAX;
}

export function isPianoKey(midi: number): boolean {
  return Number.isInteger(midi) && midi >= PIANO_LOWEST && midi <= PIANO_HIGHEST;
}

/** 0 = C … 11 = B. Works for any integer, including negatives. */
export function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

export function isBlack(midi: number): boolean {
  return BLACK_PITCH_CLASSES.has(pitchClass(midi));
}

export function pitchToMidi({ letter, accidental, octave }: Pitch): number {
  return (octave + 1) * 12 + LETTER_SEMITONES[letter] + accidental;
}

/** The default spelling of a key: naturals for white keys, sharps or flats for black keys. */
export function midiToPitch(midi: number, spelling: Spelling = 'sharp'): Pitch {
  if (!Number.isInteger(midi)) throw new RangeError(`Not a MIDI note number: ${midi}`);
  const names = spelling === 'sharp' ? SHARP_NAMES : FLAT_NAMES;
  const [letter, accidental] = names[pitchClass(midi)]!;
  // The octave follows the letter: removing the accidental lands inside the letter's octave.
  const octave = Math.floor((midi - accidental) / 12) - 1;
  return { letter, accidental, octave };
}

/** Every spelling of `midi` that uses at most one sharp or flat, ordered flat → natural → sharp. */
export function spellingsOf(midi: number): Pitch[] {
  const result: Pitch[] = [];
  for (const accidental of [-1, 0, 1] as const) {
    const natural = midi - accidental;
    if (isBlack(natural)) continue;
    const pitch = midiToPitch(natural);
    result.push({ ...pitch, accidental });
  }
  return result;
}

export function samePitch(a: Pitch, b: Pitch): boolean {
  return a.letter === b.letter && a.accidental === b.accidental && a.octave === b.octave;
}

const ACCIDENTAL_ASCII: Record<Accidental, string> = { [-1]: 'b', 0: '', 1: '#' };
const ACCIDENTAL_SYMBOL: Record<Accidental, string> = { [-1]: '♭', 0: '', 1: '♯' };

/** Stable ASCII form for keys and storage, e.g. `C#4`, `Db4`. */
export function pitchId(pitch: Pitch): string {
  return `${pitch.letter}${ACCIDENTAL_ASCII[pitch.accidental]}${pitch.octave}`;
}

/** Display form with musical symbols, e.g. `C♯4`, `D♭4`. */
export function formatPitch(pitch: Pitch): string {
  return `${letterName(pitch)}${pitch.octave}`;
}

/** The name without the octave, e.g. `C♯`. */
export function letterName(pitch: Pick<Pitch, 'letter' | 'accidental'>): string {
  return `${pitch.letter}${ACCIDENTAL_SYMBOL[pitch.accidental]}`;
}

export function midiName(midi: number, spelling: Spelling = 'sharp'): string {
  return formatPitch(midiToPitch(midi, spelling));
}

/** Parses `C4`, `C#4`, `Db4`, `C♯4`, `D♭4`, `Bb-1`. Returns null for anything else. */
export function parsePitch(text: string): Pitch | null {
  const match = /^([A-G])(#|b|♯|♭)?(-?\d+)$/.exec(text.trim());
  if (!match) return null;
  const [, letter, sign, octave] = match;
  const accidental: Accidental = sign === '#' || sign === '♯' ? 1 : sign ? -1 : 0;
  return { letter: letter as Letter, accidental, octave: Number(octave) };
}

// Diatonic step = letters counted from C0, ignoring accidentals.
function diatonicStep(pitch: Pitch): number {
  return pitch.octave * 7 + LETTERS.indexOf(pitch.letter);
}

const BOTTOM_LINE: Record<Clef, Pitch> = {
  treble: { letter: 'E', accidental: 0, octave: 4 },
  bass: { letter: 'G', accidental: 0, octave: 2 },
};

/** Number of staff positions on a five-line staff: lines at 0, 2, 4, 6, 8. */
export const STAFF_TOP_LINE = 8;

/**
 * Vertical position of a written pitch on a five-line staff, in steps (line → space → line).
 * 0 is the bottom line, 8 the top line; below 0 and above 8 need ledger lines.
 * Accidentals do not move a note, so B#3 sits where B3 does, not where C4 does.
 */
export function staffPosition(pitch: Pitch, clef: Clef): number {
  return diatonicStep(pitch) - diatonicStep(BOTTOM_LINE[clef]);
}

export function isOnLine(position: number): boolean {
  return position % 2 === 0;
}

/** Ledger lines needed to write a note at `position` (e.g. middle C in treble clef needs 1). */
export function ledgerLineCount(position: number): number {
  if (position < 0) return Math.floor(-position / 2);
  if (position > STAFF_TOP_LINE) return Math.floor((position - STAFF_TOP_LINE) / 2);
  return 0;
}
