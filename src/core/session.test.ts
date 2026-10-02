import { describe, expect, it } from 'vitest';
import { getLevel, type Level, type LevelId, type StaffNote } from './levels.ts';
import { seededRng } from './random.ts';
import {
  advance,
  endSession,
  markPainted,
  median,
  pressKey,
  recoverSummary,
  setHint,
  startSession,
  summarize,
  TIMEOUT_MS,
  type SessionState,
} from './session.ts';
import { emptyStats, updateStats, type NoteStats } from './weakness.ts';

const AT = 1_700_000_000_000;

let attemptIds = 0;
const press = (state: SessionState, midi: number, time: number, at: number) =>
  pressKey(state, midi, time, at, () => `a${++attemptIds}`);

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
  return press(painted, target(state), time + ms, AT + time + ms);
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
    state = press(state, miss, 1900, AT + 1);
    expect(state.card).toMatchObject({ status: 'wrong', wrongKey: miss });
    expect(state.attempts).toHaveLength(1);
    expect(state.attempts[0]).toMatchObject({ correct: false, played: miss, ms: 900 });

    // Still on the same card; another wrong key only updates the feedback.
    state = press(state, miss + 1 === target(state) ? miss + 2 : miss + 1, 2100, AT + 2);
    expect(state.card.status).toBe('wrong');
    expect(state.attempts).toHaveLength(1);

    state = press(state, target(state), 2500, AT + 3);
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
    state = press(state, target(state), 500, AT);
    expect(state.attempts).toHaveLength(0);
    expect(state.card.status).toBe('waiting');
  });

  it('ignores presses stamped before the paint, even if they arrive after it', () => {
    let { state } = start();
    state = markPainted(state, 0, 1000);
    state = press(state, target(state), 999.9, AT);
    expect(state.attempts).toHaveLength(0);
    state = press(state, target(state), 1000, AT);
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
    state = press(state, previousTarget, 2200, AT);
    state = markPainted(state, state.card.index, 2300);
    expect(state.attempts).toHaveLength(1);
    expect(state.card.status).toBe('waiting');
  });

  it('ignores key presses after a correct answer until the next card', () => {
    let { state } = start();
    state = answerCorrectly(state, 1000);
    const after = press(state, wrongKey(state), 2000, AT);
    expect(after).toBe(state);
  });

  it('scores the first note-on of a chord', () => {
    let { state } = start();
    state = markPainted(state, 0, 1000);
    const miss = wrongKey(state);
    state = press(state, miss, 1500, AT);
    state = press(state, target(state), 1500, AT);
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
    state = press(state, target(state) + 12, 900, AT);
    expect(state.attempts[0]!.correct).toBe(false);
  });

  it('accepts either spelling of an L7 key', () => {
    let { state } = start({ level: 'L7' });
    state = markPainted(state, 0, 0);
    const note = state.card.note;
    expect(note.pitch.accidental).not.toBe(0);
    state = press(state, note.midi, 900, AT);
    expect(state.attempts[0]!.correct).toBe(true);
  });

  it('does not advance before the right key', () => {
    const { level, rng, state: first } = start();
    let state = first;
    state = markPainted(state, 0, 0);
    expect(advance(state, { level, at: AT, stats: {}, rng })).toBe(state);
    state = press(state, wrongKey(state), 500, AT);
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
    state = press(state, target(state), 900, AT);
    expect(state.attempts[0]!.hinted).toBe(true);
  });

  it('does not re-mark an answer already scored', () => {
    const { level, rng, state: first } = start();
    let state = first;
    state = markPainted(state, 0, 0);
    state = press(state, wrongKey(state), 900, AT);
    state = setHint(state, true);
    expect(state.attempts[0]!.hinted).toBe(false);
    state = press(state, target(state), 1200, AT);
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
    expect(press(state, 60, 99_999, AT)).toBe(state);
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
    state = press(state, wrongKey(state), 41_000, AT);
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

describe('attempt ids', () => {
  it('gives each scored attempt an id from the injected generator, and only those', () => {
    const { level, rng, state: first } = start({ length: 3 });
    const ids: string[] = [];
    const newId = () => {
      ids.push(`id${ids.length + 1}`);
      return ids.at(-1)!;
    };
    let state = markPainted(first, 0, 0);
    state = pressKey(state, wrongKey(state), 500, AT, newId);
    state = pressKey(state, target(state), 900, AT, newId);
    state = advance(state, { level, at: AT, stats: {}, rng });
    state = pressKey(state, target(state), 1000, AT, newId); // not painted: ignored
    expect(state.attempts.map((a) => a.id)).toEqual(['id1']);
    expect(ids).toEqual(['id1']);
  });
});

describe('active time', () => {
  it('runs from the start to the end and caps pauses at 60 s', () => {
    const { level, rng, state: first } = start({ length: 3 });
    let state = first;
    const answerAt = (at: number) => {
      state = markPainted(state, state.card.index, 0);
      state = pressKey(state, target(state), 800, at, () => `x${at}`);
      state = advance(state, { level, at, stats: {}, rng });
    };
    answerAt(AT + 5_000);
    answerAt(AT + 10_000);
    answerAt(AT + 10_000 + 5 * 60_000); // walked away for five minutes
    expect(summarize(state)).toMatchObject({
      endedAt: AT + 10_000 + 5 * 60_000,
      activeMs: 10_000 + 60_000,
    });
  });

  it('covers a session stopped before any answer from start to stop', () => {
    const { state } = start();
    expect(summarize(endSession(state, AT + 10_000)).activeMs).toBe(10_000);
    expect(summarize(endSession(state, AT)).activeMs).toBe(0);
  });
});

describe('recoverSummary', () => {
  it('rebuilds the summary of a session whose end was never stored', () => {
    const { level, rng, state: first } = start({ length: 20 });
    let state = first;
    state = answerCorrectly(state, 1000, 700);
    state = advance(state, { level, at: AT, stats: {}, rng });
    state = markPainted(state, 1, 5000);
    state = press(state, wrongKey(state), 6000, AT + 6000);
    const recovered = recoverSummary(state.attempts)!;
    expect(recovered).toMatchObject({
      id: 's1',
      level: 'L2',
      length: 2,
      cards: 2,
      correct: 1,
      accuracy: 0.5,
      medianMs: 700,
      endedAt: AT + 6000,
    });
    expect(recovered.startedAt).toBe(Math.round(state.attempts[0]!.at - 700));
    expect(recoverSummary([])).toBeNull();
  });
});

describe('a session of some of the level’s notes', () => {
  const level = getLevel('L2');
  const answer = (correct: boolean) => ({
    correct,
    ms: 1500,
    hinted: false,
    timedOut: false,
    at: AT,
  });
  /** A note answered five times, wrong every time or right every time. */
  const seen = (key: string, correct: boolean): NoteStats =>
    Array.from({ length: 5 }).reduce<NoteStats>(
      (stats) => updateStats(stats, answer(correct)),
      emptyStats(key),
    );

  /** The notes of `n` cards of a session of `notes`, each answered right. */
  function drawn(
    notes: readonly StaffNote[],
    n: number,
    stats: Record<string, NoteStats> = {},
    from: Level = level,
  ): StaffNote[] {
    const rng = seededRng(5);
    const options = { id: 's', level: from, length: n + 1, hint: false, at: AT, stats, rng };
    let state = startSession({ ...options, notes });
    const out = [state.card.note];
    while (out.length < n) {
      const answered = { ...state, card: { ...state.card, status: 'correct' as const } };
      state = advance(answered, { level: from, at: AT, stats, rng });
      out.push(state.card.note);
    }
    return out;
  }

  it('draws those notes alone, never the same key twice in a row', () => {
    const notes = level.notes.slice(2, 5);
    const cards = drawn(notes, 200);
    expect(new Set(cards.map((n) => n.key))).toEqual(new Set(notes.map((n) => n.key)));
    cards.forEach((note, i) => {
      if (i > 0) expect(note.midi).not.toBe(cards[i - 1]!.midi);
    });
  });

  it('keeps the weights among them: the weak note comes more often', () => {
    const [weak, a, b] = level.notes.slice(2, 5) as [StaffNote, StaffNote, StaffNote];
    const stats = {
      [weak.key]: seen(weak.key, false),
      [a.key]: seen(a.key, true),
      [b.key]: seen(b.key, true),
    };
    const cards = drawn([weak, a, b], 600, stats);
    const count = (note: StaffNote) => cards.filter((c) => c.key === note.key).length;
    expect(count(weak)).toBeGreaterThan(count(a) * 1.3);
    expect(count(weak)).toBeGreaterThan(count(b) * 1.3);
    // A note of the level outside them is never drawn, however weak.
    const other = level.notes[0]!;
    const with0 = drawn([weak, a, b], 200, { ...stats, [other.key]: seen(other.key, false) });
    expect(with0.some((c) => c.key === other.key)).toBe(false);
  });

  it('two notes take turns; one note, or one key on both staves, is asked again', () => {
    const [a, b] = level.notes.slice(0, 2) as [StaffNote, StaffNote];
    const two = drawn([a, b], 6).map((n) => n.key);
    expect(new Set([two[0], two[1]])).toEqual(new Set([a.key, b.key]));
    expect(two).toEqual([two[0], two[1], two[0], two[1], two[0], two[1]]);
    expect(drawn([a], 4).map((n) => n.key)).toEqual([a.key, a.key, a.key, a.key]);
    // Middle C is written on both staves of the grand staff: the same key.
    const grand = getLevel('L5');
    const both = grand.notes.filter((n) => n.midi === 60);
    expect(both).toHaveLength(2);
    const cards = drawn(both, 20, {}, grand);
    expect(cards.every((n) => n.midi === 60)).toBe(true);
  });

  it('is a session of the level like any other: its attempts are the level’s', () => {
    const notes = level.notes.slice(2, 5);
    const rng = seededRng(2);
    let state = startSession({
      id: 's',
      level,
      length: 2,
      hint: false,
      at: AT,
      stats: {},
      rng,
      notes,
    });
    state = answerCorrectly(state, 1000);
    expect(state.attempts[0]).toMatchObject({ level: 'L2', sessionId: 's', correct: true });
    expect(summarize(state)).toMatchObject({ level: 'L2', cards: 1, length: 2 });
    // A session of the whole level keeps no list of its own.
    expect(start().state.notes).toBeUndefined();
  });
});
