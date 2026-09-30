import { describe, expect, it } from 'vitest';
import { isRhythmEarAnswer } from '../../core/answers.ts';
import { seededRng } from '../../core/random.ts';
import { createMatcher, type Matcher } from '../../core/rhythm.ts';
import type { RhythmEnd } from '../../output/rhythm.ts';
import type { RhythmStart } from '../pieces/useRhythmPlayer.ts';
import { createPracticeStore } from '../practice/store.ts';
import {
  CORRECTION_LEAD_MS,
  createRhythmEarController,
  NEXT_LEAD_MS,
  RIGHT_DELAY_MS,
  type DictationPlayer,
} from './rhythmController.ts';

/** Rhythm mode's player as the controller sees it, its runs ended by hand. */
function fakePlayer(clock: () => number) {
  const runs: { options: RhythmStart; origin: number; matcher: Matcher; ended: boolean }[] = [];
  const current = () => runs.at(-1);
  const end = (reason: RhythmEnd) => {
    const run = current();
    if (!run || run.ended) return;
    run.ended = true;
    if (reason === 'done') run.options.onSettled(run.matcher.finish(Infinity));
    run.options.onEnd(reason);
  };
  const player: DictationPlayer = {
    start(options) {
      end('stopped');
      const origin = clock() + 1000;
      runs.push({ options, origin, matcher: createMatcher(options.plan), ended: false });
      return origin;
    },
    press(midi, time) {
      const run = current();
      if (!run || run.ended) return { kind: 'ignored' };
      const at = time - run.origin - run.options.latency;
      run.options.onSettled(run.matcher.advance(at));
      return run.matcher.play(midi, at);
    },
    stop: () => end('stopped'),
  };
  return { player, runs, current, end };
}

function setup(latency = 0) {
  const practice = createPracticeStore();
  const timers = new Map<number, { run: () => void; ms: number }>();
  let nextTimer = 1;
  let ids = 0;
  let time = 10_000;
  const fake = fakePlayer(() => time);
  const controller = createRhythmEarController({
    practice,
    player: fake.player,
    latency: () => latency,
    clickVolume: () => 70,
    clock: () => time,
    now: () => 1_700_000_000_000 + time,
    rng: seededRng(5),
    newId: () => `r${++ids}`,
    setTimer: (run, ms) => {
      timers.set(nextTimer, { run, ms });
      return nextTimer++;
    },
    clearTimer: (id) => void timers.delete(id),
  });
  const state = () => controller.getState()!;
  const question = () => state().session.question;
  const wait = (ms: number) => {
    time += ms;
    for (const [id, timer] of [...timers]) {
      if (timer.ms > ms) {
        timer.ms -= ms;
        continue;
      }
      timers.delete(id);
      timer.run();
    }
  };
  /** Taps every onset of the bar to tap, `off(i)` ms late (null: not at all), then ends it. */
  const tapBar = (off: (i: number) => number | null = () => 0) => {
    const run = fake.current()!;
    for (const [i, step] of run.options.plan.steps.entries()) {
      const d = off(i);
      if (d === null) continue;
      time = run.origin + step.at + d + latency;
      controller.tap(time);
    }
    time = run.origin + run.options.plan.length;
    fake.end('done');
  };
  const answers = () => practice.getSnapshot().answers.filter(isRhythmEarAnswer);
  return { practice, controller, fake, timers, state, question, wait, tapBar, answers };
}

