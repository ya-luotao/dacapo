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

/** Of `levels` in their order, the first not mastered from `floor` on; null once those all are. */
function firstFrom<L extends string>(
  levels: readonly { level: L; mastered: boolean }[],
  floor: L | null,
): L | null {
  const from = floor === null ? -1 : levels.findIndex((l) => l.level === floor);
  return levels.slice(Math.max(0, from)).find((l) => !l.mastered)?.level ?? null;
}

/**
 * What is left to master, for today's plan and "Where you are" (core/today.ts): the first level
 * not mastered from `floor` on, and once every level from the floor on is mastered, the first not
 * mastered below it; null once all are. The levels below a floor are not taken for mastered
 * (nothing was measured, docs/START.md): they are only passed over while a later one is left.
 */
export function firstNotMastered<L extends string>(
  levels: readonly { level: L; mastered: boolean }[],
  floor: L | null = null,
): L | null {
  return firstFrom(levels, floor) ?? firstFrom(levels, null);
}

/**
 * The level the page opens on: the first not mastered yet, or the last level once all are. With a
 * floor (where the reading of someone who plays already begins, docs/START.md), the later of the
 * two: the first not mastered from the floor on, and the last level once those all are. The
 * levels below the floor are not where the page opens. `progress` is in the levels' order.
 */
export function suggestedLevel(
  progress: readonly LevelProgress[],
  floor: LevelId | null = null,
): LevelId {
  return firstFrom(progress, floor) ?? LEVEL_IDS.at(-1)!;
}
