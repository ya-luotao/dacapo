import { describe, expect, it } from 'vitest';
import { isChordSymbolAnswer } from '../../core/answers.ts';
import { symbolPitchClasses, symbolVoicing } from '../../core/chordSymbols.ts';
import { seededRng } from '../../core/random.ts';
import { createPracticeStore } from '../practice/store.ts';
import { ADVANCE_DELAY_MS } from '../read/controller.ts';
import { createHarmonyController, type HarmonyConfig } from './controller.ts';

function setup() {
  const practice = createPracticeStore();
  const timers = new Map<number, { run: () => void; ms: number }>();
  let nextTimer = 1;
  let ids = 0;
  const controller = createHarmonyController({
    practice,
    now: () => 1_700_000_000_000,
    rng: seededRng(4),
    newId: () => `h${++ids}`,
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
  const start = (config: Partial<HarmonyConfig> = {}) =>
    controller.start({ level: 'H4', length: 10, hint: false, ...config });
  /** Paints the card at `time`, plays it right (or a wrong key) 900 ms later, and lets go. */
  const answer = (time: number, correct = true) => {
    controller.painted(state().card.index, time);
    const keys = symbolVoicing(state().card.symbol);
    const pcs = symbolPitchClasses(state().card.symbol);
    const outside = [60, 61, 62, 63, 64, 65, 66].find((midi) => !pcs.has(midi % 12))!;
    const played = correct ? keys : [outside];
    for (const midi of played) controller.press(midi, time + 900);
    for (const midi of played) controller.release(midi, time + 950);
  };
  return { practice, controller, timers, flush, state, start, answer };
}

describe('harmony controller', () => {
  it('records each scored answer once and keeps the card until it is played right', () => {
    const { practice, controller, state, start, answer, timers } = setup();
    start();
    answer(1000, false);
    expect(state().card.status).toBe('wrong');
    expect(practice.getSnapshot().answers).toHaveLength(1);
    expect(timers.size).toBe(0);
    for (const midi of symbolVoicing(state().card.symbol)) controller.press(midi, 3000);
    expect(state().card.status).toBe('correct');
    expect(practice.getSnapshot().answers).toHaveLength(1);
    expect(practice.getSnapshot().answers.filter(isChordSymbolAnswer)[0]).toMatchObject({
      family: 'chordSymbol',
      level: 'H4',
      correct: false,
    });
    expect([...timers.values()].map((t) => t.ms)).toEqual([ADVANCE_DELAY_MS]);
  });

  it('moves on after 400 ms and records the session when it ends', () => {
    const { practice, flush, state, start, answer } = setup();
    start({ length: 2, level: 'H1' });
    answer(1000);
    const first = state().card.item;
    flush();
    expect(state().card.index).toBe(1);
    expect(state().card.item).not.toBe(first);
    answer(3000);
    flush();
    expect(state().phase).toBe('done');
    const sessions = practice.getSnapshot().sessions;
    expect(sessions).toEqual([
      expect.objectContaining({ kind: 'harmony', family: 'chordSymbol', level: 'H1', cards: 2 }),
    ]);
  });

  it('keeps a stopped session only when a card was answered, and forgets it on close', () => {
    const { practice, controller, state, start, answer } = setup();
    start();
    controller.stop();
    expect(state().phase).toBe('done');
    expect(practice.getSnapshot().sessions).toEqual([]);
    start();
    answer(1000);
    controller.stop();
    expect(practice.getSnapshot().sessions).toHaveLength(1);
    controller.close();
    expect(controller.getState()).toBeNull();
  });

  it('marks the card hinted while the hint is on', () => {
    const { controller, state, start, answer, practice } = setup();
    start({ hint: true });
    expect(state().card.hinted).toBe(true);
    controller.setHint(false);
    answer(1000);
    expect(practice.getSnapshot().answers[0]).toMatchObject({ hinted: true, correct: true });
  });
});
