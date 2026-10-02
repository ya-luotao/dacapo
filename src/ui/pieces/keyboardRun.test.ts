import { describe, expect, it } from 'vitest';
import { waitAdvice } from '../../core/advice.ts';
import { passSteps, pieceRuns } from '../../core/assignments.ts';
import type { PieceTask } from '../../core/assignmentRecords.ts';
import { barHeatmap, barStepsIn } from '../../core/barHeatmap.ts';
import { analyzeExpression } from '../../core/expression.ts';
import type { KeyRange } from '../../core/instrument.ts';
import {
  GIVEN_NOTES,
  keyboardScore,
  PASSED_STEPS,
  SMALL,
  STEPS,
} from '../../core/keyboardFixture.ts';
import type { PieceSessionRecord } from '../../core/log.ts';
import { piecePlan, planSource } from '../../core/piecePlan.ts';
import { isPassed, pieceFacts, type PieceStep } from '../../core/pieceRecords.ts';
import { summarizeRun } from '../../core/pieceRun.ts';
import { accompanied, accompanimentPlan, beyondKeyboard } from '../../core/playback.ts';
import { performanceOrder } from '../../core/repeats.ts';
import {
  gradeRun,
  isRunToTheEnd,
  playedSteps,
  reviewSchedule,
  runNotes,
} from '../../core/review.ts';
import { createMatcher, rhythmPlan } from '../../core/rhythm.ts';
import { summarizeRhythm } from '../../core/rhythmRun.ts';
import { keysOfRun } from '../../core/runKeys.ts';
import { buildSteps } from '../../core/score.ts';
import { takePlayback } from '../../core/takePlayback.ts';
import { TAKE_ON, type TakeEvent } from '../../core/takes.ts';
import { tempoLadder } from '../../core/tempoLadder.ts';
import { pieceStepObservations } from '../../core/trends.ts';
import { waitRange, type BarLoop } from '../../core/wait.ts';
import { createAccompanist } from '../../output/accompany.ts';
import type { Scheduler } from '../../output/scheduler.ts';
import { validatePieceStep, validateSession } from '../../storage/validate.ts';
import { afterRun, stepHand } from './advice.ts';
import {
  givenNotes,
  recordedRun,
  waitRecording,
  type RecordableRun,
  type RecordedRun,
  type RunContext,
} from './record.ts';
import { idleRhythm, rhythmReducer, rhythmTakeDone } from './rhythm.ts';
import { runReducer, startRun, type Run } from './run.ts';

// A run on a keyboard with fewer keys (docs/PERSONAL.md, "The instrument's keys"): what it
// stores, and what every reader of the records makes of it. The piece (`keyboardScore`) goes
// beyond a keyboard of C3–C5 with a chord split between the player and the app, a bass note the
// app holds, a bar that is all the app's and an ornament on a note of the app's.

const EPOCH = Date.UTC(2026, 9, 2, 9);
const DAY = 86_400_000;
const PIECE = 'piece-1';

const score = keyboardScore();
const order = performanceOrder(score.measures);
const facts = pieceFacts(score);
const full = buildSteps(score, 'both', order);
const steps = buildSteps(score, 'both', order, SMALL);
/** The keys the player has, step by step. */
const OWN = steps.map((s) => s.midis);
const OWN_NOTES = OWN.flat().length;

const context = (extra: Partial<RunContext> = {}): RunContext => ({
  pieceId: PIECE,
  checksum: facts.checksum,
  title: 'Beyond the keyboard',
  hands: 'both',
  loop: null,
  repeats: 'play',
  tempo: 100,
  ...extra,
});

interface Played {
  recorded: RecordedRun;
  events: readonly TakeEvent[];
  run: Run;
}

/**
 * A run in wait (or memory) mode on the keyboard `keys`: every key the run waits for, a second
 * apart, `rounds` times round `loop`, with a wrong key before the steps `wrong` names and the
 * app's keys of step 2 struck all the same when `strayGiven`.
 */
