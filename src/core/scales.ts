// Scale exercises: which scales there are, how each is spelled, where it lies on the keyboard and
// how it is fingered. An exercise is plain data with a stable key, so records can group by it. See
// docs/SCALES.md ("Exercises").

import { midiOf } from './musicxml.ts';
import {
  EXERCISE_TYPES,
  SCALE_OCTAVES,
  type Crossing,
  type ExerciseType,
  type Direction,
  type ScaleExercise,
  type ScaleHands,
  type ScaleNote,
  type ScaleType,
  type Tonic,
} from './scaleTypes.ts';
import {
  HANON_ARPEGGIOS,
  HANON_CHROMATIC,
  HANON_EDITION,
  HANON_SCALES,
  type HanonRuns,
} from './scaleFingering.ts';
import { CHROMATIC_TONICS, MAJOR_TONICS, MINOR_TONICS, spell, tonicPitch } from './keys.ts';
import type { Hand, HandSelection, SpelledPitch } from './score.ts';
import { isTechnique, isTechniqueExercise, techniqueNotes, techniqueRules } from './technique.ts';

// The keys themselves (tonics, spelling, key signatures) are in keys.ts; they are exported from
// here too, for the pages that work with exercises.
export {
  CHROMATIC_TONICS,
  keyAlters,
  keySignature,
  MAJOR_TONICS,
  MINOR_TONICS,
  scaleDegree,
  SIGNATURE_FIFTHS,
  signatureTonic,
  tonicPitch,
} from './keys.ts';

/** Where the fingering comes from, for the page and the credits. */
export const FINGERING_SOURCE = HANON_EDITION;

export const SCALE_HANDS: readonly ScaleHands[] = ['right', 'left', 'both', 'contrary'];

/**
 * Contrary motion from a unison tonic is offered for the majors, the harmonic minors and the
 * chromatic scale, as graded exams set it; up to three octaves, since from a tonic near middle C
 * a fourth would leave the keyboard (docs/SCALES.md, "Clarifications (decided during S5)").
 */
export const CONTRARY_TYPES: readonly ScaleType[] = ['major', 'harmonicMinor', 'chromatic'];
export const CONTRARY_MAX_OCTAVES = 3;

/** An arpeggio: the root-position triad of the key, up and down. */
export function isArpeggio(type: ExerciseType): boolean {
  return type === 'majorArpeggio' || type === 'minorArpeggio';
}

/**
 * Whether the exercise can be played so: contrary motion only for some scales and octaves; a
 * technique exercise with the hands and octaves it offers.
 */
export function handsAllowed(
  e: Pick<ScaleExercise, 'type' | 'octaves'>,
  hands: ScaleHands,
): boolean {
  if (isTechnique(e.type)) {
    const rules = techniqueRules(e.type);
    return rules.hands.includes(hands) && rules.octaves.includes(e.octaves);
  }
  return (
    hands !== 'contrary' ||
    ((CONTRARY_TYPES as readonly ExerciseType[]).includes(e.type) &&
      e.octaves <= CONTRARY_MAX_OCTAVES)
  );
}

/** The octaves an exercise can take: 1–4 for a scale, a technique exercise's own. */
export function octavesOf(type: ExerciseType): readonly ScaleExercise['octaves'][] {
  return isTechnique(type) ? techniqueRules(type).octaves : SCALE_OCTAVES;
}

/** The hands that play, for the score and the keyboard: contrary motion is both. */
export function handsPlaying(hands: ScaleHands): HandSelection {
  return hands === 'contrary' ? 'both' : hands;
}

/** The keys an exercise's form is offered in: a technique form may take fewer (Hanon's trill: C). */
export function tonicsFor(type: ExerciseType, variant: string | undefined): readonly Tonic[] {
  if (isTechnique(type)) {
    const rules = techniqueRules(type);
    return rules.tonicsOf ? rules.tonicsOf(variant) : rules.tonics;
  }
  return tonicsOf(type);
}

export function tonicsOf(type: ExerciseType): readonly Tonic[] {
  if (isTechnique(type)) return techniqueRules(type).tonics;
  if (type === 'major' || type === 'majorArpeggio') return MAJOR_TONICS;
  if (type === 'chromatic') return CHROMATIC_TONICS;
  return MINOR_TONICS;
}

