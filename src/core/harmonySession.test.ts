import { describe, expect, it } from 'vitest';
import { isChordSymbolAnswer, isEarAnswer, isTheoryAnswer, type Answer } from './answers.ts';
import { getHarmonyLevel, harmonyLevelItems, parseSymbol } from './chordSymbols.ts';
import {
  advanceHarmony,
  endHarmonySession,
  HARMONY_MASTERY_WINDOW,
  harmonyLevelProgress,
  harmonyStats,
  markHarmonyPainted,
  pressHarmonyKey,
  recoverHarmonySummary,
  releaseHarmonyKey,
  setHarmonyHint,
  startHarmonySession,
  suggestedHarmonyLevel,
  summarizeHarmony,
  type ChordSymbolAnswer,
  type HarmonySessionState,
} from './harmonySession.ts';
import {
  recoverEarSessions,
  recoverHarmonySessions,
  recoverTheorySessions,
  type SessionRecord,
} from './log.ts';
import { seededRng } from './random.ts';
import { HARMONY_LEVEL_IDS, type HarmonyLevelId } from './chordSymbols.ts';

const T = 1_700_000_000_000;
let ids = 0;
const newId = () => `a${++ids}`;

function start(level: HarmonyLevelId = 'H2', hint = false, length = 3): HarmonySessionState {
  const harmonyLevel = getHarmonyLevel(level);
  return startHarmonySession({
    id: 's1',
    level: harmonyLevel,
    length,
    hint,
    at: T,
    stats: {},
    rng: seededRng(7),
    items: harmonyLevelItems(harmonyLevel),
  });
}

/** The session with its card set to `symbol`, painted at 1000. */
function withCard(state: HarmonySessionState, symbol: string): HarmonySessionState {
  const card = { ...state.card, item: `sym:${symbol}`, symbol: parseSymbol(symbol)! };
  return markHarmonyPainted({ ...state, card }, 0, 1000);
}

const press = (state: HarmonySessionState, keys: number[], time = 2000) =>
  keys.reduce((s, midi) => pressHarmonyKey(s, midi, time, T + time, newId), state);

