// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { PieceSessionRecord } from '../../core/log.ts';
import { emptyMarkings } from '../../core/markings.ts';
import { performanceOrder } from '../../core/repeats.ts';
import { buildSteps, type Score, type ScoreNote } from '../../core/score.ts';
import { waitRange } from '../../core/wait.ts';
import { createPracticeStore, type PracticeStore } from '../practice/store.ts';
import { useRunRecorder, waitRecording, type RecordableRun, type RunContext } from './record.ts';
import type { TakeEvent, TakeInput, TakeState } from '../../core/takes.ts';
import { runReducer, startRun, type Run } from './run.ts';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const Q = 960;
const EPOCH = Date.UTC(2026, 8, 25, 9);

/** Two bars of two quarter notes for the right hand: C5 D5 | E5 F5. */
function score(): Score {
  const notes = [72, 74, 76, 77].map((midi, i): ScoreNote => ({
    id: `n${i}`,
    part: 0,
    measure: i >> 1,
    onset: i * Q,
    duration: Q,
    midi,
    pitch: { step: 'C', alter: 0, octave: 5 },
    staff: 1,
    hand: 'right',
    voice: '1',
    tieStart: false,
    tieStop: false,
    finger: null,
  }));
  const measure = (index: number) => ({
    index,
    number: String(index + 1),
    start: index * 2 * Q,
    duration: 2 * Q,
    beats: 2,
    beatType: 4,
    repeat: { forward: false, backwardTimes: null, ending: [] },
    jumps: [],
  });
  return {
    title: 'Two bars',
    composer: '',
    parts: [],
    hands: { '0.1': 'right' },
    measures: [measure(0), measure(1)],
    notes,
    tempos: [],
    markings: emptyMarkings(),
    warnings: [],
  };
}

function newRun(id: string): Run {
  const s = score();
  const order = performanceOrder(s.measures);
  const steps = buildSteps(s, 'right', order);
  return startRun({ id, steps, range: waitRange(steps, order, null, 0) });
}

const press = (run: Run, midi: number, time: number) =>
  runReducer(run, { type: 'press', midi, velocity: 64, time, at: EPOCH + time });

const CONTEXT: RunContext = {
  pieceId: 'two-bars',
  checksum: 'abcdef01',
  title: 'Two bars',
  hands: 'right',
  loop: null,
  repeats: 'play',
  tempo: 80,
};

function Recorder({ run, store }: { run: Run; store: PracticeStore }) {
  useRunRecorder(waitRecording(run), CONTEXT, store);
  return null;
}

function RhythmRecorder({ run, store }: { run: RecordableRun; store: PracticeStore }) {
  useRunRecorder(run, { ...CONTEXT, mode: 'rhythm' }, store);
  return null;
}

let root: Root;
let store: PracticeStore;
let stop: () => void;

function render(run: Run) {
  act(() => root.render(createElement(Recorder, { run, store })));
}

const pieceSessions = () =>
  store.getSnapshot().sessions.filter((s): s is PieceSessionRecord => s.kind === 'piece');

beforeEach(() => {
  root = createRoot(document.createElement('div'));
  store = createPracticeStore();
  stop = store.start();
});

afterEach(() => {
  act(() => root.unmount());
  stop();
});

