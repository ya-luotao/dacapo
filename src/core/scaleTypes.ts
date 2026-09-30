// The shapes shared by the scale exercises (scales.ts) and their analysis (evenness.ts), so each
// can be built and tested on its own. See docs/SCALES.md.

import type { Hand, SpelledPitch } from './score.ts';

export const SCALE_TYPES = [
  'major',
  'naturalMinor',
  'harmonicMinor',
  'melodicMinor',
  'chromatic',
  'majorArpeggio',
  'minorArpeggio',
] as const;
/** The scales, and the arpeggios of the major and minor triad in root position (S5). */
export type ScaleType = (typeof SCALE_TYPES)[number];

/**
 * The technique exercises (docs/SCALES.md, "Technique"): the five-finger pattern, Hanon's Part I
 * (Nos. 1–20), and the key's triad in block and broken chords, each in major and minor where it
 * has a key (S6); Hanon's sevenths, repeated notes, trills, thirds and octaves, and a trill on any
 * pair of fingers (S7).
 */
export const TECHNIQUE_TYPES = [
  'majorFiveFinger',
  'minorFiveFinger',
  'hanon',
  'majorChords',
  'minorChords',
  'majorBrokenChords',
  'minorBrokenChords',
  'diminishedSevenths',
  'dominantSevenths',
  'repeatedNotes',
  'trill',
  'thirds',
  'octaves',
  'majorOctaves',
  'minorOctaves',
] as const;
export type TechniqueType = (typeof TECHNIQUE_TYPES)[number];

/** Every exercise of the Scales page: the scales and arpeggios, then the technique. */
export const EXERCISE_TYPES = [...SCALE_TYPES, ...TECHNIQUE_TYPES] as const;
export type ExerciseType = ScaleType | TechniqueType;

export const SCALE_OCTAVES = [1, 2, 3, 4] as const;
export type ScaleOctaves = (typeof SCALE_OCTAVES)[number];

/**
 * One hand; both an octave apart (parallel motion); or both from one unison tonic in contrary
 * motion, the right hand going up while the left goes down (S5).
 */
export type ScaleHands = Hand | 'both' | 'contrary';

/** A tonic as a letter and an accidental, e.g. `C`, `F#`, `Eb`. */
export type Tonic = string;

/**
 * What to play. Plain data, so it can be stored and compared. A technique exercise that has more
 * than one form in a key (Hanon's numbers) names it in `variant`; the others have none.
 */
export interface ScaleExercise {
  type: ExerciseType;
  tonic: Tonic;
  octaves: ScaleOctaves;
  hands: ScaleHands;
  variant?: string;
}

export type Direction = 'up' | 'down';

/**
 * Where the hand shifts: the thumb passing under (right hand going up, left hand going down) or a
 * finger crossing over the thumb (right hand going down, left hand going up). Null elsewhere and
 * without fingering.
 */
export type Crossing = 'thumbUnder' | 'fingerOver' | null;

/**
 * One note of one hand's run, in the order played: up from the tonic, then back down to it. The
 * keys of a chord (a technique exercise's block chords) are one step: they share `index`, lowest
 * first.
 */
export interface ScaleNote {
  hand: Hand;
  /** Position in this hand's run (its step), from 0. */
  index: number;
  pitch: SpelledPitch;
  midi: number;
  /** 1–5, or null when the scale has no sourced fingering. */
  finger: number | null;
  /**
   * The top note is the last note going up; the notes after it go down. In contrary motion the
   * left hand goes down first: its lowest note is the last going down, and it turns there.
   */
  direction: Direction;
  /** Where the run turns: its top note, or the left hand's lowest in contrary motion. */
  turn: boolean;
  /**
   * Degree from the tonic, 0-based: 0–6 in a scale, 0–11 in the chromatic scale, 0–2 in an
   * arpeggio (root, third, fifth). In a pattern (`pattern`), the note's place in its group.
   */
  degree: number;
  crossing: Crossing;
  /**
   * The run is a group of notes repeated a step higher and lower (Hanon's Part I, the broken
   * chords): `degree` is the note's place in its group, and a run's problem place is named by it,
   * as a scale's is by its crossings (docs/SCALES.md, "Clarifications (decided during S6)").
   */
  pattern?: true;
  /**
   * The finger is known but not written on the score: a trill on a chosen pair of fingers marks
   * them at the start of each bar, as Hanon marks his (the keyboard still shows every one).
   */
  unmarked?: true;
}

/**
 * A hand's run as steps: the notes of each index (one, or a chord's keys lowest first), in the
 * order of the run.
 */
export function stepsOf<T extends Pick<ScaleNote, 'index' | 'midi'>>(notes: readonly T[]): T[][] {
  const byIndex = new Map<number, T[]>();
  for (const note of notes) {
    const step = byIndex.get(note.index);
    if (step) step.push(note);
    else byIndex.set(note.index, [note]);
  }
  return [...byIndex.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, step]) => [...step].sort((a, b) => a.midi - b.midi));
}

/** Whether some step of the run is a chord (several keys struck together in one hand). */
export function hasChordSteps(notes: readonly Pick<ScaleNote, 'hand' | 'index'>[]): boolean {
  const seen = new Set<string>();
  for (const n of notes) {
    const key = `${n.hand}:${n.index}`;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}
