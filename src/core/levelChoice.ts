// The level a family's setup opens on (docs/LEARN.md, "The level last chosen is kept"). Each
// family of Read, Ear and Harmony remembers the level picked last, in the browser with its other
// choices, and opens on it until it is mastered; then it opens on the level its page suggests
// again. A page opened with settings (a task, a lesson's button, today's plan) takes those
// instead, and what it was opened on is not kept unless a level is then picked.

/**
 * The level to open on: the one kept, while it is one of the family's levels and not mastered;
 * else the level suggested (nothing kept, a level this build does not have, or one mastered
 * since it was picked).
 */
export function openingLevel<T extends string>(
  kept: string | null | undefined,
  suggested: T,
  levels: readonly T[],
  mastered: (level: T) => boolean,
): T {
  const level = levels.find((id) => id === kept);
  return level !== undefined && !mastered(level) ? level : suggested;
}

/** The levels kept, by family, as they were stored: only strings under the families given. */
export function keptLevels<F extends string>(
  value: unknown,
  families: readonly F[],
): Partial<Record<F, string>> {
  const kept: Partial<Record<F, string>> = {};
  if (typeof value !== 'object' || value === null) return kept;
  for (const family of families) {
    const level = (value as Record<string, unknown>)[family];
    if (typeof level === 'string' && level.length > 0 && level.length <= 64) kept[family] = level;
  }
  return kept;
}
