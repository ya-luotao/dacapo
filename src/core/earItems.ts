import {
  LETTERS,
  pitchClass,
  pitchToMidi,
  spellingsOf,
  type Accidental,
  type Pitch,
} from './note.ts';
import type { Rng } from './random.ts';

// Ear training (docs/EAR.md, "Clarifications (decided during E1)"): what the items are, how a
// prompt is drawn and played, and how an answer is judged. Pure, so every rule is unit-tested.

export type EarFamily = 'interval' | 'chord';
export const EAR_FAMILIES: readonly EarFamily[] = ['interval', 'chord'];

// --- Intervals -------------------------------------------------------------------------------

/** In the order the levels add them. `TT` is the tritone (spelled A4 or d5 on the staff). */
export const INTERVAL_NAMES = [
  'P8',
  'P5',
  'M3',
  'P4',
  'm3',
  'M2',
  'm2',
  'M6',
  'm6',
  'M7',
  'm7',
  'TT',
  'm9',
  'M9',
  'm10',
  'M10',
  'P11',
  'P12',
] as const;
export type IntervalName = (typeof INTERVAL_NAMES)[number];

export const INTERVAL_SEMITONES: Readonly<Record<IntervalName, number>> = {
  m2: 1,
  M2: 2,
  m3: 3,
  M3: 4,
  P4: 5,
  TT: 6,
  P5: 7,
  m6: 8,
  M6: 9,
  m7: 10,
  M7: 11,
  P8: 12,
  m9: 13,
  M9: 14,
  m10: 15,
  M10: 16,
  P11: 17,
  P12: 19,
};

/** Letters from the lower note to the upper as written; the tritone may be either. */
const INTERVAL_LETTER_STEPS: Readonly<Record<IntervalName, readonly number[]>> = {
  m2: [1],
  M2: [1],
  m3: [2],
  M3: [2],
  P4: [3],
  TT: [3, 4],
  P5: [4],
  m6: [5],
  M6: [5],
  m7: [6],
  M7: [6],
  P8: [7],
  m9: [8],
  M9: [8],
  m10: [9],
  M10: [9],
  P11: [10],
  P12: [11],
};

export const isIntervalName = (v: unknown): v is IntervalName =>
  typeof v === 'string' && (INTERVAL_NAMES as readonly string[]).includes(v);

/** The interval name of a distance in semitones, or null when it has none here (18, over 19). */
export function intervalOfSemitones(semitones: number): IntervalName | null {
  return INTERVAL_NAMES.find((name) => INTERVAL_SEMITONES[name] === semitones) ?? null;
}

/** How an interval is played: melodic up, melodic down, or both notes together. */
export const DIRECTIONS = ['up', 'down', 'harm'] as const;
export type Direction = (typeof DIRECTIONS)[number];
/** The setting: one direction, or all of them mixed. */
export const DIRECTION_SETTINGS = ['up', 'down', 'harm', 'mixed'] as const;
export type DirectionSetting = (typeof DIRECTION_SETTINGS)[number];
export const DEFAULT_DIRECTION: DirectionSetting = 'up';

export function directionsOf(setting: DirectionSetting): readonly Direction[] {
  return setting === 'mixed' ? DIRECTIONS : [setting];
}

// --- Chords ----------------------------------------------------------------------------------

export const CHORD_QUALITIES = [
  'maj',
  'min',
  'dim',
  'aug',
  'dom7',
  'maj7',
  'min7',
  'hdim7',
] as const;
export type ChordQuality = (typeof CHORD_QUALITIES)[number];

/** Semitones above the root, in close position. */
export const CHORD_TONES: Readonly<Record<ChordQuality, readonly number[]>> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  dom7: [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  hdim7: [0, 3, 6, 10],
};

export const INVERSIONS = ['root', '1st', '2nd'] as const;
export type Inversion = (typeof INVERSIONS)[number];

export const isSeventh = (quality: ChordQuality) => CHORD_TONES[quality].length === 4;

/** How chords are played: broken (one note after another) then together, or together only. */
export const CHORD_STYLES = ['broken', 'block'] as const;
export type ChordStyle = (typeof CHORD_STYLES)[number];
export const DEFAULT_CHORD_STYLE: ChordStyle = 'broken';

