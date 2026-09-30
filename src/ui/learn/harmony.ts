import { judgeChordKeys } from '../../core/earItems.ts';
import { LETTERS, pitchToMidi, type Accidental, type Pitch } from '../../core/note.ts';
import { majorScale, pitch } from './notes.ts';

// Chords as the lesson on harmony spells, voices, names and judges them: triads and seventh chords
// stacked in thirds from a root, their inversions, the chords of a major key, and a chord played
// on the keyboard (any voicing, the pitch classes counted as the Ear page counts them).

export type Quality =
  'major' | 'minor' | 'diminished' | 'augmented' | 'dom7' | 'maj7' | 'min7' | 'hdim7';

export const TRIADS: readonly Quality[] = ['major', 'minor', 'diminished', 'augmented'];
export const SEVENTHS: readonly Quality[] = ['dom7', 'maj7', 'min7', 'hdim7'];

/** Semitones above the root, in thirds. */
export const QUALITY_TONES: Readonly<Record<Quality, readonly number[]>> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  diminished: [0, 3, 6],
  augmented: [0, 4, 8],
  dom7: [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  hdim7: [0, 3, 6, 10],
};

/** What a chord symbol adds to its root, as lead sheets in this lesson write it. */
const SUFFIX: Readonly<Record<Quality, string>> = {
  major: '',
  minor: 'm',
  diminished: '°',
  augmented: '+',
  dom7: '7',
  maj7: 'maj7',
  min7: 'm7',
  hdim7: 'm7♭5',
};

/**
 * Roots whose every triad and seventh chord is spelled without a double sharp or flat (B
 * augmented needs F𝄪, E♭ diminished B𝄫), so any quality can be built on any of them.
 */
export const ROOTS = ['C', 'D', 'E', 'F', 'G', 'A', 'Bb'] as const;

/** A note's name without its octave, as printed: B♭, F♯. */
export function noteName(p: Pick<Pitch, 'letter' | 'accidental'>): string {
  return `${p.letter}${p.accidental === 1 ? '♯' : p.accidental === -1 ? '♭' : ''}`;
}

/** The chord symbol: C, Am, B°, G7, Cmaj7, Dm7♭5; with a bass other than the root, F/A. */
export function chordSymbol(
  root: Pick<Pitch, 'letter' | 'accidental'>,
  quality: Quality,
  bass?: Pick<Pitch, 'letter' | 'accidental'>,
): string {
  const name = `${noteName(root)}${SUFFIX[quality]}`;
  return bass && noteName(bass) !== noteName(root) ? `${name}/${noteName(bass)}` : name;
}

/**
 * The chord's notes in root position, a third apart: the root, then every other letter above
 * it, each with the sharp or flat its distance from the root needs.
 */
export function spellChord(root: Pitch, quality: Quality): Pitch[] {
  const base = LETTERS.indexOf(root.letter);
  const low = pitchToMidi(root);
  return QUALITY_TONES[quality].map((semitones, i) => {
    const index = base + 2 * i;
    const natural: Pitch = {
      letter: LETTERS[index % 7]!,
      accidental: 0,
      octave: root.octave + Math.floor(index / 7),
    };
    const accidental = low + semitones - pitchToMidi(natural);
    if (accidental < -1 || accidental > 1) {
      throw new Error(`${noteName(root)} ${quality} needs a double accidental`);
    }
    return { ...natural, accidental: accidental as Accidental };
  });
}

export type Inversion = 0 | 1 | 2;

/**
 * A root-position chord inverted: the lowest notes moved up an octave, so the 3rd (first
 * inversion) or the 5th (second) is in the bass; then the whole chord lowered an octave if its
 * bass is above B4, so it sits on the treble staff.
 */
export function invert(chord: readonly Pitch[], inversion: Inversion): Pitch[] {
  const up = (p: Pitch, by: number): Pitch => ({ ...p, octave: p.octave + by });
  const out = [...chord.slice(inversion), ...chord.slice(0, inversion).map((p) => up(p, 1))];
  return pitchToMidi(out[0]!) > 71 ? out.map((p) => up(p, -1)) : out;
}

/** The chord built on a root named like the Scales page's tonics ('Bb'), from the octave given. */
export function chordOn(root: string, quality: Quality, octave = 4): Pitch[] {
  return spellChord(pitch(`${root}${octave}`), quality);
}

/** Staff positions of a pitch, counted in letters from C0: for comparing heights on the staff. */
function step(p: Pitch): number {
  return p.octave * 7 + LETTERS.indexOf(p.letter);
}

/**
 * How far to move each written accidental of a chord to the left, so that none touches another:
 * from the top down, each goes in the first column where no accidental within a sixth sits.
 */
