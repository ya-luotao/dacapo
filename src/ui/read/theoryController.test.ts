import { describe, expect, it } from 'vitest';
import { isTheoryAnswer } from '../../core/answers.ts';
import { midiOf } from '../../core/musicxml.ts';
import { seededRng } from '../../core/random.ts';
import { signatureTonic, tonicPitch } from '../../core/keys.ts';
import { rightName } from '../../core/theorySession.ts';
import { createPracticeStore } from '../practice/store.ts';
import { ADVANCE_DELAY_MS } from './controller.ts';
import { createTheoryController, type TheoryConfig } from './theoryController.ts';

function setup() {
  const practice = createPracticeStore();
  const timers = new Map<number, { run: () => void; ms: number }>();
  let nextTimer = 1;
  let ids = 0;
  const controller = createTheoryController({
    practice,
    now: () => 1_700_000_000_000,
    rng: seededRng(4),
    newId: () => `t${++ids}`,
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
  const start = (config: Partial<TheoryConfig> = {}) =>
    controller.start({ level: 'RI2', by: 'name', length: 10, hint: false, ...config });
  /** Paints the card at `time` and answers it right (or wrong) 800 ms later. */
  const answer = (time: number, correct = true) => {
    controller.painted(state().card.index, time);
    const { prompt } = state().card;
    if (prompt.family === 'keySignature') {
      const tonic = midiOf(tonicPitch(signatureTonic(prompt.fifths, prompt.mode), 3));
      controller.press(correct ? tonic : tonic + 1, time + 800);
      return;
    }
    if (state().by === 'play') {
      const keys = prompt.notes.map(midiOf);
      for (const midi of correct ? keys : [keys[0]! + 1]) controller.press(midi, time + 800);
      return;
    }
    controller.choose(correct ? rightName(state())! : 'd2', time + 800);
  };
  return { practice, controller, timers, flush, state, start, answer };
}

describe('theory controller', () => {
  it('records each scored answer once and keeps the card until the right one', () => {
    const { practice, controller, state, start, answer } = setup();
    start();
    answer(1000, false);
    expect(state().card.status).toBe('wrong');
    controller.choose(rightName(state())!, 2500);
    expect(state().card.status).toBe('correct');
    const { answers } = practice.getSnapshot();
    expect(answers).toHaveLength(1);
    expect(answers[0]).toMatchObject({
      family: 'readInterval',
      level: 'RI2',
      by: 'name',
      answer: 'd2',
      correct: false,
      ms: 800,
    });
    expect(answers.filter(isTheoryAnswer)).toHaveLength(1);
  });

  it('moves on 400 ms after a right answer', () => {
    const { timers, flush, state, start, answer } = setup();
    start();
    answer(1000);
    expect([...timers.values()].map((t) => t.ms)).toEqual([ADVANCE_DELAY_MS]);
    flush();
    expect(state().card).toMatchObject({ index: 1, status: 'waiting', shownAt: null });
  });

  it('saves one theory session when the last card is answered', () => {
    const { practice, flush, state, start, answer } = setup();
    start({ level: 'KS1', by: 'name' });
    expect(state().by).toBe('play');
    for (let i = 0; i < 10; i++) {
      answer(i * 10_000, i !== 3);
      if (state().card.status === 'wrong') answer(i * 10_000 + 2000);
      flush();
    }
    expect(state().phase).toBe('done');
    const { sessions, answers } = practice.getSnapshot();
    expect(answers).toHaveLength(10);
    expect(sessions).toEqual([
      expect.objectContaining({ kind: 'theory', family: 'keySignature', cards: 10, correct: 9 }),
    ]);
  });

  it('plays a chord, and stopping early keeps what was answered', () => {
    const { practice, controller, timers, state, start, answer } = setup();
    start({ level: 'RC1', by: 'play', length: 20 });
    answer(1000);
    expect(state().card.status).toBe('correct');
    controller.stop();
    expect(timers.size).toBe(0);
    expect(practice.getSnapshot().sessions[0]).toMatchObject({
      kind: 'theory',
      by: 'play',
      cards: 1,
      length: 20,
    });
  });

  it('marks a card hinted when the hint is shown, and closes back to the setup', () => {
    const { practice, controller, state, start, answer } = setup();
    start();
    controller.setHint(true);
    answer(1000);
    expect(practice.getSnapshot().answers[0]).toMatchObject({ hinted: true });
    expect(state().hint).toBe(true);
    controller.close();
    expect(controller.getState()).toBeNull();
  });
});
