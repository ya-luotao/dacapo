import { isBlack, midiOf, midiToPitch, spellingsOf } from './note.ts';
import type { Rng } from './random.ts';
import { keyAlters, keySignature, scaleDegree, tonicPitch } from './keys.ts';
import type { Tonic } from './scaleTypes.ts';
import type { SpelledPitch } from './score.ts';

// Echo, melodic dictation (docs/EAR.md, "Clarifications (decided during E2)"): the app plays a
// short melody after the tonic chord, and it is played back on the keyboard, note by note. Each
// level is a kind of melody drawn fresh every time by the rules below. Pure, so every rule is
// tested over many seeds.

export const ECHO_LEVEL_IDS = ['EC1', 'EC2', 'EC3', 'EC4', 'EC5', 'EC6', 'EC7'] as const;
export type EchoLevelId = (typeof ECHO_LEVEL_IDS)[number];

export const isEchoLevelId = (v: unknown): v is EchoLevelId =>
  typeof v === 'string' && (ECHO_LEVEL_IDS as readonly string[]).includes(v);

/** The scale a melody is in; a minor melody is in the natural or the harmonic form throughout. */
export type EchoScale = 'major' | 'naturalMinor' | 'harmonicMinor';

export interface EchoKey {
  tonic: Tonic;
  mode: 'major' | 'minor';
}

/** The key a melody was in, as an answer keeps it: its tonic as `scales.ts` names it, and its scale. */
export interface MelodyKey {
  tonic: Tonic;
  scale: EchoScale;
}

/** Whether `key` is one a melody of `level` can be in (for stored answers). */
export function isMelodyKeyOf(level: EchoLevelId, key: unknown): key is MelodyKey {
  if (typeof key !== 'object' || key === null || Array.isArray(key)) return false;
  const { tonic, scale } = key as Record<string, unknown>;
  if (Object.keys(key).length !== 2) return false;
  return ECHO_RULES[level].keys.some(
    (k) =>
      k.tonic === tonic &&
      (k.mode === 'major'
        ? scale === 'major'
        : scale === 'naturalMinor' || scale === 'harmonicMinor'),
  );
}

/** What a level's melodies are made of. Steps count scale degrees from the tonic: 0 is 1. */
export interface EchoRules {
  /** The fewest and the most notes. */
  notes: readonly [number, number];
  keys: readonly EchoKey[];
  /** The lowest and highest step from the tonic: 0 is 1, 7 is 8, −3 the 5th below. */
  span: readonly [number, number];
  /** The sizes of a move in scale steps (1 a step, 2 a third … 7 an octave), up or down. */
  moves: readonly number[];
  /** The last note: the tonic (in any octave), or any note of the tonic chord. */
  end: 'tonic' | 'tonicChord';
  /** The 7th only leads up to the 8th. */
  leadingTone: boolean;
  /** The fewest and the most chromatic neighbour or passing notes. */
  chromatic: readonly [number, number];
  /**
   * Whether a leap may be a tritone (the augmented 4th or diminished 5th of the scale): only
   * where any leap within the octave is (EC5, EC7), a decision of E2.
   */
  tritone: boolean;
}

const majors = (...tonics: Tonic[]): EchoKey[] => tonics.map((tonic) => ({ tonic, mode: 'major' }));

/** C, G and F major: EC1–EC3. */
const FIRST_KEYS = majors('C', 'G', 'F');
/** Majors up to two sharps or flats: EC4, EC5 and EC7. */
const MAJOR_KEYS = majors('C', 'G', 'D', 'F', 'Bb');
/** A, E and D minor: EC6. */
const MINOR_KEYS: EchoKey[] = ['A', 'E', 'D'].map((tonic) => ({ tonic, mode: 'minor' }));

/**
 * From EC4 on, a melody may go down to the 5th below the tonic and up to the 3rd above the
 * octave (a decision of E2: the spec names no span past EC3); the range G3–E5 keeps it within a
 * 13th.
 */
