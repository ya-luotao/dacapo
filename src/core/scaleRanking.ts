// Progress on the scales, per exercise: how even the runs have been lately and over the weeks
// (from the headline figures the sessions keep, so the list needs no raw run), and which exercise
// to play next. See docs/SCALES.md, "Records and progress". Kept apart from the places over runs
// (scaleProgress.ts), which re-analyse raw runs with the exercises' rules (core/scales.ts): what
// only ranks exercises (today's plan on the home page, docs/TODAY.md) loads without them.

import { runFigures, type HandFigures } from './evenness.ts';
import type { SessionRecord } from './log.ts';
import { quantile } from './robust.ts';
import type { ScaleRunSummary } from './scaleRecords.ts';
import { addDays, dayKey, type DayKey } from './streak.ts';

/** The trend covers the last this many calendar days, today included (the spec's 30). */
export const TREND_DAYS = 30;
/** A day is never longer than this, even across a clock change: enough margin for the window. */
const DAY_MS = 25 * 60 * 60 * 1000;
/**
 * Exercises are ranked on their last this many runs: enough that one warm-up or one lucky run
 * does not decide, few enough that practice shows within a session or two (the Pieces heatmap
 * judges a bar on its last 5 runs too).
 */
export const RECENT_RUNS = 5;
/**
 * The suggestion is picked among exercises played in the last this many calendar days: what the
 * player is working on now, not a scale tried once a season ago.
 */
export const SUGGEST_DAYS = 14;

export interface ExerciseProgress {
  /** `exerciseKey`. */
  exercise: string;
  /** Runs recorded, old analysis versions included. */
  runs: number;
  /** Epoch ms of the latest run's first key. */
  lastAt: number;
  /** The latest run's figures; null when they were computed by another `ANALYSIS_VERSION`. */
  latest: HandFigures | null;
  /**
   * The lowest spread of a run that is not rough, and when (the earliest run to reach it); when
   * every run is rough (one octave), the lowest rough one, marked so.
   */
  best: { spread: number; spreadShare: number | null; at: number; rough: boolean } | null;
  /** Median figures per local day, on the days of the last `TREND_DAYS` with runs, oldest first. */
  days: { day: DayKey; spread: number; spreadShare: number | null; runs: number }[];
  /** The median spread share of the last `RECENT_RUNS` runs that have one; ranks the list. */
  recentShare: number | null;
}

const median = (values: readonly number[]) => quantile(values, 0.5);

/**
 * Every exercise played, weakest first (`byWeakness`). A rough run (one octave, or two with
 * several slips) is the best only when no run is not rough: a single rough run's spread can be
 * half or twice what the player does, which is just where "best" would pick it, so it is marked
 * rough — and a one-octave exercise, rough every time, still has one. A median over a day or over
 * `RECENT_RUNS` runs tames the noise, so rough runs count for the trend and the rank.
 */