export function accidentalShifts(
  chord: readonly Pitch[],
  written: (p: Pitch, i: number) => boolean = (p) => p.accidental !== 0,
  column = 10,
): number[] {
  const order = chord.map((_, i) => i).sort((a, b) => step(chord[b]!) - step(chord[a]!));
  const columns: number[][] = [];
  const shifts = chord.map(() => 0);
  for (const i of order) {
    if (!written(chord[i]!, i)) continue;
    const at = step(chord[i]!);
    let c = columns.findIndex((steps) => steps.every((s) => Math.abs(s - at) >= 6));
    if (c < 0) c = columns.push([]) - 1;
    columns[c]!.push(at);
    shifts[i] = c * column;
  }
  return shifts;
}

/** The chords of a major key, one on each note of its scale, and their roman numerals. */
export interface KeyChord {
  numeral: string;
  quality: Quality;
  notes: Pitch[];
}

const NUMERALS = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];

/** The seven triads of a major key, from its tonic in octave 4, in thirds within the scale. */
export function keyChords(tonic: string): KeyChord[] {
  const scale = majorScale(tonic)
    .slice(0, 7)
    .map((n) => n.pitch);
  const at = (i: number): Pitch => {
    const p = scale[i % 7]!;
    return { ...p, octave: p.octave + Math.floor(i / 7) };
  };
  return NUMERALS.map((numeral, i) => {
    const notes = [at(i), at(i + 2), at(i + 4)];
    const [a, b, c] = notes.map(pitchToMidi) as [number, number, number];
    const third = b - a;
    const fifth = c - a;
    const quality: Quality =
      fifth === 6 ? 'diminished' : fifth === 8 ? 'augmented' : third === 4 ? 'major' : 'minor';
    return { numeral, quality, notes };
  });
}

/**
 * Keys played for a chord, together or one at a time (every key pressed since the question began
 * counts, so a click at a time will do): wrong at the first key outside its pitch classes, right
 * once all of them are there. With `bassMatters` (a slash chord) the lowest key must be the bass,
 * which is the first of `chord`.
 */
export function judgeChord(
  chord: readonly number[],
  pressed: readonly number[],
  bassMatters = false,
): 'right' | 'wrong' | 'pending' {
  return judgeChordKeys({ item: 'lesson', notes: chord }, pressed, bassMatters);
}

// Chords on the grand staff, for the figures and the cadences heard in the exercise.

export interface RowChord {
  treble: readonly string[];
  bass: readonly string[];
  /** Over the treble staff: the chord symbol. */
  above?: string;
  /** Under the bass staff: the roman numeral. */
  below?: string;
}

// C major: the tonic, subdominant, dominant (and its seventh) and the submediant.
export const I: RowChord = { bass: ['C3'], treble: ['E4', 'G4', 'C5'], above: 'C', below: 'I' };
const IV: RowChord = { bass: ['F2'], treble: ['F4', 'A4', 'C5'], above: 'F', below: 'IV' };
export const V: RowChord = { bass: ['G2'], treble: ['D4', 'G4', 'B4'], above: 'G', below: 'V' };
export const V7: RowChord = { bass: ['G2'], treble: ['D4', 'F4', 'B4'], above: 'G7', below: 'V7' };
const VI: RowChord = { bass: ['A2'], treble: ['E4', 'A4', 'C5'], above: 'Am', below: 'vi' };
/** After V7: the leading note up to C, the 7th down to E. */
export const I_AFTER_V7: RowChord = {
  bass: ['C3'],
  treble: ['C4', 'E4', 'C5'],
  above: 'C',
  below: 'I',
};
/** The same hands as I, the bass up a step instead: A minor, its C doubled. */
const VI_AFTER_V7: RowChord = {
  bass: ['A2'],
  treble: ['C4', 'E4', 'C5'],
  above: 'Am',
  below: 'vi',
};

export type Cadence = 'authentic' | 'plagal' | 'half' | 'deceptive';
export const CADENCES: readonly Cadence[] = ['authentic', 'plagal', 'half', 'deceptive'];

export const CADENCE_PHRASES: Readonly<Record<Cadence, readonly RowChord[]>> = {
  authentic: [I, IV, V7, I_AFTER_V7],
  plagal: [I, VI, IV, I],
  half: [I, IV, I, V],
  deceptive: [I, IV, V7, VI_AFTER_V7],
};

/** A cadence's phrase as steps of keys (a chord to a step), moved by `shift` half steps. */
export function cadenceSound(cadence: Cadence, shift = 0): number[][] {
  return CADENCE_PHRASES[cadence].map((c) =>
    [...c.bass, ...c.treble].map((p) => pitchToMidi(pitch(p)) + shift),
  );
}

/** Keys for a chord from its notes' names, from `low` up: ['A3', 'C4', 'F4'] and so on. */
export function chordKeys(notes: readonly string[]): number[] {
  return notes.map((n) => pitchToMidi(pitch(n)));
}
