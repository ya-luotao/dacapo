import { describe, expect, it } from 'vitest';
import { getEarLevel, levelItems, type EarLevelId, type Prompt } from './earItems.ts';
import {
  advanceEar,
  chooseName,
  EAR_MASTERY_WINDOW,
  ECHO_MASTERY_WINDOW,
  ECHO_SESSION_LENGTHS,
  earLevelProgress,
  earStats,
  endEarSession,
  masteryWindow,
  pressKey,
  promptScheduled,
  recoverEarSummary,
  releaseKey,
  startEarSession,
  suggestedEarLevel,
  summarizeEar,
  type EarAnswer,
  type AnswerMode,
  type EarSessionState,
} from './earSession.ts';
import { recoverEarSessions, type SessionRecord } from './log.ts';
import { seededRng } from './random.ts';

const AT = 1_700_000_000_000;

function start(level: EarLevelId, by: AnswerMode, length = 10, seed = 1): EarSessionState {
  const earLevel = getEarLevel(level);
  const directions = ['up'] as const;
  return startEarSession({
    id: 's1',
    level: earLevel,
    by,
    directions,
    items: levelItems(earLevel, directions),
    length,
    at: AT,
    stats: {},
    rng: seededRng(seed),
  });
}

/** The session with its current card's prompt replaced, scheduled to open at `opensAt`. */
function withPrompt(state: EarSessionState, prompt: Prompt, opensAt = 1000): EarSessionState {
  const next = { ...state, card: { ...state.card, prompt } };
  return promptScheduled(next, next.card.index, opensAt, false);
}

let ids = 0;
const newId = () => `a${++ids}`;