function waitRun(
  id: string,
  options: {
    keys?: KeyRange | null;
    day?: number;
    loop?: BarLoop | null;
    rounds?: number;
    wrong?: readonly number[];
    strayGiven?: boolean;
    memory?: boolean;
    /** From one step to the next, ms. */
    gap?: number;
  } = {},
): Played {
  const { keys = SMALL, day = 0, loop = null, rounds = 1, wrong = [] } = options;
  const list = buildSteps(score, 'both', order, keys);
  const range = waitRange(list, order, loop, loop?.from ?? 0);
  const memory = options.memory ? { stage: 'all' as const, hidden: new Set<number>() } : null;
  let run = startRun({ id, steps: list, range, memory });
  let time = 1000;
  const epoch = EPOCH + day * DAY;
  const press = (midi: number) => {
    run = runReducer(run, {
      type: 'press',
      midi,
      velocity: 60 + (midi % 20),
      time,
      at: epoch + time,
    });
    run = runReducer(run, { type: 'input', input: { type: 'off', midi, time: time + 200 } });
    time += 10;
  };
  for (let round = 0; round < rounds; round++) {
    for (let i = range!.first; i <= range!.last; i++) {
      const step = list[i]!;
      if (step.midis.length === 0) continue;
      time += options.gap ?? 800;
      if (wrong.includes(i)) press(30);
      if (options.strayGiven) for (const midi of step.given ?? []) press(midi);
      for (const midi of step.midis) press(midi);
    }
  }
  if (loop) run = runReducer(run, { type: 'end' });
  const labelled = loop && {
    ...loop,
    fromLabel: String(loop.from + 1),
    toLabel: String(loop.to + 1),
  };
  const recorded = recordedRun(
    waitRecording(run),
    context({ loop: labelled, ...(options.memory && { mode: 'memory' }) }),
  )!;
  return { recorded, events: run.take!.events, run };
}

/** A run in rhythm mode on the keyboard `keys`: every key the player has `late` ms after its beat. */
function rhythmRun(
  id: string,
  options: {
    keys?: KeyRange | null;
    day?: number;
    loop?: BarLoop | null;
    rounds?: number;
    late?: number;
    tempo?: number;
    miss?: readonly number[];
  } = {},
): Played & { timings: ReturnType<ReturnType<typeof createMatcher>['finish']> } {
  const {
    keys = SMALL,
    day = 0,
    loop = null,
    rounds = 1,
    late = 10,
    tempo = 100,
    miss = [],
  } = options;
  const list = buildSteps(score, 'both', order, keys);
  const plan = rhythmPlan({
    score,
    order,
    steps: list,
    loop,
    startBar: loop?.from ?? 0,
    scale: tempo / 100,
  })!;
  const matcher = createMatcher(plan);
  const origin = 5000;
  let state = rhythmReducer(idleRhythm('idle'), {
    type: 'start',
    id,
    epochOrigin: EPOCH + day * DAY,
    origin,
    latency: 0,
  });
  for (let round = 0; round < rounds; round++) {
    for (const step of plan.steps) {
      const due = round * plan.length + step.at;
      state = rhythmReducer(state, { type: 'settled', timings: matcher.advance(due - 20) });
      for (const midi of step.midis) {
        if (miss.includes(step.step)) continue;
        const at = due + late;
        const result = matcher.play(midi, at);
        state = rhythmReducer(state, {
          type: 'played',
          result,
          midi,
          velocity: 70,
          time: origin + at,
        });
        state = rhythmReducer(state, {
          type: 'input',
          input: { type: 'off', midi, time: origin + at + 300 },
        });
      }
    }
  }
  state = rhythmReducer(state, {
    type: 'settled',
    timings: matcher.finish(rounds * plan.length + 400),
  });
  state = rhythmReducer(state, { type: 'end', reason: loop ? 'stopped' : 'done' });
  const run: RecordableRun = {
    id: state.id,
    records: state.records,
    startedEpoch: state.startedEpoch,
    ended: { completed: true },
    take: state.take,
    takeDone: rhythmTakeDone(state),
  };
  const labelled = loop && {
    ...loop,
    fromLabel: String(loop.from + 1),
    toLabel: String(loop.to + 1),
  };
  const recorded = recordedRun(run, context({ loop: labelled, tempo, mode: 'rhythm' }))!;
  return { recorded, events: state.take!.events, run: undefined as never, timings: state.timings };
}

