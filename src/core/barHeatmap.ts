// Data for the measure heatmap: one cell per written bar of a piece, for one hand selection. In
// wait mode it is coloured by hesitation (the median time per step) and marked by wrong notes
// per step; in rhythm mode by timing (the median distance from the beat per note) and marked by
// missed and extra notes per note. Only recent runs count, so practice shows. A run here is one
// time through: each round of a loop counts as a run, as someone practising a phrase counts it.

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

/**
 * Memory (P7): a prompt every other run, the bar half held by heart. Steady is none in the last
 * three memory runs.
 */
export const MEMORY_ANCHOR = 0.5;
/** Upper edges of the memory buckets in prompts per run; the anchor where the others sit. */
export const MEMORY_EDGES: readonly number[] = [0.1, 0.25, 0.5, 1, 2, 3];

/**
 * What the heatmap shows: hesitation (wait mode's records), timing (rhythm mode's) or memory
 * (memory mode's prompts per run).
 */
export type BarMetric = 'hesitation' | 'timing' | 'memory';
export const BAR_METRICS: readonly BarMetric[] = ['hesitation', 'timing', 'memory'];

export const metricMode = (metric: BarMetric): PracticeMode =>
  metric === 'timing' ? 'rhythm' : metric === 'memory' ? 'memory' : 'wait';

export function metricScale(metric: BarMetric): { edges: readonly number[]; anchor: number } {
  if (metric === 'memory') return { edges: MEMORY_EDGES, anchor: MEMORY_ANCHOR };
  return metric === 'timing'
    ? { edges: TIMING_EDGES_MS, anchor: TIMING_ANCHOR_MS }
    : { edges: BAR_EDGES_MS, anchor: ANCHOR_MS };
}

/** Each bar is judged on the latest runs that played it (a round of a loop is a run). */
export const WINDOW_RUNS = 5;
/** Less than this is "not enough data": one run can be a warm-up or a fluke. */
export const MIN_RUNS = 2;
export const MIN_STEPS = 3;
/** A bar is steady when its last `STEADY_RUNS` runs were at ease and without a wrong note. */
export const STEADY_RUNS = 3;

/** The steps one time through each written bar takes, by measure index. */
export type BarSteps = ReadonlyMap<number, number>;

const byId = (a: PieceStep, b: PieceStep): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** A session's step records as it played them: a bar of one pass, step after step. */
function stretches(run: readonly PieceStep[]): PieceStep[][] {
  const out: PieceStep[][] = [];
  for (const step of [...run].sort(byId)) {
    const last = out.at(-1)?.[0];
    if (last && last.measure === step.measure && last.pass === step.pass) out.at(-1)!.push(step);
    else out.push([step]);
  }
  return out;
}

/** The steps a time through each bar takes, counted in a score's steps (any play order). */
export function barStepsIn(
  steps: readonly { measure: number; played: number }[],
): Map<number, number> {
  // A bar played again on a repeat has the same steps: the first time it is played is counted.
  const first = new Map<number, number>();
  const counts = new Map<number, number>();
  for (const step of steps) {
    if (!first.has(step.measure)) first.set(step.measure, step.played);
    if (first.get(step.measure) !== step.played) continue;
    counts.set(step.measure, (counts.get(step.measure) ?? 0) + 1);
  }
  return counts;
}

/**
 * The steps a time through each bar takes, as the records themselves show them: the most steps
 * a run played in a bar before it went on to another. For the places that have no score to count
 * them in (a library card); a bar only ever looped on its own has none.
 */
export function barStepsOf(runs: Iterable<readonly PieceStep[]>): Map<number, number> {
  const counts = new Map<number, number>();
  for (const run of runs) {
    for (const stretch of stretches(run).slice(0, -1)) {
      const { measure } = stretch[0]!;
      counts.set(measure, Math.max(counts.get(measure) ?? 0, stretch.length));
    }
  }
  return counts;
}

/**
 * The times through of one session, told from its step records (docs/PIECES.md, "Measure
 * heatmap"): its records in the order played, each with the round it belongs to (0 for the
 * first). A new round begins where the run comes back to a bar it has played in this round (the
 * loop went round; a repeat's second pass is another pass, and the same round), and, in a loop
 * of one bar, after the steps a time through the bar takes (`barSteps`; without them such a loop
 * is one round). A run without a loop is one time through.
 */
