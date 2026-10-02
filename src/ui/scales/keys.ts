import { useCallback } from 'react';
import { fitsKeys, isFullKeys } from '../../core/instrument.ts';
import { exerciseSpan } from '../../core/scales.ts';
import type { ScaleExercise } from '../../core/scaleTypes.ts';
import { useInstrumentKeys } from '../instrument.ts';

/**
 * Whether an exercise runs beyond the player's keyboard (docs/PERSONAL.md, "The instrument's
 * keys"): its setup marks it, and it is not proposed as the scale to play next. Never with 88
 * keys; an exercise that does not exist (octaves or hands its type does not have) runs nowhere.
 */
export function useBeyondKeyboard(): (exercise: ScaleExercise) => boolean {
  const keys = useInstrumentKeys();
  return useCallback(
    (exercise) => {
      if (isFullKeys(keys)) return false;
      try {
        return !fitsKeys(exerciseSpan(exercise), keys);
      } catch {
        return false;
      }
    },
    [keys],
  );
}