/**
 * Offsets from the root of a close-position voicing, lowest first: the inversions move the lower
 * tones up an octave.
 */
export function voicing(quality: ChordQuality, inversion: Inversion): number[] {
  const tones = CHORD_TONES[quality];
  const shift = INVERSIONS.indexOf(inversion);
  return [...tones.slice(shift), ...tones.slice(0, shift).map((t) => t + 12)];
}

// --- Items -----------------------------------------------------------------------------------

export type EarItem =
  | { family: 'interval'; name: IntervalName; direction: Direction }
  | { family: 'chord'; quality: ChordQuality; inversion: Inversion };

export const intervalItem = (name: IntervalName, direction: Direction) =>
  `int:${name}:${direction}`;
export const chordItem = (quality: ChordQuality, inversion: Inversion) =>
  `chord:${quality}:${inversion}`;

/** `int:M3:up` or `chord:min:1st`; null for anything else. */
export function parseItem(key: string): EarItem | null {
  const [kind, a, b, ...rest] = key.split(':');
  if (rest.length > 0) return null;
  if (kind === 'int' && isIntervalName(a) && (DIRECTIONS as readonly string[]).includes(b!)) {
    return { family: 'interval', name: a, direction: b as Direction };
  }
  if (
    kind === 'chord' &&
    (CHORD_QUALITIES as readonly string[]).includes(a!) &&
    (INVERSIONS as readonly string[]).includes(b!)
  ) {
    return { family: 'chord', quality: a as ChordQuality, inversion: b as Inversion };
  }
  return null;
}

/**
 * What an item is named by when answering by name: the interval (`M3`, whatever the direction)
 * or the chord's quality and position (`min:1st`).
 */
export function answerNameOf(item: EarItem): string {
  return item.family === 'interval' ? item.name : `${item.quality}:${item.inversion}`;
}

// --- Levels ----------------------------------------------------------------------------------

export const INTERVAL_LEVEL_IDS = ['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7'] as const;
export const CHORD_LEVEL_IDS = ['C1', 'C2', 'C3', 'C4', 'C5'] as const;
export type IntervalLevelId = (typeof INTERVAL_LEVEL_IDS)[number];
export type ChordLevelId = (typeof CHORD_LEVEL_IDS)[number];
export type EarLevelId = IntervalLevelId | ChordLevelId;

export interface IntervalLevel {
  id: IntervalLevelId;
  family: 'interval';
  /** In the order of the levels, which is the order of the answer buttons. */
  names: readonly IntervalName[];
}

export interface ChordLevel {
  id: ChordLevelId;
  family: 'chord';
  /** In the order of the levels, which is the order of the answer buttons. */
  chords: readonly { quality: ChordQuality; inversion: Inversion }[];
  /** The inversion level: a played chord must have the right bass. */
  bassMatters: boolean;
}

export type EarLevel = IntervalLevel | ChordLevel;

const upTo = (end: IntervalName) => INTERVAL_NAMES.slice(0, INTERVAL_NAMES.indexOf(end) + 1);

export const INTERVAL_LEVELS: readonly IntervalLevel[] = [
  { id: 'I1', family: 'interval', names: upTo('M3') },
  { id: 'I2', family: 'interval', names: upTo('m3') },
  { id: 'I3', family: 'interval', names: upTo('m2') },
  { id: 'I4', family: 'interval', names: upTo('m6') },
  { id: 'I5', family: 'interval', names: upTo('m7') },
  // Every simple interval but the unison.
  { id: 'I6', family: 'interval', names: upTo('TT') },
  // The whole of I6 plus the compound intervals.
  { id: 'I7', family: 'interval', names: INTERVAL_NAMES },
];

const rootPosition = (...qualities: ChordQuality[]) =>
  qualities.map((quality) => ({ quality, inversion: 'root' as const }));