export function timesThrough(
  run: readonly PieceStep[],
  barSteps: BarSteps = new Map(),
): { step: PieceStep; round: number }[] {
  const out: { step: PieceStep; round: number }[] = [];
  let round = 0;
  let played = new Set<string>();
  for (const stretch of stretches(run)) {
    const { measure, pass } = stretch[0]!;
    const bar = `${measure}:${pass}`;
    if (played.has(bar)) {
      round++;
      played = new Set();
    }
    played.add(bar);
    const perRound = barSteps.get(measure) ?? Infinity;
    stretch.forEach((step, n) => {
      // Round and round one bar: the run is back at its first step.
      if (n > 0 && n % perRound === 0) {
        round++;
        played = new Set([bar]);
      }
      out.push({ step, round });
    });
  }
  return out;
}

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
  /** Memory only: prompts per run (what the colour shows). */
  perRun?: number;
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
  /**
   * Count the runs in every key the piece was moved to (docs/HARMONY.md, "Transposing (H4)"): by
   * default only runs in the written key count.
   */
  allKeys?: boolean;
  /**
   * The steps a time through each bar takes with these hands, where the score is at hand: they
   * tell the rounds of a loop of one bar apart. Without them, as the records show them
   * (`barStepsOf`).
   */
  barSteps?: BarSteps;
}

/** One time through a bar: a run, or a round of a looped run. */
interface RunInBar {
  /** The session and the round: the order of equals. */
  id: string;
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
  prompts: number;
}

function figures(steps: readonly PieceStep[], metric: BarMetric): Figures {
  if (metric !== 'timing') {
    return {
      count: steps.length,
      medianMs: median(steps.map((s) => Math.min(s.ms, IDLE_MS))),
      wrong: steps.reduce((n, s) => n + s.wrong, 0),
      missed: 0,
      prompts: steps.reduce((n, s) => n + (s.prompts ?? 0), 0),
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
    prompts: 0,
  };
}

export function barHeatmap(
  records: readonly PieceStep[],
  { checksum, hands, bars, metric = 'hesitation', allKeys = false, barSteps }: BarHeatmapOptions,
): BarHeatmap {
  const mode = metricMode(metric);
  const { edges, anchor } = metricScale(metric);
  const stale = new Set<string>();
  const sessions = new Map<string, PieceStep[]>();
  for (const record of records) {
    if (record.hands !== hands || stepMode(record) !== mode) continue;
    if (record.transpose !== undefined && !allKeys) continue;
    if (record.checksum !== checksum) {
      stale.add(record.sessionId);
      continue;
    }
    const session = sessions.get(record.sessionId);
    if (session) session.push(record);
    else sessions.set(record.sessionId, [record]);
  }

  // Each time through a bar is a run of it: a session's rounds are told apart first.
  const perBar = barSteps ?? barStepsOf(sessions.values());
  const byBar = new Map<number, Map<string, RunInBar>>();
  for (const [sessionId, session] of sessions) {
    for (const { step, round } of timesThrough(session, perBar)) {
      let runs = byBar.get(step.measure);
      if (!runs) byBar.set(step.measure, (runs = new Map<string, RunInBar>()));
      const id = `${sessionId} ${String(round).padStart(6, '0')}`;
      const run = runs.get(id);
      if (run) {
        run.steps.push(step);
        run.last = Math.max(run.last, step.at);
      } else {
        runs.set(id, { id, last: step.at, steps: [step] });
      }
    }
  }

  const cells = bars.map((measure): BarCell => {
    const latest = [...(byBar.get(measure)?.values() ?? [])].sort(
      (a, b) => b.last - a.last || (a.id < b.id ? 1 : -1),
    );
    const window = latest.slice(0, WINDOW_RUNS);
    const { count, medianMs, wrong, missed, prompts } = figures(
      window.flatMap((r) => r.steps),
      metric,
    );
    const memory = metric === 'memory';
    const perRun = window.length === 0 ? 0 : prompts / window.length;
    const enough = window.length >= MIN_RUNS && count >= MIN_STEPS;
    const recent = latest.slice(0, STEADY_RUNS);
    const settled = figures(
      recent.flatMap((r) => r.steps),
      metric,
    );
    // Every note missed: as far from the beat as it gets.
    const bucket = !enough
      ? null
      : memory
        ? barBucket(perRun, edges)
        : medianMs === null
          ? edges.length
          : barBucket(medianMs, edges);
    return {
      measure,
      runs: window.length,
      steps: count,
      passes: Math.max(0, ...window.map((r) => new Set(r.steps.map((s) => s.pass)).size)),
      medianMs,
      wrong,
      wrongPerStep: count === 0 ? 0 : wrong / count,
      missed,
      ...(memory && { perRun }),
      bucket,
      steady:
        recent.length === STEADY_RUNS &&
        (memory
          ? settled.prompts === 0
          : settled.medianMs !== null && settled.medianMs < anchor && settled.wrong === 0),
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
