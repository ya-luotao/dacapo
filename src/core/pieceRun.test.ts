import { describe, expect, it } from 'vitest';
import { barStats, summarizeRun } from './pieceRun.ts';
import type { StepRecord } from './wait.ts';

const record = (measure: number, pass: number, ms: number, wrong: number, at: number) =>
  ({ step: 0, measure, pass, ms, wrong, at }) satisfies StepRecord;

describe('run summary', () => {
  const records = [
    record(0, 1, 0, 0, 1_000),
    record(0, 1, 500, 1, 1_500),
    record(1, 1, 3_000, 2, 4_500),
    record(0, 2, 700, 0, 5_200),
    record(2, 1, 200, 0, 5_400),
  ];

  it('aggregates both passes of a bar', () => {
    expect(barStats(records)).toEqual([
      { measure: 0, steps: 3, meanMs: 400, wrong: 1 },
      { measure: 1, steps: 1, meanMs: 3_000, wrong: 2 },
      { measure: 2, steps: 1, meanMs: 200, wrong: 0 },
    ]);
  });

  it('adds up time from the first key, wrong notes and the slowest bars', () => {
    const summary = summarizeRun(records, 1_000, 2);
    expect(summary).toMatchObject({ activeMs: 4_400, steps: 5, wrong: 3 });
    expect(summary.slowest.map((b) => b.measure)).toEqual([1, 0]);
  });

  it('caps pauses and slow steps', () => {
    const summary = summarizeRun([record(4, 1, 600_000, 0, 601_000)], 1_000);
    expect(summary.activeMs).toBe(60_000);
    expect(summary.slowest[0]!.meanMs).toBe(60_000);
  });

  it('is empty before the first key', () => {
    expect(summarizeRun([], null)).toEqual({ activeMs: 0, steps: 0, wrong: 0, slowest: [] });
  });
});
