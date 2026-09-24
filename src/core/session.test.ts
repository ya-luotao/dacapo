import { describe, expect, it } from 'vitest';
import { getLevel, type Level, type LevelId } from './levels.ts';
import { seededRng } from './random.ts';
import {
  advance,
  endSession,
  markPainted,
  median,
  pressKey,
  setHint,
  startSession,
  summarize,
  TIMEOUT_MS,
  type SessionState,
} from './session.ts';
import { emptyStats, updateStats, type NoteStats } from './weakness.ts';

const AT = 1_700_000_000_000;

function start(options: { level?: LevelId; length?: number; hint?: boolean; seed?: number } = {}) {
  const level = getLevel(options.level ?? 'L2');
  const rng = seededRng(options.seed ?? 1);
  const state = startSession({
    id: 's1',
    level,
    length: options.length ?? 10,
    hint: options.hint ?? false,
    at: AT,
    stats: {},
    rng,
  });
  return { level, rng, state };
}

const target = (state: SessionState) => state.card.note.midi;
const wrongKey = (state: SessionState) => (target(state) === 60 ? 62 : 60);

/** Paints the current card at `time` and presses the right key `ms` later. */
function answerCorrectly(state: SessionState, time: number, ms = 800): SessionState {
  const painted = markPainted(state, state.card.index, time);
  return pressKey(painted, target(state), time + ms, AT + time + ms);
}

describe('startSession', () => {
  it('shows the first card, not yet painted', () => {
    const { state } = start({ length: 20 });
    expect(state).toMatchObject({
      id: 's1',
      level: 'L2',
      length: 20,
      phase: 'running',
      startedAt: AT,
      endedAt: null,
      attempts: [],
    });
    expect(state.card).toMatchObject({
      index: 0,
      shownAt: null,
      status: 'waiting',
      wrongKey: null,
    });
    expect(getLevel('L2').notes).toContainEqual(state.card.note);
  });
});

