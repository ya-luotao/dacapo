import { CHORD_TONES, DIRECTIONS, type ChordQuality, type Direction } from './earItems.ts';
import { midiOf } from './musicxml.ts';
import {
  LETTERS,
  ledgerLineCount,
  pitchClass,
  staffPosition,
  type Clef,
  type Letter,
} from './note.ts';
import type { Rng } from './random.ts';
import { keyAlters, SIGNATURE_FIFTHS, signatureTonic, tonicPitch } from './scales.ts';
import type { SpelledPitch } from './score.ts';

// Theory on Read (docs/EAR.md, "Theory on the staff" and "Clarifications (decided during E3)"):
// intervals, key signatures and chords written on the staff, as cards to name or play. What the
// items and levels are, how a card is drawn and spelled, and how an answer is judged. Pure, so
// every rule is unit-tested.

export type TheoryFamily = 'readInterval' | 'keySignature' | 'readChord';
export const THEORY_FAMILIES: readonly TheoryFamily[] = [
  'readInterval',
  'keySignature',
  'readChord',
];
export const isTheoryFamily = (v: unknown): v is TheoryFamily =>
  THEORY_FAMILIES.includes(v as TheoryFamily);

// --- Spelled pitches -------------------------------------------------------------------------

const ALTER_ASCII: Readonly<Record<number, string>> = {
  [-2]: 'bb',
  [-1]: 'b',
  0: '',
  1: '#',
  2: '##',
};

/** A written pitch as stored: `C4`, `D#4`, `Ebb5`, `F##3`. */
export function spelledId(pitch: SpelledPitch): string {
  return `${pitch.step}${ALTER_ASCII[pitch.alter] ?? ''}${pitch.octave}`;
}

