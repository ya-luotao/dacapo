// Progress on the scales: per exercise, how even the runs have been lately and over the weeks
// (from the headline figures the sessions keep, so the list needs no raw run), which exercise to
// play next, and, over the last runs of one exercise (re-analysed from their raw notes), where the
// same place is off every time. See docs/SCALES.md, "Analysis → Where" and "Records and progress".

import {
  analyzeRun,
  ANALYSIS_VERSION,
  PROBLEM_MIN_MS,
  PROBLEM_MIN_Z,
  type RunHeadline,
} from './evenness.ts';
import type { SessionRecord } from './log.ts';
import { quantile } from './robust.ts';
import type { ScaleRunSummary, StoredScaleRun } from './scaleRecords.ts';
import { parseExerciseKey, scaleNotes } from './scales.ts';
import type { Crossing, Direction } from './scaleTypes.ts';
import type { Hand } from './score.ts';
import { addDays, dayKey, type DayKey } from './streak.ts';

// --- Progress per exercise -----------------------------------------------------------------------

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

/** The timing figures of one run, from its headline. */
export interface HandFigures {
  /** Ms; null with too few intervals. */
  spread: number | null;
  /** % of the median interval. */
  spreadShare: number | null;
  rough: boolean;
  hesitations: number;
}

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

/**
 * A run's figures are its hand's; hands together, the hand with the larger spread (the weaker hand
 * is what needs the practice; a hand without a spread gives way to one with). Null for figures of
 * another analysis version, which were computed by other rules and do not compare with today's:
 * such a run still counts as played (`runs`, `lastAt`), and its figures come back once it is
 * re-analysed from its raw notes. Recorded runs are scale runs; anything else has no figures.
 */