export const CHORD_LEVELS: readonly ChordLevel[] = [
  { id: 'C1', family: 'chord', chords: rootPosition('maj', 'min'), bassMatters: false },
  {
    id: 'C2',
    family: 'chord',
    chords: rootPosition('maj', 'min', 'dim', 'aug'),
    bassMatters: false,
  },
  // Augmented inversions sound like another augmented triad, so they are left out.
  {
    id: 'C3',
    family: 'chord',
    chords: INVERSIONS.flatMap((inversion) =>
      (['maj', 'min'] as const).map((quality) => ({ quality, inversion })),
    ),
    bassMatters: true,
  },
  {
    id: 'C4',
    family: 'chord',
    chords: rootPosition('dom7', 'maj7', 'min7', 'hdim7'),
    bassMatters: false,
  },
  {
    id: 'C5',
    family: 'chord',
    chords: rootPosition('maj', 'min', 'dim', 'aug', 'dom7', 'maj7', 'min7', 'hdim7'),
    bassMatters: false,
  },
];

export const EAR_LEVELS: readonly EarLevel[] = [...INTERVAL_LEVELS, ...CHORD_LEVELS];

export const isEarLevelId = (v: unknown): v is EarLevelId =>
  EAR_LEVELS.some((level) => level.id === v);

export function getEarLevel(id: EarLevelId): EarLevel {
  return EAR_LEVELS.find((level) => level.id === id)!;
}

export function levelsOf(family: EarFamily): readonly EarLevel[] {
  return family === 'interval' ? INTERVAL_LEVELS : CHORD_LEVELS;
}

/** The level after `id` in its family, or null for the last. */
export function nextEarLevel(id: EarLevelId): EarLevelId | null {
  const levels = levelsOf(getEarLevel(id).family);
  const i = levels.findIndex((level) => level.id === id);
  return levels[i + 1]?.id ?? null;
}

/** The items of a session: every interval of the level in each direction, or the level's chords. */
export function levelItems(level: EarLevel, directions: readonly Direction[]): string[] {
  if (level.family === 'chord') return level.chords.map((c) => chordItem(c.quality, c.inversion));
  return level.names.flatMap((name) => directions.map((d) => intervalItem(name, d)));
}

/** The names of the answer buttons, in order: the level's intervals, or its chords. */
export function answerNames(level: EarLevel): string[] {
  if (level.family === 'chord') return level.chords.map((c) => `${c.quality}:${c.inversion}`);
  return [...level.names];
}

/** Whether `item` is one of the level's (an interval in any direction). */
export function itemInLevel(item: EarItem, level: EarLevel): boolean {
  if (item.family !== level.family) return false;
  return answerNames(level).includes(answerNameOf(item));
}

// --- Prompts ---------------------------------------------------------------------------------

/** C3: the lowest note of every prompt. */
export const PROMPT_LOWEST = 48;
/** C5: the highest lower note of an interval. */
export const INTERVAL_LOWER_HIGHEST = 72;
/** C6: the highest upper note of an interval. */
export const INTERVAL_UPPER_HIGHEST = 84;
/** C5: the highest note of a triad (inside C3–C5). */
export const TRIAD_HIGHEST = 72;
/** C6: the highest note of a seventh chord (C5 + an octave). */
export const SEVENTH_HIGHEST = 84;

/** A drawn prompt: its keys in the order they are played (a chord's from low to high). */
export interface Prompt {
  item: string;
  notes: readonly number[];
}

const randomInt = (low: number, high: number, rng: Rng) =>
  low + Math.min(high - low, Math.floor(rng() * (high - low + 1)));

/**
 * Draws the keys of `item`. An interval's lower note is uniform in C3–C5 with the upper note at
 * most C6; a chord's root is uniform with the voicing's lowest note at or above C3 and its
 * highest at most C5 (a triad) or C6 (a seventh chord).
 */
export function makePrompt(key: string, rng: Rng): Prompt {
  const item = parseItem(key);
  if (!item) throw new RangeError(`Not an ear-training item: ${key}`);
  if (item.family === 'interval') {
    const size = INTERVAL_SEMITONES[item.name];
    const lower = randomInt(
      PROMPT_LOWEST,
      Math.min(INTERVAL_LOWER_HIGHEST, INTERVAL_UPPER_HIGHEST - size),
      rng,
    );
    const upper = lower + size;
    return { item: key, notes: item.direction === 'down' ? [upper, lower] : [lower, upper] };
  }
  const offsets = voicing(item.quality, item.inversion);
  const highest = isSeventh(item.quality) ? SEVENTH_HIGHEST : TRIAD_HIGHEST;
  const root = randomInt(PROMPT_LOWEST - offsets[0]!, highest - offsets.at(-1)!, rng);
  return { item: key, notes: offsets.map((o) => root + o) };
}