const WIDE: readonly [number, number] = [-3, 9];
/** Leaps up to a fifth, and the octave. */
const TO_FIFTH = [1, 2, 3, 4, 7];
/** Any leap within the octave. */
const ANY = [1, 2, 3, 4, 5, 6, 7];

export const ECHO_RULES: Readonly<Record<EchoLevelId, EchoRules>> = {
  EC1: {
    notes: [3, 3],
    keys: FIRST_KEYS,
    span: [0, 4],
    moves: [1],
    end: 'tonic',
    leadingTone: false,
    chromatic: [0, 0],
    tritone: false,
  },
  EC2: {
    notes: [4, 4],
    keys: FIRST_KEYS,
    span: [0, 4],
    moves: [1, 2],
    end: 'tonic',
    leadingTone: false,
    chromatic: [0, 0],
    tritone: false,
  },
  EC3: {
    notes: [5, 5],
    keys: FIRST_KEYS,
    span: [0, 7],
    moves: [1, 2],
    end: 'tonic',
    leadingTone: true,
    chromatic: [0, 0],
    tritone: false,
  },
  EC4: {
    notes: [6, 6],
    keys: MAJOR_KEYS,
    span: WIDE,
    moves: TO_FIFTH,
    end: 'tonic',
    leadingTone: false,
    chromatic: [0, 0],
    tritone: false,
  },
  EC5: {
    notes: [8, 8],
    keys: MAJOR_KEYS,
    span: WIDE,
    moves: ANY,
    end: 'tonic',
    leadingTone: false,
    chromatic: [0, 0],
    tritone: true,
  },
  // Leaps as in EC4: the new thing is the minor key (a decision of E2).
  EC6: {
    notes: [5, 6],
    keys: MINOR_KEYS,
    span: WIDE,
    moves: TO_FIFTH,
    end: 'tonicChord',
    leadingTone: false,
    chromatic: [0, 0],
    tritone: false,
  },
  // Leaps as in EC5, in the majors of EC4 (a decision of E2).
  EC7: {
    notes: [6, 8],
    keys: MAJOR_KEYS,
    span: WIDE,
    moves: ANY,
    end: 'tonicChord',
    leadingTone: false,
    chromatic: [1, 2],
    tritone: true,
  },
};

/** G3 and E5: every note of a melody lies within them. */
export const MELODY_LOWEST = 55;
export const MELODY_HIGHEST = 76;

// --- Timing ----------------------------------------------------------------------------------

/** The tonic triad, block, before the melody. */
export const TONIC_CHORD_MS = 900;
/** A quarter at ♩ = 100: the rest after the chord, and the distance from note to note. */
export const BEAT_MS = 600;
/** How long each note of the melody sounds, of its beat. */
export const MELODY_NOTE_MS = 540;

export interface TimedNote {
  midi: number;
  on: number;
  off: number;
}

/**
 * When each key sounds: the tonic triad (unless `chord` is null), a quarter's rest, then the
 * melody in quarters. Without the chord the melody starts at once.
 */
export function melodyTiming(notes: readonly number[], chord: readonly number[] | null) {
  const start = chord ? TONIC_CHORD_MS + BEAT_MS : 0;
  const timed: TimedNote[] = (chord ?? []).map((midi) => ({ midi, on: 0, off: TONIC_CHORD_MS }));
  notes.forEach((midi, i) => {
    const on = start + i * BEAT_MS;
    timed.push({ midi, on, off: on + MELODY_NOTE_MS });
  });
  return timed;
}

// --- Melodies --------------------------------------------------------------------------------

/** A note of a melody: a scale step from the tonic, raised or lowered by a semitone when chromatic. */
export interface EchoNote {
  step: number;
  chromatic: -1 | 0 | 1;
}