/** Reverses `spelledId` (double sharps and flats included); null for anything else. */
export function parseSpelled(text: unknown): SpelledPitch | null {
  if (typeof text !== 'string') return null;
  const match = /^([A-G])(bb|b|##|#)?([0-9])$/.exec(text);
  if (!match) return null;
  const sign = match[2] ?? '';
  const alter = sign === '##' ? 2 : sign === '#' ? 1 : sign === 'bb' ? -2 : sign === 'b' ? -1 : 0;
  return { step: match[1] as Letter, alter, octave: Number(match[3]) };
}

/** Letters counted from C0, accidentals aside: the note's place on any staff. */
export const diatonic = (pitch: SpelledPitch) => pitch.octave * 7 + LETTERS.indexOf(pitch.step);

/** Where a written pitch sits on a staff (0 the bottom line, 8 the top line). */
export const positionOn = (pitch: SpelledPitch, clef: Clef) =>
  staffPosition({ letter: pitch.step, accidental: 0, octave: pitch.octave }, clef);

/** The pitch `steps` letters above `from`, as sounding `midi`: its sign is whatever that takes. */
function spellAt(from: SpelledPitch, steps: number, midi: number): SpelledPitch {
  const index = LETTERS.indexOf(from.step) + steps;
  const natural: SpelledPitch = {
    step: LETTERS[((index % 7) + 7) % 7]!,
    alter: 0,
    octave: from.octave + Math.floor(index / 7),
  };
  return { ...natural, alter: midi - midiOf(natural) };
}

// --- Intervals -------------------------------------------------------------------------------

/** Diminished, minor, perfect, major, augmented: the order of the answer buttons. */
export const QUALITIES = ['d', 'm', 'P', 'M', 'A'] as const;
export type Quality = (typeof QUALITIES)[number];
/** 2nd to octave: the unison is left out, as on the Ear page. */
export const INTERVAL_NUMBERS = [2, 3, 4, 5, 6, 7, 8] as const;
export type IntervalNumber = (typeof INTERVAL_NUMBERS)[number];

/** Semitones of the major or perfect interval of each number. */
const REFERENCE: Readonly<Record<IntervalNumber, number>> = {
  2: 2,
  3: 4,
  4: 5,
  5: 7,
  6: 9,
  7: 11,
  8: 12,
};
const isPerfectKind = (n: IntervalNumber) => n === 4 || n === 5 || n === 8;

/**
 * The qualities an interval of `number` can have here: diminished to augmented, perfect or minor
 * and major by its kind; the octave only perfect (its augmented and diminished forms are left out).
 */
export function qualitiesOf(number: IntervalNumber): readonly Quality[] {
  if (number === 8) return ['P'];
  return isPerfectKind(number) ? ['d', 'P', 'A'] : ['d', 'm', 'M', 'A'];
}

/** Semitones a quality adds to the major or perfect interval. */
function qualityOffset(quality: Quality, number: IntervalNumber): number | null {
  if (!qualitiesOf(number).includes(quality)) return null;
  if (isPerfectKind(number)) return quality === 'd' ? -1 : quality === 'A' ? 1 : 0;
  return { d: -2, m: -1, M: 0, A: 1, P: null }[quality];
}

/** An interval's name: its quality, then its number (`A2`, `d5`, `P8`). */
export interface IntervalName {
  quality: Quality;
  number: IntervalNumber;
}

/** Every interval name a card can have, by number, then quality. */
export const INTERVAL_NAMES: readonly string[] = INTERVAL_NUMBERS.flatMap((n) =>
  qualitiesOf(n).map((q) => `${q}${n}`),
);

/** `A2` → augmented 2nd; null for anything that is not one of `INTERVAL_NAMES`. */
export function parseIntervalName(name: unknown): IntervalName | null {
  if (typeof name !== 'string' || !INTERVAL_NAMES.includes(name)) return null;
  return { quality: name[0] as Quality, number: Number(name.slice(1)) as IntervalNumber };
}

export function intervalSemitones({ quality, number }: IntervalName): number {
  return REFERENCE[number] + qualityOffset(quality, number)!;
}

/**
 * The interval between two written pitches, by letters then quality: from the lower (by letter)
 * to the higher. Null for a unison, anything past the octave, or a quality not named here.
 */
export function intervalBetween(a: SpelledPitch, b: SpelledPitch): string | null {
  const [low, high] = diatonic(a) <= diatonic(b) ? [a, b] : [b, a];
  const number = diatonic(high) - diatonic(low) + 1;
  if (number < 2 || number > 8) return null;
  const n = number as IntervalNumber;
  const offset = midiOf(high) - midiOf(low) - REFERENCE[n];
  const quality = qualitiesOf(n).find((q) => qualityOffset(q, n) === offset);
  return quality ? `${quality}${n}` : null;
}

/** The pitch an interval above `lower`, spelled by letters then quality (any sign it takes). */
export function intervalAbove(lower: SpelledPitch, name: IntervalName): SpelledPitch {
  return spellAt(lower, name.number - 1, midiOf(lower) + intervalSemitones(name));
}

// --- Chords ----------------------------------------------------------------------------------

/** The chords written on Read: the triads and sevenths of the Ear page but the augmented triad. */
export const READ_CHORD_QUALITIES = [
  'maj',
  'min',
  'dim',
  'dom7',
  'maj7',
  'min7',
  'hdim7',
] as const satisfies readonly ChordQuality[];
export type ReadChordQuality = (typeof READ_CHORD_QUALITIES)[number];
export const READ_INVERSIONS = ['root', '1st', '2nd'] as const;
export type ReadInversion = (typeof READ_INVERSIONS)[number];

/** A chord's root as written, without its octave: `F#`, `Bb`, `C`. */
export interface Root {
  step: Letter;
  alter: number;
}

export const rootId = (root: Root) => `${root.step}${ALTER_ASCII[root.alter] ?? ''}`;

export function parseRoot(text: unknown): Root | null {
  const pitch = parseSpelled(typeof text === 'string' ? `${text}4` : null);
  return pitch && Math.abs(pitch.alter) <= 1 ? { step: pitch.step, alter: pitch.alter } : null;
}

/**
 * A close-position chord on `root` in `octave`, low to high, spelled in thirds (0, 2, 4, 6 letters
 * above the root); an inversion moves its lower tones up an octave.
 */
export function spellChord(
  root: Root,
  octave: number,
  quality: ReadChordQuality,
  inversion: ReadInversion,
): SpelledPitch[] {
  const base: SpelledPitch = { step: root.step, alter: root.alter, octave };
  const tones = CHORD_TONES[quality].map((semitones, i) =>
    spellAt(base, i * 2, midiOf(base) + semitones),
  );
  const shift = READ_INVERSIONS.indexOf(inversion);
  return [
    ...tones.slice(shift),
    ...tones.slice(0, shift).map((p) => ({ ...p, octave: p.octave + 1 })),
  ];
}

// --- Items -----------------------------------------------------------------------------------

export type TheoryItem =
  | { family: 'readInterval'; name: IntervalName; direction: Direction }
  | { family: 'keySignature'; fifths: number; mode: 'major' | 'minor' }
  | { family: 'readChord'; quality: ReadChordQuality; inversion: ReadInversion };

export const readIntervalItem = (name: string, direction: Direction) => `ri:${name}:${direction}`;
export const readChordItem = (quality: ReadChordQuality, inversion: ReadInversion) =>
  `rc:${quality}:${inversion}`;

/** A key signature as written in keys and prompts: `0`, `3s` (three sharps), `4f` (four flats). */
export const signatureId = (fifths: number) =>
  fifths === 0 ? '0' : `${Math.abs(fifths)}${fifths > 0 ? 's' : 'f'}`;

export function parseSignature(text: unknown): number | null {
  if (text === '0') return 0;
  const match = typeof text === 'string' ? /^([1-7])([sf])$/.exec(text) : null;
  if (!match) return null;
  return Number(match[1]) * (match[2] === 's' ? 1 : -1);
}

export const keySignatureItem = (fifths: number, mode: 'major' | 'minor') =>
  `ks:${signatureId(fifths)}:${mode}`;

/** `ri:A2:up`, `ks:3f:minor`, `rc:min:1st`; null for anything else. */
export function parseTheoryItem(key: unknown): TheoryItem | null {
  if (typeof key !== 'string') return null;
  const [kind, a, b, ...rest] = key.split(':');
  if (rest.length > 0 || b === undefined) return null;
  if (kind === 'ri') {
    const name = parseIntervalName(a);
    if (!name || !(DIRECTIONS as readonly string[]).includes(b)) return null;
    return { family: 'readInterval', name, direction: b as Direction };
  }
  if (kind === 'ks') {
    const fifths = parseSignature(a);
    if (fifths === null || (b !== 'major' && b !== 'minor')) return null;
    return { family: 'keySignature', fifths, mode: b };
  }
  if (
    kind === 'rc' &&
    (READ_CHORD_QUALITIES as readonly string[]).includes(a!) &&
    (READ_INVERSIONS as readonly string[]).includes(b)
  ) {
    return { family: 'readChord', quality: a as ReadChordQuality, inversion: b as ReadInversion };
  }
  return null;
}

// --- Levels ----------------------------------------------------------------------------------

export const READ_INTERVAL_LEVEL_IDS = ['RI1', 'RI2', 'RI3', 'RI4'] as const;
export const KEY_SIGNATURE_LEVEL_IDS = ['KS1', 'KS2', 'KS3', 'KS4', 'KS5'] as const;
export const READ_CHORD_LEVEL_IDS = ['RC1', 'RC2', 'RC3', 'RC4', 'RC5'] as const;
export type ReadIntervalLevelId = (typeof READ_INTERVAL_LEVEL_IDS)[number];
export type KeySignatureLevelId = (typeof KEY_SIGNATURE_LEVEL_IDS)[number];
export type ReadChordLevelId = (typeof READ_CHORD_LEVEL_IDS)[number];
export type TheoryLevelId = ReadIntervalLevelId | KeySignatureLevelId | ReadChordLevelId;

export interface ReadIntervalLevel {
  id: ReadIntervalLevelId;
  family: 'readInterval';
  /** The written intervals, by number, then quality. */
  names: readonly string[];
  /** RI1 asks for the number only. */
  numberOnly: boolean;
  /** The most sharps or flats on one note: 0 (natural notes), 1, or 2 (double sharps and flats). */
  maxAlter: number;
  /** The most ledger lines either note may need. */
  maxLedger: number;
  clefs: readonly Clef[];
}

export interface KeySignatureLevel {
  id: KeySignatureLevelId;
  family: 'keySignature';
  mode: 'major' | 'minor';
  /** The signatures, as sharps (+) or flats (−), round the circle of fifths. */
  fifths: readonly number[];
}

export interface ReadChordLevel {
  id: ReadChordLevelId;
  family: 'readChord';
  /** In the order of the levels, which is the order of the answer buttons. */
  chords: readonly { quality: ReadChordQuality; inversion: ReadInversion }[];
  /** RC1: the triads of C major only. */
  diatonic: boolean;
  /** Triads are named with their position (the inversion levels). */
  withPosition: boolean;
  clefs: readonly Clef[];
}

export type TheoryLevel = ReadIntervalLevel | KeySignatureLevel | ReadChordLevel;

/** Every note of a chord card within one ledger line of its staff. */
export const CHORD_MAX_LEDGER = 1;

/** The intervals two natural notes make (so B–F is a diminished 5th, F–B an augmented 4th). */
const NATURAL_NAMES: readonly string[] = (() => {
  const found = new Set<string>();
  for (const step of LETTERS) {
    for (let steps = 1; steps <= 7; steps++) {
      const low: SpelledPitch = { step, alter: 0, octave: 4 };
      const index = LETTERS.indexOf(step) + steps;
      const high: SpelledPitch = {
        step: LETTERS[index % 7]!,
        alter: 0,
        octave: 4 + Math.floor(index / 7),
      };
      const name = intervalBetween(low, high);
      if (name) found.add(name);
    }
  }
  return INTERVAL_NAMES.filter((name) => found.has(name));
})();

const within = (limit: number) => SIGNATURE_FIFTHS.filter((f) => Math.abs(f) <= limit);

const triads = (...inversions: ReadInversion[]) =>
  inversions.flatMap((inversion) =>
    (['maj', 'min'] as const).map((quality) => ({ quality, inversion })),
  );
const SEVENTHS = (['dom7', 'maj7', 'min7', 'hdim7'] as const).map((quality) => ({
  quality,
  inversion: 'root' as const,
}));

export const READ_INTERVAL_LEVELS: readonly ReadIntervalLevel[] = [
  {
    id: 'RI1',
    family: 'readInterval',
    names: NATURAL_NAMES,
    numberOnly: true,
    maxAlter: 0,
    maxLedger: 1,
    clefs: ['treble'],
  },
  {
    id: 'RI2',
    family: 'readInterval',
    names: NATURAL_NAMES,
    numberOnly: false,
    maxAlter: 0,
    maxLedger: 1,
    clefs: ['treble', 'bass'],
  },
  {
    id: 'RI3',
    family: 'readInterval',
    names: INTERVAL_NAMES,
    numberOnly: false,
    maxAlter: 1,
    maxLedger: 1,
    clefs: ['treble', 'bass'],
  },
  {
    id: 'RI4',
    family: 'readInterval',
    names: INTERVAL_NAMES,
    numberOnly: false,
    maxAlter: 2,
    maxLedger: 2,
    clefs: ['treble', 'bass'],
  },
];

export const KEY_SIGNATURE_LEVELS: readonly KeySignatureLevel[] = [
  { id: 'KS1', family: 'keySignature', mode: 'major', fifths: within(2) },
  { id: 'KS2', family: 'keySignature', mode: 'major', fifths: within(4) },
  { id: 'KS3', family: 'keySignature', mode: 'major', fifths: within(7) },
  { id: 'KS4', family: 'keySignature', mode: 'minor', fifths: within(4) },
  { id: 'KS5', family: 'keySignature', mode: 'minor', fifths: within(7) },
];

export const READ_CHORD_LEVELS: readonly ReadChordLevel[] = [
  {
    id: 'RC1',
    family: 'readChord',
    chords: [
      { quality: 'maj', inversion: 'root' },
      { quality: 'min', inversion: 'root' },
      { quality: 'dim', inversion: 'root' },
    ],
    diatonic: true,
    withPosition: false,
    clefs: ['treble'],
  },
  {
    id: 'RC2',
    family: 'readChord',
    chords: triads('root'),
    diatonic: false,
    withPosition: false,
    clefs: ['treble', 'bass'],
  },
  {
    id: 'RC3',
    family: 'readChord',
    chords: triads('root', '1st', '2nd'),
    diatonic: false,
    withPosition: true,
    clefs: ['treble', 'bass'],
  },
  {
    id: 'RC4',
    family: 'readChord',
    chords: SEVENTHS,
    diatonic: false,
    withPosition: false,
    clefs: ['treble', 'bass'],
  },
  {
    id: 'RC5',
    family: 'readChord',
    chords: [...triads('root', '1st', '2nd'), ...SEVENTHS],
    diatonic: false,
    withPosition: true,
    clefs: ['treble', 'bass'],
  },
];

export const THEORY_LEVELS: readonly TheoryLevel[] = [
  ...READ_INTERVAL_LEVELS,
  ...KEY_SIGNATURE_LEVELS,
  ...READ_CHORD_LEVELS,
];

export const isTheoryLevelId = (v: unknown): v is TheoryLevelId =>
  THEORY_LEVELS.some((level) => level.id === v);

export function getTheoryLevel(id: TheoryLevelId): TheoryLevel {
  return THEORY_LEVELS.find((level) => level.id === id)!;
}

export function theoryLevelsOf(family: TheoryFamily): readonly TheoryLevel[] {
  if (family === 'readInterval') return READ_INTERVAL_LEVELS;
  return family === 'keySignature' ? KEY_SIGNATURE_LEVELS : READ_CHORD_LEVELS;
}

/** The level after `id` in its family, or null for the last. */
export function nextTheoryLevel(id: TheoryLevelId): TheoryLevelId | null {
  const levels = theoryLevelsOf(getTheoryLevel(id).family);
  return levels[levels.findIndex((level) => level.id === id) + 1]?.id ?? null;
}

/** The items of a level: every interval in each direction, every signature, every chord. */
export function theoryLevelItems(level: TheoryLevel): string[] {
  switch (level.family) {
    case 'readInterval':
      return level.names.flatMap((name) => DIRECTIONS.map((d) => readIntervalItem(name, d)));
    case 'keySignature':
      return level.fifths.map((f) => keySignatureItem(f, level.mode));
    case 'readChord':
      return level.chords.map((c) => readChordItem(c.quality, c.inversion));
  }
}

export function theoryItemInLevel(item: string, level: TheoryLevel): boolean {
  return theoryLevelItems(level).includes(item);
}

// --- Cards -----------------------------------------------------------------------------------

/** A card as drawn: what is written on the staff. Plain data. */
export type TheoryPrompt =
  | {
      family: 'readInterval';
      item: string;
      clef: Clef;
      /** Left to right: a melodic interval in the order played, a harmonic one low to high. */
      notes: readonly SpelledPitch[];
    }
  | { family: 'keySignature'; item: string; fifths: number; mode: 'major' | 'minor' }
  | {
      family: 'readChord';
      item: string;
      clef: Clef;
      /** Low to high. */
      notes: readonly SpelledPitch[];
      root: Root;
    };

const fitsStaff = (pitches: readonly SpelledPitch[], clef: Clef, maxLedger: number) =>
  pitches.every((p) => ledgerLineCount(positionOn(p, clef)) <= maxLedger);

/** Natural pitches from `maxLedger` ledger lines below the staff to as many above. */
function staffNaturals(clef: Clef, maxLedger: number): SpelledPitch[] {
  const result: SpelledPitch[] = [];
  for (let octave = 0; octave <= 8; octave++) {
    for (const step of LETTERS) {
      const pitch: SpelledPitch = { step, alter: 0, octave };
      if (fitsStaff([pitch], clef, maxLedger)) result.push(pitch);
    }
  }
  return result;
}

/**
 * Every pair of written notes an interval item can be on `clef` at `level`, lower note first:
 * each note with at most `maxAlter` sharps or flats and `maxLedger` ledger lines.
 */
export function intervalCandidates(
  level: ReadIntervalLevel,
  name: IntervalName,
  clef: Clef,
): [SpelledPitch, SpelledPitch][] {
  const result: [SpelledPitch, SpelledPitch][] = [];
  for (const natural of staffNaturals(clef, level.maxLedger)) {
    for (let alter = -level.maxAlter; alter <= level.maxAlter; alter++) {
      const lower = { ...natural, alter };
      const upper = intervalAbove(lower, name);
      if (Math.abs(upper.alter) <= level.maxAlter && fitsStaff([upper], clef, level.maxLedger)) {
        result.push([lower, upper]);
      }
    }
  }
  return result;
}

/** The degrees of C major and the quality of the triad on each. */
const C_MAJOR_TRIADS: readonly [Letter, ReadChordQuality][] = [
  ['C', 'maj'],
  ['D', 'min'],
  ['E', 'min'],
  ['F', 'maj'],
  ['G', 'maj'],
  ['A', 'min'],
  ['B', 'dim'],
];

/**
 * The roots a chord of `quality` is written on at `level`: RC1 the triads of C major; the other
 * levels every root with at most one sharp or flat whose chord needs no double sharp or flat.
 */
export function chordRoots(level: ReadChordLevel, quality: ReadChordQuality): Root[] {
  if (level.diatonic) {
    return C_MAJOR_TRIADS.filter(([, q]) => q === quality).map(([step]) => ({ step, alter: 0 }));
  }
  return LETTERS.flatMap((step) =>
    [-1, 0, 1]
      .map((alter) => ({ step, alter }))
      .filter((root) => spellChord(root, 4, quality, 'root').every((p) => Math.abs(p.alter) <= 1)),
  );
}

/** Every voicing of a chord item on `clef` at `level`, low to high, within one ledger line. */
export function chordCandidates(
  level: ReadChordLevel,
  quality: ReadChordQuality,
  inversion: ReadInversion,
  clef: Clef,
): { root: Root; notes: SpelledPitch[] }[] {
  return chordRoots(level, quality).flatMap((root) =>
    [1, 2, 3, 4, 5, 6]
      .map((octave) => spellChord(root, octave, quality, inversion))
      .filter((notes) => fitsStaff(notes, clef, CHORD_MAX_LEDGER))
      .map((notes) => ({ root, notes })),
  );
}

const pick = <T>(items: readonly T[], rng: Rng): T =>
  items[Math.min(items.length - 1, Math.floor(rng() * items.length))]!;

/**
 * Draws a card for `item` of `level`: the staff first (each of the level's equally often), then
 * one of the item's candidates on it. Throws if the item is not the level's.
 */
export function makeTheoryPrompt(level: TheoryLevel, item: string, rng: Rng): TheoryPrompt {
  const parsed = parseTheoryItem(item);
  if (!parsed || !theoryItemInLevel(item, level)) {
    throw new RangeError(`Not an item of ${level.id}: ${item}`);
  }
  if (parsed.family === 'keySignature') {
    return { family: 'keySignature', item, fifths: parsed.fifths, mode: parsed.mode };
  }
  if (parsed.family === 'readInterval' && level.family === 'readInterval') {
    const clef = pick(level.clefs, rng);
    const [lower, upper] = pick(intervalCandidates(level, parsed.name, clef), rng);
    const notes = parsed.direction === 'down' ? [upper, lower] : [lower, upper];
    return { family: 'readInterval', item, clef, notes };
  }
  if (parsed.family === 'readChord' && level.family === 'readChord') {
    const clef = pick(level.clefs, rng);
    const { root, notes } = pick(
      chordCandidates(level, parsed.quality, parsed.inversion, clef),
      rng,
    );
    return { family: 'readChord', item, clef, notes, root };
  }
  throw new RangeError(`Not an item of ${level.id}: ${item}`);
}

// --- Key signatures --------------------------------------------------------------------------

/** The signature's sharps or flats in the order they are written: F♯ C♯ G♯, or B♭ E♭ A♭. */
export function signatureAccidentals(fifths: number): Root[] {
  const alters = keyAlters(fifths);
  const order: Letter[] =
    fifths > 0 ? ['F', 'C', 'G', 'D', 'A', 'E', 'B'] : ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
  return order.slice(0, Math.abs(fifths)).map((step) => ({ step, alter: alters[step] }));
}

// --- Judging ---------------------------------------------------------------------------------

/** The MIDI keys of written notes, low to high. */
export const writtenKeys = (notes: readonly SpelledPitch[]) =>
  notes.map(midiOf).sort((a, b) => a - b);

/**
 * The name an interval card is answered by: RI1 its number (`3`), the other levels its quality
 * and number (`m3`).
 */
export function intervalAnswerName(level: ReadIntervalLevel, item: string): string {
  const parsed = parseTheoryItem(item);
  if (parsed?.family !== 'readInterval') throw new RangeError(`Not an interval item: ${item}`);
  const { quality, number } = parsed.name;
  return level.numberOnly ? String(number) : `${quality}${number}`;
}

/** Whether `name` is a name an interval card of `level` can be answered with. */
export function isIntervalAnswer(level: ReadIntervalLevel, name: unknown): name is string {
  if (level.numberOnly) return typeof name === 'string' && /^[2-8]$/.test(name);
  return parseIntervalName(name) !== null;
}

/** A key played for a key signature: right when it is the tonic, in any octave. */
export function isTonicKey(fifths: number, mode: 'major' | 'minor', midi: number): boolean {
  return pitchClass(midiOf(tonicPitch(signatureTonic(fifths, mode), 4))) === pitchClass(midi);
}

/**
 * The keys held for a written chord (pressed since the card was painted and not let go):
 * wrong as soon as one is not among the written keys, right once they are exactly the written
 * keys, octave included; `pending` until then.
 */
export function judgeWrittenChord(
  notes: readonly SpelledPitch[],
  held: readonly number[],
): 'right' | 'wrong' | 'pending' {
  const written = new Set(notes.map(midiOf));
  if (held.some((midi) => !written.has(midi))) return 'wrong';
  return new Set(held).size === written.size ? 'right' : 'pending';
}

/** A chord's name as answered: its root as written, quality and position (`F#:min:1st`). */
export const chordAnswerName = (root: Root, quality: ReadChordQuality, inversion: ReadInversion) =>
  `${rootId(root)}:${quality}:${inversion}`;

export interface ChordName {
  root: Root;
  quality: ReadChordQuality;
  inversion: ReadInversion;
}

export function parseChordName(name: unknown): ChordName | null {
  if (typeof name !== 'string') return null;
  const [root, quality, inversion, ...rest] = name.split(':');
  const parsedRoot = parseRoot(root);
  if (
    rest.length > 0 ||
    !parsedRoot ||
    !(READ_CHORD_QUALITIES as readonly string[]).includes(quality!) ||
    !(READ_INVERSIONS as readonly string[]).includes(inversion!)
  ) {
    return null;
  }
  return {
    root: parsedRoot,
    quality: quality as ReadChordQuality,
    inversion: inversion as ReadInversion,
  };
}

/** Whether a chord name is one a card of `level` can be answered with (a chord of the level). */
export function isChordAnswer(level: ReadChordLevel, name: unknown): name is string {
  const parsed = parseChordName(name);
  return (
    parsed !== null &&
    level.chords.some((c) => c.quality === parsed.quality && c.inversion === parsed.inversion)
  );
}

// --- Checking stored prompts -----------------------------------------------------------------

/**
 * Whether written notes are a card of `item` at `level` on `clef`, by the rules cards are drawn
 * by: an interval's two notes in the order of its direction, spelled as named, within the level's
 * signs and ledger lines; a chord in close position on one of the level's roots. Used to validate
 * stored answers.
 */
export function promptFits(
  level: TheoryLevel,
  item: string,
  notes: readonly SpelledPitch[],
  clef: Clef,
): boolean {
  const parsed = parseTheoryItem(item);
  if (!parsed || !theoryItemInLevel(item, level)) return false;
  if (parsed.family === 'readInterval' && level.family === 'readInterval') {
    if (notes.length !== 2 || !level.clefs.includes(clef)) return false;
    const [first, second] = notes as [SpelledPitch, SpelledPitch];
    const rising = diatonic(second) > diatonic(first);
    if (rising !== (parsed.direction !== 'down')) return false;
    const [lower, upper] = rising ? [first, second] : [second, first];
    return intervalCandidates(level, parsed.name, clef).some(
      ([l, u]) => spelledId(l) === spelledId(lower) && spelledId(u) === spelledId(upper),
    );
  }
  if (parsed.family === 'readChord' && level.family === 'readChord') {
    if (!level.clefs.includes(clef)) return false;
    const ids = notes.map(spelledId).join(' ');
    return chordCandidates(level, parsed.quality, parsed.inversion, clef).some(
      (c) => c.notes.map(spelledId).join(' ') === ids,
    );
  }
  return false;
}

/** The root of a written chord card: the voicing's root, found from its item. */
export function rootOf(item: string, notes: readonly SpelledPitch[]): Root | null {
  const parsed = parseTheoryItem(item);
  if (parsed?.family !== 'readChord' || notes.length === 0) return null;
  const shift = READ_INVERSIONS.indexOf(parsed.inversion);
  // Root position has the root lowest; the inversions move it up by one or two tones.
  const root = notes[(notes.length - shift) % notes.length]!;
  return { step: root.step, alter: root.alter };
}