describe('scoring', () => {
  it('start → card → wrong → correct → next → summary', () => {
    const { level, rng, state: first } = start({ length: 2 });
    let state = first;
    state = markPainted(state, 0, 1000);
    const miss = wrongKey(state);
    state = pressKey(state, miss, 1900, AT + 1);
    expect(state.card).toMatchObject({ status: 'wrong', wrongKey: miss });
    expect(state.attempts).toHaveLength(1);
    expect(state.attempts[0]).toMatchObject({ correct: false, played: miss, ms: 900 });

    // Still on the same card; another wrong key only updates the feedback.
    state = pressKey(state, miss + 1 === target(state) ? miss + 2 : miss + 1, 2100, AT + 2);
    expect(state.card.status).toBe('wrong');
    expect(state.attempts).toHaveLength(1);

    state = pressKey(state, target(state), 2500, AT + 3);
    expect(state.card.status).toBe('correct');
    expect(state.attempts).toHaveLength(1);
    expect(state.attempts[0]!.correct).toBe(false);

    const firstNote = state.card.note;
    state = advance(state, { level, at: AT + 4, stats: {}, rng });
    expect(state.phase).toBe('running');
    expect(state.card).toMatchObject({ index: 1, shownAt: null, status: 'waiting' });
    expect(state.card.note.midi).not.toBe(firstNote.midi);

    state = answerCorrectly(state, 5000, 700);
    expect(state.attempts[1]).toMatchObject({ correct: true, ms: 700, hinted: false });
    state = advance(state, { level, at: AT + 9, stats: {}, rng });
    expect(state).toMatchObject({ phase: 'done', endedAt: AT + 9 });

    expect(summarize(state)).toMatchObject({
      id: 's1',
      level: 'L2',
      length: 2,
      cards: 2,
      correct: 1,
      accuracy: 0.5,
      medianMs: 700,
      startedAt: AT,
      endedAt: AT + 9,
    });
  });

  it('ignores presses before the card is painted', () => {
    let { state } = start();
    state = pressKey(state, target(state), 500, AT);
    expect(state.attempts).toHaveLength(0);
    expect(state.card.status).toBe('waiting');
  });

  it('ignores presses stamped before the paint, even if they arrive after it', () => {
    let { state } = start();
    state = markPainted(state, 0, 1000);
    state = pressKey(state, target(state), 999.9, AT);
    expect(state.attempts).toHaveLength(0);
    state = pressKey(state, target(state), 1000, AT);
    expect(state.attempts).toHaveLength(1);
    expect(state.attempts[0]!.ms).toBe(0);
  });

  it('does not let a late press of the previous card score the next one', () => {
    const { level, rng, state: first } = start();
    let state = first;
    state = answerCorrectly(state, 1000);
    const previousTarget = state.card.note.midi;
    state = advance(state, { level, at: AT, stats: {}, rng });
    // The key of the old card pressed again during the transition, before the new card is painted.
    state = pressKey(state, previousTarget, 2200, AT);
    state = markPainted(state, state.card.index, 2300);
    expect(state.attempts).toHaveLength(1);
    expect(state.card.status).toBe('waiting');
  });

  it('ignores key presses after a correct answer until the next card', () => {
    let { state } = start();
    state = answerCorrectly(state, 1000);
    const after = pressKey(state, wrongKey(state), 2000, AT);
    expect(after).toBe(state);
  });

  it('scores the first note-on of a chord', () => {
    let { state } = start();
    state = markPainted(state, 0, 1000);
    const miss = wrongKey(state);
    state = pressKey(state, miss, 1500, AT);
    state = pressKey(state, target(state), 1500, AT);
    expect(state.attempts).toHaveLength(1);
    expect(state.attempts[0]).toMatchObject({ played: miss, correct: false });
  });

  it('only accepts the paint stamp of the current card, once', () => {
    let { state } = start();
    expect(markPainted(state, 1, 1000)).toBe(state);
    state = markPainted(state, 0, 1000);
    expect(markPainted(state, 0, 2000).card.shownAt).toBe(1000);
  });

  it('requires the exact octave', () => {
    let { state } = start();
    state = markPainted(state, 0, 0);
    state = pressKey(state, target(state) + 12, 900, AT);
    expect(state.attempts[0]!.correct).toBe(false);
  });

  it('accepts either spelling of an L7 key', () => {
    let { state } = start({ level: 'L7' });
    state = markPainted(state, 0, 0);
    const note = state.card.note;
    expect(note.pitch.accidental).not.toBe(0);
    state = pressKey(state, note.midi, 900, AT);
    expect(state.attempts[0]!.correct).toBe(true);
  });

  it('does not advance before the right key', () => {
    const { level, rng, state: first } = start();
    let state = first;
    state = markPainted(state, 0, 0);
    expect(advance(state, { level, at: AT, stats: {}, rng })).toBe(state);
    state = pressKey(state, wrongKey(state), 500, AT);
    expect(advance(state, { level, at: AT, stats: {}, rng })).toBe(state);
  });
});

describe('hint', () => {
  it('marks answers given with the hint visible', () => {
    let { state } = start({ hint: true });
    state = answerCorrectly(state, 0);
    expect(state.attempts[0]!.hinted).toBe(true);
  });

  it('counts a hint switched on before the answer, and keeps it when switched off', () => {
    let { state } = start();
    state = markPainted(state, 0, 0);
    state = setHint(state, true);
    state = setHint(state, false);
    state = pressKey(state, target(state), 900, AT);
    expect(state.attempts[0]!.hinted).toBe(true);
  });

  it('does not re-mark an answer already scored', () => {
    const { level, rng, state: first } = start();
    let state = first;
    state = markPainted(state, 0, 0);
    state = pressKey(state, wrongKey(state), 900, AT);
    state = setHint(state, true);
    expect(state.attempts[0]!.hinted).toBe(false);
    state = pressKey(state, target(state), 1200, AT);
    state = advance(state, { level, at: AT, stats: {}, rng });
    expect(state.card.hinted).toBe(true);
  });

  it('leaves hinted answers out of the median', () => {
    const { level, rng, state: first } = start({ length: 3 });
    let state = first;
    state = answerCorrectly(state, 0, 1000);
    state = advance(state, { level, at: AT, stats: {}, rng });
    state = setHint(state, true);
    state = answerCorrectly(state, 10_000, 200);
    state = setHint(state, false);
    state = advance(state, { level, at: AT, stats: {}, rng });
    state = answerCorrectly(state, 20_000, 3000);
    const summary = summarize(state);
    expect(summary.cards).toBe(3);
    expect(summary.accuracy).toBe(1);
    expect(summary.medianMs).toBe(2000);
  });
});

