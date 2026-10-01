import { describe, expect, it } from 'vitest';
import { emptyMarkings } from '../../core/markings.ts';
import { performanceOrder } from '../../core/repeats.ts';
import { buildSteps, type HandSelection, type Score, type ScoreNote } from '../../core/score.ts';
import { waitRange } from '../../core/wait.ts';
import { runReducer, startRun, type Run } from './run.ts';

const Q = 960;
const EPOCH = Date.UTC(2026, 8, 25, 9);

/** Two 4/4 bars, the second repeated: right hand C5 D5 per bar, left hand a C3–G3 chord. */
function score(): Score {
  const notes: ScoreNote[] = [];
  const note = (id: string, measure: number, onset: number, midi: number, hand: 'right' | 'left') =>
    notes.push({
      id,
      part: 0,
      measure,
      onset,
      duration: Q,
      midi,
      pitch: { step: 'C', alter: 0, octave: 4 },
      staff: hand === 'right' ? 1 : 2,
      hand,
      voice: '1',
      tieStart: false,
      tieStop: false,
      finger: null,
    });
  for (const m of [0, 1]) {
    note(`r${m}a`, m, m * 4 * Q, 72, 'right');
    note(`r${m}b`, m, m * 4 * Q + Q, 74, 'right');
    note(`l${m}a`, m, m * 4 * Q, 48, 'left');
    note(`l${m}b`, m, m * 4 * Q, 55, 'left');
  }
  const bar = (index: number, backwardTimes: number | null) => ({
    index,
    number: String(index + 1),
    start: index * 4 * Q,
    duration: 4 * Q,
    beats: 4,
    beatType: 4,
    repeat: { forward: index === 1, backwardTimes, ending: [] },
    jumps: [],
  });
  return {
    title: '',
    composer: '',
    parts: [],
    hands: {},
    measures: [bar(0, null), bar(1, 2)],
    notes,
    tempos: [],
    markings: emptyMarkings(),
    warnings: [],
  };
}

function runFor(hands: HandSelection, loop: { from: number; to: number } | null = null, start = 0) {
  const s = score();
  const order = performanceOrder(s.measures);
  const steps = buildSteps(s, hands, order);
  return startRun({ id: 'run', steps, range: waitRange(steps, order, loop, start) });
}

function play(run: Run, keys: number[], time = 0): Run {
  return keys.reduce(
    (r, midi, i) =>
      runReducer(r, { type: 'press', midi, velocity: 64, time: time + i, at: EPOCH + time + i }),
    run,
  );
}