describe('a session of chord symbols', () => {
  it('draws cards of the level and waits for the paint', () => {
    const state = start('H1');
    expect(getHarmonyLevel('H1').symbols).toContain(state.card.item.slice(4));
    expect(state.card.shownAt).toBeNull();
    // Before the paint, no key counts.
    expect(pressHarmonyKey(state, 60, 500, T, newId)).toBe(state);
    const painted = markHarmonyPainted(state, 0, 900);
    expect(painted.card.shownAt).toBe(900);
    expect(markHarmonyPainted(painted, 0, 950)).toBe(painted);
    expect(markHarmonyPainted(state, 1, 950)).toBe(state);
  });

  it('scores the chord once all its notes are held, timed from the paint', () => {
    const state = press(withCard(start(), 'F♯m'), [54, 57], 1800);
    expect(state.card.status).toBe('waiting');
    expect(state.card.held).toEqual([54, 57]);
    const done = pressHarmonyKey(state, 61, 2300, T + 2300, newId);
    expect(done.card.status).toBe('correct');
    expect(done.answers).toEqual([
      expect.objectContaining({
        sessionId: 's1',
        family: 'chordSymbol',
        level: 'H2',
        item: 'sym:F♯m',
        by: 'play',
        prompt: 'F♯m',
        answer: [54, 57, 61],
        correct: true,
        ms: 1300,
        hinted: false,
        at: T + 2300,
      }),
    ]);
  });

  it('marks the first wrong answer and keeps the card until it is played right', () => {
    let state = press(withCard(start(), 'C'), [60, 63]);
    expect(state.card.status).toBe('wrong');
    expect(state.card.wrong).toEqual([60, 63]);
    expect(state.answers).toHaveLength(1);
    expect(state.answers[0]).toMatchObject({ correct: false, answer: [60, 63] });
    // Another wrong key is shown, not scored.
    state = press(state, [66]);
    expect(state.answers).toHaveLength(1);
    expect(state.card.wrong).toEqual([60, 63, 66]);
    // Let go of the wrong keys while the right ones are held: that is the chord.
    state = releaseHarmonyKey(state, 63, 2100);
    state = releaseHarmonyKey(state, 66, 2100);
    state = press(state, [64, 67], 2200);
    expect(state.card.status).toBe('correct');
    expect(state.answers).toHaveLength(1);
  });

  it('turns right when the wrong key is let go with the chord held', () => {
    let state = press(withCard(start(), 'C'), [60, 64, 66]);
    expect(state.card.status).toBe('wrong');
    state = press(state, [67]);
    expect(state.card.status).toBe('wrong');
    state = releaseHarmonyKey(state, 66, 2500);
    expect(state.card.status).toBe('correct');
    expect(state.card.held).toEqual([60, 64, 67]);
  });

  it('waits for a slash chord’s bass under the chord', () => {
    let state = press(withCard(start('H4'), 'C/E'), [60, 64, 67]);
    expect(state.card.status).toBe('waiting');
    expect(state.answers).toHaveLength(0);
    state = press(state, [52], 2400);
    expect(state.card.status).toBe('correct');
    expect(state.answers[0]).toMatchObject({ correct: true, answer: [52, 60, 64, 67], ms: 1400 });
  });

  it('forgets a key once it is let go, and a key held from before the paint', () => {
    let state = press(withCard(start(), 'C'), [60, 64]);
    state = releaseHarmonyKey(state, 64, 2100);
    expect(state.card.held).toEqual([60]);
    state = press(state, [67]);
    expect(state.card.status).toBe('waiting');
    // A release of a key that never counted changes nothing.
    expect(releaseHarmonyKey(state, 72, 2200)).toBe(state);
  });

  it('counts a card as hinted once the hint was on while it waited', () => {
    let state = withCard(start(), 'C');
    state = setHarmonyHint(state, true);
    expect(state.card.hinted).toBe(true);
    state = setHarmonyHint(state, false);
    expect(state.card.hinted).toBe(true);
    state = press(state, [60, 64, 67]);
    expect(state.answers[0]!.hinted).toBe(true);
    // Turned on after the answer, it does not count.
    const after = setHarmonyHint(press(withCard(start(), 'C'), [60, 64, 67]), true);
    expect(after.card.hinted).toBe(false);
    expect(start('H2', true).card.hinted).toBe(true);
  });

  it('moves on after a right answer, never to the same symbol, and ends after its length', () => {
    let state = press(withCard(start('H1', false, 2), 'C'), [60, 64, 67]);
    state = advanceHarmony(state, { at: T + 3000, stats: {}, rng: seededRng(1) });
    expect(state.card.index).toBe(1);
    expect(state.card.item).not.toBe('sym:C');
    expect(state.card.status).toBe('waiting');
    expect(state.card.held).toEqual([]);
    // A card not answered right yet stays.
    expect(advanceHarmony(state, { at: T, stats: {}, rng: seededRng(1) })).toBe(state);
    const symbol = state.card.item.slice(4);
    state = markHarmonyPainted(state, 1, 4000);
    const keys = { C: [60, 64, 67] }[symbol] ?? keysOf(symbol);
    state = keys.reduce((s, midi) => pressHarmonyKey(s, midi, 4500, T + 4500, newId), state);
    state = advanceHarmony(state, { at: T + 5000, stats: {}, rng: seededRng(1) });
    expect(state.phase).toBe('done');
    expect(state.endedAt).toBe(T + 5000);
    expect(endHarmonySession(state, T + 9000)).toBe(state);
  });
});

/** Close-position keys of a triad of H1 from its root in octave 4. */
function keysOf(symbol: string): number[] {
  const parsed = parseSymbol(symbol)!;
  const root =
    60 + ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[parsed.root.step] + parsed.root.alter);
  return parsed.quality === 'min' ? [root, root + 3, root + 7] : [root, root + 4, root + 7];
}

function answer(i: number, over: Partial<ChordSymbolAnswer> = {}): ChordSymbolAnswer {
  return {
    id: `x${i}`,
    sessionId: 'h1',
    family: 'chordSymbol',
    level: 'H2',
    item: 'sym:Dm',
    by: 'play',
    prompt: 'Dm',
    answer: [62, 65, 69],
    correct: true,
    ms: 2000,
    hinted: false,
    at: T + i * 5000,
    ...over,
  };
}

