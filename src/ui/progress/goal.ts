import { useMemo, useState } from 'react';
import { goalMsOn, readGoalHistory, type GoalHistory } from '../../core/goal.ts';
import type { DayKey } from '../../core/streak.ts';
import { readPref, writePref } from '../../lib/localPrefs.ts';

// The daily goal as the browser keeps it (docs/PERSONAL.md, "The daily goal"): each change with
// its day, so a day is judged by the goal it had. Kept per device like the other preferences,
// exported with them and never synced. Loaded with the start: the home page's line towards the
// goal reads it.

const KEY = 'dacapo.goal';

/** The goal's changes; none when no goal was chosen, or when what was kept cannot be read. */
export function readGoal(): GoalHistory {
  try {
    return readGoalHistory(JSON.parse(readPref(KEY) ?? 'null'));
  } catch {
    return [];
  }
}

export function writeGoal(history: GoalHistory): void {
  writePref(KEY, history.length === 0 ? null : JSON.stringify(history));
}

/**
 * Each day's goal in ms, as it is when the page opens: the streak, the charts and the line
 * towards today's goal all judge a day through it.
 */
export function useGoal(): (day: DayKey) => number {
  const [history] = useState(readGoal);
  return useMemo(() => goalMsOn(history), [history]);
}