describe('a wait-mode run', () => {
  it('asks each hand for its own notes, and both hands for both', () => {
    expect(runFor('right').steps.map((s) => s.midis)).toEqual([[72], [74], [72], [74], [72], [74]]);
    expect(runFor('left').steps.map((s) => s.midis)).toEqual([
      [48, 55],
      [48, 55],
      [48, 55],
    ]);
    expect(runFor('both').steps[0]!.midis).toEqual([48, 55, 72]);
  });

  it('plays through the repeat to the end and keeps a record per step', () => {
    const done = play(runFor('left'), [55, 48, 48, 55, 55, 48], 1000);
    expect(done.wait).toMatchObject({ finished: true });
    expect(done.records.map((r) => [r.measure, r.pass])).toEqual([
      [0, 1],
      [1, 1],
      [1, 2],
    ]);
    expect(done.startedAt).toBe(1000);
  });

  it('loops a bar, starts from a bar and restarts', () => {
    // Bar 2 loops its first pass; the chord steps come round again.
    let run = runFor('left', { from: 1, to: 1 });
    run = play(run, [48, 55, 48, 55]);
    expect(run.wait).toMatchObject({ current: 1, laps: 2, finished: false });
    expect(runReducer(run, { type: 'end' }).ended).toBe(true);
    // Start from bar 2 without a loop.
    expect(runFor('right', null, 1).wait!.current).toBe(2);
    const fresh = runReducer(run, {
      type: 'restart',
      id: 'next',
      steps: run.steps,
      range: run.range,
    });
    expect(fresh).toMatchObject({ records: [], startedAt: null, ended: false });
  });

  it('remembers the last wrong key for the flash, and ignores keys once finished', () => {
    let run = runFor('right');
    run = runReducer(run, { type: 'press', midi: 60, velocity: 64, time: 5, at: EPOCH + 5 });
    expect(run.wrongKey).toEqual({ midi: 60, at: 5, step: 0 });
    run = runReducer(run, { type: 'clearWrong', key: { midi: 60, at: 4, step: 0 } });
    expect(run.wrongKey).not.toBeNull();
    run = runReducer(run, { type: 'clearWrong', key: run.wrongKey });
    expect(run.wrongKey).toBeNull();
    const done = play(run, [72, 74, 72, 74, 72, 74]);
    expect(play(done, [72])).toBe(done);
    // Nothing started yet: Finish does nothing.
    expect(runReducer(runFor('right'), { type: 'end' }).ended).toBe(false);
  });

  it('takes an ornament’s keys as neither right nor wrong, and names them in the take', () => {
    // A mordent on the first C5 (C–B–C).
    const s = score();
    s.notes.find((n) => n.id === 'r0a')!.ornaments = [{ kind: 'mordent', upper: 74, lower: 71 }];
    const order = performanceOrder(s.measures);
    const steps = buildSteps(s, 'right', order);
    const start = startRun({ id: 'run', steps, range: waitRange(steps, order, null, 0) });
    const run = play(start, [72, 71, 72, 74]);
    expect(run.wait).toMatchObject({ current: 2, wrong: 0 });
    expect(run.wrongKey).toBeNull();
    expect(run.records.map((r) => r.wrong)).toEqual([0, 0]);
    // The lower note names its step; the principal struck again names none, as a key matched to
    // nothing.
    expect(run.take!.events.map((e) => [e[2], e[4]])).toEqual([
      [72, 0],
      [71, 0],
      [72, -1],
      [74, 1],
    ]);
  });
});

describe('a memory-mode run', () => {
  /** The right hand from bar 1, bar 2 hidden (both its passes). */
  function memoryRun(): Run {
    const s = score();
    const order = performanceOrder(s.measures);
    const steps = buildSteps(s, 'right', order);
    return startRun({
      id: 'run',
      steps,
      range: waitRange(steps, order, null, 0),
      memory: { stage: 'alternate', hidden: new Set([1]) },
    });
  }

  it('counts a wrong key or a peek as a prompt only where the bar is hidden', () => {
    let run = memoryRun();
    // Bar 1 is shown: a wrong key there is only wrong, a peek nothing.
    run = play(run, [60]);
    run = runReducer(run, { type: 'peek' });
    expect(run.prompts).toBe(0);
    run = play(run, [72, 74], 10);
    // Bar 2 is hidden: a wrong key and a peek are two prompts on its first step.
    run = play(run, [61], 20);
    run = runReducer(run, { type: 'peek' });
    expect(run.prompts).toBe(2);
    run = play(run, [72, 74, 72, 74], 30);
    expect(run.wait).toMatchObject({ finished: true });
    expect(run.records.map((r) => [r.measure, r.wrong, r.prompts, r.stage])).toEqual([
      [0, 1, 0, 'alternate'],
      [0, 0, 0, 'alternate'],
      [1, 1, 2, 'alternate'],
      [1, 0, 0, 'alternate'],
      [1, 0, 0, 'alternate'],
      [1, 0, 0, 'alternate'],
    ]);
    // Once over, a peek counts no more.
    expect(runReducer(run, { type: 'peek' }).prompts).toBe(0);
  });

  it('keeps no prompts in wait mode', () => {
    const run = play(runFor('right'), [61, 72]);
    expect(run.records[0]).not.toHaveProperty('prompts');
    expect(runReducer(run, { type: 'peek' })).toBe(run);
  });
});
