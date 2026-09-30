import { describe, expect, it } from 'vitest';
import type { StepTiming } from '../../core/rhythm.ts';
import { idleRhythm, rhythmReducer, rhythmTakeDone, type RhythmRunState } from './rhythm.ts';

const timing = (step: number, due: number, deviation: number | null, extra = 0): StepTiming => ({
  step,
  round: 0,
  measure: step >> 2,
  pass: 1,
  played: step >> 2,
  due,
  slot: 500,
  notes: [{ midi: 60, deviation }],
  extra,
});

const run = (...actions: Parameters<typeof rhythmReducer>[1][]): RhythmRunState =>
  actions.reduce(rhythmReducer, idleRhythm('r0'));

describe('rhythm run state', () => {
  it('turns settled steps into records with epoch times from the run’s clock', () => {
    const state = run(
      { type: 'start', id: 'r1', epochOrigin: 1_000_000, origin: 0, latency: 0 },
      { type: 'settled', timings: [timing(0, 0, 12), timing(1, 500, null, 1)] },
    );
    expect(state.records).toEqual([
      {
        measure: 0,
        pass: 1,
        ms: 500,
        wrong: 0,
        epoch: 1_000_000,
        notes: [{ midi: 60, deviation: 12 }],
      },
      {
        measure: 0,
        pass: 1,
        ms: 500,
        wrong: 1,
        epoch: 1_000_500,
        notes: [{ midi: 60, deviation: null }],
      },
    ]);
    expect(state.startedEpoch).toBe(1_000_000);
  });

  it('remembers the last note for the quiet indicator, only while running', () => {
    const hit = { kind: 'hit', step: 0, round: 0, midi: 60, deviation: -18 } as const;
    expect(
      run(
        { type: 'start', id: 'r1', epochOrigin: 0, origin: 0, latency: 0 },
        { type: 'played', result: hit, midi: 60, velocity: 64, time: 0 },
      ).last,
    ).toEqual({
      kind: 'hit',
      deviation: -18,
    });
    expect(
      run(
        { type: 'start', id: 'r1', epochOrigin: 0, origin: 0, latency: 0 },
        { type: 'played', result: { kind: 'extra', midi: 61 }, midi: 61, velocity: 64, time: 0 },
      ).last,
    ).toEqual({ kind: 'extra' });
    expect(run({ type: 'played', result: hit, midi: 60, velocity: 64, time: 0 }).last).toBeNull();
  });

  it('ends once; a hidden end keeps its records but shows no sheet; reset starts clean', () => {
    const ended = run(
      { type: 'start', id: 'r1', epochOrigin: 0, origin: 0, latency: 0 },
      { type: 'settled', timings: [timing(0, 0, 5)] },
      { type: 'end', reason: 'stopped' },
      { type: 'end', reason: 'done' },
      { type: 'hide' },
    );
    expect(ended).toMatchObject({ status: 'ended', end: 'stopped', hidden: true });
    expect(ended.records).toHaveLength(1);
    expect(rhythmReducer(ended, { type: 'reset', id: 'r2' })).toEqual(idleRhythm('r2'));
    // Nothing settles into a run that has not started.
    expect(run({ type: 'settled', timings: [timing(0, 0, 5)] }).records).toEqual([]);
  });

  it('keeps a take from Start: the count-in before 0, every key with its step or none', () => {
    const hit = { kind: 'hit', step: 3, round: 0, midi: 62, deviation: 4 } as const;
    const ignored = { kind: 'ignored' } as const;
    const state = run(
      {
        type: 'start',
        id: 'r1',
        epochOrigin: 1_000_000,
        origin: 5_000,
        latency: 21,
        pedals: { 64: 0, 66: 0, 67: 90 },
      },
      { type: 'played', result: ignored, midi: 60, velocity: 50, time: 4_300 },
      { type: 'input', input: { type: 'off', midi: 60, time: 4_500 } },
      { type: 'played', result: hit, midi: 62, velocity: 77, time: 5_504.4 },
      { type: 'played', result: { kind: 'extra', midi: 63 }, midi: 63, velocity: 20, time: 5_600 },
      { type: 'input', input: { type: 'pedal', controller: 64, value: 127, time: 5_650 } },
      { type: 'end', reason: 'done' },
      // After the end: no new key, but the releases of the keys held.
      { type: 'played', result: ignored, midi: 65, velocity: 50, time: 5_700 },
      { type: 'input', input: { type: 'off', midi: 62, time: 5_800 } },
    );
    expect(state.take).toMatchObject({ startedAt: 1_000_000, latency: 21, held: [63] });
    expect(state.take!.events).toEqual([
      [0, 67, 90],
      [-700, 1, 60, 50, -1],
      [-500, 0, 60],
      [504, 1, 62, 77, 3],
      [600, 1, 63, 20, -1],
      [650, 64, 127],
      [800, 0, 62],
    ]);
    expect(rhythmTakeDone(state)).toBe(false);
    const done = rhythmReducer(state, {
      type: 'input',
      input: { type: 'off', midi: 63, time: 5_900 },
    });
    expect(rhythmTakeDone(done)).toBe(true);
    // Done: nothing more.
    const after = rhythmReducer(done, {
      type: 'input',
      input: { type: 'pedal', controller: 64, value: 0, time: 6_000 },
    });
    expect(after).toBe(done);
    // Before Start there is no take.
    expect(run({ type: 'input', input: { type: 'off', midi: 60, time: 0 } }).take).toBeNull();
  });

  it('names an ornament’s keys with their step, and keeps the last note shown', () => {
    const hit = { kind: 'hit', step: 0, round: 0, midi: 72, deviation: 3 } as const;
    const lower = { kind: 'ornament', step: 0, round: 0, midi: 71, principal: false } as const;
    const again = { kind: 'ornament', step: 0, round: 0, midi: 72, principal: true } as const;
    const state = run(
      { type: 'start', id: 'r1', epochOrigin: 1_000_000, origin: 5_000, latency: 0 },
      { type: 'played', result: hit, midi: 72, velocity: 60, time: 5_003 },
      { type: 'played', result: lower, midi: 71, velocity: 60, time: 5_070 },
      { type: 'played', result: again, midi: 72, velocity: 60, time: 5_140 },
    );
    expect(state.take!.events).toEqual([
      [3, 1, 72, 60, 0],
      [70, 1, 71, 60, 0],
      [140, 1, 72, 60, -1],
    ]);
    expect(state.last).toEqual({ kind: 'hit', deviation: 3 });
  });
});