describe('rhythm dictation controller', () => {
  it('plays a bar to tap back, and keeps an answer for each of its cells', () => {
    const { controller, fake, state, question, tapBar, answers, wait } = setup();
    controller.start({ level: 'R2', by: 'play', bpm: 72, length: 2 });
    const run = fake.current()!;
    expect(run.options.plan.steps.length).toBeGreaterThan(0);
    expect(run.options.backing?.notes.length).toBeGreaterThan(0);
    expect(run.options.clickMode).toBe('on');
    expect(state().sound?.kind).toBe('tap');
    tapBar();
    expect(question().status).toBe('correct');
    expect(answers()).toHaveLength(question().bar.length);
    expect(answers().every((a) => a.correct && a.by === 'play')).toBe(true);
    expect(state().sound).toBeNull();
    // Right: the next bar after a moment, its count-in a breath later.
    wait(RIGHT_DELAY_MS);
    expect(question().index).toBe(1);
    wait(NEXT_LEAD_MS);
    expect(fake.runs).toHaveLength(2);
  });

  it('takes the latency off each tap', () => {
    const { controller, question, tapBar } = setup(40);
    controller.start({ level: 'R1', by: 'play', bpm: 72, length: 1 });
    tapBar();
    expect(question().status).toBe('correct');
    const devs = question().tapped!.onsets.map((o) => o.deviation);
    expect(devs.every((d) => d === 0)).toBe(true);
  });

  it('plays the bar again after one tapped wrong, and waits for Next', () => {
    const { controller, fake, question, tapBar, wait, timers } = setup();
    controller.start({ level: 'R1', by: 'play', bpm: 72, length: 3 });
    tapBar(() => 120);
    expect(question().status).toBe('wrong');
    wait(CORRECTION_LEAD_MS);
    expect(fake.runs).toHaveLength(2);
    expect(fake.current()!.options.plan.steps).toEqual([]);
    expect(timers.size).toBe(0);
    expect(question().index).toBe(0);
    controller.next();
    expect(question().index).toBe(1);
  });

  it('starts a bar over on Hear again, keeping nothing of it and counting the replay', () => {
    const { controller, fake, question, tapBar, answers } = setup();
    controller.start({ level: 'R2', by: 'play', bpm: 72, length: 1 });
    const first = fake.current()!;
    controller.tap(first.origin + first.options.plan.steps[0]!.at);
    controller.hearAgain();
    expect(first.ended).toBe(true);
    expect(fake.runs).toHaveLength(2);
    expect(answers()).toEqual([]);
    expect(question().replays).toBe(1);
    tapBar();
    expect(answers().every((a) => a.replays === 1)).toBe(true);
  });

  it('keeps nothing of a bar stopped before its end', () => {
    const { controller, fake, state, answers } = setup();
    controller.start({ level: 'R2', by: 'play', bpm: 72, length: 1 });
    fake.end('interrupted');
    expect(state().stopped).toBe(true);
    expect(answers()).toEqual([]);
    expect(state().session.question.status).toBe('waiting');
  });

  it('takes a choice only once the prompt’s last note has sounded', () => {
    const { controller, fake, question, answers, wait } = setup();
    controller.start({ level: 'R2', by: 'name', bpm: 72, length: 2 });
    const run = fake.current()!;
    expect(run.options.plan.steps).toEqual([]);
    const choice = question().choice!;
    const opensAt = question().opensAt!;
    expect(opensAt).toBe(run.origin + (run.options.backing!.notes.at(-1)!.on ?? 0));
    controller.choose(choice.right, opensAt - 1);
    expect(answers()).toEqual([]);
    controller.choose(choice.right, opensAt + 900);
    expect(question().status).toBe('correct');
    expect(answers()).toHaveLength(1);
    expect(answers()[0]).toMatchObject({ by: 'name', correct: true, ms: 900, replays: 0 });
    wait(RIGHT_DELAY_MS);
    expect(question().index).toBe(1);
  });

  it('records the session as an ear session of rhythm dictation when it stops', () => {
    const { controller, practice, tapBar } = setup();
    controller.start({ level: 'R2', by: 'play', bpm: 72, length: 5 });
    tapBar();
    controller.stop();
    const [session] = practice.getSnapshot().sessions;
    expect(session).toMatchObject({
      kind: 'ear',
      family: 'rhythmEar',
      level: 'R2',
      by: 'play',
      bpm: 72,
      length: 5,
      questions: 1,
    });
  });
});
