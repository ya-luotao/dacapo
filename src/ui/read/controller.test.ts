import { describe, expect, it } from 'vitest';
import { getLevel } from '../../core/levels.ts';
import { levelProgress } from '../../core/mastery.ts';
import { seededRng } from '../../core/random.ts';
import { createPracticeStore } from '../practice/store.ts';
import { ADVANCE_DELAY_MS, createReadController } from './controller.ts';

function setup() {
  const practice = createPracticeStore();
  const timers = new Map<number, { run: () => void; ms: number }>();
  let nextTimer = 1;
  let ids = 0;
  const controller = createReadController({
    practice,
    now: () => 1_700_000_000_000,
    rng: seededRng(9),
    newId: () => `s${++ids}`,
    setTimer: (run, ms) => {
      timers.set(nextTimer, { run, ms });
      return nextTimer++;
    },
    clearTimer: (id) => void timers.delete(id),
  });
  const flush = () => {
    for (const [id, timer] of [...timers]) {
      timers.delete(id);
      timer.run();
    }
  };
  const state = () => controller.getState()!;
  const answer = (time: number, correct = true) => {
    controller.painted(state().card.index, time);
    const target = state().card.note.midi;
    controller.press(correct ? target : target + 1, time + 500);
  };
  return { practice, controller, timers, flush, state, answer };
}

describe('read controller', () => {
  it('records each scored attempt and the note stats once', () => {
    const { practice, controller, state, answer } = setup();
    controller.start('L1', 10, false);
    answer(1000, false);
    controller.press(state().card.note.midi, 2000);
    const data = practice.getSnapshot();
    expect(data.attempts).toHaveLength(1);
    expect(data.attempts[0]).toMatchObject({ sessionId: 's1', correct: false, ms: 500 });
    expect(data.stats[state().card.note.key]).toMatchObject({ attempts: 1, errors: 1 });
  });

  it('moves to the next card 400 ms after a correct answer', () => {
    const { controller, timers, flush, state, answer } = setup();
    controller.start('L1', 10, false);
    answer(1000);
    expect([...timers.values()].map((t) => t.ms)).toEqual([ADVANCE_DELAY_MS]);
    expect(state().card.index).toBe(0);
    flush();
    expect(state().card).toMatchObject({ index: 1, status: 'waiting', shownAt: null });
  });

  it('saves one summary when the session completes', () => {
    const { practice, controller, flush, state, answer } = setup();
    controller.start('L2', 10, false);
    for (let i = 0; i < 10; i++) {
      answer(i * 10_000);
      flush();
    }
    expect(state().phase).toBe('done');
    const { sessions, attempts } = practice.getSnapshot();
    expect(attempts).toHaveLength(10);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ id: 's1', level: 'L2', cards: 10, accuracy: 1 });
  });

  it('stopping early keeps the answered cards and cancels the pending advance', () => {
    const { practice, controller, timers, state, answer } = setup();
    controller.start('L1', 20, false);
    answer(1000);
    controller.stop();
    expect(timers.size).toBe(0);
    expect(state().phase).toBe('done');
    expect(practice.getSnapshot().sessions[0]).toMatchObject({ cards: 1, length: 20 });
    controller.dispose();
    expect(practice.getSnapshot().sessions).toHaveLength(1);
  });

  it('does not save a session without answers', () => {
    const { practice, controller } = setup();
    controller.start('L1', 20, false);
    controller.dispose();
    controller.close();
    expect(controller.getState()).toBeNull();
    expect(practice.getSnapshot().sessions).toHaveLength(0);
  });

  it('ignores input without a session', () => {
    const { practice, controller } = setup();
    controller.press(60, 1000);
    controller.painted(0, 1000);
    controller.setHint(true);
    expect(controller.getState()).toBeNull();
    expect(practice.getSnapshot().attempts).toHaveLength(0);
  });
});

describe('read controller: a session of some of the level’s notes', () => {
  it('shows those notes only, and is a session of the level like any other', () => {
    const { practice, controller, flush, state, answer } = setup();
    const notes = getLevel('L2').notes.slice(2, 5);
    controller.start('L2', 10, false, notes);
    const shown: string[] = [];
    for (let i = 0; i < 10; i++) {
      shown.push(state().card.note.key);
      answer(i * 10_000);
      flush();
    }
    expect(state().phase).toBe('done');
    expect(new Set(shown)).toEqual(new Set(notes.map((n) => n.key)));
    for (let i = 1; i < shown.length; i++) expect(shown[i]).not.toBe(shown[i - 1]);

    // Its answers are the level's: they count for its figures and its mastery.
    const { attempts, sessions } = practice.getSnapshot();
    expect(attempts).toHaveLength(10);
    expect(attempts.every((a) => a.level === 'L2' && a.sessionId === 's1')).toBe(true);
    expect(levelProgress(attempts, 'L2').cards).toBe(10);
    expect(sessions[0]).toMatchObject({ id: 's1', level: 'L2', cards: 10, length: 10 });

    // Nothing says which kind of session it was: the record has what any session's has.
    controller.start('L2', 10, false);
    for (let i = 0; i < 10; i++) {
      answer(200_000 + i * 10_000);
      flush();
    }
    const [some, all] = practice.getSnapshot().sessions;
    expect(Object.keys(some!).sort()).toEqual(Object.keys(all!).sort());
    const [first, last] = [attempts[0]!, practice.getSnapshot().attempts.at(-1)!];
    expect(Object.keys(first).sort()).toEqual(Object.keys(last).sort());
  });
});