describe('an ear session', () => {
  it('starts with a waiting card whose window is not open yet', () => {
    const state = start('I1', 'play');
    expect(state).toMatchObject({ family: 'interval', level: 'I1', phase: 'running' });
    expect(state.card).toMatchObject({ index: 0, opensAt: null, replays: 0, status: 'waiting' });
    expect(state.items).toEqual(['int:P8:up', 'int:P5:up', 'int:M3:up']);
    // Nothing counts before the prompt is scheduled.
    expect(pressKey(state, 60, 5000, AT, newId)).toBe(state);
  });

  it('counts keys only from the last note-on, and times from there', () => {
    let state = withPrompt(start('I1', 'play'), { item: 'int:M3:up', notes: [60, 64] }, 1000);
    expect(pressKey(state, 64, 999, AT, newId)).toBe(state);
    state = pressKey(state, 64, 1600, AT + 5, () => 'the-answer');
    expect(state.card.status).toBe('correct');
    expect(state.answers).toEqual([
      {
        id: 'the-answer',
        sessionId: 's1',
        family: 'interval',
        level: 'I1',
        item: 'int:M3:up',
        by: 'play',
        prompt: [60, 64],
        answer: [64],
        correct: true,
        ms: 600,
        replays: 0,
        at: AT + 5,
      },
    ]);
    // Only the first answer is scored.
    expect(pressKey(state, 65, 1700, AT, newId)).toBe(state);
  });

  it('passes over the key shown and scores a wrong key', () => {
    let state = withPrompt(start('I1', 'play'), { item: 'int:P5:down', notes: [67, 60] });
    expect(pressKey(state, 67, 1200, AT, newId)).toBe(state);
    state = pressKey(state, 59, 1300, AT, newId);
    expect(state.card).toMatchObject({ status: 'wrong', answer: [59] });
    expect(state.answers[0]).toMatchObject({ correct: false, answer: [59], ms: 300 });
  });

  it('counts a replay before the answer, not one after it', () => {
    let state = start('I1', 'play');
    state = promptScheduled(state, 0, 1000, false);
    state = promptScheduled(state, 0, 4000, true);
    expect(state.card).toMatchObject({ opensAt: 4000, replays: 1 });
    // The replay closes the window until its own last note-on.
    const target = state.card.prompt.notes[1]!;
    expect(pressKey(state, target, 3000, AT, newId)).toBe(state);
    state = pressKey(state, target, 4500, AT, newId);
    expect(state.answers[0]).toMatchObject({ replays: 1, ms: 500 });
    state = promptScheduled(state, 0, 9000, true);
    expect(state.card.replays).toBe(1);
    // A stale card index changes nothing.
    expect(promptScheduled(state, 3, 1, true)).toBe(state);
  });

  it('judges a chord by the keys held since the window opened', () => {
    const prompt = { item: 'chord:maj:root', notes: [60, 64, 67] };
    let state = withPrompt(start('C1', 'play'), prompt, 1000);
    state = pressKey(state, 48, 1100, AT, newId);
    state = pressKey(state, 55, 1150, AT, newId);
    expect(state.card).toMatchObject({ status: 'waiting', held: [48, 55] });
    state = releaseKey(state, 48);
    expect(state.card.held).toEqual([55]);
    state = pressKey(state, 64, 1300, AT, newId);
    expect(state.card.status).toBe('waiting');
    state = pressKey(state, 72, 1400, AT, newId);
    expect(state.card.status).toBe('correct');
    expect(state.answers[0]).toMatchObject({ answer: [55, 64, 72], correct: true, ms: 400 });
  });

  it('marks a chord wrong at the first key outside it', () => {
    let state = withPrompt(start('C1', 'play'), { item: 'chord:min:root', notes: [57, 60, 64] });
    state = pressKey(state, 57, 1100, AT, newId);
    state = pressKey(state, 61, 1200, AT, newId);
    expect(state.card.status).toBe('wrong');
    expect(state.answers[0]).toMatchObject({ answer: [57, 61], correct: false });
  });

  it('forgets keys held when a replay starts', () => {
    const prompt = { item: 'chord:maj:root', notes: [60, 64, 67] };
    let state = withPrompt(start('C1', 'play'), prompt, 1000);
    state = pressKey(state, 60, 1100, AT, newId);
    state = pressKey(state, 64, 1100, AT, newId);
    state = promptScheduled(state, 0, 5000, true);
    expect(state.card.held).toEqual([]);
    state = pressKey(state, 67, 5100, AT, newId);
    expect(state.card).toMatchObject({ status: 'waiting', held: [67] });
  });

  it('wants the bass in the inversion level', () => {
    const prompt = { item: 'chord:maj:2nd', notes: [67, 72, 76] };
    let state = withPrompt(start('C3', 'play'), prompt);
    for (const midi of [60, 64, 67]) state = pressKey(state, midi, 1200, AT, newId);
    expect(state.card.status).toBe('wrong');
    let again = withPrompt(start('C3', 'play'), prompt);
    for (const midi of [55, 60, 64]) again = pressKey(again, midi, 1200, AT, newId);
    expect(again.card.status).toBe('correct');
  });

  it('answers by name: the interval, whatever its direction', () => {
    let state = withPrompt(start('I2', 'name'), { item: 'int:m3:up', notes: [60, 63] });
    expect(pressKey(state, 63, 1500, AT, newId)).toBe(state);
    expect(chooseName(state, 'm3', 900, AT, newId)).toBe(state);
    state = chooseName(state, 'M3', 1800, AT, newId);
    expect(state.answers[0]).toMatchObject({ answer: 'M3', correct: false, ms: 800 });
    expect(chooseName(state, 'm3', 2000, AT, newId)).toBe(state);
    const right = chooseName(
      withPrompt(start('C3', 'name'), { item: 'chord:min:1st', notes: [63, 67, 72] }),
      'min:1st',
      1100,
      AT,
      newId,
    );
    expect(right.answers[0]).toMatchObject({ answer: 'min:1st', correct: true });
  });

  it('moves on after any answer, never to the same item, and ends after the last', () => {
    let state = start('I1', 'play', 3, 4);
    const rng = seededRng(8);
    const items: string[] = [];
    for (let i = 0; i < 3; i++) {
      items.push(state.card.prompt.item);
      state = promptScheduled(state, i, 1000 * i, false);
      expect(advanceEar(state, { at: AT, stats: {}, rng })).toBe(state);
      state = pressKey(
        state,
        state.card.prompt.notes[1]! + (i === 1 ? 1 : 0),
        1000 * i + 500,
        AT + i,
        newId,
      );
      state = advanceEar(state, { at: AT + i + 1, stats: {}, rng });
    }
    expect(items[0]).not.toBe(items[1]);
    expect(items[1]).not.toBe(items[2]);
    expect(state).toMatchObject({ phase: 'done', endedAt: AT + 3 });
    expect(state.answers.map((a) => a.correct)).toEqual([true, false, true]);
  });

  it('can be stopped at any time', () => {
    const state = endEarSession(start('I1', 'play'), AT + 10);
    expect(state).toMatchObject({ phase: 'done', endedAt: AT + 10 });
    expect(endEarSession(state, AT + 20)).toBe(state);
  });
});

