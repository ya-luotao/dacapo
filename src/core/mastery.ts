import { LEVEL_IDS, type LevelId } from './levels.ts';
import { isTimed, median, type Attempt } from './session.ts';

export const MASTERY_WINDOW = 40;
export const MASTERY_ACCURACY = 0.9;
export const MASTERY_MEDIAN_MS = 2000;

export interface LevelProgress {
  level: LevelId;
  /** Every card ever answered at this level, hinted or not. */
  total: number;
  /** Un-hinted cards in the window (at most `MASTERY_WINDOW`). */
  cards: number;
  accuracy: number | null;
  medianMs: number | null;
  mastered: boolean;
}

/**
 * Mastery over the last `MASTERY_WINDOW` un-hinted cards of a level: a hinted card does not show
 * that the note was read. Needs a full window, ≥ 90 % correct and a median below 2 s over the
 * timely correct answers. `attempts` must be in the order they happened.
 */
export function levelProgress(attempts: readonly Attempt[], level: LevelId): LevelProgress {
  const ofLevel = attempts.filter((a) => a.level === level);
  const window = ofLevel.filter((a) => !a.hinted).slice(-MASTERY_WINDOW);
  const correct = window.filter((a) => a.correct).length;
  const accuracy = window.length > 0 ? correct / window.length : null;
  const medianMs = median(window.filter(isTimed).map((a) => a.ms));
  return {
    level,
    total: ofLevel.length,
    cards: window.length,
    accuracy,
    medianMs,
    mastered:
      window.length >= MASTERY_WINDOW &&
      accuracy !== null &&
      accuracy >= MASTERY_ACCURACY &&
      medianMs !== null &&
      medianMs < MASTERY_MEDIAN_MS,
  };
}

/** The first level not mastered yet, or the last level once all are. */
export function suggestedLevel(progress: readonly LevelProgress[]): LevelId {
  return progress.find((p) => !p.mastered)?.level ?? LEVEL_IDS.at(-1)!;
}
