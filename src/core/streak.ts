// Daily practice totals and streaks, by local calendar date. A session counts for the date on which
// it started. Dates are `YYYY-MM-DD` strings and day arithmetic works on the calendar, never on
// 24-hour steps, so days with a daylight-saving change (23 or 25 hours) are one day like any other.

/** A day counts towards the streak with at least this much practice. */
export const STREAK_GOAL_MS = 5 * 60_000;
export const HISTORY_DAYS = 30;
/** Columns of the year grid: a year of whole weeks, plus the one under way. */
export const GRID_WEEKS = 53;

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

/** The weekday of a date, ISO-numbered as `Intl.Locale` week info is: 1 is Monday, 7 is Sunday. */
export function weekday(day: DayKey): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d)).getUTCDay() || 7;
}

/**
 * How much practice a day had, for the year grid: 0 none, 1 some but short of the goal, 2 the
 * goal, 3 three times it, 4 six times it. The break between 1 and 2 is the streak's, so the grid
 * and the bar chart agree on which days count.
 */
export type PracticeLevel = 0 | 1 | 2 | 3 | 4;
export const LEVEL_GOALS = [1, 3, 6] as const;

export function practiceLevel(ms: number, goalMs = STREAK_GOAL_MS): PracticeLevel {
  if (ms <= 0) return 0;
  if (ms < goalMs * LEVEL_GOALS[0]) return 1;
  if (ms < goalMs * LEVEL_GOALS[1]) return 2;
  if (ms < goalMs * LEVEL_GOALS[2]) return 3;
  return 4;
}

/**
 * The last `weeks` calendar weeks up to and including today's, oldest first, as columns of seven
 * days starting on `firstDay` (1 Monday … 7 Sunday). The days after today are null.
 */
export function yearGrid(
  totals: ReadonlyMap<DayKey, number>,
  today: DayKey,
  { weeks = GRID_WEEKS, firstDay = 7 }: { weeks?: number; firstDay?: number } = {},
): (DayTotal | null)[][] {
  const weekStart = addDays(today, -((weekday(today) - firstDay + 7) % 7));
  let day = addDays(weekStart, -7 * (weeks - 1));
  const columns: (DayTotal | null)[][] = [];
  for (let w = 0; w < weeks; w++) {
    const column: (DayTotal | null)[] = [];
    for (let i = 0; i < 7; i++) {
      column.push(day > today ? null : { day, ms: totals.get(day) ?? 0 });
      day = addDays(day, 1);
    }
    columns.push(column);
  }
  return columns;
}

/**
 * Where to label the months of a `yearGrid`: column → the first day of the column in which a
 * month begins. A label needs `room` columns before the next one or they collide, so the earlier
 * of two close labels is dropped; the last one is always kept, as the month under way.
 */
export function monthStarts(
  columns: readonly (readonly (DayTotal | null)[])[],
  room = 3,
): Map<number, DayKey> {
  const starts: [number, DayKey][] = [];
  columns.forEach((column, c) => {
    const first = column[0]!.day;
    if (c === 0 || first.slice(0, 7) !== columns[c - 1]![0]!.day.slice(0, 7)) {
      starts.push([c, first]);
    }
  });
  return new Map(
    starts.filter(([c], i) => i === starts.length - 1 || starts[i + 1]![0] - c >= room),
  );
}

export interface MonthTotal {
  /** `YYYY-MM`. */
  month: string;
  /** Days with any practice. */
  practised: number;
  /** Days reaching the goal. */
  reached: number;
  ms: number;
}

/** `days` (in order) summed by calendar month, oldest first. */
export function monthTotals(days: readonly DayTotal[], goalMs = STREAK_GOAL_MS): MonthTotal[] {
  const months: MonthTotal[] = [];
  for (const { day, ms } of days) {
    const month = day.slice(0, 7);
    let last = months.at(-1);
    if (last?.month !== month) {
      last = { month, practised: 0, reached: 0, ms: 0 };
      months.push(last);
    }
    if (ms > 0) last.practised++;
    if (ms >= goalMs) last.reached++;
    last.ms += ms;
  }
  return months;
}

export interface PracticeLog {
  today: DayKey;
  todayMs: number;
  currentStreak: number;
  longestStreak: number;
  history: DayTotal[];
  /** Practice per local date, for charts over a longer span than `history`. */
  totals: ReadonlyMap<DayKey, number>;
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
    totals,
  };
}
