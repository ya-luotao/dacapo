// The summary of one wait-mode run: time, wrong notes and the bars that held the player up.

import { IDLE_MS } from './activity.ts';
import type { StepRecord } from './wait.ts';

export interface BarStat {
  /** Written measure index: both passes of a repeat count for the same bar. */
  measure: number;
  steps: number;
  /** Mean time per step, each capped at `IDLE_MS`. */
  meanMs: number;
  wrong: number;
}

export interface RunSummary {
  /**
   * Time on the steps, from the first key to the last completed step, each step capped at
   * `IDLE_MS`. A step's clock restarts after the demo, so listening does not count.
   */
  activeMs: number;
  steps: number;
  wrong: number;
  /** Slowest first. */
  slowest: BarStat[];
}

export function barStats(records: readonly StepRecord[]): BarStat[] {
  const bars = new Map<number, { steps: number; ms: number; wrong: number }>();
  for (const r of records) {
    const bar = bars.get(r.measure) ?? { steps: 0, ms: 0, wrong: 0 };
    bar.steps++;
    bar.ms += Math.min(r.ms, IDLE_MS);
    bar.wrong += r.wrong;
    bars.set(r.measure, bar);
  }
  return [...bars].map(([measure, b]) => ({
    measure,
    steps: b.steps,
    meanMs: b.ms / b.steps,
    wrong: b.wrong,
  }));
}

/**
 * The slowest bars are those whose steps took longest on average, ties broken by wrong notes; at
 * most `count`.
 */
export function summarizeRun(records: readonly StepRecord[], count = 3): RunSummary {
  const slowest = barStats(records)
    .sort((a, b) => b.meanMs - a.meanMs || b.wrong - a.wrong || a.measure - b.measure)
    .slice(0, count);
  return {
    activeMs: records.reduce((sum, r) => sum + Math.min(r.ms, IDLE_MS), 0),
    steps: records.length,
    wrong: records.reduce((sum, r) => sum + r.wrong, 0),
    slowest,
  };
}