export function runFigures(headline: RunHeadline): HandFigures | null {
  if (headline.version !== ANALYSIS_VERSION || headline.quality !== 'ok') return null;
  let pick: RunHeadline['hands'][number] | null = null;
  for (const h of headline.hands) {
    if (!pick || (h.spread !== null && (pick.spread === null || h.spread > pick.spread))) pick = h;
  }
  if (!pick) return null;
  return {
    spread: pick.spread,
    spreadShare: pick.spreadShare,
    rough: pick.rough,
    hesitations: pick.hesitations,
  };
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
 * What to play next: the weakest (`byWeakness`) of the exercises played on one of the last
 * `SUGGEST_DAYS` calendar days that have a recent figure. Null when there is none: an exercise
 * without figures cannot be called weak, and one left for weeks is the player's choice, not ours.
 */
export function suggestedExercise(
  progress: readonly ExerciseProgress[],
  now: number,
  timeZone?: string,
): string | null {
  const since = addDays(dayKey(now, timeZone), -(SUGGEST_DAYS - 1));
  const recent = progress.filter(
    (p) => p.recentShare !== null && dayKey(p.lastAt, timeZone) >= since,
  );
  return [...recent].sort(byWeakness)[0]?.exercise ?? null;
}

// --- Places over runs ----------------------------------------------------------------------------

/** Over-run figures need at least this many runs (the spec's 3). */
export const MIN_RUNS = 3;
/** By default the places are judged on the last this many runs. */
export const PLACE_RUNS = 10;
/**
 * A crossing place (the crossings of one kind, direction and hand) is named at this many standard
 * errors: S1's `PROBLEM_MIN_Z`, since a hand has at most two such places per direction.
 */
export const CROSSING_MIN_Z = PROBLEM_MIN_Z;
/**
 * A degree place (the notes of one degree, direction and hand that are no crossing) needs more:
 * a hand has some ten of them against two crossing places. Simulated (300 exercises per case, C
 * major two octaves, σ = 15–25 ms, 3–10 runs), a steady player gets a degree place in 5–21 % of
 * exercises at 2.5 standard errors and 3–10 % at 3, where a thumb 25 ms late also pulls the lines
 * enough that a note beside it is named in up to 19 % of four-octave exercises. At 3.5 both stay
 * under 10 % (the figures in `placesOverRuns`).
 */
export const DEGREE_MIN_Z = 3.5;
/** The median absolute deviation times this estimates the standard deviation of normal noise. */
const MAD_TO_SD = 1.4826;
/** Timing is never exact to better than this (input resolution). */
const NOISE_FLOOR_MS = 1;

/** One expected note over the last runs: its figures for the profile chart and the table. */
export interface PlaceOverRuns {
  /** Expected index in the hand's run. */
  index: number;
  hand: Hand;
  direction: Direction;
  crossing: Crossing;
  degree: number;
  turn: boolean;
  /** Runs in which it was played with the right key and has a deviation. */
  runs: number;
  /** Mean deviation over those runs, ms (early −, late +). */
  irregularity: number;
  /** IQR of those deviations, ms. */
  instability: number;
  /**
   * SD of those deviations / √runs. Descriptive only: from 3–5 values the SD is noise of its own
   * (at 3 runs a "2 standard errors" test on it is really a t test at 2 degrees of freedom, whose
   * 5 % point is 4.3), so `irregular` does not use it.
   */
  standardError: number;
}

/**
 * A place irregular over the last runs, in one direction of one hand: either the crossings of one
 * kind (`crossing` set, as S1's `ProblemPlace`, so a summary can tell when a run and its
 * predecessors agree), or the notes of one degree that are no crossing (`degree` set).
 */
export interface IrregularPlace {
  hand: Hand;
  direction: Direction;
  /** A crossing place: its kind; null for a degree place. */
  crossing: Crossing;
  /** A degree place: its degree (0-based from the tonic); null for a crossing place. */
  degree: number | null;
  /** Expected indexes of the notes it rests on. */
  indexes: number[];
  /** Runs with at least one of those notes measured, and the deviations counted. */
  runs: number;
  notes: number;
  /** Mean deviation of those notes over the runs, ms (early −, late +). */
  irregularity: number;
  /** IQR of the same deviations, ms. */
  instability: number;
  /** The hand's robust deviation spread over the runs / √notes. */
  standardError: number;
}

export interface PlacesOverRuns {
  /** Runs used: of the last ones asked for, the scale runs. */
  runs: number;
  /** Every expected note measured in at least `MIN_RUNS` runs, right hand first, in run order. */
  places: PlaceOverRuns[];
  /** Strongest (most standard errors from zero) first. */
  irregular: IrregularPlace[];
}

/**
 * Over the last `last` runs of one exercise, re-analysed from their raw notes: each note's
 * deviations (the `places`) and the places named irregular. A run that is not a scale run under
 * today's analysis is skipped (its notes are not where they seem); runs of more than one exercise
 * are an error, since their notes do not line up.
 *
 * Places are named by groups over the runs, never note by note: in one direction of one hand, the
 * crossings of one kind (the thumb passing under, a finger crossing over), and, for the notes that
 * are no crossing (all of them in a scale without fingering), the notes of one degree, the run's
 * first and last notes left out. A group is named when it was measured in at least `MIN_RUNS`
 * runs and its mean deviation is at least `PROBLEM_MIN_MS` from zero and `CROSSING_MIN_Z` (a
 * crossing) or `DEGREE_MIN_Z` (a degree) standard errors, the standard error being the hand's
 * robust deviation spread over all its notes and runs (1.4826 × MAD, the turn left out) over the
 * square root of the group's deviations. The turning note is never named (a turn may breathe).
 *
 * The spec's first reading — each note against its own SD over the runs — names a place for a
 * steady player in 62 % (two octaves) and 85 % (four) of exercises at σ = 15 ms over 5 runs, and
 * in 80–94 % at σ = 25 ms over 10: an SD of 3–10 values is noise of its own and some 28–56 notes
 * are tested at once. As built (300 exercises per case, 250 ms notes, onset jitter σ = 15 and 25
 * ms, 3, 5 and 10 runs, two and four octaves, C major either hand and A natural minor): a steady
 * player is named in 0–9 % of exercises; a thumb 25 ms late in every run is named in 92–100 % at σ
 * = 15 and 54–96 % at σ = 25, and a note of no crossing (A, going up, in C major) 38–100 % and
 * 7–97 %, with 0–9 % of exercises naming some other place beside it. In A natural minor, which
 * has no fingering, the thumb's notes (where A harmonic minor puts it) are degree places: 25 ms
 * late, they are named in 24–100 % at σ = 15 and 5–96 % at σ = 25, and a note beside them in up
 * to 12 % (22 % at 3 standard errors, where the thumb is named more often: 47–100 % and 12–99 %).
 * One octave, where each place has one note per run, is named less often (thumb: 61–98 % at
 * σ = 15) and a steady player at most 9 % of the time.
 */
export function placesOverRuns(runs: readonly StoredScaleRun[], last = PLACE_RUNS): PlacesOverRuns {
  if (runs.length === 0) return { runs: 0, places: [], irregular: [] };
  const exercise = runs[0]!.exercise;
  if (runs.some((r) => r.exercise !== exercise))
    throw new Error(`runs of more than one exercise: ${exercise} and others`);
  const parsed = parseExerciseKey(exercise);
  if (!parsed) throw new Error(`not an exercise key: ${exercise}`);
  const { right, left } = scaleNotes(parsed);
  const expected = [...right, ...left];

  const recent = [...runs]
    .sort((a, b) => b.startedAt - a.startedAt || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))
    .slice(0, Math.max(0, last));
  // Per hand and expected index: the deviation in each run used (one per run at most), and the run.
  const deviations = {
    right: right.map(() => [] as Measured[]),
    left: left.map(() => [] as Measured[]),
  };
  let used = 0;
  for (const run of recent) {
    const analysis = analyzeRun({
      expected,
      played: run.keys,
      velocityMeasured: run.velocityMeasured,
    });
    if (analysis.quality !== 'ok') continue;
    used++;
    for (const hand of analysis.hands) {
      for (const note of hand.notes) {
        if (note.outcome === 'played' && note.deviation !== null)
          deviations[hand.hand][note.index]!.push({ run: used, deviation: note.deviation });
      }
    }
  }

  const places: PlaceOverRuns[] = [];
  const irregular: { place: IrregularPlace; z: number }[] = [];
  for (const [hand, notes] of [
    ['right', right],
    ['left', left],
  ] as const) {
    const byIndex = deviations[hand];
    for (const note of notes) {
      const d = byIndex[note.index]!.map((m) => m.deviation);
      if (d.length < MIN_RUNS) continue;
      places.push({
        index: note.index,
        hand,
        direction: note.direction,
        crossing: note.crossing,
        degree: note.degree,
        turn: note.turn,
        runs: d.length,
        irregularity: mean(d),
        instability: iqr(d),
        standardError: sampleSd(d) / Math.sqrt(d.length),
      });
    }

    // The hand's spread over every note and run, the turn left out (a turn may breathe).
    const all = notes.flatMap((n) => (n.turn ? [] : byIndex[n.index]!.map((m) => m.deviation)));
    const centre = median(all);
    if (centre === null) continue;
    const spread = Math.max(
      NOISE_FLOOR_MS,
      MAD_TO_SD * median(all.map((v) => Math.abs(v - centre)))!,
    );
    const groups = new Map<string, typeof notes>();
    const lastIndex = notes.length - 1;
    for (const n of notes) {
      if (n.turn) continue;
      // The first and last notes' lines are fitted from one side only: their deviations spread
      // about a quarter more (21–22 ms against 17 at σ = 15), too much for a place of their own.
      if (n.crossing === null && (n.index === 0 || n.index === lastIndex)) continue;
      const key =
        n.crossing === null ? `${n.direction}:${n.degree}` : `${n.direction}:${n.crossing}`;
      groups.set(key, [...(groups.get(key) ?? []), n]);
    }
    for (const group of groups.values()) {
      const crossing = group[0]!.crossing;
      const measured = group.flatMap((n) => byIndex[n.index]!);
      const runsWith = new Set(measured.map((m) => m.run)).size;
      const d = measured.map((m) => m.deviation);
      if (runsWith < MIN_RUNS) continue;
      const irregularity = mean(d);
      const standardError = spread / Math.sqrt(d.length);
      const z = Math.abs(irregularity) / standardError;
      const minZ = crossing === null ? DEGREE_MIN_Z : CROSSING_MIN_Z;
      if (Math.abs(irregularity) < PROBLEM_MIN_MS || z < minZ) continue;
      irregular.push({
        place: {
          hand,
          direction: group[0]!.direction,
          crossing,
          degree: crossing === null ? group[0]!.degree : null,
          indexes: group.filter((n) => byIndex[n.index]!.length > 0).map((n) => n.index),
          runs: runsWith,
          notes: d.length,
          irregularity,
          instability: iqr(d),
          standardError,
        },
        z,
      });
    }
  }
  irregular.sort((a, b) => b.z - a.z);
  return { runs: used, places, irregular: irregular.map((i) => i.place) };
}

interface Measured {
  /** Which of the runs used. */
  run: number;
  deviation: number;
}

const mean = (values: readonly number[]) => values.reduce((a, v) => a + v, 0) / values.length;

function iqr(values: readonly number[]): number {
  return quantile(values, 0.75)! - quantile(values, 0.25)!;
}

/** Sample standard deviation (n − 1); callers pass at least `MIN_RUNS` values. */
function sampleSd(values: readonly number[]): number {
  const m = mean(values);
  return Math.sqrt(values.reduce((a, v) => a + (v - m) ** 2, 0) / (values.length - 1));
}
