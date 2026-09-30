import { describe, expect, it } from 'vitest';
import { givenKey, targetKey, type PlannedNote } from '../../core/earItems.ts';
import { seededRng } from '../../core/random.ts';
import { createPracticeStore } from '../practice/store.ts';
import {
  ADVANCE_DELAY_MS,
  CORRECTION_LEAD_MS,
  createEarController,
  FIRST_LEAD_MS,
  PROMPT_LEAD_MS,
  type EarConfig,
} from './controller.ts';

const INTERVALS: EarConfig = {
  level: 'I1',
  by: 'play',
  directions: ['up'],
  chordStyle: 'broken',
  length: 10,
};

function setup() {
  const practice = createPracticeStore();
  const timers = new Map<number, { run: () => void; ms: number }>();
  let nextTimer = 1;
  let ids = 0;
  let time = 10_000;
  const played: { notes: readonly PlannedNote[]; start: number }[] = [];
  let silenced = 0;
  const controller = createEarController({
    practice,
    sound: {
      play: (notes, start) => void played.push({ notes, start }),
      silence: () => void silenced++,
    },
    clock: () => time,
    now: () => 1_700_000_000_000,
    rng: seededRng(9),
    newId: () => `s${++ids}`,
    setTimer: (run, ms) => {
      timers.set(nextTimer, { run, ms });
      return nextTimer++;
    },
    clearTimer: (id) => void timers.delete(id),
  });
  const state = () => controller.getState()!;
  const card = () => state().session.card;
  /** Runs the timers due in `ms`, moving the clock on. */
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
  /** Until the answer window is open. */
  const listen = () => wait(card().opensAt! - time);
  return {
    practice,
    controller,
    timers,
    played,
    state,
    card,
    wait,
    listen,
    now: () => time,
    silenced: () => silenced,
  };
}

