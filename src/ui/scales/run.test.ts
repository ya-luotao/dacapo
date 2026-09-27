import { describe, expect, it } from 'vitest';
import type { ScaleNote } from '../../core/scaleTypes.ts';
import {
  allReleased,
  IDLE_END_MS,
  runStep,
  sessionStep,
  usedPedal,
  velocityMeasured,
  waitingRun,
  type RunEvent,
  type ScaleRunState,
} from './run.ts';

// C D E F G F E D C, right hand.
const MIDIS = [60, 62, 64, 65, 67, 65, 64, 62, 60];
const EXPECTED: ScaleNote[] = MIDIS.map((midi, index) => ({
  hand: 'right',
  index,
  pitch: { step: 'C', alter: 0, octave: 4 },
  midi,
  finger: null,
  direction: index <= 4 ? 'up' : 'down',
  turn: index === 4,
  degree: 0,
  crossing: null,
}));

const T0 = 1000;
const on = (midi: number, ms: number, velocity = 64): RunEvent => ({
  type: 'on',
  midi,
  velocity,
  time: T0 + ms,
  at: 1_700_000_000_000 + ms,
});
const play = (events: RunEvent[]) => events.reduce(runStep, waitingRun(EXPECTED));

describe('scale run', () => {
  it('starts at the first key of the scale, not before', () => {
    const state = play([on(67, -500), on(64, -200)]);
    expect(state.phase).toBe('waiting');
    expect(state.keys).toEqual([]);
    const started = runStep(state, on(60, 0));
    expect(started.phase).toBe('playing');
    expect(started.origin).toBe(T0);
    expect(started.keys).toEqual([{ midi: 60, velocity: 64, on: 0, off: null }]);
  });

  it('keeps up when a few notes in a row are skipped, and still ends at the last note', () => {
    // D and E skipped, then everything to the end.
    const played = [0, 3, 4, 5, 6, 7, 8].map((i) => MIDIS[i]!);
    const state = play(played.map((midi, n) => on(midi, n * 250)));
    expect(state.end).toBe('finished');
    expect(state.played).toEqual([0, 3, 4, 5, 6, 7, 8]);
  });

  it('follows the notes, forgives one skipped note and flashes a wrong key', () => {
    const state = play([on(60, 0), on(62, 200), on(65, 400), on(66, 600)]);
    // E was skipped: F is taken as the note after it.
    expect(state.played).toEqual([0, 1, 3]);
    expect(state.next).toBe(4);
    expect(state.wrongKey).toBe(66);
    expect(state.keys).toHaveLength(4);
  });

  it('finishes at the last note', () => {
    const state = play(MIDIS.map((midi, i) => on(midi, i * 250)));
    expect(state.phase).toBe('done');
    expect(state.end).toBe('finished');
    expect(state.played).toEqual(MIDIS.map((_, i) => i));
  });

  it('ends after a pause, and on Stop', () => {
    const started = play([on(60, 0), on(62, 250)]);
    expect(runStep(started, { type: 'tick', time: T0 + 250 + IDLE_END_MS - 1 }).phase).toBe(
      'playing',
    );
    expect(runStep(started, { type: 'tick', time: T0 + 250 + IDLE_END_MS }).end).toBe('idle');
    expect(runStep(started, { type: 'stop', time: T0 + 300 }).end).toBe('stopped');
  });

  it('keeps the releases of the keys still down when the run ends', () => {
    const done = MIDIS.map((midi, i) => on(midi, i * 250)).reduce(runStep, waitingRun(EXPECTED));
    expect(done.phase).toBe('done');
    expect(allReleased(done)).toBe(false);
    const released = done.keys
      .map((key, i) => ({ key, i }))
      // Latest first: the scale's first and last key are the same (both C4).
      .reverse()
      .reduce<ScaleRunState>(
        (state, { key, i }) =>
          runStep(state, { type: 'off', midi: key.midi, time: T0 + i * 250 + 200 }),
        done,
      );
    expect(allReleased(released)).toBe(true);
    expect(released.keys.at(-1)!.off).toBe((MIDIS.length - 1) * 250 + 200);
  });

  it('pairs each release with the latest press of its key, ignoring keys held from before', () => {
    const state = play([
      on(62, -100),
      on(60, 0),
      { type: 'off', midi: 62, time: T0 + 50 },
      { type: 'off', midi: 60, time: T0 + 230.04 },
    ]);
    expect(state.keys).toEqual([{ midi: 60, velocity: 64, on: 0, off: 230 }]);
  });

  it('keeps the pedal', () => {
    const before = runStep(waitingRun(EXPECTED), { type: 'pedal', down: true, time: T0 - 10 });
    expect(usedPedal(runStep(before, on(60, 0)))).toBe(true);
    const state = play([on(60, 0), { type: 'pedal', down: true, time: T0 + 120 }]);
    expect(state.pedal).toEqual([{ down: true, time: 120 }]);
    expect(usedPedal(state)).toBe(true);
    expect(usedPedal(play([on(60, 0)]))).toBe(false);
  });

  it('knows when loudness cannot be measured', () => {
    expect(velocityMeasured([{ velocity: 80 }, { velocity: 80 }])).toBe(false);
    expect(velocityMeasured([{ velocity: 80 }, { velocity: 81 }])).toBe(true);
  });
});

describe('runs one after another', () => {
  it('knows the pedal was down when the next run starts', () => {
    const first = play([on(60, 0), { type: 'pedal', down: true, time: T0 + 10 }]);
    const done = runStep(first, { type: 'stop', time: T0 + 100 });
    const next = sessionStep(done, on(60, 1000));
    expect(next.pedalAtStart).toBe(true);
    expect(usedPedal(next)).toBe(true);
    const lifted = sessionStep(done, { type: 'pedal', down: false, time: T0 + 500 });
    expect(sessionStep(lifted, on(60, 1000)).pedalAtStart).toBe(false);
  });

  it('starts the next run at the first key once one is done', () => {
    const done = MIDIS.map((midi, i) => on(midi, i * 250)).reduce(
      sessionStep,
      waitingRun(EXPECTED),
    );
    expect(done.phase).toBe('done');
    expect(sessionStep(done, on(64, 5000))).toBe(done);
    const again = sessionStep(done, on(60, 6000));
    expect(again.phase).toBe('playing');
    expect(again.origin).toBe(T0 + 6000);
    expect(again.keys).toHaveLength(1);
  });
});
