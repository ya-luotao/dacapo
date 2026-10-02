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

export function barStats(
  records: readonly Pick<StepRecord, 'measure' | 'ms' | 'wrong'>[],
): BarStat[] {
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

/** The bar whose steps took longest on average first, ties broken by wrong notes. */
export const bySlowest = (a: BarStat, b: BarStat): number =>
  b.meanMs - a.meanMs || b.wrong - a.wrong || a.measure - b.measure;

/**
 * The slowest bars are those whose steps took longest on average; at most `count`. The steps are
 * those the player had a key of: a step passed (all of it beyond their keyboard) took no time
 * and is not one of them.
 */
export function summarizeRun(all: readonly StepRecord[], count = 3): RunSummary {
  const records = all.some((r) => r.passed) ? all.filter((r) => !r.passed) : all;
  const slowest = barStats(records).sort(bySlowest).slice(0, count);
  return {
    activeMs: records.reduce((sum, r) => sum + Math.min(r.ms, IDLE_MS), 0),
    steps: records.length,
    wrong: records.reduce((sum, r) => sum + r.wrong, 0),
    slowest,
  };
}
