// The daily goal (docs/PERSONAL.md, "The daily goal"): how much practice a day needs to count
// towards the streak, chosen by the player. A change never rewrites the past: the goal is kept as
// its changes, each with the day it was made, and a day is judged by the goal in force on it. So
// a streak earned at five minutes stays earned when the goal becomes twenty. Pure, and loaded
// with the start: it needs the calendar of streak.ts and nothing else.

import { addDays, STREAK_GOAL_MS, type DayKey } from './streak.ts';

const MINUTE_MS = 60_000;

/** The goals to choose from, in minutes a day. */
export const GOAL_MINUTES = [5, 10, 15, 20, 30, 45] as const;
export type GoalMinutes = (typeof GOAL_MINUTES)[number];
/** The goal before any is chosen: the five minutes the streak has always asked for. */
export const DEFAULT_GOAL_MINUTES: GoalMinutes = 5;

/** A change of the goal: the day it was made (it counts from that day on) and the new goal. */
export type GoalChange = readonly [day: DayKey, minutes: GoalMinutes];
/**
 * The goal as its changes, oldest first, at most one a day. Before the first of them, and with
 * none, the goal is `DEFAULT_GOAL_MINUTES`.
 */
export type GoalHistory = readonly GoalChange[];

/** More changes than a preference holds: what was kept is not trusted to be a history. */
const MAX_CHANGES = 2000;

export function isGoalMinutes(value: unknown): value is GoalMinutes {
  return (GOAL_MINUTES as readonly unknown[]).includes(value);
}

/** A day of the calendar, written as streak.ts writes it. */
const isDay = (value: unknown): value is DayKey =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && addDays(value, 0) === value;

/**
 * A history read field by field: a list of `[day, minutes]`, each a day of the calendar and one
 * of `GOAL_MINUTES`. It comes back in order, the last of a day's changes kept; anything else is
 * null (an export file names it among what it could not read).
 */
export function parseGoalHistory(value: unknown): GoalHistory | null {
  if (!Array.isArray(value) || value.length > MAX_CHANGES) return null;
  const byDay = new Map<DayKey, GoalMinutes>();
  for (const change of value as unknown[]) {
    if (!Array.isArray(change) || change.length !== 2) return null;
    const [day, minutes] = change as unknown[];
    if (!isDay(day) || !isGoalMinutes(minutes)) return null;
    byDay.set(day, minutes);
  }
  return [...byDay].sort(([a], [b]) => (a < b ? -1 : 1));
}

/**
 * The history kept in the browser's preferences, read back: a damaged preference is no history,
 * and the goal is five minutes for every day, as before there was a choice.
 */
export function readGoalHistory(value: unknown): GoalHistory {
  return parseGoalHistory(value) ?? [];
}

/** The goal in force on `day`, in minutes: the last change made on that day or before it. */
export function goalOn(history: GoalHistory, day: DayKey): GoalMinutes {
  let minutes = DEFAULT_GOAL_MINUTES;
  for (const [from, goal] of history) {
    if (from > day) break;
    minutes = goal;
  }
  return minutes;
}

/** Each day's goal in ms, as the streak's rules take it (`DayGoal` in streak.ts). */
export function goalMsOn(history: GoalHistory): (day: DayKey) => number {
  if (history.length === 0) return () => STREAK_GOAL_MS;
  return (day) => goalOn(history, day) * MINUTE_MS;
}

/**
 * The history with the goal changed to `minutes` on `day`: the days before it keep the goal they
 * had. A second change on the same day takes the first one's place, and a change back to the goal
 * of the day before leaves no change at all. Changes dated after `day` (a clock that was set
 * back, a history brought from a device a day ahead) are dropped: the choice counts from today.
 */
export function withGoal(history: GoalHistory, day: DayKey, minutes: GoalMinutes): GoalHistory {
  const before = history.filter(([from]) => from < day);
  return goalOn(before, day) === minutes ? before : [...before, [day, minutes]];
}