/**
 * The key shown on the keyboard to answer from: an interval's first note (the lower one when the
 * notes sound together), a chord's root where the voicing has it.
 */
export function givenKey(prompt: Prompt): number {
  const item = parseItem(prompt.item);
  if (item?.family !== 'chord') return prompt.notes[0]!;
  return prompt.notes[voicing(item.quality, item.inversion).findIndex((o) => o % 12 === 0)]!;
}

/** The key to play for an interval: the other note. */
export const targetKey = (prompt: Prompt): number => prompt.notes[1]!;

/**
 * Whether `notes` can be a prompt for `item`: an interval's two keys the right distance apart in
 * its direction, a chord's keys in its close-position voicing. Used to validate stored answers.
 */
export function promptMatches(item: EarItem, notes: readonly number[]): boolean {
  if (item.family === 'interval') {
    if (notes.length !== 2) return false;
    const [first, second] = notes as [number, number];
    const size = INTERVAL_SEMITONES[item.name];
    return item.direction === 'down' ? first - second === size : second - first === size;
  }
  const offsets = voicing(item.quality, item.inversion);
  return (
    notes.length === offsets.length &&
    notes.every((midi, i) => midi - notes[0]! === offsets[i]! - offsets[0]!)
  );
}

// --- Timing ----------------------------------------------------------------------------------

/** Velocity of every prompt (docs/EAR.md, "Sound"). */
export const PROMPT_VELOCITY = 72;
/** A melodic interval: each note sounds this long … */
export const MELODIC_NOTE_MS = 700;
/** … and the second starts this long after the first. */
export const MELODIC_STEP_MS = 800;
/** Both notes of a harmonic interval together. */
export const HARMONIC_MS = 1400;
/** A broken chord: one note after another, this far apart and each as long … */
export const BROKEN_STEP_MS = 450;
/** … then a breath before the block chord. */
export const BROKEN_GAP_MS = 250;
/** The block chord. */
export const BLOCK_MS = 1500;

export interface PlannedNote {
  midi: number;
  /** Ms from the start of the prompt. */
  on: number;
  off: number;
}

export interface PromptPlan {
  notes: readonly PlannedNote[];
  /**
   * Ms from the start to the last note-on, where the answer window opens. For a chord played
   * broken, then block, that is the block chord: the notes of the arpeggio are not answered.
   */
  lastOn: number;
  /** Ms from the start to the last note-off. */
  length: number;
}

function plan(notes: PlannedNote[]): PromptPlan {
  return {
    notes,
    lastOn: Math.max(...notes.map((n) => n.on)),
    length: Math.max(...notes.map((n) => n.off)),
  };
}

/** When each key of the prompt sounds. */
export function promptPlan(prompt: Prompt, style: ChordStyle): PromptPlan {
  const item = parseItem(prompt.item);
  if (item?.family === 'interval') {
    if (item.direction === 'harm') {
      return plan(prompt.notes.map((midi) => ({ midi, on: 0, off: HARMONIC_MS })));
    }
    return plan(
      prompt.notes.map((midi, i) => ({
        midi,
        on: i * MELODIC_STEP_MS,
        off: i * MELODIC_STEP_MS + MELODIC_NOTE_MS,
      })),
    );
  }
  const broken =
    style === 'broken'
      ? prompt.notes.map((midi, i) => ({
          midi,
          on: i * BROKEN_STEP_MS,
          off: (i + 1) * BROKEN_STEP_MS,
        }))
      : [];
  const blockOn = broken.length > 0 ? broken.length * BROKEN_STEP_MS + BROKEN_GAP_MS : 0;
  return plan([
    ...broken,
    ...prompt.notes.map((midi) => ({ midi, on: blockOn, off: blockOn + BLOCK_MS })),
  ]);
}

// --- Judging ---------------------------------------------------------------------------------

/**
 * A key played for an interval: right when it is the other note. The shown key itself is not an
 * answer (`ignored`): a learner often plays the given note before the answer, or both together,
 * and it is on screen already. (A decision of E1 beyond the spec's "the exact key".)
 */