export interface Melody {
  /** The line the notes were drawn as: scale steps from the tonic, and the chromatic ones. */
  line: EchoNote[];
  tonic: Tonic;
  scale: EchoScale;
  /** The key signature: sharps (+) or flats (−). */
  fifths: number;
  /** The keys, in the order played. */
  notes: number[];
  /** The notes as written in the key. */
  written: SpelledPitch[];
  /** The tonic triad in root position on the tonic the steps count from. */
  chord: number[];
}

const mod7 = (n: number) => ((n % 7) + 7) % 7;
const randomInt = (low: number, high: number, rng: Rng) =>
  low + Math.min(high - low, Math.floor(rng() * (high - low + 1)));
const pick = <T>(values: readonly T[], rng: Rng): T =>
  values[randomInt(0, values.length - 1, rng)]!;

/** 1, 3 and 5 in any octave. */
const inTonicChord = (step: number) => [0, 2, 4].includes(mod7(step));
const isTonic = (step: number) => mod7(step) === 0;

/** Steps are likelier than leaps, small leaps than large ones, and the octave in between. */
const MOVE_WEIGHT: Readonly<Record<number, number>> = {
  1: 6,
  2: 3,
  3: 2,
  4: 2,
  5: 1,
  6: 1,
  7: 1.5,
};

/** `values` in a random order, each drawn with its weight (Efraimidis–Spirakis). */
function weightedOrder<T>(values: readonly T[], weight: (value: T) => number, rng: Rng): T[] {
  return values
    .map((value) => ({ value, key: Math.pow(rng(), 1 / weight(value)) }))
    .sort((a, b) => b.key - a.key)
    .map((entry) => entry.value);
}

/** A move in scale steps: a step is a 2nd, a skip a 3rd, a leap a 4th or more. */
const isStep = (move: number) => Math.abs(move) === 1;
const isSkip = (move: number) => Math.abs(move) === 2;
const isLeap = (move: number) => Math.abs(move) >= 3;

/**
 * Whether `move` after the `moves` so far (in scale steps, up +, down −) keeps the rules of
 * motion: never the same note twice; never two leaps the same way in a row, and after a leap a
 * turn back or a step; skips the same way at most two in a row (1–3–5 outlines a triad, a third
 * skip would not).
 */
export function keepsMotionRules(moves: readonly number[], move: number): boolean {
  if (move === 0) return false;
  const previous = moves.at(-1);
  if (previous === undefined) return true;
  const same = Math.sign(move) === Math.sign(previous);
  if (isLeap(previous) && same && !isStep(move)) return false;
  const before = moves.at(-2);
  if (
    isSkip(move) &&
    isSkip(previous) &&
    before !== undefined &&
    isSkip(before) &&
    same &&
    Math.sign(before) === Math.sign(move)
  ) {
    return false;
  }
  return true;
}

/**
 * A line of `length` scale steps by the level's rules: it starts on 1, 3 or 5, ends as the level
 * says, moves by the level's moves inside its span, keeps the leap rules, and (EC3) takes the
 * 7th up to the 8th. A depth-first search in a weighted random order, so it always finds one
 * when there is one; null when there is none.
 */
