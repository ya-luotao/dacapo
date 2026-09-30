import { describe, expect, it } from 'vitest';
import { seededRng } from './random.ts';
import { createMatcher, type StepTiming } from './rhythm.ts';
import { cellOnsets, getRhythmLevel } from './rhythmCells.ts';
import {
  buildExercise,
  exerciseOnsets,
  exercisePlan,
  LINE_KEYS,
  msPerTick,
  type RhythmExercise,
} from './rhythmExercise.ts';
import {
  createTapFilter,
  endRhythmSession,
  isExtraTap,
  judgeRhythmRun,
  nextExercise,
  nextRhythmExercise,
  recordRhythmRun,
  recoverRhythmSummary,
  rhythmLevelProgress,
  rhythmStats,
  startRhythmSession,
  suggestedRhythmLevel,
  summarizeRhythmSession,
  unevenness,
  type RhythmAnswer,
  type RhythmLevelProgress,
} from './rhythmRead.ts';
import type { RhythmLevelId } from './rhythmCells.ts';

interface Tap {
  line: number;
  time: number;
}

/** The taps of a perfect run: each onset on time, shifted by `off(onset index)` ms. */
function taps(e: RhythmExercise, bpm: number, off: (i: number) => number | null = () => 0) {
  const perTick = msPerTick(e.meter, bpm);
  return exerciseOnsets(e).flatMap((o, i): Tap[] => {
    const d = off(i);
    return d === null ? [] : [{ line: o.line, time: o.tick * perTick + d }];
  });
}

/** Plays taps through rhythm mode's matcher, as the run does, and judges the run. */
function play(e: RhythmExercise, bpm: number, list: Tap[]) {
  const plan = exercisePlan(e, bpm);
  const matcher = createMatcher(plan);
  const timings: StepTiming[] = [];
  const extras: { line: number; time: number }[] = [];
  for (const tap of [...list].sort((a, b) => a.time - b.time)) {
    timings.push(...matcher.advance(tap.time));
    const result = matcher.play(LINE_KEYS[tap.line]!, tap.time);
    if (isExtraTap(plan, tap.time, result)) extras.push(tap);
  }
  timings.push(...matcher.finish(Infinity));
  return judgeRhythmRun(e, bpm, timings, extras);
}

const e = buildExercise('R5', '4/4', ['q', 'ee', 'ed-s', 'qr', 'h', 'ssss', 'q']);
// 60 beats a minute: a beat is 1000 ms.

describe('judging a run', () => {
  it('finds every cell right when every onset is in time', () => {
    const run = play(
      e,
      60,
      taps(e, 60, (i) => (i % 2 ? 30 : -20)),
    );
    expect(run.cells.map((c) => c.correct)).toEqual([true, true, true, true, true, true, true]);
    expect(run.right).toBe(7);
    expect(run.cells[1]!.deviations).toEqual([[30, -20]]);
    expect(run.cells[3]!).toMatchObject({ key: 'qr', prompt: [[]], deviations: [[]], extras: 0 });
    expect(run.medianDeviation).toBe(20);
    expect(run.onsets.at(-1)).toMatchObject({ cell: -1 });
    expect(run.extras).toEqual([]);
  });

  it('marks a cell wrong for an onset out of time, missed, or a tap extra in its span', () => {
    // Onsets: q(0) ee(1,2) ed-s(3,4) h(5) ssss(6-9) q(10) final(11).
    const list = taps(e, 60, (i) => (i === 1 ? 70 : i === 6 ? null : i === 4 ? -51 : 0));
    // A tap in the rest's span.
    list.push({ line: 0, time: 3500 });
    const run = play(e, 60, list);
    expect(run.cells.map((c) => c.correct)).toEqual([true, false, false, false, true, false, true]);
    expect(run.cells[1]!.deviations).toEqual([[70, 0]]);
    expect(run.cells[2]!.deviations).toEqual([[0, -51]]);
    expect(run.cells[3]!.extras).toBe(1);
    expect(run.cells[5]!.deviations).toEqual([[null, 0, 0, 0]]);
    expect(run.extras).toMatchObject([{ line: 0, time: 3500, cell: 3 }]);
    expect(run.extras[0]!.tick).toBeCloseTo(3360);
  });

  it('judges on whole milliseconds: 50.4 is in time, 50.6 is not', () => {
    const run = play(
      e,
      60,
      taps(e, 60, (i) => (i === 0 ? 50.4 : i === 1 ? -50.6 : 0)),
    );
    expect(run.cells[0]!).toMatchObject({ deviations: [[50]], correct: true });
    expect(run.cells[1]!).toMatchObject({ deviations: [[-51, 0]], correct: false });
  });

  it('takes each hand on its own line: a tap of the wrong hand is extra', () => {
    const hands = buildExercise('R9', '4/4', ['h|q', 'ee|q', 'q|q']);
    const good = taps(hands, 60);
    expect(play(hands, 60, good).right).toBe(3);
    // The left hand's beat 2 played by the right hand.
    const wrong = good.map((t) =>
      t.line === 1 && Math.abs(t.time - 1000) < 1 ? { ...t, line: 0 } : t,
    );
    const run = play(hands, 60, wrong);
    expect(run.cells[0]!).toMatchObject({
      deviations: [[0], [0, null]],
      extras: 1,
      correct: false,
    });
    expect(run.cells.slice(1).every((c) => c.correct)).toBe(true);
  });
});