export function judgeIntervalKey(prompt: Prompt, midi: number): 'right' | 'wrong' | 'ignored' {
  if (midi === givenKey(prompt)) return 'ignored';
  return midi === targetKey(prompt) ? 'right' : 'wrong';
}

/**
 * The keys held for a chord (those pressed since the answer window opened, the pedal aside):
 * wrong as soon as one is outside the chord's pitch classes; right once they hold exactly its
 * pitch classes, in any voicing and octave; with `bassMatters` (the inversion level) wrong
 * instead when the lowest key is not the voicing's bass. `pending` until then.
 */
export function judgeChordKeys(
  prompt: Prompt,
  held: readonly number[],
  bassMatters: boolean,
): 'right' | 'wrong' | 'pending' {
  const chord = new Set(prompt.notes.map(pitchClass));
  const played = new Set(held.map(pitchClass));
  for (const pc of played) if (!chord.has(pc)) return 'wrong';
  if (played.size < chord.size) return 'pending';
  if (bassMatters && pitchClass(Math.min(...held)) !== pitchClass(prompt.notes[0]!)) {
    return 'wrong';
  }
  return 'right';
}

// --- Spelling (for the staff) ----------------------------------------------------------------

const letterIndex = (pitch: Pitch) => LETTERS.indexOf(pitch.letter);

/** The pitch `steps` letters above `from` that sounds as `midi`; null when that needs a double. */
function spellAbove(from: Pitch, steps: number, midi: number): Pitch | null {
  const index = letterIndex(from) + steps;
  const natural: Pitch = {
    letter: LETTERS[index % 7]!,
    accidental: 0,
    octave: from.octave + Math.floor(index / 7),
  };
  const accidental = midi - pitchToMidi(natural);
  if (accidental < -1 || accidental > 1) return null;
  return { ...natural, accidental: accidental as Accidental };
}

const accidentals = (pitches: readonly Pitch[]) =>
  pitches.reduce((sum, p) => sum + Math.abs(p.accidental), 0);

/**
 * The spelling with the fewest accidentals, built on each spelling of `base`; of equal ones the
 * first (natural, then flat, then sharp bases). Null when every one needs a double accidental.
 */
function bestSpelling(base: number, build: (base: Pitch) => Pitch[] | null): Pitch[] | null {
  const bases = spellingsOf(base).sort(
    (a, b) => Math.abs(a.accidental) - Math.abs(b.accidental) || a.accidental - b.accidental,
  );
  let best: Pitch[] | null = null;
  for (const pitch of bases) {
    const spelled = build(pitch);
    if (spelled && (!best || accidentals(spelled) < accidentals(best))) best = spelled;
  }
  return best;
}

/**
 * The prompt's keys as written, low to high: an interval by its letters (the tritone as an
 * augmented 4th or a diminished 5th), a chord in thirds from its root; each with the fewest
 * accidentals and never a double one. Null only if no such spelling exists.
 */
export function spellPrompt(prompt: Prompt): Pitch[] | null {
  const item = parseItem(prompt.item);
  if (!item) return null;
  if (item.family === 'interval') {
    const [lower, upper] = [...prompt.notes].sort((a, b) => a - b) as [number, number];
    return bestSpelling(lower, (base) => {
      const options = INTERVAL_LETTER_STEPS[item.name].flatMap((steps) => {
        const top = spellAbove(base, steps, upper);
        return top ? [[base, top]] : [];
      });
      return options.sort((a, b) => accidentals(a) - accidentals(b))[0] ?? null;
    });
  }
  const offsets = voicing(item.quality, item.inversion);
  // The root below the voicing's lowest note (itself, in root position).
  const root = prompt.notes[0]! - offsets[0]!;
  const tones = CHORD_TONES[item.quality];
  return bestSpelling(root, (base) => {
    const spelled: Pitch[] = [];
    for (const offset of offsets) {
      // Chord tones are a third apart: 0, 2, 4, 6 letters above the root, plus the octave.
      const steps = tones.indexOf(offset % 12) * 2 + Math.floor(offset / 12) * 7;
      const pitch = spellAbove(base, steps, root + offset);
      if (!pitch) return null;
      spelled.push(pitch);
    }
    return spelled;
  });
}