const sessionsOf = (...runs: Played[]): PieceSessionRecord[] => runs.map((r) => r.recorded.session);
const stepsOf = (...runs: Played[]): PieceStep[] => runs.flatMap((r) => r.recorded.steps);

describe('what a wait run on a keyboard with fewer keys stores', () => {
  const run = waitRun('w1', { wrong: [3] });
  const { session, steps: records } = run.recorded;

  it('a record for every step, the steps passed marked and without time or wrong notes', () => {
    expect(records).toHaveLength(STEPS);
    expect(records.map((r) => [r.measure, r.pass])).toEqual(full.map((s) => [s.measure, s.pass]));
    const passed = records.filter(isPassed);
    expect(passed.map((r) => r.id)).toEqual(['w1:00004', 'w1:00005']);
    for (const r of passed) expect(r).toMatchObject({ notes: [], ms: 0, wrong: 0, measure: 2 });
    // The steps the player played are as they always were: no mode, no notes.
    for (const r of records.filter((s) => !isPassed(s))) {
      expect(Object.keys(r).sort()).toEqual([
        'at',
        'checksum',
        'hands',
        'id',
        'measure',
        'ms',
        'pass',
        'pieceId',
        'sessionId',
        'wrong',
      ]);
    }
    // The piece's own checksum: its notes did not change.
    expect(new Set(records.map((r) => r.checksum))).toEqual(new Set([facts.checksum]));
  });

  it('a session with the steps the player had and the notes played for them', () => {
    expect(session).toMatchObject({
      steps: STEPS - PASSED_STEPS,
      wrong: 1,
      completed: true,
      given: GIVEN_NOTES,
    });
    expect(givenNotes(run.run.records)).toBe(GIVEN_NOTES);
    // On 88 keys nothing is passed and nothing given: the session has no such field.
    const whole = waitRun('w88', { keys: null }).recorded;
    expect(whole.session.steps).toBe(STEPS);
    expect('given' in whole.session).toBe(false);
    expect(whole.steps.some((s) => 'notes' in s)).toBe(false);
  });

  it('a take of the keys the player pressed, and only those', () => {
    const downs = run.events.filter((e) => e[1] === TAKE_ON);
    expect(downs.map((e) => [e[2], e[4]])).toEqual([
      [48, 0],
      [60, 0],
      [64, 1],
      [67, 2],
      [30, -1],
      [62, 3],
      [52, 6],
      [48, 7],
      [60, 7],
      [48, 8],
      [60, 8],
    ]);
    // A key of the app's struck all the same matches nothing, and is no wrong note.
    const stray = waitRun('w2', { strayGiven: true });
    expect(stray.recorded.session.wrong).toBe(0);
    const strays = stray.events.filter((e) => e[1] === TAKE_ON && [43, 76, 81].includes(e[2]!));
    expect(strays.map((e) => e[4])).toEqual([-1, -1, -1]);
  });

  it('records that every build validates as written', () => {
    for (const r of records) expect(validatePieceStep(r)).toEqual({ ok: true, value: r });
    expect(validateSession(session)).toEqual({ ok: true, value: session });
    const memory = waitRun('m1', { memory: true }).recorded;
    expect(memory.steps.filter(isPassed)).toHaveLength(PASSED_STEPS);
    for (const r of memory.steps) {
      expect(r).toMatchObject({ mode: 'memory', prompts: 0, stage: 'all' });
      expect(validatePieceStep(r)).toEqual({ ok: true, value: r });
    }
    expect(memory.session).toMatchObject({ mode: 'memory', steps: STEPS - PASSED_STEPS, given: 5 });
    expect(validateSession(memory.session)).toEqual({ ok: true, value: memory.session });
  });

  it('a summary of the steps the player had', () => {
    const summary = summarizeRun(run.run.records);
    expect(summary).toMatchObject({ steps: STEPS - PASSED_STEPS, wrong: 1 });
    // The bar that is all the app's took no time: it is no bar of the player's.
    expect(summary.slowest.map((bar) => bar.measure)).not.toContain(2);
  });
});