const answer = (i: number, patch: Partial<EarAnswer> = {}): EarAnswer => ({
  id: `x${i}`,
  sessionId: 's1',
  family: 'interval',
  level: 'I1',
  item: 'int:P5:up',
  by: 'play',
  prompt: [60, 67],
  answer: [67],
  correct: true,
  ms: 1000 + i,
  replays: 0,
  at: AT + i * 1000,
  ...patch,
});

describe('ear figures', () => {
  it('summarizes a session: times over right answers without a replay', () => {
    const answers = [
      answer(0, { ms: 1200 }),
      answer(1, { ms: 800, replays: 2 }),
      answer(2, { correct: false, answer: [66], ms: 500 }),
      answer(3, { ms: 1600 }),
      answer(4, { ms: 40_000 }),
    ];
    const summary = summarizeEar({
      id: 's1',
      family: 'interval',
      level: 'I1',
      by: 'play',
      length: 10,
      startedAt: AT - 2000,
      endedAt: AT + 5000,
      answers,
    });
    expect(summary).toEqual({
      id: 's1',
      family: 'interval',
      level: 'I1',
      by: 'play',
      startedAt: AT - 2000,
      endedAt: AT + 5000,
      activeMs: 7000,
      length: 10,
      items: 5,
      correct: 4,
      accuracy: 0.8,
      medianMs: 1400,
      replays: 2,
      missed: [{ item: 'int:P5:up', answer: [66], prompt: [60, 67] }],
    });
  });

  it('recovers the session of answers whose session was never stored', () => {
    const answers = [answer(0), answer(1), answer(2, { sessionId: 'known' })];
    const sessions = [{ kind: 'free', id: 'known' }] as unknown as SessionRecord[];
    const [recovered, ...rest] = recoverEarSessions(answers, sessions);
    expect(rest).toEqual([]);
    expect(recovered).toMatchObject({
      kind: 'ear',
      id: 's1',
      items: 2,
      length: 2,
      startedAt: AT - 1000,
      endedAt: AT + 1000,
    });
    expect(recoverEarSummary([])).toBeNull();
  });

  it('keeps per-item stats from the answers, a replay counting for accuracy only', () => {
    const stats = earStats([
      answer(0, { ms: 1000 }),
      answer(1, { ms: 9000, replays: 1 }),
      answer(2, { item: 'int:M3:up', prompt: [60, 64], answer: [65], correct: false }),
    ]);
    expect(stats['int:P5:up']).toMatchObject({ attempts: 2, correct: 2, ewmaMs: 1000 });
    expect(stats['int:M3:up']).toMatchObject({ attempts: 1, errors: 1, ewmaMs: null });
  });

  it('masters a level at 90 % over its last 40 answers without a replay', () => {
    const answers: EarAnswer[] = [];
    for (let i = 0; i < EAR_MASTERY_WINDOW; i++) {
      answers.push(answer(i, { correct: i % 10 !== 0, answer: i % 10 !== 0 ? [67] : [66] }));
    }
    expect(earLevelProgress(answers, 'I1')).toMatchObject({
      total: 40,
      answers: 40,
      accuracy: 0.9,
      mastered: true,
    });
    // Replayed answers are left out of the window: 39 is not a full one.
    const replayed = answers.map((a, i) => (i === 5 ? { ...a, replays: 1 } : a));
    expect(earLevelProgress(replayed, 'I1')).toMatchObject({ answers: 39, mastered: false });
    // Two more wrong answers push out a wrong and a right one: 35 of 40 is below 90 %.
    const wrong = { correct: false, answer: [66] };
    const worse = [...answers, answer(99, wrong), answer(100, wrong)];
    expect(earLevelProgress(worse, 'I1')).toMatchObject({ accuracy: 0.875, mastered: false });
    expect(earLevelProgress(answers, 'I2')).toMatchObject({ total: 0, accuracy: null });
  });

  it('suggests the first level of the family not mastered', () => {
    const mastered = (level: EarLevelId) => ({
      level,
      total: 40,
      answers: 40,
      window: 40,
      accuracy: 1,
      medianMs: 900,
      mastered: true,
    });
    const progress = new Map([
      ['I1', mastered('I1')],
      ['C1', mastered('C1')],
      ['C2', mastered('C2')],
    ] as const);
    expect(suggestedEarLevel('interval', progress)).toBe('I2');
    expect(suggestedEarLevel('chord', progress)).toBe('C3');
    const all = new Map(
      (['C1', 'C2', 'C3', 'C4', 'C5'] as const).map((id) => [id, mastered(id)] as const),
    );
    expect(suggestedEarLevel('chord', all)).toBe('C5');
  });
});