/** `major:D:2:both`; a technique exercise's form last: `hanon:C:2:both:1`. */
export function exerciseKey(e: ScaleExercise): string {
  const key = `${e.type}:${e.tonic}:${e.octaves}:${e.hands}`;
  return e.variant === undefined ? key : `${key}:${e.variant}`;
}

export function isScaleExercise(value: unknown): value is ScaleExercise {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const e = value as Record<string, unknown>;
  const fields = Object.keys(e).length;
  if (
    !(EXERCISE_TYPES as readonly unknown[]).includes(e.type) ||
    typeof e.tonic !== 'string' ||
    !(SCALE_OCTAVES as readonly unknown[]).includes(e.octaves) ||
    !(SCALE_HANDS as readonly unknown[]).includes(e.hands)
  )
    return false;
  const type = e.type as ExerciseType;
  if (isTechnique(type))
    return (
      fields === ('variant' in e ? 5 : 4) &&
      isTechniqueExercise({
        type,
        tonic: e.tonic,
        octaves: e.octaves,
        hands: e.hands,
        variant: e.variant,
      })
    );
  return (
    fields === 4 &&
    tonicsOf(type).includes(e.tonic) &&
    handsAllowed(e as unknown as ScaleExercise, e.hands as ScaleHands)
  );
}

/** The exercise a key names, or null for anything that is not exactly such a key. */
export function parseExerciseKey(key: string): ScaleExercise | null {
  const parts = key.split(':');
  if (parts.length !== 4 && parts.length !== 5) return null;
  const [type, tonic, octaves, hands, variant] = parts as [string, string, string, string, string?];
  if (!/^[1-9]$/.test(octaves)) return null;
  const e = {
    type,
    tonic,
    octaves: Number(octaves),
    hands,
    ...(variant !== undefined && { variant }),
  };
  return isScaleExercise(e) ? e : null;
}

/** Notes per octave: 7, 12 for the chromatic scale, 3 for an arpeggio. */
export function notesPerOctave(type: ScaleType): number {
  return type === 'chromatic' ? 12 : isArpeggio(type) ? 3 : 7;
}

// Range ---------------------------------------------------------------------------------------

/**
 * The lowest key the right hand may start on: C4 for one and two octaves, C3 for three and four
 * (Hanon's own starting octave: C3–C7, D3–D7). Every run then lies within A0–C8.
 */
export function rightHandFloor(octaves: number): number {
  return octaves <= 2 ? 60 : 48;
}

/**
 * Contrary motion starts both hands on one tonic, the one from A3 to G♯4: near middle C, and three
 * octaves either way from it stay within A0–C8.
 */
export const UNISON_FLOOR = 57;

/**
 * The tonic each hand starts on: the right hand on the lowest tonic at or above its floor, the
 * left an octave lower. Hands separate start where they would in hands together. In contrary
 * motion both start on the same tonic, the lowest at or above `UNISON_FLOOR`.
 */
export function startingTonics(
  e: Pick<ScaleExercise, 'tonic' | 'octaves'> & { hands?: ScaleHands },
): {
  right: SpelledPitch;
  left: SpelledPitch;
} {
  if (e.hands === 'contrary') {
    let unison = tonicPitch(e.tonic, 4);
    while (midiOf(unison) < UNISON_FLOOR) unison = { ...unison, octave: unison.octave + 1 };
    while (midiOf(unison) >= UNISON_FLOOR + 12) unison = { ...unison, octave: unison.octave - 1 };
    return { right: unison, left: unison };
  }
  const floor = rightHandFloor(e.octaves);
  let right = tonicPitch(e.tonic, 4);
  while (midiOf(right) < floor) right = { ...right, octave: right.octave + 1 };
  while (midiOf(right) >= floor + 12) right = { ...right, octave: right.octave - 1 };
  return { right, left: { ...right, octave: right.octave - 1 } };
}

// Fingering -----------------------------------------------------------------------------------

type Runs = HanonRuns;

const digits = (run: string): number[] => [...run.replace(/ /g, '')].map(Number);

/**
 * The longest stretch where the run repeats itself one octave on: `run[j] === run[j + period]`
 * for every j from `from` to `to`.
 */