describe('chords', () => {
  it('count once: a second key of the same hand within 30 ms is not a tap', () => {
    const counts = createTapFilter();
    expect(counts(0, 1000)).toBe(true);
    expect(counts(0, 1020)).toBe(false);
    expect(counts(1, 1020)).toBe(true);
    expect(counts(0, 1040)).toBe(true);
  });
});

function session(level: RhythmLevelId = 'R5', length = 2) {
  let ids = 0;
  const newId = () => `a${++ids}`;
  let s = startRhythmSession({ id: 's1', level, bpm: 60, length, at: 1_000_000, exercise: e });
  return { s, newId, set: (next: typeof s) => (s = next) };
}

describe('a session', () => {
  it('keeps one answer per cell of each run, stamped when the cell ended', () => {
    const { s, newId } = session();
    const run = play(
      e,
      60,
      taps(e, 60, (i) => (i === 1 ? 70 : 0)),
    );
    const next = recordRhythmRun(s, run, 2_000_000, newId);
    expect(next.answers).toHaveLength(7);
    expect(next.runs).toBe(1);
    expect(next.last).toBe(run);
    const [first, second] = next.answers;
    expect(first).toEqual({
      id: 'a1',
      sessionId: 's1',
      family: 'rhythm',
      level: 'R5',
      item: 'rhythm:q:4/4',
      prompt: [[0]],
      answer: { deviations: [[0]], extras: 0 },
      correct: true,
      bpm: 60,
      exercise: 0,
      run: 0,
      at: 2_001_000,
    });
    expect(second).toMatchObject({ item: 'rhythm:ee:4/4', correct: false, at: 2_002_000 });
    expect(next.answers.map((a) => a.prompt)).toEqual(e.cells.map((c) => cellOnsets(c.key, '4/4')));
  });

  it('plays an exercise again, moves on, and ends after the last', () => {
    const { newId } = session();
    let s = session().s;
    const run = play(e, 60, taps(e, 60));
    s = recordRhythmRun(s, run, 2_000_000, newId);
    s = recordRhythmRun(s, run, 2_020_000, newId);
    const other = buildExercise('R5', '4/4', ['w']);
    s = nextRhythmExercise(s, other, 2_030_000);
    expect(s).toMatchObject({ index: 1, exercise: other, last: null, phase: 'running' });
    s = recordRhythmRun(s, play(other, 60, taps(other, 60)), 2_040_000, newId);
    expect(s.answers.map((a) => [a.exercise, a.run]).at(-1)).toEqual([1, 2]);
    s = nextRhythmExercise(s, e, 2_050_000);
    expect(s).toMatchObject({ phase: 'done', endedAt: 2_050_000 });
    const summary = summarizeRhythmSession(s);
    expect(summary).toMatchObject({
      id: 's1',
      level: 'R5',
      bpm: 60,
      length: 2,
      exercises: 2,
      runs: 3,
      cells: 15,
      correct: 15,
      accuracy: 1,
      medianDeviation: 0,
      tendency: 0,
      missed: [],
    });
    // A run after the end is not kept.
    expect(recordRhythmRun(s, run, 3_000_000, newId)).toBe(s);
  });

  it('sums up what was missed, and can be rebuilt from its answers', () => {
    const { newId } = session();
    let s = session().s;
    s = recordRhythmRun(
      s,
      play(
        e,
        60,
        taps(e, 60, (i) => (i < 3 ? 80 : 0)),
      ),
      2_000_000,
      newId,
    );
    s = endRhythmSession(s, 2_100_000);
    const summary = summarizeRhythmSession(s);
    expect(summary.missed).toEqual([
      { item: 'rhythm:ee:4/4', count: 1 },
      { item: 'rhythm:q:4/4', count: 1 },
    ]);
    expect(summary.correct).toBe(5);
    expect(summary.tendency).toBeGreaterThan(0);
    const recovered = recoverRhythmSummary(s.answers)!;
    expect(recovered).toMatchObject({
      id: 's1',
      level: 'R5',
      bpm: 60,
      length: 1,
      exercises: 1,
      cells: 7,
      correct: 5,
      missed: summary.missed,
      startedAt: s.answers[0]!.at,
      endedAt: s.answers.at(-1)!.at,
    });
    expect(recoverRhythmSummary([])).toBeNull();
  });
});

