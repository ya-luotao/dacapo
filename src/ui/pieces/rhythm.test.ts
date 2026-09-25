import { describe, expect, it } from 'vitest';
import type { StepTiming } from '../../core/rhythm.ts';
import { idleRhythm, rhythmReducer, type RhythmRunState } from './rhythm.ts';

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
      { type: 'start', id: 'r1', epochOrigin: 1_000_000 },
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
      run({ type: 'start', id: 'r1', epochOrigin: 0 }, { type: 'played', result: hit }).last,
    ).toEqual({
      kind: 'hit',
      deviation: -18,
    });
    expect(
      run(
        { type: 'start', id: 'r1', epochOrigin: 0 },
        { type: 'played', result: { kind: 'extra', midi: 61 } },
      ).last,
    ).toEqual({ kind: 'extra' });
    expect(run({ type: 'played', result: hit }).last).toBeNull();
  });

  it('ends once; a hidden end keeps its records but shows no sheet; reset starts clean', () => {
    const ended = run(
      { type: 'start', id: 'r1', epochOrigin: 0 },
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
});