describe('recording runs', () => {
  it('stores each step as it is completed and the session when the run finishes', async () => {
    let run = newRun('r1');
    render(run);
    run = press(run, 72, 1_000);
    render(run);
    run = press(run, 60, 1_300); // wrong
    run = press(run, 74, 1_800);
    render(run);
    store.loadPieceSteps('two-bars');
    await store.settled();
    await new Promise((resolve) => setTimeout(resolve));
    expect(store.getPieceSteps('two-bars')).toEqual([
      {
        id: 'r1:00000',
        sessionId: 'r1',
        pieceId: 'two-bars',
        checksum: 'abcdef01',
        hands: 'right',
        measure: 0,
        pass: 1,
        ms: 0,
        wrong: 0,
        at: EPOCH + 1_000,
      },
      expect.objectContaining({ id: 'r1:00001', measure: 0, ms: 800, wrong: 1 }),
    ]);
    expect(pieceSessions()).toEqual([]);

    run = press(press(run, 76, 2_500), 77, 3_000);
    render(run);
    expect(pieceSessions()).toEqual([
      {
        kind: 'piece',
        id: 'r1',
        pieceId: 'two-bars',
        title: 'Two bars',
        hands: 'right',
        loop: null,
        repeats: 'play',
        tempo: 80,
        startedAt: EPOCH + 1_000,
        endedAt: EPOCH + 3_000,
        activeMs: 2_000,
        steps: 4,
        wrong: 1,
        completed: true,
      },
    ]);
  });

  it('records a run that is restarted or left after a step, and none without a step', () => {
    let run = press(newRun('r1'), 72, 1_000);
    render(run);
    // Restarted: a new run replaces it.
    run = newRun('r2');
    render(run);
    expect(pieceSessions().map((s) => [s.id, s.steps, s.completed])).toEqual([['r1', 1, false]]);
    // A run without a completed step leaves nothing, even when replaced.
    render(newRun('r3'));
    run = press(press(newRun('r4'), 72, 5_000), 74, 5_600);
    render(run);
    act(() => root.unmount());
    root = createRoot(document.createElement('div'));
    expect(pieceSessions().map((s) => [s.id, s.steps, s.completed])).toEqual([
      ['r4', 2, false],
      ['r1', 1, false],
    ]);
  });

  it('does not count listening to the demo as hesitation or practice', () => {
    let run = press(newRun('r1'), 72, 1_000);
    // The demo plays for a minute and a half; the next key restarts the step's clock.
    run = runReducer(run, { type: 'pauseClock' });
    run = press(run, 74, 91_000);
    run = press(run, 76, 91_700);
    run = press(run, 77, 92_000);
    render(run);
    expect(run.records.map((r) => r.ms)).toEqual([0, 0, 700, 300]);
    expect(pieceSessions()[0]).toMatchObject({ activeMs: 1_000, completed: true });
  });

  it('stores rhythm steps with their timings, and the session with its counts', async () => {
    const notes = (...devs: (number | null)[]) =>
      devs.map((deviation, i) => ({ midi: 72 + i, deviation }));
    const records = [
      { measure: 0, pass: 1, ms: 667, wrong: 0, epoch: EPOCH, notes: notes(12.4, -60.6) },
      { measure: 0, pass: 1, ms: 667, wrong: 1, epoch: EPOCH + 667, notes: notes(null) },
    ];
    const rhythm = (count: number, ended: RecordableRun['ended']): RecordableRun => ({
      id: 'r9',
      records: records.slice(0, count),
      startedEpoch: count > 0 ? EPOCH : null,
      ended,
      take: null,
      takeDone: false,
    });
    const show = (run: RecordableRun) =>
      act(() => root.render(createElement(RhythmRecorder, { run, store })));
    show(rhythm(1, null));
    show(rhythm(2, { completed: true }));
    store.loadPieceSteps('two-bars');
    await store.settled();
    await new Promise((resolve) => setTimeout(resolve));
    expect(store.getPieceSteps('two-bars')).toEqual([
      expect.objectContaining({
        id: 'r9:00000',
        ms: 667,
        mode: 'rhythm',
        notes: [
          { midi: 72, deviation: 12 },
          { midi: 73, deviation: -61 },
        ],
      }),
      expect.objectContaining({ id: 'r9:00001', wrong: 1, notes: [{ midi: 72, deviation: null }] }),
    ]);
    expect(pieceSessions()).toEqual([
      expect.objectContaining({
        id: 'r9',
        mode: 'rhythm',
        activeMs: 1_334,
        endedAt: EPOCH + 1_334,
        steps: 2,
        wrong: 1,
        completed: true,
        rhythm: { notes: 3, hits: 2, inTime: 1 },
      }),
    ]);
  });
});

