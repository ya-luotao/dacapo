import { describe, expect, it } from 'vitest';
import { seededRng } from '../../core/random.ts';
import type { SightRun } from '../../core/sightRead.ts';
import { createPracticeStore } from '../practice/store.ts';
import { createSightController } from './sightController.ts';

function setup() {
  const practice = createPracticeStore();
  let ids = 0;
  let clock = 1_700_000_000_000;
  const controller = createSightController({
    practice,
    now: () => (clock += 1000),
    rng: seededRng(4),
    newId: () => `s${++ids}`,
  });
  const state = () => controller.getState()!;
  const run = (inTime: number): SightRun => {
    const startedAt = (clock += 5000);
    return {
      figures: {
        mode: 'time',
        bpm: 72,
        readAhead: 'on',
        startedAt,
        endedAt: (clock += 20_000),
        notes: 30,
        inTime,
        early: 30 - inTime,
        late: 0,
        wrong: 0,
        missed: 0,
        extras: 0,
        medianDeviation: 12,
        tendency: -8,
      },
      bars: [],
      ink: new Map(),
    };
  };
  return { practice, controller, state, run };
}

describe('sight-reading controller', () => {
  it('stores the session again after every run, and never before the first', () => {
    const { practice, controller, state, run } = setup();
    controller.start({ level: 'F3', length: 4 });
    expect(state()).toMatchObject({ level: 'F3', length: 4, phase: 'running', last: null });
    expect(state().fragments).toHaveLength(1);
    const seed = state().fragments[0]!.seed;
    expect(practice.getSnapshot().sessions).toEqual([]);
    controller.recordRun(run(28));
    expect(practice.getSnapshot().sessions).toHaveLength(1);
    // Again: the same fragment, one more run, the record replaced.
    controller.recordRun(run(30));
    expect(state().fragments[0]).toMatchObject({ seed, version: 1 });
    const stored = practice.getSnapshot().sessions;
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ kind: 'sight', id: 's1', level: 'F3', length: 4 });
    const first = stored[0]!;
    expect(first.kind === 'sight' && first.fragments[0]!.runs).toHaveLength(2);
    controller.next();
    expect(state().fragments).toHaveLength(2);
    expect(state().fragments[1]!.seed).not.toBe(seed);
    expect(state().last).toBeNull();
  });

  it('ends after the last fragment, and a session stopped before any run leaves nothing', () => {
    const { practice, controller, state, run } = setup();
    controller.start({ level: 'F1', length: 4 });
    controller.stop();
    expect(state().phase).toBe('done');
    expect(practice.getSnapshot().sessions).toEqual([]);
    controller.start({ level: 'F1', length: 4 });
    for (let i = 0; i < 4; i++) {
      controller.recordRun(run(30));
      controller.next();
    }
    expect(state().phase).toBe('done');
    const [stored] = practice.getSnapshot().sessions;
    expect(stored?.kind === 'sight' && stored.fragments).toHaveLength(4);
    controller.close();
    expect(controller.getState()).toBeNull();
  });
});
