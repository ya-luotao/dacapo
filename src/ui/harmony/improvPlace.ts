import { useCallback, useSyncExternalStore } from 'react';
import type { ImprovPlan } from '../../core/improv.ts';
import type { ImprovController } from './improvController.ts';

// Where Improvise's loop is, for its screens.

/** C3 to C7: the player's register and an octave below it. */
export const IMPROV_KEYS: readonly [number, number] = [48, 96];

/** Where the loop is: a bar from 0 (the count-in is before it) and its beat from 1. */
export interface LoopPlace {
  bar: number;
  beat: number;
  /** The count-in's beat (1–4), or null once the loop has begun. */
  countIn: number | null;
}

/** The place `ms` after time 0 (negative in the count-in). */
export function loopPlace(plan: ImprovPlan, ms: number | null): LoopPlace {
  if (ms === null || ms < 0) {
    const beats = ms === null ? -4 : Math.floor(ms / plan.beatMs);
    return { bar: 0, beat: 1, countIn: ms === null ? null : Math.max(1, beats + 5) };
  }
  const bar = Math.floor(ms / plan.barMs);
  return { bar, beat: Math.floor((ms - bar * plan.barMs) / plan.beatMs) + 1, countIn: null };
}

/** The beat heard now (from time 0, negative in the count-in), or null: for `useSyncExternalStore`. */
export function useBeat(controller: ImprovController, plan: ImprovPlan | null): number | null {
  const snapshot = useCallback(() => {
    const at = controller.position();
    return at === null || !plan ? null : Math.floor(at / plan.beatMs);
  }, [controller, plan]);
  return useSyncExternalStore(controller.subscribeBeat, snapshot);
}

/** Where the loop is, a beat at a time. */
export function useLoopPlace(controller: ImprovController, plan: ImprovPlan): LoopPlace {
  const beat = useBeat(controller, plan);
  // A hair into the beat, so its own bar is taken however the division rounds.
  return loopPlace(plan, beat === null ? null : beat * plan.beatMs + 1);
}
