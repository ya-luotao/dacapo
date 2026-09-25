// Data for the measure heatmap: one cell per written bar of a piece, for one hand selection,
// coloured by hesitation (the median time per step in wait mode) and marked by wrong notes per
// step. Only recent runs count, so practice shows.

import { IDLE_MS } from './activity.ts';
import type { PieceStep } from './pieceRecords.ts';
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

/** Each bar is judged on the latest runs that played it. */
export const WINDOW_RUNS = 5;
/** Less than this is "not enough data": one run can be a warm-up or a fluke. */
export const MIN_RUNS = 2;
export const MIN_STEPS = 3;
/** A bar is steady when its last `STEADY_RUNS` runs were at ease and without a wrong note. */
export const STEADY_RUNS = 3;

/** 0 (faster than `BAR_EDGES_MS[0]`) … `BAR_BUCKETS - 1`; an edge value belongs to the slower one. */
export function barBucket(ms: number): number {
  const index = BAR_EDGES_MS.findIndex((edge) => ms < edge);
  return index === -1 ? BAR_EDGES_MS.length : index;
}

export interface BarCell {
  /** Written measure index. */
  measure: number;
  /** Runs counted (at most `WINDOW_RUNS`), and their steps in this bar. */
  runs: number;
  steps: number;
  /** The most passes through the bar within one run (2 for a repeated bar, both counted). */
  passes: number;
  /** Median time per step, each capped at `IDLE_MS`; null without steps. */
  medianMs: number | null;
  wrong: number;
  /** 0 without steps. */
  wrongPerStep: number;
  /** Hesitation bucket, or null when there is not enough data. */
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
}

interface RunInBar {
  sessionId: string;
  /** The latest step of the run in the bar: the order of the runs. */
  last: number;
  steps: PieceStep[];
}

const figures = (steps: readonly PieceStep[]) => {
  const wrong = steps.reduce((n, s) => n + s.wrong, 0);
  return {
    medianMs: median(steps.map((s) => Math.min(s.ms, IDLE_MS))),
    wrong,
    wrongPerStep: steps.length === 0 ? 0 : wrong / steps.length,
  };
};

export function barHeatmap(
  records: readonly PieceStep[],
  { checksum, hands, bars }: BarHeatmapOptions,
): BarHeatmap {
  const stale = new Set<string>();
  const byBar = new Map<number, Map<string, RunInBar>>();
  for (const record of records) {
    if (record.hands !== hands) continue;
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
    const steps = window.flatMap((r) => r.steps);
    const { medianMs, wrong, wrongPerStep } = figures(steps);
    const enough = window.length >= MIN_RUNS && steps.length >= MIN_STEPS;
    const recent = latest.slice(0, STEADY_RUNS);
    const settled = figures(recent.flatMap((r) => r.steps));
    return {
      measure,
      runs: window.length,
      steps: steps.length,
      passes: Math.max(0, ...window.map((r) => new Set(r.steps.map((s) => s.pass)).size)),
      medianMs,
      wrong,
      wrongPerStep,
      bucket: enough && medianMs !== null ? barBucket(medianMs) : null,
      steady: recent.length === STEADY_RUNS && settled.medianMs! < ANCHOR_MS && settled.wrong === 0,
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