describe('an echo session', () => {
  const melody: Prompt = { item: 'echo:EC2', notes: [64, 62, 60, 62] };
  const echo = (length = 5) => start('EC2', 'name', length);

  it('plays back only, one melody item per level', () => {
    const state = echo();
    expect(state).toMatchObject({ family: 'echo', level: 'EC2', by: 'play', directions: [] });
    expect(state.items).toEqual(['echo:EC2']);
    expect(state.card.played).toEqual([]);
    expect(state.card.prompt.melody).toBeDefined();
  });

  it('takes the keys in order and scores the melody at its last key', () => {
    let state = withPrompt(echo(), melody, 1000);
    // Nothing before the last note-on of the melody.
    expect(pressKey(state, 64, 900, AT, newId)).toBe(state);
    state = pressKey(state, 64, 1200, AT, newId);
    state = pressKey(state, 62, 1500, AT, newId);
    state = pressKey(state, 60, 1800, AT, newId);
    expect(state.card).toMatchObject({ status: 'waiting', played: [64, 62, 60] });
    expect(state.answers).toEqual([]);
    state = pressKey(state, 62, 2400, AT + 9, () => 'm1');
    expect(state.card.status).toBe('correct');
    expect(state.answers).toEqual([
      {
        id: 'm1',
        sessionId: 's1',
        family: 'echo',
        level: 'EC2',
        item: 'echo:EC2',
        by: 'play',
        prompt: [64, 62, 60, 62],
        answer: [64, 62, 60, 62],
        correct: true,
        ms: 1400,
        replays: 0,
        at: AT + 9,
      },
    ]);
  });

  it('keeps the melody’s key with the answer and the miss, to spell its notes', () => {
    const inF: Prompt = {
      item: 'echo:EC2',
      notes: [65, 69, 67, 65],
      melody: { tonic: 'F', scale: 'major', fifths: -1, written: [], chord: [65, 69, 72] },
    };
    let state = withPrompt(echo(), inF, 1000);
    state = pressKey(state, 65, 1100, AT, newId);
    state = pressKey(state, 70, 1200, AT, newId);
    expect(state.answers[0]).toMatchObject({ key: { tonic: 'F', scale: 'major' } });
    expect(summarizeEar(state).missed).toEqual([
      {
        item: 'echo:EC2',
        answer: [65, 70],
        prompt: [65, 69, 67, 65],
        key: { tonic: 'F', scale: 'major' },
      },
    ]);
  });

  it('ends the attempt at the first wrong key', () => {
    let state = withPrompt(echo(), melody, 1000);
    state = pressKey(state, 64, 1100, AT, newId);
    state = pressKey(state, 60, 1300, AT, newId);
    expect(state.card).toMatchObject({ status: 'wrong', answer: [64, 60] });
    expect(state.answers[0]).toMatchObject({ correct: false, answer: [64, 60], ms: 300 });
    // Only the first attempt is scored.
    expect(pressKey(state, 62, 1400, AT, newId)).toBe(state);
  });

  it('keeps the keys played before a replay, and goes on where it was', () => {
    let state = withPrompt(echo(), melody, 1000);
    state = pressKey(state, 64, 1100, AT, newId);
    state = pressKey(state, 62, 1200, AT, newId);
    state = promptScheduled(state, 0, 6000, true);
    expect(state.card).toMatchObject({ played: [64, 62], replays: 1, opensAt: 6000 });
    // The replay closes the window until its last note-on.
    expect(pressKey(state, 60, 5000, AT, newId)).toBe(state);
    state = pressKey(state, 60, 6100, AT, newId);
    state = pressKey(state, 62, 6300, AT, newId);
    expect(state.answers[0]).toMatchObject({
      correct: true,
      answer: [64, 62, 60, 62],
      replays: 1,
      ms: 300,
    });
  });

  it('goes on from melody to melody, its one item drawn again', () => {
    let state = withPrompt(echo(3), melody, 1000);
    for (let i = 0; i < 3; i++) {
      state = withPrompt(state, { ...melody, item: 'echo:EC2' }, 1000);
      state = pressKey(state, 65, 1100, AT, newId);
      state = advanceEar(state, { at: AT, stats: {}, rng: seededRng(i) });
    }
    expect(state.phase).toBe('done');
    expect(state.answers).toHaveLength(3);
    expect(summarizeEar(state)).toMatchObject({
      family: 'echo',
      items: 3,
      correct: 0,
      missed: [
        { item: 'echo:EC2', answer: [65], prompt: [64, 62, 60, 62] },
        { item: 'echo:EC2', answer: [65], prompt: [64, 62, 60, 62] },
        { item: 'echo:EC2', answer: [65], prompt: [64, 62, 60, 62] },
      ],
    });
  });

  it('masters an echo level over its last 20 melodies', () => {
    expect(masteryWindow('EC1')).toBe(ECHO_MASTERY_WINDOW);
    expect(masteryWindow('I1')).toBe(EAR_MASTERY_WINDOW);
    const answers: EarAnswer[] = Array.from({ length: ECHO_MASTERY_WINDOW }, (_, i) => ({
      id: `e${i}`,
      sessionId: 's',
      family: 'echo',
      level: 'EC1',
      item: 'echo:EC1',
      by: 'play',
      prompt: [64, 62, 60],
      answer: i === 0 ? [65] : [64, 62, 60],
      correct: i !== 0,
      ms: 2000,
      replays: 0,
      at: AT + i,
    }));
    expect(earLevelProgress(answers, 'EC1')).toMatchObject({
      total: 20,
      answers: 20,
      window: 20,
      accuracy: 0.95,
      mastered: true,
    });
    expect(earLevelProgress(answers.slice(1), 'EC1')).toMatchObject({ mastered: false });
    expect(ECHO_SESSION_LENGTHS).toEqual([5, 10, 20]);
  });
});

