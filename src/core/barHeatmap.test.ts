import { describe, expect, it } from 'vitest';
import { sampleStep } from '../storage/fixtures.ts';
import {
  ANCHOR_BUCKET,
  ANCHOR_MS,
  BAR_EDGES_MS,
  barBucket,
  barHeatmap,
  byBarWeakness,
  isWeak,
  steadyBars,
  TIMING_ANCHOR_MS,
  TIMING_EDGES_MS,
  weakestLoop,
  type BarCell,
} from './barHeatmap.ts';
import type { PieceStep } from './pieceRecords.ts';
import type { PlayedMeasure } from './repeats.ts';

const CHECKSUM = 'b80fe0e1';
const T = Date.UTC(2026, 8, 25, 9);

/** A run `r` that plays each bar of `bars` with one step of `ms` (and `wrong` wrong notes). */
function run(
  r: number,
  bars: Record<number, { ms: number; wrong?: number; steps?: number; pass?: number }[]>,
  patch: Partial<PieceStep> = {},
): PieceStep[] {
  const out: PieceStep[] = [];
  for (const [measure, list] of Object.entries(bars)) {
    for (const { ms, wrong = 0, steps = 1, pass = 1 } of list) {
      for (let i = 0; i < steps; i++) {
        out.push(
          sampleStep(`run${r}`, out.length, {
            measure: Number(measure),
            pass,
            ms,
            wrong,
            at: T + r * 600_000 + out.length * 1000,
            ...patch,
          }),
        );
      }
    }
  }
  return out;
}

const heat = (records: PieceStep[], bars = [0, 1, 2, 3], hands: 'right' | 'left' = 'right') =>
  barHeatmap(records, { checksum: CHECKSUM, hands, bars });
const cell = (records: PieceStep[], measure: number) =>
  heat(records).cells.find((c) => c.measure === measure)!;

describe('the hesitation scale', () => {
  it('has round edges around a one-second anchor, which belongs to the slower bucket', () => {
    expect(BAR_EDGES_MS).toEqual([500, 750, 1000, 1500, 2000, 3000]);
    expect(ANCHOR_MS).toBe(1000);
    expect(barBucket(499)).toBe(0);
    expect(barBucket(500)).toBe(1);
    expect(barBucket(999)).toBe(2);
    expect(barBucket(1000)).toBe(ANCHOR_BUCKET);
    expect(barBucket(2999)).toBe(5);
    expect(barBucket(60_000)).toBe(6);
  });
});

describe('per-bar aggregation', () => {
  it('takes the median time per step and wrong notes per step of each bar', () => {
    const records = [
      ...run(1, { 0: [{ ms: 400 }, { ms: 1200, wrong: 1 }], 1: [{ ms: 2500 }] }),
      ...run(2, { 0: [{ ms: 600 }, { ms: 800 }], 1: [{ ms: 2100, wrong: 2 }] }),
    ];
    const bar0 = cell(records, 0);
    expect(bar0).toMatchObject({ runs: 2, steps: 4, medianMs: 700, wrong: 1, wrongPerStep: 0.25 });
    expect(bar0.bucket).toBe(barBucket(700));
    const bar1 = cell(records, 1);
    // Two runs, but only two steps: not enough to judge.
    expect(bar1).toMatchObject({ runs: 2, steps: 2, medianMs: 2300, wrong: 2, bucket: null });
  });

  it('caps a step left waiting at the idle limit', () => {
    const records = [0, 1, 2].flatMap((r) => run(r, { 0: [{ ms: 600_000 }] }));
    expect(cell(records, 0).medianMs).toBe(60_000);
  });

  it('counts only the last five runs that played the bar, so improvement shows', () => {
    const slow = [0, 1, 2, 3].flatMap((r) => run(r, { 2: [{ ms: 4000 }] }));
    const fast = [4, 5, 6, 7, 8].flatMap((r) => run(r, { 2: [{ ms: 600 }] }));
    const other = [9, 10].flatMap((r) => run(r, { 3: [{ ms: 900 }] }));
    const bar = cell([...slow, ...fast, ...other], 2);
    expect(bar).toMatchObject({ runs: 5, steps: 5, medianMs: 600, bucket: barBucket(600) });
    // Runs that did not play the bar do not push older ones out of its window.
    expect(cell([...slow.slice(1), ...other], 2).runs).toBe(3);
  });

  it('merges both passes of a repeated bar', () => {
    const records = [1, 2].flatMap((r) =>
      run(r, {
        0: [
          { ms: 500, pass: 1 },
          { ms: 900, pass: 2 },
        ],
      }),
    );
    expect(cell(records, 0)).toMatchObject({ runs: 2, steps: 4, passes: 2, medianMs: 700 });
    expect(cell(run(1, { 1: [{ ms: 500, steps: 3 }] }), 1).passes).toBe(1);
  });

  it('keeps the hand selections apart', () => {
    const right = [1, 2].flatMap((r) => run(r, { 0: [{ ms: 500, steps: 2 }] }));
    const left = [3, 4].flatMap((r) => run(r, { 0: [{ ms: 2500, steps: 2 }] }, { hands: 'left' }));
    expect(heat([...right, ...left]).cells[0]!.medianMs).toBe(500);
    expect(heat([...right, ...left], [0], 'left').cells[0]!.medianMs).toBe(2500);
  });

  it('leaves out runs on another version of the score and counts them', () => {
    const current = [1, 2].flatMap((r) => run(r, { 0: [{ ms: 500, steps: 2 }] }));
    const older = [3, 4, 5].flatMap((r) =>
      run(r, { 0: [{ ms: 9000, steps: 2 }] }, { checksum: '00000000' }),
    );
    const olderLeft = run(6, { 0: [{ ms: 9000 }] }, { checksum: '00000000', hands: 'left' });
    const result = heat([...current, ...older, ...olderLeft]);
    expect(result.cells[0]!.medianMs).toBe(500);
    expect(result.staleRuns).toBe(3);
  });

  it('gives every bar asked for a cell, with "not enough data" below two runs or three steps', () => {
    const records = [
      ...run(1, { 0: [{ ms: 500, steps: 5 }], 1: [{ ms: 500 }] }),
      ...run(2, { 1: [{ ms: 500 }] }),
    ];
    const { cells } = heat(records);
    expect(cells.map((c) => [c.measure, c.runs, c.steps, c.bucket])).toEqual([
      [0, 1, 5, null],
      [1, 2, 2, null],
      [2, 0, 0, null],
      [3, 0, 0, null],
    ]);
    expect(cells[2]).toMatchObject({ medianMs: null, wrongPerStep: 0, passes: 0, steady: false });
    const third = run(3, { 1: [{ ms: 500 }] });
    expect(cell([...records, ...third], 1).bucket).toBe(barBucket(500));
  });
});