describe('what a rhythm run on a keyboard with fewer keys stores', () => {
  const run = rhythmRun('r1', { miss: [3] });
  const { session, steps: records } = run.recorded;

  it('a record for every step, its notes those the player had', () => {
    expect(records).toHaveLength(STEPS);
    expect(records.map((r) => r.notes!.map((n) => n.midi))).toEqual(OWN);
    expect(records.every((r) => r.mode === 'rhythm')).toBe(true);
    expect(records.filter(isPassed).map((r) => r.measure)).toEqual([2, 2]);
    for (const r of records) expect(validatePieceStep(r)).toEqual({ ok: true, value: r });
  });

  it('a session whose notes, hits and notes in time are of the player’s notes', () => {
    expect(session).toMatchObject({
      mode: 'rhythm',
      steps: STEPS - PASSED_STEPS,
      rhythm: { notes: OWN_NOTES, hits: OWN_NOTES - 1, inTime: OWN_NOTES - 1 },
      given: GIVEN_NOTES,
    });
    expect(validateSession(session)).toEqual({ ok: true, value: session });
    const summary = summarizeRhythm(run.timings);
    expect(summary).toMatchObject({ notes: OWN_NOTES, hits: OWN_NOTES - 1, missed: 1, extra: 0 });
  });

  it('a take of the keys the player pressed', () => {
    const downs = run.events.filter((e) => e[1] === TAKE_ON);
    expect(downs.every((e) => e[2]! >= SMALL.low && e[2]! <= SMALL.high)).toBe(true);
    expect(downs).toHaveLength(OWN_NOTES - 1);
  });
});

describe('the review schedule', () => {
  it('counts the run as a run to the end, the bar that is all the app’s gone through', () => {
    const run = waitRun('w1');
    expect(facts.bars.both).toBe(5);
    expect(isRunToTheEnd(run.recorded.session, run.recorded.steps, facts)).toBe(true);
    const schedule = reviewSchedule(PIECE, sessionsOf(run), stepsOf(run), facts, 'UTC')!;
    expect(schedule.runs).toHaveLength(1);
    expect(schedule).toMatchObject({ stage: 0, interval: 1, due: '2026-10-03' });
    const timed = rhythmRun('r1');
    expect(isRunToTheEnd(timed.recorded.session, timed.recorded.steps, facts)).toBe(true);
  });

  it('grades it on the notes the player had', () => {
    const run = waitRun('w1');
    // The piece asks for 15 keys; 5 were played for the player.
    expect(facts.notes).toEqual({ play: 15, skip: 15 });
    expect(runNotes(run.recorded.session, facts)).toBe(OWN_NOTES);
    expect(gradeRun(run.recorded.session, run.recorded.steps, facts)).toBe('better');
    // One wrong note in the ten the player had is one in ten; in fifteen it would be fewer.
    const slip = waitRun('w2', { wrong: [1] }).recorded;
    expect(gradeRun(slip.session, slip.steps, facts)).toBe('same');
    expect(gradeRun({ ...slip.session, given: 6 }, slip.steps, facts)).toBe('worse');
    expect(gradeRun({ ...slip.session, given: undefined }, slip.steps, facts)).toBe('same');
    // In rhythm mode the notes due are the player's already.
    const timed = rhythmRun('r1').recorded;
    expect(gradeRun(timed.session, timed.steps, facts)).toBe('better');
    const missed = rhythmRun('r2', { miss: [0] }).recorded;
    expect(missed.session.rhythm).toMatchObject({ notes: OWN_NOTES, hits: OWN_NOTES - 2 });
    expect(gradeRun(missed.session, missed.steps, facts)).toBe('worse');
  });

  it('leaves the steps passed out of the run’s median step and of its bars', () => {
    const run = waitRun('w1').recorded;
    expect(playedSteps(run.steps)).toHaveLength(STEPS - PASSED_STEPS);
    // Were more than half its steps passed ones counted with no time, the median step would be
    // 0 and every bar played "slow": the run could never move the interval up.
    const many = [
      ...run.steps,
      ...Array.from({ length: 12 }, (_, n) => ({ ...run.steps[4]!, id: `w1:x${n}` })),
    ];
    expect(gradeRun(run.session, many, facts)).toBe('better');
    expect(
      gradeRun(
        run.session,
        many.map((step) => {
          const bare = { ...step };
          delete bare.notes;
          return bare;
        }),
        facts,
      ),
    ).toBe('same');
  });
});

