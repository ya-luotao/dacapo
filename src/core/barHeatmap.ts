// Data for the measure heatmap: one cell per written bar of a piece, for one hand selection. In
// wait mode it is coloured by hesitation (the median time per step) and marked by wrong notes
// per step; in rhythm mode by timing (the median distance from the beat per note) and marked by
// missed and extra notes per note. Only recent runs count, so practice shows.

import { IDLE_MS } from './activity.ts';
import { stepMode, type PieceStep, type PracticeMode } from './pieceRecords.ts';
import type { PlayedMeasure } from './repeats.ts';
import type { HandSelection } from './score.ts';
import { median } from './session.ts';
import type { BarLoop } from './wait.ts';

/**
 * A comfortable wait-mode step: about a second, i.e. quarter notes at ♩ = 60, the slow practice
 * tempo at which the notes are read, not searched for. Slower steps are hesitation.
 */
export const ANCHOR_MS = 1000;

/**
 * Upper edges of the hesitation buckets in ms, round numbers around the anchor (½, ¾, 1, 1½, 2
 * and 3 s). The anchor sits at the same place of the scale as the note heatmap's target.
 */
export const BAR_EDGES_MS: readonly number[] = [500, 750, 1000, 1500, 2000, 3000];
export const BAR_BUCKETS = BAR_EDGES_MS.length + 1;
/** The first bucket at or over the anchor. */
export const ANCHOR_BUCKET = BAR_EDGES_MS.indexOf(ANCHOR_MS) + 1;

/**
 * In time: a median of 30 ms from the beat, about where a listener starts to hear notes as early
 * or late against a click. Anything under 10 ms is as tight as a player gets.
 */
export const TIMING_ANCHOR_MS = 30;
/** Upper edges of the timing buckets in ms; the anchor sits where the hesitation anchor does. */
export const TIMING_EDGES_MS: readonly number[] = [10, 20, 30, 50, 75, 100];

/** What the heatmap shows: hesitation (wait mode's records) or timing (rhythm mode's). */
export type BarMetric = 'hesitation' | 'timing';

export const metricMode = (metric: BarMetric): PracticeMode =>
  metric === 'timing' ? 'rhythm' : 'wait';

export function metricScale(metric: BarMetric): { edges: readonly number[]; anchor: number } {
  return metric === 'timing'
    ? { edges: TIMING_EDGES_MS, anchor: TIMING_ANCHOR_MS }
    : { edges: BAR_EDGES_MS, anchor: ANCHOR_MS };
}

/** Each bar is judged on the latest runs that played it. */
export const WINDOW_RUNS = 5;
/** Less than this is "not enough data": one run can be a warm-up or a fluke. */
export const MIN_RUNS = 2;
export const MIN_STEPS = 3;
/** A bar is steady when its last `STEADY_RUNS` runs were at ease and without a wrong note. */
export const STEADY_RUNS = 3;

/** 0 (under `edges[0]`) … `BAR_BUCKETS - 1`; an edge value belongs to the higher bucket. */
export function barBucket(ms: number, edges: readonly number[] = BAR_EDGES_MS): number {
  const index = edges.findIndex((edge) => ms < edge);
  return index === -1 ? edges.length : index;
}

export interface BarCell {
  /** Written measure index. */
  measure: number;
  /** Runs counted (at most `WINDOW_RUNS`), and their steps in this bar (timing: their notes). */
  runs: number;
  steps: number;
  /** The most passes through the bar within one run (2 for a repeated bar, both counted). */
  passes: number;
  /**
   * Hesitation: median time per step, each capped at `IDLE_MS`. Timing: median distance from the
   * beat of the notes played. Null without any.
   */
  medianMs: number | null;
  /** Wrong notes; timing: missed and extra notes. */
  wrong: number;
  /** Per step (timing: per note); 0 without any. */
  wrongPerStep: number;
  /** Timing only: of `wrong`, the notes missed. */
  missed: number;
  /** The metric's bucket, or null when there is not enough data. */
  bucket: number | null;
  steady: boolean;
}

export interface BarHeatmap {
  /** One per bar asked for, in the order given. */
  cells: BarCell[];
  /** Runs of this hand selection recorded on another version of the score, left out. */
  staleRuns: number;
}

export interface BarHeatmapOptions {
  /** The score's current `pieceChecksum`. */
  checksum: string;
  hands: HandSelection;
  /** The written bars the hand selection plays. */
  bars: readonly number[];
  /** Default: hesitation. */
  metric?: BarMetric;
}

interface RunInBar {
  sessionId: string;
  /** The latest step of the run in the bar: the order of the runs. */
  last: number;
  steps: PieceStep[];
}

interface Figures {
  /** Steps, or notes due for timing. */
  count: number;
  medianMs: number | null;
  wrong: number;
  missed: number;
}