describe('recording takes', () => {
  const input = (run: Run, event: TakeInput) => runReducer(run, { type: 'input', input: event });
  const off = (midi: number, time: number): TakeInput => ({ type: 'off', midi, time });

  it('keeps what was played, and writes it once the keys held at the end are let go', async () => {
    let run = newRun('r1');
    run = runReducer(run, {
      type: 'press',
      midi: 72,
      velocity: 90,
      time: 1_000,
      at: EPOCH + 1_000,
      pedals: { 64: 127, 66: 0, 67: 0 },
    });
    run = input(run, off(72, 1_200));
    run = press(run, 61, 1_300); // wrong
    run = input(run, off(61, 1_320));
    run = input(run, { type: 'pedal', controller: 64, value: 0, time: 1_350 });
    run = press(run, 74, 1_800);
    render(run);
    run = press(press(run, 76, 2_500), 77, 3_000);
    render(run);
    // Over, with keys still down: the session is written, the take waits for them.
    expect(pieceSessions()).toHaveLength(1);
    expect(await store.takes({ sessionId: 'r1' })).toEqual([]);
    run = input(run, { type: 'pedal', controller: 67, value: 127, time: 3_100 });
    run = input(run, off(74, 3_200));
    run = input(input(run, off(76, 3_300)), off(77, 3_400));
    // Keys pressed after the end are no part of it.
    run = press(run, 60, 3_500);
    render(run);
    await store.settled();
    expect(await store.takes({ sessionId: 'r1' })).toEqual([
      {
        id: 'r1:take:000',
        sessionId: 'r1',
        pieceId: 'two-bars',
        checksum: 'abcdef01',
        hands: 'right',
        repeats: 'play',
        tempo: 80,
        startedAt: EPOCH + 1_000,
        chunk: 0,
        events: [
          [0, 64, 127],
          [0, 1, 72, 90, 0],
          [200, 0, 72],
          [300, 1, 61, 64, -1],
          [320, 0, 61],
          [350, 64, 0],
          [800, 1, 74, 64, 1],
          [1_500, 1, 76, 64, 2],
          [2_000, 1, 77, 64, 3],
          [2_100, 67, 127],
          [2_200, 0, 74],
          [2_300, 0, 76],
          [2_400, 0, 77],
        ],
      },
    ]);
  });

  it('writes no take for a run that left no session, and the rest of one replaced', async () => {
    // Only a wrong key: no step, no session, no take.
    render(press(newRun('r1'), 60, 1_000));
    render(press(newRun('r2'), 72, 2_000));
    // Replaced with a key still down: its take is written as it is.
    render(newRun('r3'));
    await store.settled();
    expect(await store.takes({ pieceId: 'two-bars' })).toEqual([
      expect.objectContaining({ id: 'r2:take:000', events: [[0, 1, 72, 64, 0]] }),
    ]);
  });

  it('writes a chunk of 2,000 events as soon as it is full, the rest at the end', async () => {
    const events = (count: number): TakeEvent[] =>
      Array.from({ length: count }, (_, i) => [i * 10, 1, 60 + (i % 12), 64, i]);
    const base: TakeState = { origin: 0, startedAt: EPOCH, latency: 17, events: [], held: [] };
    const records = [{ measure: 0, pass: 1, ms: 667, wrong: 0, epoch: EPOCH, notes: [] }];
    const rhythm = (count: number, done: boolean): RecordableRun => ({
      id: 'r9',
      records,
      startedEpoch: EPOCH,
      ended: done ? { completed: true } : null,
      take: { ...base, events: events(count) },
      takeDone: done,
    });
    const show = (run: RecordableRun) =>
      act(() => root.render(createElement(RhythmRecorder, { run, store })));
    show(rhythm(1_999, false));
    await store.settled();
    expect(await store.takes({ sessionId: 'r9' })).toEqual([]);
    show(rhythm(4_100, false));
    await store.settled();
    expect((await store.takes({ sessionId: 'r9' })).map((c) => c.events.length)).toEqual([
      2_000, 2_000,
    ]);
    show(rhythm(4_500, true));
    await store.settled();
    const chunks = await store.takes({ sessionId: 'r9' });
    expect(chunks.map((c) => [c.id, c.chunk, c.events.length, c.mode, c.latency])).toEqual([
      ['r9:take:000', 0, 2_000, 'rhythm', 17],
      ['r9:take:001', 1, 2_000, 'rhythm', 17],
      ['r9:take:002', 2, 500, 'rhythm', 17],
    ]);
    expect(chunks.flatMap((c) => c.events)).toEqual(events(4_500));
  });
});

