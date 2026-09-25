// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { PieceSessionRecord } from '../../core/log.ts';
import { performanceOrder } from '../../core/repeats.ts';
import { buildSteps, type Score, type ScoreNote } from '../../core/score.ts';
import { waitRange } from '../../core/wait.ts';
import { createPracticeStore, type PracticeStore } from '../practice/store.ts';
import { useRunRecorder, type RunContext } from './record.ts';
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
  runReducer(run, { type: 'press', midi, time, at: EPOCH + time });

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
  useRunRecorder(run, CONTEXT, store);
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
});
