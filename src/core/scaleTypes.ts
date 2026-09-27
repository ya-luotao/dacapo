// The shapes shared by the scale exercises (scales.ts) and their analysis (evenness.ts), so each
// can be built and tested on its own. See docs/SCALES.md.

import type { Hand, SpelledPitch } from './score.ts';

export const SCALE_TYPES = [
  'major',
  'naturalMinor',
  'harmonicMinor',
  'melodicMinor',
  'chromatic',
] as const;
export type ScaleType = (typeof SCALE_TYPES)[number];

export const SCALE_OCTAVES = [1, 2, 3, 4] as const;
export type ScaleOctaves = (typeof SCALE_OCTAVES)[number];

export type ScaleHands = Hand | 'both';

/** A tonic as a letter and an accidental, e.g. `C`, `F#`, `Eb`. */
export type Tonic = string;

/** What to play. Plain data, so it can be stored and compared. */
export interface ScaleExercise {
  type: ScaleType;
  tonic: Tonic;
  octaves: ScaleOctaves;
  hands: ScaleHands;
}

export type Direction = 'up' | 'down';

/**
 * Where the hand shifts: the thumb passing under (right hand going up, left hand going down) or a
 * finger crossing over the thumb (right hand going down, left hand going up). Null elsewhere and
 * without fingering.
 */
export type Crossing = 'thumbUnder' | 'fingerOver' | null;

/** One note of one hand's run, in the order played: up from the tonic, then back down to it. */
export interface ScaleNote {
  hand: Hand;
  /** Position in this hand's run, from 0. */
  index: number;
  pitch: SpelledPitch;
  midi: number;
  /** 1–5, or null when the scale has no sourced fingering. */
  finger: number | null;
  /** The top note is the last note going up; the notes after it go down. */
  direction: Direction;
  /** The top note, where the run turns. */
  turn: boolean;
  /** Scale degree from the tonic, 0-based: 0–6, or 0–11 for the chromatic scale. */
  degree: number;
  crossing: Crossing;
}
