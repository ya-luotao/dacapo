// Daily practice totals and streaks, by local calendar date. A session counts for the date on which
// it started. Dates are `YYYY-MM-DD` strings and day arithmetic works on the calendar, never on
// 24-hour steps, so days with a daylight-saving change (23 or 25 hours) are one day like any other.

/** A day counts towards the streak with at least this much practice. */
export const STREAK_GOAL_MS = 5 * 60_000;
export const HISTORY_DAYS = 30;

/** `YYYY-MM-DD` on the local calendar. */
export type DayKey = string;

export interface TimedSession {
  /** Epoch ms. */
  startedAt: number;
  activeMs: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string | undefined): Intl.DateTimeFormat {
  const cacheKey = timeZone ?? '';
  let formatter = formatters.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    formatters.set(cacheKey, formatter);
  }
  return formatter;
}

/** The calendar date of an instant in `timeZone` (an IANA name; the system zone when omitted). */
export function dayKey(epochMs: number, timeZone?: string): DayKey {
  const parts = formatterFor(timeZone).formatToParts(epochMs);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year').padStart(4, '0')}-${part('month')}-${part('day')}`;
}

/** `day` moved by `n` calendar days. */
export function addDays(day: DayKey, n: number): DayKey {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().slice(0, 10);
}

/** Practice per local date. */
export function dailyTotals(
  sessions: readonly TimedSession[],
  timeZone?: string,
): Map<DayKey, number> {
  const totals = new Map<DayKey, number>();
  for (const { startedAt, activeMs } of sessions) {
    const day = dayKey(startedAt, timeZone);
    totals.set(day, (totals.get(day) ?? 0) + activeMs);
  }
  return totals;
}

function reached(totals: ReadonlyMap<DayKey, number>, day: DayKey, goalMs: number): boolean {
  return (totals.get(day) ?? 0) >= goalMs;
}

/**
 * Consecutive days reaching the goal, ending today, or ending yesterday while today has not
 * reached it yet: the day is not over, so it does not break the streak.
 */
export function currentStreak(
  totals: ReadonlyMap<DayKey, number>,
  today: DayKey,
  goalMs = STREAK_GOAL_MS,
): number {
  let day = reached(totals, today, goalMs) ? today : addDays(today, -1);
  let streak = 0;
  while (reached(totals, day, goalMs)) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

export function longestStreak(
  totals: ReadonlyMap<DayKey, number>,
  goalMs = STREAK_GOAL_MS,
): number {
  const days = [...totals.keys()].filter((day) => reached(totals, day, goalMs)).sort();
  let longest = 0;
  let run = 0;
  let previous: DayKey | null = null;
  for (const day of days) {
    run = previous !== null && addDays(previous, 1) === day ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }
  return longest;
}

export interface DayTotal {
  day: DayKey;
  ms: number;
}

/** The last `days` dates up to and including today, oldest first; days without practice are 0. */
export function dayHistory(
  totals: ReadonlyMap<DayKey, number>,
  today: DayKey,
  days = HISTORY_DAYS,
): DayTotal[] {
  const history: DayTotal[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = addDays(today, -i);
    history.push({ day, ms: totals.get(day) ?? 0 });
  }
  return history;
}

export interface PracticeLog {
  today: DayKey;
  todayMs: number;
  currentStreak: number;
  longestStreak: number;
  history: DayTotal[];
}

export function practiceLog(
  sessions: readonly TimedSession[],
  { now, timeZone, days = HISTORY_DAYS }: { now: number; timeZone?: string; days?: number },
): PracticeLog {
  const totals = dailyTotals(sessions, timeZone);
  const today = dayKey(now, timeZone);
  return {
    today,
    todayMs: totals.get(today) ?? 0,
    currentStreak: currentStreak(totals, today),
    longestStreak: longestStreak(totals),
    history: dayHistory(totals, today, days),
  };
}
