import type { ScaleExercise } from '../../core/scaleTypes.ts';
import { tonicsFor } from '../../core/scales.ts';
import { isTechnique, techniqueRules } from '../../core/technique.ts';

/**
 * Step to the previous or next exercise along the active family's tonics
 * (around the circle of fifths for keys, or chromatic order) or numbered
 * variants when the family only uses one tonic. Returns `null` when only a
 * single exercise exists (such as Hanon No. 51 octaves).
 */
export function adjacentExercise(exercise: ScaleExercise, delta: -1 | 1): ScaleExercise | null {
  const tonics = tonicsFor(exercise.type, exercise.variant);
  if (tonics.length > 1) {
    const idx = tonics.indexOf(exercise.tonic);
    const current = idx >= 0 ? idx : 0;
    const nextIdx = (current + delta + tonics.length) % tonics.length;
    return { ...exercise, tonic: tonics[nextIdx]! };
  }

  const variants = isTechnique(exercise.type) ? techniqueRules(exercise.type).variants : [];
  if (variants.length > 1) {
    const idx = exercise.variant === undefined ? -1 : variants.indexOf(exercise.variant);
    const current = idx >= 0 ? idx : 0;
    const nextIdx = (current + delta + variants.length) % variants.length;
    const nextVariant = variants[nextIdx]!;
    const nextTonic = tonicsFor(exercise.type, nextVariant)[0] ?? exercise.tonic;
    return { ...exercise, variant: nextVariant, tonic: nextTonic };
  }

  return null;
}