describe('an assignment', () => {
  const task = (extra: Partial<PieceTask>): PieceTask => ({
    kind: 'piece',
    id: 't1',
    piece: { id: PIECE, title: 'Beyond the keyboard', composer: '', checksum: facts.checksum },
    bars: null,
    hands: 'both',
    mode: 'wait',
    tempo: 40,
    runs: 1,
    pass: passSteps(score, 'both', null),
    ...extra,
  });
  const input = (...runs: Played[]) => ({
    steps: new Map([[PIECE, stepsOf(...runs)]]),
    pieces: [{ id: PIECE, checksum: facts.checksum }],
  });

  it('counts a run through the piece as a run, its notes right those the player had', () => {
    expect(task({}).pass).toEqual({ play: STEPS, skip: STEPS });
    const clean = waitRun('w1');
    expect(pieceRuns(task({}), sessionsOf(clean), input(clean))).toMatchObject([
      { right: 1, inTime: null },
    ]);
    // One wrong note in the seven steps the player had, not in nine.
    const slip = waitRun('w2', { wrong: [1] });
    expect(pieceRuns(task({}), sessionsOf(slip), input(slip))[0]!.right).toBeCloseTo(1 - 1 / 7, 4);
    // Without its step records: from the session, which counts the player's steps too.
    expect(pieceRuns(task({}), sessionsOf(slip), { pieces: input().pieces })[0]!.right).toBeCloseTo(
      1 - 1 / 7,
      4,
    );
  });

  it('tells the times round a loop apart, the steps passed among them', () => {
    const loop = { from: 1, to: 2, fromLabel: '2', toLabel: '3' };
    const looped = task({ bars: loop, pass: passSteps(score, 'both', loop) });
    expect(looped.pass).toEqual({ play: 4, skip: 4 });
    const run = waitRun('w3', { loop: { from: 1, to: 2 }, rounds: 3 });
    expect(run.recorded.steps).toHaveLength(12);
    expect(pieceRuns(looped, sessionsOf(run), input(run))).toHaveLength(3);
  });

  it('measures a rhythm run by the player’s notes: right and in time', () => {
    const timed = task({ mode: 'rhythm', goal: { measure: 'inTime', percent: 80 } });
    const run = rhythmRun('r1', { miss: [3] });
    expect(pieceRuns(timed, sessionsOf(run), input(run))).toMatchObject([
      { right: 0.9, inTime: 0.9 },
    ]);
    const looped = task({
      mode: 'rhythm',
      bars: { from: 1, to: 2, fromLabel: '2', toLabel: '3' },
      pass: passSteps(score, 'both', { from: 1, to: 2 }),
    });
    const rounds = rhythmRun('r2', { loop: { from: 1, to: 2 }, rounds: 2 });
    expect(pieceRuns(looped, sessionsOf(rounds), input(rounds))).toMatchObject([
      { right: 1, inTime: 1 },
      { right: 1, inTime: 1 },
    ]);
  });
});