function answer(level: RhythmLevelId, correct: boolean, at: number, dev = 10): RhythmAnswer {
  return {
    id: `x${at}`,
    sessionId: 's',
    family: 'rhythm',
    level,
    item: 'rhythm:q:4/4',
    prompt: [[0]],
    answer: { deviations: [[correct ? dev : 90]], extras: 0 },
    correct,
    bpm: 72,
    exercise: 0,
    run: 0,
    at,
  };
}

describe('mastery', () => {
  it('needs 90 % of the level’s last 40 cells right', () => {
    const answers = Array.from({ length: 40 }, (_, i) => answer('R1', i < 10 || i >= 14, i));
    expect(rhythmLevelProgress(answers, 'R1')).toMatchObject({
      total: 40,
      cells: 40,
      accuracy: 0.9,
      mastered: true,
    });
    expect(rhythmLevelProgress(answers.slice(1), 'R1').mastered).toBe(false);
    // Taps along with the count-in are no extras; a tap in a rest is.
    const plan = exercisePlan(e, 60);
    expect(isExtraTap(plan, -500, { kind: 'ignored' })).toBe(false);
    expect(isExtraTap(plan, 3500, { kind: 'ignored' })).toBe(true);
    expect(isExtraTap(plan, 3500, { kind: 'hit', step: 1, round: 0, midi: 64, deviation: 0 })).toBe(
      false,
    );
    const worse = [...answers, answer('R1', false, 100)];
    expect(rhythmLevelProgress(worse, 'R1')).toMatchObject({ cells: 40, mastered: false });
    // Other levels' cells do not count.
    expect(rhythmLevelProgress(answers, 'R2')).toMatchObject({ total: 0, accuracy: null });
  });

  it('suggests the first level not mastered', () => {
    const progress = new Map<RhythmLevelId, RhythmLevelProgress>([
      [
        'R1',
        { level: 'R1', total: 40, cells: 40, accuracy: 1, medianDeviation: 5, mastered: true },
      ],
    ]);
    expect(suggestedRhythmLevel(progress)).toBe('R2');
    expect(suggestedRhythmLevel(new Map())).toBe('R1');
  });
});

describe('the item model', () => {
  it('weighs a cell by its misses and its unevenness', () => {
    expect(unevenness(answer('R1', true, 0, -30))).toBe(30);
    const stats = rhythmStats([answer('R1', true, 0, 20), answer('R1', false, 1)]);
    expect(stats['rhythm:q:4/4']).toMatchObject({ attempts: 2, errors: 1, ewmaMs: 20 });
  });

  it('draws two bars in R9–R10 until the level’s first 40 cells, then four', () => {
    const level = getRhythmLevel('R10');
    const early = nextExercise(level, [], seededRng(1));
    expect(early.bars).toBe(2);
    expect(early.cells.every((c) => !c.key.includes('trip'))).toBe(true);
    const played = Array.from({ length: 40 }, (_, i) => answer('R10', true, i));
    expect(nextExercise(level, played, seededRng(1)).bars).toBe(4);
    expect(nextExercise(getRhythmLevel('R2'), [], seededRng(1)).bars).toBe(4);
  });
});