function drawSteps(rules: EchoRules, scale: EchoScale, length: number, rng: Rng): number[] | null {
  const [low, high] = rules.span;
  const all = Array.from({ length: high - low + 1 }, (_, i) => low + i);
  const starts = all.filter(inTonicChord);
  const ends = new Set(all.filter(rules.end === 'tonic' ? isTonic : inTonicChord));
  const line: number[] = [];

  const candidates = (): number[] => {
    if (line.length === 0) return starts;
    const previous = line.at(-1)!;
    if (rules.leadingTone && mod7(previous) === 6)
      return previous + 1 <= high ? [previous + 1] : [];
    const moves = line.slice(1).map((step, i) => step - line[i]!);
    return rules.moves
      .flatMap((size) => [previous + size, previous - size])
      .filter(
        (next) =>
          next >= low &&
          next <= high &&
          keepsMotionRules(moves, next - previous) &&
          (rules.tritone ||
            Math.abs(stepSemitones(scale, next) - stepSemitones(scale, previous)) !== 6),
      );
  };

  const extend = (): boolean => {
    if (line.length === length) return ends.has(line.at(-1)!);
    let options = candidates();
    if (line.length === length - 1) options = options.filter((step) => ends.has(step));
    const previous = line.at(-1);
    const weight = (step: number) =>
      previous === undefined ? 1 : (MOVE_WEIGHT[Math.abs(step - previous)] ?? 1);
    for (const step of weightedOrder(options, weight, rng)) {
      line.push(step);
      if (extend()) return true;
      line.pop();
    }
    return false;
  };

  return extend() ? line : null;
}

/** Semitones from the tonic to each degree of the scale. */
const SCALE_SEMITONES: Readonly<Record<EchoScale, readonly number[]>> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  naturalMinor: [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
};

/** Semitones from the tonic to a scale step (negative below it). */
export function stepSemitones(scale: EchoScale, step: number): number {
  return SCALE_SEMITONES[scale][mod7(step)]! + 12 * Math.floor(step / 7);
}

const wholeStep = (scale: EchoScale, a: number, b: number) =>
  Math.abs(stepSemitones(scale, a) - stepSemitones(scale, b)) === 2;

/**
 * Puts `passing` chromatic passing notes and `neighbours` chromatic neighbours into a line of
 * scale steps. A passing note goes between two degrees a whole step apart (C–C♯–D up, D–D♭–C
 * down); a neighbour replaces the middle of X–Y–X where Y is a whole step from X, a semitone
 * from X instead (G–F♯–G, G–A♭–G). No two chromatic notes are next to each other. Null when the
 * line has too few places.
 */
function addChromatic(
  steps: readonly number[],
  scale: EchoScale,
  passing: number,
  neighbours: number,
  rng: Rng,
): EchoNote[] | null {
  const gaps = steps
    .slice(0, -1)
    .map((_, g) => g)
    .filter(
      (g) =>
        Math.abs(steps[g + 1]! - steps[g]!) === 1 && wholeStep(scale, steps[g]!, steps[g + 1]!),
    );
  const middles = steps
    .map((_, j) => j)
    .filter(
      (j) =>
        j > 0 &&
        j < steps.length - 1 &&
        steps[j - 1] === steps[j + 1] &&
        Math.abs(steps[j]! - steps[j - 1]!) === 1 &&
        wholeStep(scale, steps[j]!, steps[j - 1]!),
    );
  const chosenGaps = new Set<number>();
  const chosenMiddles = new Set<number>();
  for (const g of weightedOrder(gaps, () => 1, rng)) {
    if (chosenGaps.size === passing) break;
    chosenGaps.add(g);
  }
  // A neighbour next to a passing note, or to another neighbour, would stand beside it.
  for (const j of weightedOrder(middles, () => 1, rng)) {
    if (chosenMiddles.size === neighbours) break;
    if (chosenGaps.has(j - 1) || chosenGaps.has(j)) continue;
    if (chosenMiddles.has(j - 1) || chosenMiddles.has(j + 1)) continue;
    chosenMiddles.add(j);
  }
  if (chosenGaps.size < passing || chosenMiddles.size < neighbours) return null;
  const notes: EchoNote[] = [];
  steps.forEach((step, i) => {
    if (chosenMiddles.has(i)) {
      // An upper neighbour is lowered towards X, a lower one raised.
      notes.push({ step, chromatic: step > steps[i - 1]! ? -1 : 1 });
    } else {
      notes.push({ step, chromatic: 0 });
    }
    if (chosenGaps.has(i)) {
      // The lower degree raised going up, the upper lowered going down.
      notes.push({ step, chromatic: steps[i + 1]! > step ? 1 : -1 });
    }
  });
  return notes;
}