describe('the bar heatmap', () => {
  const bars = [0, 1, 2, 3, 4];
  const barSteps = barStepsIn(full);

  it('counts the steps the player had: the bar that is all the app’s held nobody up, and is steady', () => {
    const runs = [0, 1, 2].map((day) => waitRun(`w${day}`, { day }));
    const { cells, staleRuns } = barHeatmap(stepsOf(...runs), {
      checksum: facts.checksum,
      hands: 'both',
      bars,
      barSteps,
    });
    expect(staleRuns).toBe(0);
    expect(cells.map((c) => [c.runs, c.steps])).toEqual([
      [3, 6],
      [3, 6],
      [3, 0],
      [3, 6],
      [3, 3],
    ]);
    // No step of the player's there: nothing to colour, and nothing that hesitates.
    expect(cells[2]).toMatchObject({ medianMs: 0, wrong: 0, bucket: null, steady: true });
    expect(cells.every((c) => c.steady)).toBe(true);
  });

  it('judges a bar with a step passed among the player’s by the player’s steps alone', () => {
    // A keyboard up to B5: in bar 3 the C6 is passed and the B5 is the player's.
    const upToB5 = { low: 48, high: 83 };
    const runs = [0, 1, 2].map((day) => waitRun(`w${day}`, { day, keys: upToB5, gap: 900 }));
    const mixed = runs[0]!.recorded.steps.filter((s) => s.measure === 2);
    expect(mixed.map((s) => [isPassed(s), s.ms])).toEqual([
      [true, 0],
      [false, 910],
    ]);
    const { cells } = barHeatmap(stepsOf(...runs), {
      checksum: facts.checksum,
      hands: 'both',
      bars,
      barSteps,
    });
    // Three steps of the player’s, each 910 ms: not six with a median of 455.
    expect(cells[2]).toMatchObject({ runs: 3, steps: 3, medianMs: 910, wrong: 0, steady: true });
    // One wrong note on the B5 is one in three steps of the player's.
    const slips = [0, 1, 2].map((day) =>
      waitRun(`s${day}`, { day, keys: upToB5, gap: 900, wrong: day === 2 ? [5] : [] }),
    );
    const slipped = barHeatmap(stepsOf(...slips), {
      checksum: facts.checksum,
      hands: 'both',
      bars,
      barSteps,
    }).cells[2]!;
    expect(slipped).toMatchObject({ steps: 3, wrong: 1, steady: false });
    expect(slipped.wrongPerStep).toBeCloseTo(1 / 3, 6);
  });

  it('tells the rounds of a loop apart as on 88 keys', () => {
    const run = waitRun('w1', { loop: { from: 1, to: 2 }, rounds: 3 });
    const { cells } = barHeatmap(run.recorded.steps, {
      checksum: facts.checksum,
      hands: 'both',
      bars: [1, 2],
      barSteps,
    });
    expect(cells.map((c) => c.runs)).toEqual([3, 3]);
    expect(cells.every((c) => c.steady)).toBe(true);
  });

  it('judges the timing of the player’s notes', () => {
    const runs = [0, 1, 2].map((day) => rhythmRun(`r${day}`, { day }));
    const { cells } = barHeatmap(stepsOf(...runs), {
      checksum: facts.checksum,
      hands: 'both',
      bars,
      metric: 'timing',
      barSteps,
    });
    // Notes due per bar over three runs: 3, 2, none, 3 and 2 a run.
    expect(cells.map((c) => c.steps)).toEqual([9, 6, 0, 9, 6]);
    expect(cells[1]).toMatchObject({ medianMs: 10, wrong: 0, missed: 0, steady: true });
    // A bar without a note of the player's has no timing to show.
    expect(cells[2]).toMatchObject({ medianMs: null, wrong: 0, bucket: null });
  });
});

describe('the plan, the ladder, the advice and the trend', () => {
  const source = planSource(score);

  it('ticks a hand’s stage, a phrase in time and the whole piece', () => {
    const runs = [
      ...[0, 1, 2].map((day) => waitRun(`w${day}`, { day })),
      rhythmRun('r1', { day: 3, tempo: 60 }),
    ];
    const plan = piecePlan({
      pieceId: PIECE,
      ...source,
      sessions: sessionsOf(...runs),
      steps: stepsOf(...runs),
    });
    const stage = (row: number, name: string) =>
      plan.rows[row]!.stages[plan.stages.indexOf(name as never)]!;
    // Bars 1–4 are a phrase, bar 5 another: together is steady, the bar passed with it.
    expect(plan.rows.map((row) => [row.phrase.from, row.phrase.to])).toEqual([
      [0, 3],
      [4, 4],
    ]);
    expect(stage(0, 'together').done).toBe(true);
    expect(stage(0, 'inTime').done).toBe(true);
    expect(stage(1, 'inTime').done).toBe(true);
    expect(plan.whole.done).toBe(true);
  });

  it('climbs the ladder with a clean rhythm run to the end', () => {
    const run = rhythmRun('r1', { tempo: 60 });
    expect(tempoLadder(PIECE, 'both', sessionsOf(run), stepsOf(run), facts)).toEqual({
      reached: 60,
      next: 70,
    });
  });

  it('advises from the player’s notes and steps', () => {
    const run = waitRun('w1');
    const after = afterRun(run.recorded, { sessions: [], steps: [] }, facts, false);
    expect(after).toMatchObject({
      whole: true,
      notes: OWN_NOTES,
      review: { kind: 'new', days: 1 },
    });
    const byId = new Map(score.notes.map((n) => [n.id, n]));
    const own = run.run.records.filter((r) => !r.passed);
    expect(own).toHaveLength(STEPS - PASSED_STEPS);
    const advice = waitAdvice({
      stage: null,
      hands: 'both',
      twoHands: true,
      steps: own.map((r) => ({
        measure: r.measure,
        ms: r.ms,
        wrong: r.wrong,
        hand: stepHand(run.run.steps[r.step], (id) => byId.get(id)?.hand),
      })),
      notes: after.notes,
      whole: after.whole,
      next: after.ladder.next,
    });
    expect(advice).toMatchObject({ rule: 'toRhythm', tempo: 60 });
    // A step whose other note is the app's is the hand's whose note the player had.
    expect(stepHand(run.run.steps[6], (id) => byId.get(id)?.hand)).toBe('left');
    expect(stepHand(run.run.steps[2], (id) => byId.get(id)?.hand)).toBe('right');
  });

  it('counts in the trend the steps the player had', () => {
    const run = waitRun('w1', { wrong: [1] });
    const { wait } = pieceStepObservations(run.recorded.steps);
    expect(wait).toHaveLength(STEPS - PASSED_STEPS);
    expect(wait.filter((o) => o.value === 0)).toHaveLength(1);
    const timed = rhythmRun('r1');
    expect(pieceStepObservations(timed.recorded.steps).timed).toHaveLength(OWN_NOTES);
  });
});