describe('a cadence session', () => {
  it('names only, the level’s cadences, a key drawn from the level', () => {
    const state = start('CA2', 'play');
    expect(state).toMatchObject({ family: 'cadence', by: 'name' });
    expect(state.items).toEqual(['cad:authentic', 'cad:plagal', 'cad:half']);
    const { prompt } = state.card;
    expect(prompt.notes).toHaveLength(16);
    expect(prompt.cadence?.numerals).toHaveLength(4);
    // CA2 is in major keys only.
    expect(prompt.cadence?.key.endsWith('m')).toBe(false);
    // Keys answer nothing.
    expect(pressKey(withPrompt(state, prompt), 60, 2000, AT, newId).answers).toEqual([]);
  });

  it('judges the name chosen and keeps the key with the answer and the miss', () => {
    let state = start('CA4', 'name', 10, 5);
    state = withPrompt(state, {
      item: 'cad:deceptive',
      notes: [50, 57, 62, 66, 43, 59, 62, 67, 45, 57, 61, 64, 47, 59, 62, 66],
      cadence: { key: 'D', numerals: ['I', 'IV', 'V', 'vi'] },
    });
    state = chooseName(state, 'authentic', 1500, AT + 500, newId);
    expect(state.answers[0]).toMatchObject({
      family: 'cadence',
      level: 'CA4',
      item: 'cad:deceptive',
      by: 'name',
      answer: 'authentic',
      correct: false,
      ms: 500,
      key: { tonic: 'D', scale: 'major' },
    });
    expect(summarizeEar(state).missed).toEqual([
      {
        item: 'cad:deceptive',
        answer: 'authentic',
        prompt: state.answers[0]!.prompt,
        key: { tonic: 'D', scale: 'major' },
      },
    ]);
  });

  it('masters a level over its last 20 cadences', () => {
    expect(masteryWindow('CA1')).toBe(ECHO_MASTERY_WINDOW);
    expect(masteryWindow('C1')).toBe(EAR_MASTERY_WINDOW);
  });
});