function periodicStretch(run: readonly number[], period: number): { from: number; to: number } {
  let best = { from: 0, to: -1 };
  let from = 0;
  for (let j = 0; j + period < run.length; j++) {
    if (run[j] !== run[j + period]) {
      from = j + 1;
      continue;
    }
    if (j - from > best.to - best.from) best = { from, to: j };
  }
  return best;
}

/**
 * Hanon's four-octave run (up or down) cut to `octaves`. His start and his end (the approach to
 * the top going up, the close going down) are kept, and whole octaves come out of the middle,
 * where his fingering repeats every octave: finger i is his finger i before the seam and his
 * finger i + (octaves taken out) × period after it. The seam is the first note (after the first)
 * from which the run is periodic; it is checked that it lies far enough from his end that every
 * pair of neighbouring fingers in the result is a pair he prints on the same degrees.
 */
export function shortenRun(run: readonly number[], period: number, octaves: number): number[] {
  const cut = period * (4 - octaves);
  if (run.length !== 4 * period + 1)
    throw new Error(`a four-octave run has ${4 * period + 1} notes`);
  if (cut === 0) return [...run];
  const { from, to } = periodicStretch(run, period);
  const seam = Math.max(1, from);
  if (seam + cut > to + period)
    throw new Error(`fingering ${run.join('')} is not periodic enough for ${octaves} octave(s)`);
  return [...run.slice(0, seam), ...run.slice(seam + cut)];
}

function hanonScale(type: ScaleType, tonic: Tonic): Runs | null {
  if (type === 'majorArpeggio' || type === 'minorArpeggio') {
    // F♯ major as G♭, as for the scale; No. 41 has every other key under our spelling.
    const key = type === 'majorArpeggio' && tonic === 'F#' ? 'Gb' : tonic;
    const mode = type === 'majorArpeggio' ? 'major' : 'minor';
    return HANON_ARPEGGIOS.find((a) => a.key === key && a.mode === mode) ?? null;
  }
  if (type === 'naturalMinor' || type === 'chromatic') return null;
  // F♯ major is played on the keys of Hanon's G♭ major.
  const key = type === 'major' && tonic === 'F#' ? 'Gb' : tonic;
  return HANON_SCALES.find((s) => s.key === key && s.mode === type) ?? null;
}

/**
 * Chromatic fingering per pitch class (0 = C), hand and direction, from the middle octaves of
 * Hanon's chromatic scale at the octave (his second and third octaves, which agree).
 */
export const CHROMATIC_FINGERS: Readonly<Record<keyof Runs, readonly number[]>> = (() => {
  const out = {} as Record<keyof Runs, number[]>;
  for (const run of ['rightUp', 'rightDown', 'leftUp', 'leftDown'] as const) {
    const fingers = digits(HANON_CHROMATIC[run]);
    const up = run.endsWith('Up');
    const table: number[] = [];
    for (let j = 12; j < 36; j++) {
      // Going up, note j is j semitones above C; going down, j semitones below the top C.
      const pc = up ? j % 12 : (12 - (j % 12)) % 12;
      if (table[pc] !== undefined && table[pc] !== fingers[j])
        throw new Error(`chromatic ${run}: the middle octaves disagree`);
      table[pc] = fingers[j]!;
    }
    out[run] = table;
  }
  return out;
})();

/** Up (tonic to top) and down (top to tonic) fingers of one hand, or null without fingering. */
export function scaleFingering(
  e: Pick<ScaleExercise, 'tonic' | 'octaves'> & { type: ScaleType },
  hand: Hand,
): { up: number[]; down: number[] } | null {
  const upRun = hand === 'right' ? 'rightUp' : 'leftUp';
  const downRun = hand === 'right' ? 'rightDown' : 'leftDown';
  if (e.type === 'chromatic') {
    if (e.tonic === 'C')
      return {
        up: shortenRun(digits(HANON_CHROMATIC[upRun]), 12, e.octaves),
        down: shortenRun(digits(HANON_CHROMATIC[downRun]), 12, e.octaves),
      };
    // Elsewhere the per-key table, the start, the top and the close included.
    const tonic = midiOf(tonicPitch(e.tonic, 4)) % 12;
    const length = 12 * e.octaves + 1;
    return {
      up: Array.from({ length }, (_, i) => CHROMATIC_FINGERS[upRun][(tonic + i) % 12]!),
      down: Array.from({ length }, (_, i) => CHROMATIC_FINGERS[downRun][(tonic + 144 - i) % 12]!),
    };
  }
  const runs = hanonScale(e.type, e.tonic);
  if (!runs) return null;
  const period = notesPerOctave(e.type);
  return {
    up: shortenRun(digits(runs[upRun]), period, e.octaves),
    down: shortenRun(digits(runs[downRun]), period, e.octaves),
  };
}