describe('a past run read on any keyboard', () => {
  const sameSteps = (keys: KeyRange | null) =>
    expect(buildSteps(score, 'both', order, keys).map((s) => [s.midis, s.given])).toEqual(
      steps.map((s) => [s.midis, s.given]),
    );

  it('tells its keyboard from its take in wait mode, as far as its notes go', () => {
    const run = waitRun('w1');
    const keys = keysOfRun({
      score,
      hands: 'both',
      repeats: 'play',
      loop: null,
      mode: 'wait',
      given: run.recorded.session.given,
      events: run.events,
    });
    // G2 was the app's, C3 the player's; G4 the player's highest, E5 the app's.
    expect(keys).toEqual({ low: 44, high: 75 });
    sameSteps(keys);
  });

  it('tells it from its step records in rhythm mode, a missed note being the player’s', () => {
    const run = rhythmRun('r1', { miss: [2, 3] });
    const input = {
      score,
      hands: 'both' as const,
      repeats: 'play' as const,
      loop: null,
      mode: 'rhythm' as const,
      given: run.recorded.session.given,
      events: run.events,
    };
    const keys = keysOfRun({ ...input, records: run.recorded.steps });
    expect(keys).toEqual({ low: 44, high: 75 });
    sameSteps(keys);
    // Without its records the take cannot tell a note missed from one played for the player.
    expect(keysOfRun(input)).toBeNull();
  });

  it('has every key for a run with nothing played for the player', () => {
    const run = waitRun('w88', { keys: null });
    expect(run.recorded.session.given).toBeUndefined();
    expect(
      keysOfRun({
        score,
        hands: 'both',
        repeats: 'play',
        loop: null,
        mode: 'wait',
        events: run.events,
      }),
    ).toBeNull();
  });

  it('judges nothing of the notes that were the app’s', () => {
    const run = waitRun('w1');
    const analysis = (keys: KeyRange | null) =>
      analyzeExpression({
        score,
        hands: 'both',
        repeats: 'play',
        loop: null,
        mode: 'wait',
        events: run.events,
        keys,
      });
    const read = analysis({ low: 44, high: 75 });
    // The accent and the mordent are on A5, which the app played.
    expect(read.dynamics.judgements.filter((j) => j.kind === 'accent')).toEqual([]);
    expect(read.ornaments).toEqual({ inScore: false, judgements: [] });
    expect(read.notes).toHaveLength(OWN_NOTES);
    // Read as a run on 88 keys, the accent would be one the player missed.
    const mistaken = analysis(null);
    expect(mistaken.dynamics.judgements.filter((j) => j.kind === 'accent')).toMatchObject([
      { verdict: 'missed' },
    ]);
    expect(mistaken.ornaments.inScore).toBe(true);
  });

  it('plays the run back whole: the player’s keys and the notes the app played for them', () => {
    // Played slowly: the app's notes after a step have sounded before the next step is played.
    // (Played on at once, they are dropped, as the other hand's are: see the last test.)
    const run = waitRun('w1', { wrong: [3], strayGiven: true, gap: 3000 });
    const playback = (keys: KeyRange | null) =>
      takePlayback({
        score,
        hands: 'both',
        repeats: 'play',
        loop: null,
        mode: 'wait',
        tempo: 100,
        latency: 0,
        events: run.events,
        keys,
        givenVelocity: 44,
      })!;
    const whole = playback({ low: 44, high: 75 });
    const strokes = run.events.filter((e) => e[1] === TAKE_ON);
    const app = whole.plan.notes.filter((n) => n.velocity === 44);
    // E5 and G2 with the chord, C6 and B5 a beat and two after D4, A5 and its mordent with E3.
    expect(app.map((n) => n.midi)).toEqual([43, 76, 84, 83, 81, 79, 81]);
    expect(whole.plan.notes).toHaveLength(strokes.length + app.length);
    const at = (midi: number) => strokes.find((e) => e[2] === midi)![0]!;
    expect(app[0]!.on).toBe(at(67));
    expect(Math.round(app[2]!.on - at(62))).toBe(1000);
    expect(Math.round(app[3]!.on - at(62))).toBe(2000);
    expect(app[4]!.on).toBe(at(52));
    // The wrong key is shown as one; a key of the app's struck by the player is not.
    expect(whole.keys.filter((k) => k.wrong).map((k) => k.midi)).toEqual([30]);
    // Read as a run on 88 keys, the app's notes would be missing and its keys wrong ones.
    const bare = playback(null);
    expect(bare.plan.notes).toHaveLength(strokes.length);
    expect(bare.keys.filter((k) => k.wrong).length).toBeGreaterThan(1);
  });

  it('plays a rhythm run back with the app’s notes on its beat', () => {
    const run = rhythmRun('r1');
    const playback = takePlayback({
      score,
      hands: 'both',
      repeats: 'play',
      loop: null,
      mode: 'rhythm',
      tempo: 100,
      latency: 0,
      events: run.events,
      keys: { low: 44, high: 75 },
      givenVelocity: 44,
    })!;
    const app = playback.plan.notes.filter((n) => n.velocity === 44);
    expect(app.map((n) => [n.midi, Math.round(n.on)]).slice(0, 5)).toEqual([
      [43, 2000],
      [76, 2000],
      [84, 4000],
      [83, 5000],
      [81, 6000],
    ]);
  });
});