describe('figures', () => {
  it('sums a session up as Read does', () => {
    const answers = [
      answer(0, { ms: 1500 }),
      answer(1, { item: 'sym:E♭', prompt: 'E♭', correct: false, answer: [63, 66], ms: 2500 }),
      answer(2, { item: 'sym:E♭', prompt: 'E♭', ms: 4000 }),
      answer(3, { ms: 900, hinted: true }),
    ];
    const summary = summarizeHarmony({
      id: 'h1',
      family: 'chordSymbol',
      level: 'H2',
      length: 10,
      startedAt: T - 1500,
      endedAt: T + 20_000,
      answers,
    });
    expect(summary).toMatchObject({
      cards: 4,
      correct: 3,
      accuracy: 0.75,
      medianMs: 2750,
      slowest: [
        { item: 'sym:E♭', ms: 4000 },
        { item: 'sym:Dm', ms: 1500 },
      ],
      missed: [{ item: 'sym:E♭', answer: [63, 66] }],
    });
  });

  it('rebuilds a session left without its end, and only from its own answers', () => {
    const answers = [answer(0), answer(1, { correct: false, answer: [62, 64] })];
    expect(recoverHarmonySummary(answers)).toMatchObject({
      id: 'h1',
      level: 'H2',
      length: 2,
      cards: 2,
      startedAt: T - 2000,
      endedAt: T + 5000,
    });
    expect(recoverHarmonySummary([])).toBeNull();
    const others: Answer[] = [
      ...answers,
      {
        id: 'e1',
        sessionId: 'ear',
        family: 'interval',
        level: 'I1',
        item: 'int:P8:up',
        by: 'name',
        prompt: [60, 72],
        answer: 'P8',
        correct: true,
        ms: 1000,
        replays: 0,
        at: T,
      },
    ];
    expect(others.filter(isChordSymbolAnswer)).toHaveLength(2);
    expect(others.filter(isEarAnswer)).toHaveLength(1);
    expect(others.filter(isTheoryAnswer)).toHaveLength(0);
    const sessions: SessionRecord[] = [];
    expect(recoverHarmonySessions(others, sessions)).toEqual([
      expect.objectContaining({ kind: 'harmony', id: 'h1', cards: 2 }),
    ]);
    expect(recoverEarSessions(others, sessions).map((s) => s.id)).toEqual(['ear']);
    expect(recoverTheorySessions(others, sessions)).toEqual([]);
  });

  it('counts a hinted answer for accuracy, not for time', () => {
    const stats = harmonyStats([answer(0, { hinted: true, ms: 9000 }), answer(1)]);
    expect(stats['sym:Dm']).toMatchObject({ attempts: 2, correct: 2, ewmaMs: 2000 });
  });
});

describe('mastery', () => {
  const window = (n: number, over: Partial<ChordSymbolAnswer> = {}) =>
    Array.from({ length: n }, (_, i) => answer(i, over));

  it('needs 40 cards without the hint, 90 % right and a median under 3 s', () => {
    expect(harmonyLevelProgress(window(39), 'H2').mastered).toBe(false);
    expect(harmonyLevelProgress(window(HARMONY_MASTERY_WINDOW), 'H2')).toMatchObject({
      total: 40,
      cards: 40,
      accuracy: 1,
      medianMs: 2000,
      mastered: true,
    });
    expect(harmonyLevelProgress(window(40, { ms: 3000 }), 'H2').mastered).toBe(false);
    const fourWrong = window(40).map((a, i) => (i < 5 ? { ...a, correct: false } : a));
    expect(harmonyLevelProgress(fourWrong, 'H2').mastered).toBe(false);
    const hinted = [...window(40), ...window(10, { hinted: true, correct: false })];
    expect(harmonyLevelProgress(hinted, 'H2')).toMatchObject({ total: 50, mastered: true });
    expect(harmonyLevelProgress(window(40), 'H3').total).toBe(0);
  });

  it('suggests the first level not mastered', () => {
    const progress = new Map(
      HARMONY_LEVEL_IDS.map((id) => [id, harmonyLevelProgress(window(40), id)] as const),
    );
    expect(suggestedHarmonyLevel(progress, HARMONY_LEVEL_IDS)).toBe('H1');
    const all = new Map(
      HARMONY_LEVEL_IDS.map(
        (id) => [id, harmonyLevelProgress(window(40, { level: id }), id)] as const,
      ),
    );
    expect(suggestedHarmonyLevel(all, HARMONY_LEVEL_IDS)).toBe('H5');
  });
});