describe('ear controller', () => {
  it('plays the first prompt after a moment, and listens until its last note-on', () => {
    const { controller, played, state, card, now, listen } = setup();
    controller.start(INTERVALS);
    expect(played).toHaveLength(1);
    expect(played[0]!.start).toBe(now() + FIRST_LEAD_MS);
    expect(played[0]!.notes.map((n) => n.midi)).toEqual(card().prompt.notes);
    expect(state().listening).toBe(true);
    expect(card().opensAt).toBe(now() + FIRST_LEAD_MS + 800);
    listen();
    expect(state().listening).toBe(false);
  });

  it('ignores keys while the prompt plays, then records the answer', () => {
    const { controller, practice, card, now, listen } = setup();
    controller.start(INTERVALS);
    const target = targetKey(card().prompt);
    controller.press(target, now() + 100);
    expect(card().status).toBe('waiting');
    listen();
    controller.press(target, now() + 700);
    expect(card().status).toBe('correct');
    expect(practice.getSnapshot().answers).toEqual([
      expect.objectContaining({ sessionId: 's1', correct: true, ms: 700, replays: 0 }),
    ]);
  });

  it('moves to the next item 400 ms after a right answer and plays its prompt', () => {
    const { controller, played, timers, card, now, listen, wait } = setup();
    controller.start(INTERVALS);
    listen();
    controller.press(targetKey(card().prompt), now() + 500);
    expect([...timers.values()].map((t) => t.ms)).toContain(ADVANCE_DELAY_MS);
    wait(ADVANCE_DELAY_MS);
    expect(card()).toMatchObject({ index: 1, status: 'waiting' });
    expect(played).toHaveLength(2);
    expect(played[1]!.start).toBe(now() + PROMPT_LEAD_MS);
  });

  it('after a wrong answer plays the right one, then moves on with a key or Next', () => {
    const { controller, played, card, now, listen, silenced } = setup();
    controller.start(INTERVALS);
    listen();
    const { prompt } = card();
    controller.press(targetKey(prompt) + 1, now() + 400);
    expect(card().status).toBe('wrong');
    // The correction: the same prompt again, not counted as a replay.
    expect(played).toHaveLength(2);
    expect(played[1]!.start).toBe(now() + CORRECTION_LEAD_MS);
    expect(card().replays).toBe(0);
    // A key while the correction plays does not move on.
    controller.press(60, now() + 100);
    expect(card().index).toBe(0);
    listen();
    controller.press(60, now() + 10);
    expect(card()).toMatchObject({ index: 1, status: 'waiting' });

    // Next moves on at once and silences the correction.
    listen();
    controller.press(targetKey(card().prompt) + 1, now() + 400);
    const before = silenced();
    controller.next();
    expect(silenced()).toBe(before + 1);
    expect(card().index).toBe(2);
  });

  it('counts Hear again before the answer, and opens the window at its last note-on', () => {
    const { controller, played, practice, card, now, listen } = setup();
    controller.start(INTERVALS);
    listen();
    controller.hearAgain();
    expect(played).toHaveLength(2);
    expect(card().replays).toBe(1);
    const opensAt = card().opensAt!;
    expect(opensAt).toBe(now() + PROMPT_LEAD_MS + 800);
    controller.press(targetKey(card().prompt), opensAt - 1);
    expect(card().status).toBe('waiting');
    listen();
    controller.press(targetKey(card().prompt), now() + 300);
    expect(practice.getSnapshot().answers[0]).toMatchObject({ replays: 1, ms: 300 });
  });

  it('plays a chord broken, then block, and judges the keys held', () => {
    const { controller, played, card, now, listen } = setup();
    controller.start({ ...INTERVALS, level: 'C1', directions: [] });
    const { prompt } = card();
    expect(played[0]!.notes).toHaveLength(6);
    listen();
    const [root, third, fifth] = prompt.notes as [number, number, number];
    expect(givenKey(prompt)).toBe(root);
    controller.press(root - 12, now() + 10);
    controller.press(third, now() + 20);
    expect(card().status).toBe('waiting');
    controller.release(third);
    controller.press(fifth + 12, now() + 30);
    expect(card().status).toBe('waiting');
    controller.press(third + 12, now() + 40);
    expect(card().status).toBe('correct');
  });

  it('answers by name', () => {
    const { controller, practice, card, now, listen } = setup();
    controller.start({ ...INTERVALS, by: 'name' });
    controller.choose('P8', now());
    expect(card().status).toBe('waiting');
    listen();
    controller.press(targetKey(card().prompt), now() + 10);
    expect(card().status).toBe('waiting');
    controller.choose('P8', now() + 900);
    expect(practice.getSnapshot().answers).toHaveLength(1);
    expect(practice.getSnapshot().answers[0]).toMatchObject({ by: 'name', answer: 'P8' });
  });

  it('saves one summary when the session completes', () => {
    const { controller, practice, card, now, listen, wait, state } = setup();
    controller.start({ ...INTERVALS, length: 10 });
    for (let i = 0; i < 10; i++) {
      listen();
      controller.press(targetKey(card().prompt), now() + 600);
      wait(ADVANCE_DELAY_MS);
    }
    expect(state().session.phase).toBe('done');
    expect(state().listening).toBe(false);
    const { sessions, answers } = practice.getSnapshot();
    expect(answers).toHaveLength(10);
    expect(sessions).toEqual([
      expect.objectContaining({ kind: 'ear', id: 's1', level: 'I1', items: 10, accuracy: 1 }),
    ]);
  });

  it('stopping keeps the answers, silences and cancels the timers; nothing is saved empty', () => {
    const { controller, practice, timers, card, now, listen, silenced } = setup();
    controller.start(INTERVALS);
    listen();
    controller.press(targetKey(card().prompt), now() + 600);
    controller.stop();
    expect(timers.size).toBe(0);
    expect(silenced()).toBeGreaterThan(0);
    expect(practice.getSnapshot().sessions[0]).toMatchObject({ items: 1, length: 10 });
    controller.close();
    expect(controller.getState()).toBeNull();

    controller.start(INTERVALS);
    controller.dispose();
    expect(practice.getSnapshot().sessions).toHaveLength(1);
  });

  it('stops listening when the sound is cut from outside', () => {
    const { controller, state, timers } = setup();
    controller.start(INTERVALS);
    controller.interrupted();
    expect(state().listening).toBe(false);
    expect(timers.size).toBe(0);
  });
});
