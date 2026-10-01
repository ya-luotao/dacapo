import {
  DEFAULT_PLAN_MINUTES,
  isPlanMinutes,
  PLAN_PARTS,
  planRows,
  type PlanMinutes,
  type TodayPlan,
} from '../../core/todayRecords.ts';
import type { DayKey } from '../../core/streak.ts';
import { readPref, writePref } from '../../lib/localPrefs.ts';

// What today's plan keeps in the browser (docs/TODAY.md): its length, the plan of the day, and
// whether the visitor has practised here before. Kept per device like the other preferences,
// never synced or exported. This file is loaded at the start: it reads the kept plan only as far
// as the home page needs to lay itself out; today.ts reads it in full, checking every field.

const RETURNING_KEY = 'dacapo.returning';
const MINUTES_KEY = 'dacapo.today.minutes';
const PLAN_KEY = 'dacapo.today';

/**
 * Whether someone has practised here before (a session stored, or a lesson ticked), as it was
 * last known: read before the records are, so the home page is laid out right at once.
 */
export function readReturning(): boolean {
  return readPref(RETURNING_KEY) === '1';
}

export function writeReturning(returning: boolean): void {
  if (returning !== readReturning()) writePref(RETURNING_KEY, returning ? '1' : null);
}

/** The length chosen for the plan: 20 minutes unless chosen. */
export function readPlanMinutes(): PlanMinutes {
  const stored = Number(readPref(MINUTES_KEY) ?? '');
  return isPlanMinutes(stored) ? stored : DEFAULT_PLAN_MINUTES;
}

export function writePlanMinutes(minutes: PlanMinutes): void {
  writePref(MINUTES_KEY, String(minutes));
}

/** The kept plan as it was written, unchecked; null when there is none that can be read. */
export function readKeptPlan(): unknown {
  try {
    return JSON.parse(readPref(PLAN_KEY) ?? 'null');
  } catch {
    return null;
  }
}

export function writeKeptPlan(plan: TodayPlan): void {
  writePref(PLAN_KEY, JSON.stringify(plan));
}

/** More rows than any plan has: what was kept is not trusted to be a plan. */
const MAX_ROWS = 12;

/**
 * The room to keep while the plan's rules load, as rows and the parts they begin (a part is
 * named above its first row on a phone): those of the kept plan when it is today's at this
 * length (it is then the plan shown), else as many as the last plan of this length had, else the
 * most a plan of this length has.
 */
export function keptRoom(today: DayKey, minutes: PlanMinutes): { rows: number; parts: number } {
  const most = { rows: planRows(minutes), parts: PLAN_PARTS.length };
  const kept = readKeptPlan();
  if (typeof kept !== 'object' || kept === null) return most;
  const { day, minutes: length, steps } = kept as Record<string, unknown>;
  if (length !== minutes || !Array.isArray(steps) || steps.length > MAX_ROWS) return most;
  if (steps.length === 0) return day === today ? { rows: 0, parts: 0 } : most;
  const parts = new Set(steps.map((step: unknown) => (step as { part?: unknown } | null)?.part));
  return { rows: steps.length, parts: Math.min(parts.size, PLAN_PARTS.length) };
}