describe('timeouts', () => {
  it('marks answers slower than 30 s and leaves them out of reaction figures', () => {
    const { level, rng, state: first } = start({ length: 2 });
    let state = first;
    state = answerCorrectly(state, 0, TIMEOUT_MS + 1);
    expect(state.attempts[0]).toMatchObject({ correct: true, timedOut: true, ms: TIMEOUT_MS + 1 });
    state = advance(state, { level, at: AT, stats: {}, rng });
    state = answerCorrectly(state, 60_000, 1200);
    expect(state.attempts[1]!.timedOut).toBe(false);
    const summary = summarize(state);
    expect(summary.accuracy).toBe(1);
    expect(summary.medianMs).toBe(1200);
    expect(summary.slowest.map((s) => s.ms)).toEqual([1200]);
  });

  it('keeps an answer at exactly 30 s', () => {
    const { state } = start();
    expect(answerCorrectly(state, 0, TIMEOUT_MS).attempts[0]!.timedOut).toBe(false);
  });
});

describe('ending', () => {
  it('can stop early and summarizes what was answered', () => {
    let { state } = start({ length: 20 });
    state = answerCorrectly(state, 0);
    state = endSession(state, AT + 50);
    expect(state).toMatchObject({ phase: 'done', endedAt: AT + 50 });
    expect(pressKey(state, 60, 99_999, AT)).toBe(state);
    expect(summarize(state)).toMatchObject({ length: 20, cards: 1, correct: 1 });
    expect(endSession(state, AT + 99).endedAt).toBe(AT + 50);
  });

  it('summarizes an empty session without dividing by zero', () => {
    const { state } = start();
    expect(summarize(endSession(state, AT))).toMatchObject({
      cards: 0,
      accuracy: null,
      medianMs: null,
      slowest: [],
      missed: [],
    });
  });

  it('runs a full session of the chosen length with the weakness model', () => {
    const level: Level = getLevel('L5');
    const rng = seededRng(5);
    let stats: Record<string, NoteStats> = {};
    let state = startSession({ id: 'x', level, length: 50, hint: false, at: AT, stats, rng });
    let time = 0;
    let previous: number | null = null;
    while (state.phase === 'running') {
      expect(state.card.note.midi).not.toBe(previous);
      previous = state.card.note.midi;
      state = answerCorrectly(state, (time += 5000), 900);
      const attempt = state.attempts.at(-1)!;
      stats = {
        ...stats,
        [attempt.note]: updateStats(stats[attempt.note] ?? emptyStats(attempt.note), attempt),
      };
      state = advance(state, { level, at: AT + time, stats, rng });
    }
    expect(state.attempts).toHaveLength(50);
    expect(state.card.index).toBe(49);
    expect(JSON.parse(JSON.stringify(state.attempts))).toEqual(state.attempts);
  });
});

describe('summary', () => {
  it('lists the slowest notes and the missed ones', () => {
    const { level, rng, state: first } = start({ length: 4 });
    let state = first;
    const times = [900, 2500, 1800];
    for (const ms of times) {
      state = answerCorrectly(state, state.card.index * 10_000, ms);
      state = advance(state, { level, at: AT, stats: {}, rng });
    }
    state = markPainted(state, state.card.index, 40_000);
    const missed = state.card.note.key;
    state = pressKey(state, wrongKey(state), 41_000, AT);
    const summary = summarize(state);
    expect(summary.slowest.map((s) => s.ms)).toEqual([2500, 1800, 900]);
    expect(summary.missed).toEqual([missed]);
    expect(summary.medianMs).toBe(1800);
    expect(summary.accuracy).toBe(0.75);
  });
});

describe('median', () => {
  it('handles odd, even and empty inputs', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});
