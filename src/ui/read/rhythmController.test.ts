import { describe, expect, it } from 'vitest';
import { isRhythmAnswer } from '../../core/answers.ts';
import { seededRng } from '../../core/random.ts';
import { exerciseOnsets, exercisePlan, LINE_KEYS, msPerTick } from '../../core/rhythmExercise.ts';
import { createMatcher, type StepTiming } from '../../core/rhythm.ts';
import { judgeRhythmRun } from '../../core/rhythmRead.ts';
import { createPracticeStore } from '../practice/store.ts';
import { createRhythmController } from './rhythmController.ts';

function setup() {
  const practice = createPracticeStore();
  let ids = 0;
  let clock = 1_700_000_000_000;
  const controller = createRhythmController({
    practice,
    now: () => (clock += 1000),
    rng: seededRng(9),
    newId: () => `r${++ids}`,
  });
  const state = () => controller.getState()!;
  /** Plays the exercise on the stand perfectly and records the run. */
  const playRun = () => {
    const { exercise, bpm } = state();
    const plan = exercisePlan(exercise, bpm);
    const matcher = createMatcher(plan);
    const timings: StepTiming[] = [];
    const perTick = msPerTick(exercise.meter, bpm);
    for (const o of exerciseOnsets(exercise)) {
      const time = o.tick * perTick;
      timings.push(...matcher.advance(time));
      matcher.play(LINE_KEYS[o.line]!, time);
    }
    timings.push(...matcher.finish(Infinity));
    controller.recordRun(judgeRhythmRun(exercise, bpm, timings, []), (clock += 20_000));
  };
  return { practice, controller, state, playRun };
}

describe('rhythm controller', () => {
  it('records every cell of every run, and the session once it ends', () => {
    const { practice, controller, state, playRun } = setup();
    controller.start({ level: 'R2', bpm: 72, length: 2 });
    expect(state()).toMatchObject({ level: 'R2', bpm: 72, length: 2, index: 0, runs: 0 });
    expect(state().exercise.bars).toBe(4);
    playRun();
    const cells = state().exercise.cells.length;
    expect(practice.getSnapshot().answers.filter(isRhythmAnswer)).toHaveLength(cells);
    expect(state().last?.right).toBe(cells);
    // Again: the same exercise once more.
    playRun();
    expect(state().runs).toBe(2);
    const first = state().exercise;
    controller.next();
    expect(state().index).toBe(1);
    expect(state().exercise).not.toBe(first);
    expect(state().last).toBeNull();
    playRun();
    controller.next();
    expect(state().phase).toBe('done');
    const sessions = practice.getSnapshot().sessions;
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      kind: 'rhythm',
      level: 'R2',
      length: 2,
      exercises: 2,
      runs: 3,
      accuracy: 1,
    });
    expect(practice.getSnapshot().answers).toHaveLength(state().answers.length);
    controller.close();
    expect(controller.getState()).toBeNull();
  });

  it('keeps nothing of a session stopped before any run', () => {
    const { practice, controller, state } = setup();
    controller.start({ level: 'R9', bpm: 60, length: 4 });
    // Two hands begin with two bars.
    expect(state().exercise.bars).toBe(2);
    expect(state().exercise.lines).toHaveLength(2);
    controller.stop();
    expect(state().phase).toBe('done');
    expect(practice.getSnapshot().sessions).toEqual([]);
  });
});