/**
 * The note as written: the scale's spelling, raised or lowered when chromatic. A chromatic note
 * that would be a white key with a sign (B♯, E♯, C♭, F♭) is written as that white key instead
 * (B–C♮–C♯, not B–B♯–C♯): a decision of E2, for reading.
 */
function writeNote(scale: EchoScale, home: SpelledPitch, note: EchoNote): SpelledPitch {
  const pitch = scaleDegree(scale, home, note.step);
  const written = { ...pitch, alter: pitch.alter + note.chromatic };
  const midi = midiOf(written);
  if (note.chromatic === 0 || isBlack(midi) || written.alter === 0) return written;
  const natural = midiToPitch(midi);
  return { step: natural.letter, alter: 0, octave: natural.octave };
}

/** Attempts before giving up; each level finds a melody in its first few. */
const MAX_ATTEMPTS = 200;

/**
 * A fresh melody for `level`: the key, the notes by the rules, then the octave of the tonic that
 * keeps every note within G3–E5 (one of those that do, at random).
 */
export function makeMelody(level: EchoLevelId, rng: Rng): Melody {
  const rules = ECHO_RULES[level];
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const key = pick(rules.keys, rng);
    const scale: EchoScale =
      key.mode === 'major' ? 'major' : pick(['naturalMinor', 'harmonicMinor'] as const, rng);
    const length = randomInt(rules.notes[0], rules.notes[1], rng);
    const chromatic = randomInt(rules.chromatic[0], rules.chromatic[1], rng);
    const passing = randomInt(0, chromatic, rng);
    const steps = drawSteps(rules, scale, length - passing, rng);
    if (!steps) continue;
    const notes = addChromatic(steps, scale, passing, chromatic - passing, rng);
    if (!notes) continue;
    const fits = [2, 3, 4, 5].flatMap((octave) => {
      const home = tonicPitch(key.tonic, octave);
      const written = notes.map((note) => writeNote(scale, home, note));
      const midi = written.map(midiOf);
      return midi.every((m) => m >= MELODY_LOWEST && m <= MELODY_HIGHEST)
        ? [{ home, written, midi }]
        : [];
    });
    if (fits.length === 0) continue;
    const { home, written, midi } = pick(fits, rng);
    const root = midiOf(home);
    return {
      line: notes,
      tonic: key.tonic,
      scale,
      fifths: keySignature(scale, key.tonic).fifths,
      notes: midi,
      written,
      chord: [root, root + (key.mode === 'major' ? 4 : 3), root + 7],
    };
  }
  throw new Error(`No melody found for ${level}`);
}

/**
 * Whether stored keys can be a melody of `level`: as many notes as the level has, no key twice
 * in a row. (The key is not stored, so the rest of the rules cannot be checked.)
 */
export function melodyFits(level: EchoLevelId, notes: readonly number[]): boolean {
  const [fewest, most] = ECHO_RULES[level].notes;
  return (
    notes.length >= fewest &&
    notes.length <= most &&
    notes.every((midi, i) => i === 0 || midi !== notes[i - 1])
  );
}

// --- Judging ---------------------------------------------------------------------------------

/**
 * A key played back, after the keys `played` that were right so far: `next` when it is the next
 * note and more are to come, `right` when it is the last, `wrong` otherwise.
 */
export function judgeEchoKey(
  melody: readonly number[],
  played: readonly number[],
  midi: number,
): 'next' | 'right' | 'wrong' {
  if (midi !== melody[played.length]) return 'wrong';
  return played.length + 1 === melody.length ? 'right' : 'next';
}

/**
 * A recorded answer judged again: the keys played are the melody's up to the last, which is the
 * first wrong one or completes it. True when every key matches, false when the last is wrong,
 * null when the keys cannot be an answer (a wrong key before the last, or the melody unfinished).
 */