describe('steady bars', () => {
  it('are at ease with no wrong note in each of the last three runs', () => {
    const early = run(0, { 0: [{ ms: 3000, wrong: 3 }], 1: [{ ms: 400 }] });
    const recent = [1, 2, 3].flatMap((r) =>
      run(r, { 0: [{ ms: 800 }], 1: [{ ms: 400, wrong: r === 2 ? 1 : 0 }], 2: [{ ms: 1000 }] }),
    );
    const { cells } = heat([...early, ...recent]);
    expect(cells.map((c) => c.steady)).toEqual([true, false, false, false]);
    expect(steadyBars(cells)).toEqual({ steady: 1, total: 4 });
    // Two runs are not enough to call a bar steady.
    expect(
      cell(
        recent.filter((s) => s.sessionId !== 'run3'),
        0,
      ).steady,
    ).toBe(false);
  });
});

describe('weakest bars', () => {
  const figures = (measure: number, bucket: number | null, wrongPerStep = 0, medianMs = 0) =>
    ({
      measure,
      runs: 3,
      steps: 6,
      passes: 1,
      medianMs,
      wrong: wrongPerStep * 6,
      wrongPerStep,
      missed: 0,
      bucket,
      steady: false,
    }) satisfies BarCell;
  const straight: PlayedMeasure[] = [0, 1, 2, 3, 4, 5].map((measure) => ({
    measure,
    pass: 1,
    start: measure * 960,
  }));

  it('sort by colour, then wrong notes per step, then time; no data last', () => {
    const cells = [
      figures(0, null),
      figures(1, 3, 0, 1200),
      figures(2, 5, 0, 2500),
      figures(3, 3, 0.5, 1100),
      figures(4, 3, 0, 1400),
    ];
    expect([...cells].sort(byBarWeakness).map((c) => c.measure)).toEqual([2, 3, 4, 1, 0]);
  });

  it('loop the weakest bar alone when its neighbours are fine', () => {
    const cells = [figures(0, 1), figures(1, 5), figures(2, 2), figures(3, null)];
    expect(weakestLoop(cells, straight)).toEqual({ from: 1, to: 1 });
  });

  it('loop a contiguous pair when a neighbour is weak too, the weaker neighbour', () => {
    const cells = [figures(0, 4), figures(1, 6), figures(2, 3, 0.2), figures(3, 0)];
    expect(weakestLoop(cells, straight)).toEqual({ from: 0, to: 1 });
    const after = [figures(0, 3), figures(1, 6), figures(2, 5)];
    expect(weakestLoop(after, straight)).toEqual({ from: 1, to: 2 });
  });

  it('never pair a first ending with the second', () => {
    // Bars 0 1 [2 = 1st ending] then 0 1 [3 = 2nd ending].
    const order: PlayedMeasure[] = [0, 1, 2, 0, 1, 3].map((measure, i) => ({
      measure,
      pass: i < 3 ? 1 : 2,
      start: i * 960,
    }));
    const cells = [figures(0, 0), figures(1, 1), figures(2, 5), figures(3, 6)];
    expect(weakestLoop(cells, order)).toEqual({ from: 3, to: 3 });
  });

  it('pairs only when the weakest bar is weak itself, and needs data', () => {
    const fine = [figures(0, 2, 0, 900), figures(1, 2, 0, 950)];
    expect(weakestLoop(fine, straight)).toEqual({ from: 1, to: 1 });
    expect(weakestLoop([figures(0, null)], straight)).toBeNull();
  });
});

