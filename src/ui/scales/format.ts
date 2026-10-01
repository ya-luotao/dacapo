import { useCallback } from 'react';
import { octavesOf } from '../../core/scales.ts';
import type { SpelledPitch } from '../../core/score.ts';
import { stepsOf, type ScaleExercise, type ScaleNote } from '../../core/scaleTypes.ts';
import { useT } from '../../i18n/index.ts';
import { tonicName, useExerciseName } from './exerciseName.ts';

// An exercise's name needs none of the exercises' rules: it is in exerciseName.ts, for the
// pages that load without them.
export { tonicName, useExerciseName };

const ACCIDENTALS: Record<number, string> = { [-2]: '𝄫', [-1]: '♭', 0: '', 1: '♯', 2: '𝄪' };

/** A written note as the scale spells it: `F𝄪5`, `E♭4`. */
export function spelledName(pitch: SpelledPitch): string {
  return `${pitch.step}${ACCIDENTALS[pitch.alter] ?? ''}${pitch.octave}`;
}

/**
 * Each step of a hand's run by name, as the chart, the table and the sentences name it: a note
 * (`F♯4`), or a chord's keys lowest first (`C4–E4–G4`). Indexed by step, as the figures are.
 */
export function stepNames(notes: readonly ScaleNote[]): string[] {
  return stepsOf(notes).map((step) => step.map((note) => spelledName(note.pitch)).join('–'));
}

/** A form of an exercise as its list of forms names it (Hanon's number, No. 45's fingering). */
export function useVariantName() {
  const t = useT();
  return (type: ScaleExercise['type'], variant: string) => {
    if (type === 'repeatedNotes') {
      const [n, k] = variant.split('.');
      return k
        ? t('scales.variant.fingering', { n: n ?? '', k })
        : t('scales.variant.number', { n: n ?? '' });
    }
    if (type === 'thirds')
      return t(variant === 'chromatic' ? 'scales.variant.chromatic' : 'scales.variant.scale');
    return variant;
  };
}

/** The scale as a page heading names it: its name, and "in contrary motion" when it is. */
export function useExerciseTitle() {
  const t = useT();
  const name = useExerciseName();
  return (e: Pick<ScaleExercise, 'type' | 'tonic' | 'hands' | 'variant'>) =>
    e.hands === 'contrary' ? t('scales.name.inContrary', { scale: name(e) }) : name(e);
}

/**
 * The exercise as a list names it: its name and octaves ("D major, 2 oct."), the name alone where
 * the exercise has one length (a five-finger pattern, Hanon's).
 */
export function useExerciseLabel() {
  const t = useT();
  const name = useExerciseName();
  return useCallback(
    (e: Pick<ScaleExercise, 'type' | 'tonic' | 'octaves' | 'variant'>) =>
      octavesOf(e.type).length > 1
        ? t('progress.session.scaleOne', { scale: name(e), octaves: e.octaves })
        : name(e),
    [t, name],
  );
}

/** A pattern's place names this many of its keys, then "…" (a group's place recurs every bar). */
export const PLACE_KEYS = 3;

/**
 * A place's keys by name for a sentence: each key once (a five-finger group repeats its keys), the
 * first `PLACE_KEYS` and "…" when there are more.
 */
export function fewKeys(names: readonly string[], separator: string): string {
  const unique = [...new Set(names)];
  return unique.length > PLACE_KEYS
    ? `${unique.slice(0, PLACE_KEYS).join(separator)}${separator}…`
    : unique.join(separator);
}