export function judgeEchoAnswer(
  melody: readonly number[],
  answer: readonly number[],
): boolean | null {
  if (answer.length === 0 || answer.length > melody.length) return null;
  const last = answer.length - 1;
  if (answer.some((midi, i) => i < last && midi !== melody[i])) return null;
  if (answer[last] !== melody[last]) return false;
  return answer.length === melody.length ? true : null;
}

export interface EchoMistake {
  /** 1-based: the note that went wrong. */
  note: number;
  /** The key asked for, and the key played. */
  expected: number;
  played: number;
  /**
   * The melodic interval into the note, in semitones (up +, down −), asked and played; null for
   * the first note, which has none.
   */
  asked: number | null;
  answered: number | null;
}

/** Where a wrong answer went wrong, or null for a right one. */
export function echoMistake(
  melody: readonly number[],
  answer: readonly number[],
): EchoMistake | null {
  const index = answer.length - 1;
  const played = answer[index];
  const expected = melody[index];
  if (played === undefined || expected === undefined || played === expected) return null;
  const before = index > 0 ? melody[index - 1]! : null;
  return {
    note: index + 1,
    expected,
    played,
    asked: before === null ? null : expected - before,
    answered: before === null ? null : played - before,
  };
}

// --- Writing ---------------------------------------------------------------------------------

/**
 * A key played as it is written in the melody's key: its spelling in the scale when it is one of
 * the scale's notes, otherwise the one with the fewest accidentals, sharps in sharp keys (and C
 * major or A minor) and flats in flat keys.
 */
export function spellInKey(midi: number, melody: MelodyKey) {
  const fifths = keySignature(melody.scale, melody.tonic).fifths;
  const home = tonicPitch(melody.tonic, 4);
  const offset = (((midi - midiOf(home)) % 12) + 12) % 12;
  const degree = SCALE_SEMITONES[melody.scale].indexOf(offset);
  if (degree >= 0) {
    const octaves = Math.floor((midi - midiOf(home)) / 12);
    const pitch = scaleDegree(melody.scale, home, degree + 7 * octaves);
    if (midiOf(pitch) === midi) return pitch;
  }
  const options = spellingsOf(midi).map((p): SpelledPitch => ({
    step: p.letter,
    alter: p.accidental,
    octave: p.octave,
  }));
  const prefer = fifths < 0 ? -1 : 1;
  return options.sort(
    (a, b) =>
      Math.abs(a.alter) - Math.abs(b.alter) ||
      Number(b.alter === prefer) - Number(a.alter === prefer),
  )[0]!;
}

/**
 * The accidentals to print before each note of a line in a key, as within one bar: a note
 * whose alteration differs from what its letter in its octave had last (the key signature's at
 * first) shows its own (0 a natural); otherwise null. With `extra`, a note drawn over the line at
 * `index` (a wrong key) is marked against the line up to there, and always when it shares its
 * letter and octave with the line's note there; it does not change what follows.
 */
export function accidentalMarks(
  line: readonly SpelledPitch[],
  fifths: number,
  extra?: { index: number; pitch: SpelledPitch },
): { line: (number | null)[]; extra: number | null } {
  const signature = keyAlters(fifths);
  const current = new Map<string, number>();
  const place = (p: SpelledPitch) => `${p.step}${p.octave}`;
  const now = (p: SpelledPitch) => current.get(place(p)) ?? signature[p.step];
  let extraMark: number | null = null;
  const marks = line.map((pitch, i) => {
    if (extra && extra.index === i) {
      const clash = place(extra.pitch) === place(pitch) && extra.pitch.alter !== pitch.alter;
      extraMark = clash || now(extra.pitch) !== extra.pitch.alter ? extra.pitch.alter : null;
    }
    if (now(pitch) === pitch.alter) return null;
    current.set(place(pitch), pitch.alter);
    return pitch.alter;
  });
  return { line: marks, extra: extraMark };
}