/** Rhythm run `r`: in each bar, notes with these deviations (null: missed), `extra` extras. */
function rhythmRun(
  r: number,
  bars: Record<number, { devs: (number | null)[]; extra?: number }>,
): PieceStep[] {
  return Object.entries(bars).map(([measure, { devs, extra = 0 }], i) =>
    sampleStep(`rhythm${r}`, i, {
      measure: Number(measure),
      ms: 667,
      wrong: extra,
      at: T + r * 600_000 + i * 1000,
      mode: 'rhythm',
      notes: devs.map((deviation, k) => ({ midi: 60 + k, deviation })),
    }),
  );
}

const timing = (records: PieceStep[], bars = [0, 1, 2, 3]) =>
  barHeatmap(records, { checksum: CHECKSUM, hands: 'right', bars, metric: 'timing' });

describe('the timing metric', () => {
  it('has round edges around a 30 ms anchor, at the place of the hesitation anchor', () => {
    expect(TIMING_EDGES_MS).toEqual([10, 20, 30, 50, 75, 100]);
    expect(TIMING_EDGES_MS.indexOf(TIMING_ANCHOR_MS)).toBe(BAR_EDGES_MS.indexOf(ANCHOR_MS));
    expect(barBucket(29, TIMING_EDGES_MS)).toBe(ANCHOR_BUCKET - 1);
    expect(barBucket(30, TIMING_EDGES_MS)).toBe(ANCHOR_BUCKET);
  });

  it('is the median distance from the beat per note, with missed and extra notes per note', () => {
    const records = [
      ...rhythmRun(1, { 0: { devs: [-40, 10, null] }, 1: { devs: [5, 5], extra: 1 } }),
      ...rhythmRun(2, { 0: { devs: [20, -60, 15] }, 1: { devs: [-5, 0] } }),
    ];
    const [bar0, bar1] = timing(records).cells;
    // |−40| 10 20 |−60| 15 → median 20; one missed of six notes.
    expect(bar0).toMatchObject({ runs: 2, steps: 6, medianMs: 20, wrong: 1, missed: 1 });
    expect(bar0!.wrongPerStep).toBeCloseTo(1 / 6, 9);
    expect(bar0!.bucket).toBe(barBucket(20, TIMING_EDGES_MS));
    expect(bar1).toMatchObject({ steps: 4, medianMs: 5, wrong: 1, missed: 0, wrongPerStep: 0.25 });
  });

  it('keeps the modes apart and uses the same window and data rules', () => {
    const waiting = [1, 2, 3].flatMap((r) => run(r, { 0: [{ ms: 3000, steps: 2 }] }));
    const rhythm = [4, 5].flatMap((r) => rhythmRun(r, { 0: { devs: [8, 8] } }));
    expect(heat([...waiting, ...rhythm]).cells[0]).toMatchObject({ runs: 3, medianMs: 3000 });
    expect(timing([...waiting, ...rhythm]).cells[0]).toMatchObject({
      runs: 2,
      medianMs: 8,
      bucket: 0,
    });
    // One run, or fewer than three notes: not enough data.
    expect(timing(rhythmRun(1, { 0: { devs: [8, 8, 8] } })).cells[0]!.bucket).toBeNull();
    expect(
      timing([...rhythmRun(1, { 0: { devs: [8] } }), ...rhythmRun(2, { 0: { devs: [8] } })])
        .cells[0]!.bucket,
    ).toBeNull();
    // Only the last five runs count.
    const old = [1, 2, 3].flatMap((r) => rhythmRun(r, { 0: { devs: [90, 90] } }));
    const recent = [4, 5, 6, 7, 8].flatMap((r) => rhythmRun(r, { 0: { devs: [12, 12] } }));
    expect(timing([...old, ...recent]).cells[0]).toMatchObject({ runs: 5, medianMs: 12 });
  });

  it('a bar whose every note was missed is as far off as the scale goes', () => {
    const missed = [1, 2].flatMap((r) => rhythmRun(r, { 0: { devs: [null, null] } }));
    expect(timing(missed).cells[0]).toMatchObject({
      medianMs: null,
      bucket: TIMING_EDGES_MS.length,
      missed: 4,
    });
  });

  it('a bar is steady in time when its last three runs were within the anchor, nothing missed', () => {
    const tight = [1, 2, 3].flatMap((r) =>
      rhythmRun(r, { 0: { devs: [10, -12] }, 1: { devs: [10, null] } }),
    );
    expect(timing(tight).cells.map((c) => c.steady)).toEqual([true, false, false, false]);
    // Weak: over the anchor, or with missed or extra notes.
    const loose = [1, 2].flatMap((r) =>
      rhythmRun(r, { 0: { devs: [40, 45] }, 1: { devs: [10, 12], extra: 1 } }),
    );
    expect(timing(loose).cells.slice(0, 2).map(isWeak)).toEqual([true, true]);
  });
});