/**
 * Crossings from the fingers: the thumb passing under (a 1 after another finger, right hand up
 * or left hand down) or a finger crossing over it (3, 4 or 5 right after a 1 the other way).
 */
function crossingOf(hand: Hand, dir: Direction, finger: number | null, previous: number | null) {
  if (finger === null || previous === null) return null;
  const thumbUnder = (hand === 'right') === (dir === 'up');
  if (thumbUnder) return finger === 1 && previous !== 1 ? 'thumbUnder' : null;
  return finger >= 3 && previous === 1 ? 'fingerOver' : null;
}

/**
 * One hand's run from `tonic`: up and back down, or, `descending` (the left hand in contrary
 * motion), down to the tonic `octaves` below and back up. The fingering is the hand's own each
 * way (`scaleFingering`'s up from the lowest tonic, down from the top), so the left hand in
 * contrary motion plays its descent and then its ascent: every pair of neighbouring fingers is one
 * Hanon prints on the same notes in the same direction.
 */
function handRun(
  e: ScaleExercise & { type: ScaleType },
  hand: Hand,
  tonic: SpelledPitch,
  descending = false,
): ScaleNote[] {
  const period = notesPerOctave(e.type);
  const top = period * e.octaves;
  const fingering = scaleFingering(e, hand);
  const lowest = descending ? { ...tonic, octave: tonic.octave - e.octaves } : tonic;
  const notes: ScaleNote[] = [];
  for (let index = 0; index <= 2 * top; index++) {
    const first = index <= top;
    const direction: Direction = first === !descending ? 'up' : 'down';
    // Steps above the lowest tonic.
    const position = descending ? Math.abs(top - index) : first ? index : 2 * top - index;
    const pitch = spell(e.type, lowest, position, direction);
    const finger = fingering
      ? direction === 'down'
        ? fingering.down[descending ? index : index - top]!
        : fingering.up[descending ? index - top : index]!
      : null;
    const crossing: Crossing = crossingOf(hand, direction, finger, notes.at(-1)?.finger ?? null);
    notes.push({
      hand,
      index,
      pitch,
      midi: midiOf(pitch),
      finger,
      direction,
      turn: index === top,
      degree: position % period,
      crossing,
    });
  }
  return notes;
}

/**
 * The lowest and the highest key an exercise plays, its hands together: what tells whether it
 * stays on the player's keyboard (docs/PERSONAL.md, "The instrument's keys").
 */
export function exerciseSpan(e: ScaleExercise): [lowest: number, highest: number] {
  const { right, left } = scaleNotes(e);
  let lowest = Infinity;
  let highest = -Infinity;
  for (const note of [...right, ...left]) {
    lowest = Math.min(lowest, note.midi);
    highest = Math.max(highest, note.midi);
  }
  return [lowest, highest];
}

/**
 * Each hand's run, up and back down (the left hand down and back up in contrary motion), the
 * turning note once; empty for a hand not played.
 */
export function scaleNotes(e: ScaleExercise): { right: ScaleNote[]; left: ScaleNote[] } {
  if (!isScaleExercise(e)) throw new Error(`not a scale exercise: ${JSON.stringify(e)}`);
  if (isTechnique(e.type)) return techniqueNotes({ ...e, type: e.type });
  const scale = { ...e, type: e.type };
  const tonics = startingTonics(e);
  return {
    right: e.hands === 'left' ? [] : handRun(scale, 'right', tonics.right),
    left: e.hands === 'right' ? [] : handRun(scale, 'left', tonics.left, e.hands === 'contrary'),
  };
}