describe('the notes the app plays as the run goes', () => {
  it('are what a run played back plays again (the accompanist and its reading agree)', () => {
    const plan = accompanimentPlan({
      score,
      order,
      steps,
      hand: null,
      include: beyondKeyboard('both', SMALL)!,
      loop: null,
      scale: 1,
    })!;
    const completions = [
      { step: 0, at: 1000 },
      { step: 1, at: 1900 },
      { step: 2, at: 2800 },
      { step: 3, at: 3300 },
      { step: 6, at: 6900 },
      { step: 7, at: 7800 },
      { step: 8, at: 8700 },
    ];
    // A scheduler that keeps what it is asked to play: nothing is on its way yet.
    const played: { midi: number; on: number; off: number }[] = [];
    const dropped = new Set<number>();
    const scheduler = {
      playAll(notes: readonly { midi: number; on: number; off: number }[]) {
        return notes.map((n) => played.push({ midi: n.midi, on: n.on, off: n.off }) - 1);
      },
      drop(id: number) {
        dropped.add(id);
        return true;
      },
      cut(id: number, when: number) {
        played[id]!.off = Math.min(played[id]!.off, when);
      },
    } as unknown as Scheduler;
    const accompanist = createAccompanist(scheduler, { now: () => 0 } as never);
    for (const { step, at } of completions) accompanist.complete(plan, step, at, 60);
    const live = played
      .filter((_, id) => !dropped.has(id))
      .sort((a, b) => a.on - b.on || a.midi - b.midi);
    expect(accompanied(plan, completions)).toEqual(live);
    expect(live.map((n) => n.midi)).toEqual([43, 76, 84, 83, 81, 79, 81]);
  });
});