function figures(steps: readonly PieceStep[], metric: BarMetric): Figures {
  if (metric === 'hesitation') {
    return {
      count: steps.length,
      medianMs: median(steps.map((s) => Math.min(s.ms, IDLE_MS))),
      wrong: steps.reduce((n, s) => n + s.wrong, 0),
      missed: 0,
    };
  }
  const notes = steps.flatMap((s) => s.notes ?? []);
  const played = notes.flatMap((n) => (n.deviation === null ? [] : [Math.abs(n.deviation)]));
  const missed = notes.length - played.length;
  return {
    count: notes.length,
    medianMs: median(played),
    wrong: missed + steps.reduce((n, s) => n + s.wrong, 0),
    missed,
  };
}

export function barHeatmap(
  records: readonly PieceStep[],
  { checksum, hands, bars, metric = 'hesitation' }: BarHeatmapOptions,
): BarHeatmap {
  const mode = metricMode(metric);
  const { edges, anchor } = metricScale(metric);
  const stale = new Set<string>();
  const byBar = new Map<number, Map<string, RunInBar>>();
  for (const record of records) {
    if (record.hands !== hands || stepMode(record) !== mode) continue;
    if (record.checksum !== checksum) {
      stale.add(record.sessionId);
      continue;
    }
    let runs = byBar.get(record.measure);
    if (!runs) byBar.set(record.measure, (runs = new Map<string, RunInBar>()));
    const run = runs.get(record.sessionId);
    if (run) {
      run.steps.push(record);
      run.last = Math.max(run.last, record.at);
    } else {
      runs.set(record.sessionId, { sessionId: record.sessionId, last: record.at, steps: [record] });
    }
  }

  const cells = bars.map((measure): BarCell => {
    const latest = [...(byBar.get(measure)?.values() ?? [])].sort(
      (a, b) => b.last - a.last || (a.sessionId < b.sessionId ? 1 : -1),
    );
    const window = latest.slice(0, WINDOW_RUNS);
    const { count, medianMs, wrong, missed } = figures(
      window.flatMap((r) => r.steps),
      metric,
    );
    const enough = window.length >= MIN_RUNS && count >= MIN_STEPS;
    const recent = latest.slice(0, STEADY_RUNS);
    const settled = figures(
      recent.flatMap((r) => r.steps),
      metric,
    );
    // Every note missed: as far from the beat as it gets.
    const bucket = !enough ? null : medianMs === null ? edges.length : barBucket(medianMs, edges);
    return {
      measure,
      runs: window.length,
      steps: count,
      passes: Math.max(0, ...window.map((r) => new Set(r.steps.map((s) => s.pass)).size)),
      medianMs,
      wrong,
      wrongPerStep: count === 0 ? 0 : wrong / count,
      missed,
      bucket,
      steady:
        recent.length === STEADY_RUNS &&
        settled.medianMs !== null &&
        settled.medianMs < anchor &&
        settled.wrong === 0,
    };
  });
  return { cells, staleRuns: stale.size };
}

/**
 * Weakest first: by hesitation bucket (what the colour shows), then wrong notes per step, then the
 * median itself. Bars without enough data come last, in written order.
 */
export function byBarWeakness(a: BarCell, b: BarCell): number {
  if ((a.bucket === null) !== (b.bucket === null)) return a.bucket === null ? 1 : -1;
  if (a.bucket === null || b.bucket === null) return a.measure - b.measure;
  return (
    b.bucket - a.bucket ||
    b.wrongPerStep - a.wrongPerStep ||
    (b.medianMs ?? 0) - (a.medianMs ?? 0) ||
    a.measure - b.measure
  );
}

/** Slower than the anchor or with wrong notes: worth practising. */
export function isWeak(cell: BarCell): boolean {
  return cell.bucket !== null && (cell.bucket >= ANCHOR_BUCKET || cell.wrong > 0);
}

/** Bars `a` and `a + 1` follow each other when played (not a first ending and a second). */
function adjacentInPlay(order: readonly PlayedMeasure[], a: number): boolean {
  return order.some((p, i) => p.measure === a && order[i + 1]?.measure === a + 1);
}

/**
 * What "Loop the weakest bars" loops: the weakest bar, together with a neighbour played right
 * before or after it when that one is weak too (the weaker of the two). Null without data.
 */
export function weakestLoop(
  cells: readonly BarCell[],
  order: readonly PlayedMeasure[],
): BarLoop | null {
  const ranked = cells.filter((c) => c.bucket !== null).sort(byBarWeakness);
  const weakest = ranked[0];
  if (!weakest) return null;
  const m = weakest.measure;
  const neighbours = ranked.filter(
    (c) =>
      isWeak(c) &&
      ((c.measure === m - 1 && adjacentInPlay(order, m - 1)) ||
        (c.measure === m + 1 && adjacentInPlay(order, m))),
  );
  const partner = isWeak(weakest) ? neighbours[0] : undefined;
  if (!partner) return { from: m, to: m };
  return { from: Math.min(m, partner.measure), to: Math.max(m, partner.measure) };
}

/** Bars whose last `STEADY_RUNS` runs were at ease and clean, and how many bars there are. */
export function steadyBars(cells: readonly BarCell[]): { steady: number; total: number } {
  return { steady: cells.filter((c) => c.steady).length, total: cells.length };
}