export function scaleProgress(
  sessions: readonly SessionRecord[],
  now: number,
  timeZone?: string,
): ExerciseProgress[] {
  const byExercise = new Map<string, ScaleRunSummary[]>();
  for (const session of sessions) {
    if (session.kind !== 'scale') continue;
    for (const run of session.runs) {
      const list = byExercise.get(run.exercise);
      if (list) list.push(run);
      else byExercise.set(run.exercise, [run]);
    }
  }
  const today = dayKey(now, timeZone);
  const firstDay = addDays(today, -(TREND_DAYS - 1));

  const progress: ExerciseProgress[] = [];
  for (const [exercise, list] of byExercise) {
    const runs = [...list].sort(
      (a, b) => a.startedAt - b.startedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
    const figured = runs.map((run) => ({ run, figures: runFigures(run.headline) }));
    const withSpread = figured.flatMap(({ run, figures }) =>
      figures?.spread != null ? [{ run, figures, spread: figures.spread }] : [],
    );

    const lowest = (rough: boolean): ExerciseProgress['best'] => {
      let found: ExerciseProgress['best'] = null;
      for (const { run, figures, spread } of withSpread) {
        if (figures.rough !== rough || (found && spread >= found.spread)) continue;
        found = { spread, spreadShare: figures.spreadShare, at: run.startedAt, rough };
      }
      return found;
    };
    const best = lowest(false) ?? lowest(true);

    const perDay = new Map<DayKey, { spreads: number[]; shares: number[] }>();
    for (const { run, figures, spread } of withSpread) {
      // Runs clearly before the window skip the day's name: `dayKey` (Intl) is the cost here.
      if (run.startedAt < now - (TREND_DAYS + 1) * DAY_MS) continue;
      const day = dayKey(run.startedAt, timeZone);
      if (day < firstDay || day > today) continue;
      let entry = perDay.get(day);
      if (!entry) perDay.set(day, (entry = { spreads: [], shares: [] }));
      entry.spreads.push(spread);
      if (figures.spreadShare !== null) entry.shares.push(figures.spreadShare);
    }
    const days = [...perDay]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([day, { spreads, shares }]) => ({
        day,
        spread: median(spreads)!,
        spreadShare: median(shares),
        runs: spreads.length,
      }));

    const shares = figured.flatMap(({ figures }) =>
      figures?.spreadShare != null ? [figures.spreadShare] : [],
    );
    const last = figured.at(-1)!;
    progress.push({
      exercise,
      runs: runs.length,
      lastAt: last.run.startedAt,
      latest: last.figures,
      best,
      days,
      recentShare: median(shares.slice(-RECENT_RUNS)),
    });
  }
  return progress.sort(byWeakness);
}

/**
 * Weakest first: the larger recent spread share first (least even for its note length, so a slow
 * scale and a fast one compare), exercises without one last, then the most recently played, then
 * by key so the order is total.
 */
export function byWeakness(a: ExerciseProgress, b: ExerciseProgress): number {
  if ((a.recentShare === null) !== (b.recentShare === null)) return a.recentShare === null ? 1 : -1;
  return (
    (b.recentShare ?? 0) - (a.recentShare ?? 0) ||
    b.lastAt - a.lastAt ||
    (a.exercise < b.exercise ? -1 : a.exercise > b.exercise ? 1 : 0)
  );
}

/**
 * The exercises played on one of the last `SUGGEST_DAYS` calendar days up to `today`: what the
 * player is working on now.
 */
export function playedLately(
  progress: readonly ExerciseProgress[],
  today: DayKey,
  timeZone?: string,
): ExerciseProgress[] {
  const since = addDays(today, -(SUGGEST_DAYS - 1));
  return progress.filter((p) => dayKey(p.lastAt, timeZone) >= since);
}

/**
 * What to play next: the weakest (`byWeakness`) of the exercises played on one of the last
 * `SUGGEST_DAYS` calendar days that have a recent figure. Null when there is none: an exercise
 * without figures cannot be called weak, and one left for weeks is the player's choice, not ours.
 * Nor is one that runs beyond the player's keyboard proposed (`fits`, docs/PERSONAL.md, "The
 * instrument's keys").
 */
export function suggestedExercise(
  progress: readonly ExerciseProgress[],
  now: number,
  timeZone?: string,
  fits?: (exercise: string) => boolean,
): string | null {
  return weakestLately(progress, dayKey(now, timeZone), timeZone, fits);
}

/** `suggestedExercise` for a calendar day: the plan of a day is made for the day, not an hour. */
export function weakestLately(
  progress: readonly ExerciseProgress[],
  today: DayKey,
  timeZone?: string,
  fits: (exercise: string) => boolean = () => true,
): string | null {
  const recent = playedLately(progress, today, timeZone).filter(
    (p) => p.recentShare !== null && fits(p.exercise),
  );
  return [...recent].sort(byWeakness)[0]?.exercise ?? null;
}
