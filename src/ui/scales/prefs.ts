import { exerciseKey, parseExerciseKey } from '../../core/scales.ts';
import type { ScaleExercise } from '../../core/scaleTypes.ts';
import { readPref, writePref } from '../../lib/localPrefs.ts';

export const EXERCISE_PREF = 'dacapo.scales.exercise';

/** Hands together comes with S3: until then an exercise is one hand. */
export const DEFAULT_EXERCISE: ScaleExercise = {
  type: 'major',
  tonic: 'C',
  octaves: 2,
  hands: 'right',
};

/** The last exercise chosen in this browser. */
export function readExercise(): ScaleExercise {
  const stored = parseExerciseKey(readPref(EXERCISE_PREF) ?? '');
  return stored && stored.hands !== 'both' ? stored : DEFAULT_EXERCISE;
}

export function writeExercise(e: ScaleExercise): void {
  writePref(EXERCISE_PREF, exerciseKey(e));
}