describe('recording a run with a left hand from the symbols', () => {
  function PatternRecorder({ run, store }: { run: Run; store: PracticeStore }) {
    useRunRecorder(
      waitRecording(run),
      { ...CONTEXT, checksum: '0badf00d', leftHand: 'alberti' },
      store,
    );
    return null;
  }

  it('keeps the pattern on the session, and the practised notes’ checksum on its steps', async () => {
    const s = score();
    const order = performanceOrder(s.measures);
    const steps = buildSteps(s, 'right', order);
    let run = startRun({ id: 'l1', steps, range: waitRange(steps, order, null, 0) });
    const show = () => act(() => root.render(createElement(PatternRecorder, { run, store })));
    show();
    run = press(press(press(press(run, 72, 1_000), 74, 1_500), 76, 2_000), 77, 2_500);
    show();
    store.loadPieceSteps('two-bars');
    await store.settled();
    await new Promise((resolve) => setTimeout(resolve));
    expect(store.getPieceSteps('two-bars')!.map((step) => step.checksum)).toEqual(
      Array.from({ length: 4 }, () => '0badf00d'),
    );
    expect(pieceSessions()).toEqual([
      expect.objectContaining({ id: 'l1', completed: true, leftHand: 'alberti' }),
    ]);
  });
});

describe('recording a transposed run', () => {
  function MovedRecorder({ run, store }: { run: Run; store: PracticeStore }) {
    useRunRecorder(waitRecording(run), { ...CONTEXT, transpose: -3 }, store);
    return null;
  }

  it('says how far it was moved on its steps, its session and its take', async () => {
    let run = newRun('t1');
    const show = () => act(() => root.render(createElement(MovedRecorder, { run, store })));
    show();
    // The keys played are the transposed ones; the steps and the checksum are the written piece's.
    run = press(press(press(press(run, 72, 1_000), 74, 1_500), 76, 2_000), 77, 2_500);
    for (const midi of [72, 74, 76, 77])
      run = runReducer(run, { type: 'input', input: { type: 'off', midi, time: 3_000 } });
    show();
    store.loadPieceSteps('two-bars');
    await store.settled();
    await new Promise((resolve) => setTimeout(resolve));
    expect(store.getPieceSteps('two-bars')!.map((s) => [s.checksum, s.transpose])).toEqual(
      Array.from({ length: 4 }, () => ['abcdef01', -3]),
    );
    expect(pieceSessions()).toEqual([expect.objectContaining({ id: 't1', transpose: -3 })]);
    expect((await store.takes({ sessionId: 't1' })).map((c) => c.transpose)).toEqual([-3]);
  });

  it('leaves the written key unmarked', async () => {
    function Written({ run, store }: { run: Run; store: PracticeStore }) {
      useRunRecorder(waitRecording(run), { ...CONTEXT, transpose: 0 }, store);
      return null;
    }
    let run = newRun('w1');
    const show = () => act(() => root.render(createElement(Written, { run, store })));
    show();
    run = press(press(press(press(run, 72, 1_000), 74, 1_500), 76, 2_000), 77, 2_500);
    show();
    store.loadPieceSteps('two-bars');
    await store.settled();
    await new Promise((resolve) => setTimeout(resolve));
    expect(store.getPieceSteps('two-bars')!.every((s) => !('transpose' in s))).toBe(true);
    expect(pieceSessions()[0]).not.toHaveProperty('transpose');
  });
});

describe('recording memory runs', () => {
  function MemoryRecorder({ run, store }: { run: Run; store: PracticeStore }) {
    useRunRecorder(waitRecording(run), { ...CONTEXT, mode: 'memory' }, store);
    return null;
  }

  it('stores each step with its prompts and stage, and the session with their sum', async () => {
    const s = score();
    const order = performanceOrder(s.measures);
    const steps = buildSteps(s, 'right', order);
    let run = startRun({
      id: 'm1',
      steps,
      range: waitRange(steps, order, null, 0),
      memory: { stage: 'phrases', hidden: new Set([1]) },
    });
    const show = () => act(() => root.render(createElement(MemoryRecorder, { run, store })));
    show();
    run = press(press(run, 72, 1_000), 74, 1_500);
    run = runReducer(run, { type: 'peek' });
    run = press(press(press(run, 70, 2_000), 76, 2_500), 77, 3_000);
    show();
    store.loadPieceSteps('two-bars');
    await store.settled();
    await new Promise((resolve) => setTimeout(resolve));
    expect(
      store.getPieceSteps('two-bars')!.map((step) => [step.mode, step.prompts, step.stage]),
    ).toEqual([
      ['memory', 0, 'phrases'],
      ['memory', 0, 'phrases'],
      ['memory', 2, 'phrases'],
      ['memory', 0, 'phrases'],
    ]);
    expect(pieceSessions()).toEqual([
      expect.objectContaining({
        id: 'm1',
        mode: 'memory',
        wrong: 1,
        completed: true,
        memory: { stage: 'phrases', prompts: 2 },
      }),
    ]);
  });
});
