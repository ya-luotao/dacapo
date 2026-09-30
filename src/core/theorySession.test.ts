import { describe, expect, it } from 'vitest';
import { isEarAnswer, isTheoryAnswer } from './answers.ts';
import { recoverEarSessions, recoverTheorySessions, type SessionRecord } from './log.ts';
import { seededRng } from './random.ts';
import {
  getTheoryLevel,
  parseSpelled,
  spellChord,
  theoryLevelItems,
  type TheoryLevelId,
  type TheoryPrompt,
} from './theoryItems.ts';
import {
  advanceTheory,
  chooseTheoryName,
  endTheorySession,
  markTheoryPainted,
  pressTheoryKey,
  recoverTheorySummary,
  releaseTheoryKey,
  rightName,
  setTheoryHint,
  startTheorySession,
  summarizeTheory,
  suggestedTheoryLevel,
  theoryLevelProgress,
  theoryStats,
  THEORY_MASTERY_WINDOW,
  type TheoryAnswer,
  type TheorySessionState,
} from './theorySession.ts';
import type { AnswerMode } from './earSession.ts';

const T = 1_700_000_000_000;
let ids = 0;
const newId = () => `a${++ids}`;

function start(level: TheoryLevelId, by: AnswerMode = 'name', hint = false): TheorySessionState {
  const theoryLevel = getTheoryLevel(level);
  return startTheorySession({
    id: 's1',
    level: theoryLevel,
    by,
    length: 3,
    hint,
    at: T,
    stats: {},
    rng: seededRng(7),
    items: theoryLevelItems(theoryLevel),
  });
}

/** The session with its card replaced by `prompt`, painted at 1000. */
function withCard(state: TheorySessionState, prompt: TheoryPrompt): TheorySessionState {
  return markTheoryPainted({ ...state, card: { ...state.card, prompt } }, 0, 1000);
}

const interval = (item: string, a: string, b: string): TheoryPrompt => ({
  family: 'readInterval',
  item,
  clef: 'treble',
  notes: [parseSpelled(a)!, parseSpelled(b)!],
});

const cMajor: TheoryPrompt = {
  family: 'readChord',
  item: 'rc:maj:root',
  clef: 'treble',
  notes: spellChord({ step: 'C', alter: 0 }, 4, 'maj', 'root'),
  root: { step: 'C', alter: 0 },
};

describe('a theory session', () => {
  it('names intervals, plays key signatures, and chords either way', () => {
    expect(start('RI2', 'play').by).toBe('name');
    expect(start('KS1', 'name').by).toBe('play');
    expect(start('RC1', 'play').by).toBe('play');
    expect(start('RC1', 'name').by).toBe('name');
  });

  it('times from the paint and ignores answers before it', () => {
    let s = withCard(start('RI2'), interval('ri:m3:up', 'C4', 'Eb4'));
    s = { ...s, card: { ...s.card, shownAt: null } };
    expect(chooseTheoryName(s, 'm3', 900, T, newId)).toBe(s);
    s = markTheoryPainted(s, 0, 1000);
    expect(markTheoryPainted(s, 0, 2000).card.shownAt).toBe(1000);
    expect(chooseTheoryName(s, 'm3', 999, T, newId)).toBe(s);
    const right = chooseTheoryName(s, 'm3', 2500, T + 5, newId);
    expect(right.card.status).toBe('correct');
    expect(right.answers[0]).toMatchObject({
      family: 'readInterval',
      level: 'RI2',
      item: 'ri:m3:up',
      by: 'name',
      prompt: ['C4', 'Eb4'],
      clef: 'treble',
      answer: 'm3',
      correct: true,
      ms: 1500,
      hinted: false,
      at: T + 5,
    });
  });

  it('scores the first answer and keeps the card until the right one', () => {
    let s = withCard(start('RI3'), interval('ri:A2:up', 'C4', 'D#4'));
    s = chooseTheoryName(s, 'm3', 1400, T, newId);
    expect(s.card.status).toBe('wrong');
    expect(s.card.wrong).toBe('m3');
    expect(s.answers).toHaveLength(1);
    expect(s.answers[0]).toMatchObject({ answer: 'm3', correct: false });
    // The same wrong name again changes nothing; another is shown but not scored.
    expect(chooseTheoryName(s, 'm3', 1500, T, newId)).toBe(s);
    s = chooseTheoryName(s, 'M2', 1600, T, newId);
    expect(s.card.wrong).toBe('M2');
    s = chooseTheoryName(s, 'A2', 1700, T, newId);
    expect(s.card.status).toBe('correct');
    expect(s.answers).toHaveLength(1);
  });

  it('asks RI1 for the number only', () => {
    const s = withCard(start('RI1'), interval('ri:m3:down', 'Eb5', 'C5'));
    expect(rightName(s)).toBe('3');
    expect(chooseTheoryName(s, '3', 1200, T, newId).card.status).toBe('correct');
  });

  it('takes the tonic of a key signature in any octave', () => {
    const base = start('KS2');
    const prompt: TheoryPrompt = {
      family: 'keySignature',
      item: 'ks:3f:major',
      fifths: -3,
      mode: 'major',
    };
    let s = withCard(base, prompt);
    s = pressTheoryKey(s, 60, 1300, T, newId);
    expect(s.card.status).toBe('wrong');
    expect(s.answers[0]).toMatchObject({ prompt: '3f', answer: [60], correct: false });
    expect(s.answers[0]!.clef).toBeUndefined();
    s = pressTheoryKey(s, 39, 1400, T, newId);
    expect(s.card.status).toBe('correct');
    expect(s.answers).toHaveLength(1);
  });

  it('plays a chord: right once exactly its keys are held, wrong at the first other key', () => {
    let s = withCard(start('RC1', 'play'), cMajor);
    s = pressTheoryKey(s, 60, 1100, T, newId);
    s = pressTheoryKey(s, 64, 1110, T, newId);
    expect(s.card.status).toBe('waiting');
    expect(s.card.held).toEqual([60, 64]);
    // Let go and pressed again: still pending.
    s = releaseTheoryKey(s, 64, 1120);
    s = pressTheoryKey(s, 64, 1130, T, newId);
    s = pressTheoryKey(s, 67, 1140, T + 1, newId);
    expect(s.card.status).toBe('correct');
    expect(s.answers[0]).toMatchObject({ answer: [60, 64, 67], correct: true, ms: 140 });

    let w = withCard(start('RC1', 'play'), cMajor);
    w = pressTheoryKey(w, 60, 1100, T, newId);
    w = pressTheoryKey(w, 76, 1150, T, newId);
    expect(w.card.status).toBe('wrong');
    expect(w.answers[0]).toMatchObject({ answer: [60, 76], correct: false });
    // The written keys, with the wrong one still down: not yet; letting it go: right.
    w = pressTheoryKey(w, 64, 1200, T, newId);
    w = pressTheoryKey(w, 67, 1210, T, newId);
    expect(w.card.status).toBe('wrong');
    w = releaseTheoryKey(w, 76, 1300);
    expect(w.card.status).toBe('correct');
    expect(w.answers).toHaveLength(1);
  });

  it('does not count a key held from before the card', () => {
    let s = start('RC1', 'play');
    s = withCard(s, cMajor);
    // A key pressed before the paint.
    expect(pressTheoryKey(s, 60, 900, T, newId)).toBe(s);
    expect(releaseTheoryKey(s, 60, 1100)).toBe(s);
  });

  it('names a chord by its root as written', () => {
    const prompt: TheoryPrompt = {
      family: 'readChord',
      item: 'rc:min:1st',
      clef: 'bass',
      notes: spellChord({ step: 'F', alter: 1 }, 2, 'min', '1st'),
      root: { step: 'F', alter: 1 },
    };
    const s = withCard(start('RC3', 'name'), prompt);
    expect(rightName(s)).toBe('F#:min:1st');
    const wrong = chooseTheoryName(s, 'Gb:min:1st', 1500, T, newId);
    expect(wrong.card.status).toBe('wrong');
    expect(wrong.answers[0]).toMatchObject({ prompt: ['A2', 'C#3', 'F#3'], clef: 'bass' });
    expect(chooseTheoryName(wrong, 'F#:min:1st', 1600, T, newId).card.status).toBe('correct');
  });

  it('marks a card hinted when the hint is shown before its answer', () => {
    let s = withCard(start('RI2'), interval('ri:m3:up', 'C4', 'Eb4'));
    s = setTheoryHint(s, true);
    expect(s.card.hinted).toBe(true);
    s = chooseTheoryName(s, 'm3', 1500, T, newId);
    expect(s.answers[0]!.hinted).toBe(true);
    // Turning the hint off does not unhint a card, nor hint one already answered.
    expect(setTheoryHint(s, false).card.hinted).toBe(true);
    const started = start('RI2', 'name', true);
    expect(started.card.hinted).toBe(true);
  });

  it('advances after a right answer and ends after the last card', () => {
    let s = start('RI2');
    const rng = seededRng(1);
    for (let i = 0; i < 3; i++) {
      s = markTheoryPainted(s, i, 1000 * (i + 1));
      expect(advanceTheory(s, { at: T, stats: {}, rng })).toBe(s);
      s = chooseTheoryName(s, rightName(s)!, 1000 * (i + 1) + 800, T + i, newId);
      const previous = s.card.prompt.item;
      s = advanceTheory(s, { at: T + 10, stats: {}, rng });
      if (i < 2) {
        expect(s.card.index).toBe(i + 1);
        expect(s.card.prompt.item).not.toBe(previous);
        expect(s.card.status).toBe('waiting');
      }
    }
    expect(s.phase).toBe('done');
    expect(s.endedAt).toBe(T + 10);
    expect(endTheorySession(s, T + 20)).toBe(s);
  });
});

function answer(i: number, patch: Partial<TheoryAnswer> = {}): TheoryAnswer {
  return {
    id: `t${i}`,
    sessionId: 'st',
    family: 'readInterval',
    level: 'RI2',
    item: 'ri:m3:up',
    by: 'name',
    prompt: ['C4', 'Eb4'],
    clef: 'treble',
    answer: 'm3',
    correct: true,
    ms: 1500,
    hinted: false,
    at: T + i * 5000,
    ...patch,
  };
}

describe('figures', () => {
  it('summarizes like Read: timed answers, the slowest items, the misses', () => {
    const answers = [
      answer(0, { ms: 1200 }),
      answer(1, { item: 'ri:M3:up', prompt: ['C4', 'E4'], answer: 'm3', correct: false }),
      answer(2, { item: 'ri:P5:up', prompt: ['C4', 'G4'], answer: 'P5', ms: 2500 }),
      answer(3, { ms: 9000, hinted: true }),
      answer(4, { ms: 40_000 }),
    ];
    const summary = summarizeTheory({
      id: 'st',
      family: 'readInterval',
      level: 'RI2',
      by: 'name',
      length: 10,
      startedAt: T - 1000,
      endedAt: null,
      answers,
    });
    expect(summary).toMatchObject({ cards: 5, correct: 4, accuracy: 0.8, length: 10 });
    expect(summary.medianMs).toBe(1850);
    expect(summary.slowest).toEqual([
      { item: 'ri:P5:up', ms: 2500 },
      { item: 'ri:m3:up', ms: 1200 },
    ]);
    expect(summary.missed).toEqual([
      { item: 'ri:M3:up', prompt: ['C4', 'E4'], clef: 'treble', answer: 'm3' },
    ]);
    expect(summary.endedAt).toBe(answers.at(-1)!.at);
  });

  it('recovers a session from its answers, and leaves ear answers to the ear', () => {
    const answers = [answer(0), answer(1)];
    const recovered = recoverTheorySummary(answers)!;
    expect(recovered).toMatchObject({ id: 'st', level: 'RI2', cards: 2, length: 2 });
    expect(recovered.startedAt).toBe(T - 1500);
    const ear = {
      id: 'e',
      sessionId: 'se',
      family: 'interval' as const,
      level: 'I1' as const,
      item: 'int:P5:up',
      by: 'play' as const,
      prompt: [60, 67],
      answer: [67],
      correct: true,
      ms: 900,
      replays: 0,
      at: T,
    };
    const mixed = [ear, ...answers];
    expect(mixed.filter(isTheoryAnswer)).toHaveLength(2);
    expect(mixed.filter(isEarAnswer)).toEqual([ear]);
    const sessions: SessionRecord[] = [];
    expect(recoverTheorySessions(mixed, sessions).map((s) => [s.kind, s.id])).toEqual([
      ['theory', 'st'],
    ]);
    expect(recoverEarSessions(mixed, sessions).map((s) => [s.kind, s.id])).toEqual([['ear', 'se']]);
  });

  it('keeps per-item stats, a hinted answer counted for accuracy only', () => {
    const stats = theoryStats([answer(0, { ms: 1000 }), answer(1, { ms: 5000, hinted: true })]);
    expect(stats['ri:m3:up']).toMatchObject({ attempts: 2, correct: 2, ewmaMs: 1000 });
  });

  it('masters a level at 90 % over 40 un-hinted cards with the median under 3 s or 4 s', () => {
    const quick = Array.from({ length: THEORY_MASTERY_WINDOW }, (_, i) =>
      answer(i, { correct: i % 10 !== 0, ms: 2900 }),
    );
    expect(theoryLevelProgress(quick, 'RI2')).toMatchObject({ mastered: true, cards: 40 });
    const slow = quick.map((a) => ({ ...a, ms: 3100 }));
    expect(theoryLevelProgress(slow, 'RI2').mastered).toBe(false);
    // Chords have a second more.
    const chords = slow.map((a) => ({ ...a, family: 'readChord' as const, level: 'RC1' as const }));
    expect(theoryLevelProgress(chords, 'RC1').mastered).toBe(true);
    // Hinted cards are not in the window.
    const hinted = quick.map((a, i) => (i < 5 ? { ...a, hinted: true } : a));
    expect(theoryLevelProgress(hinted, 'RI2')).toMatchObject({ cards: 35, mastered: false });
    const progress = new Map([
      [
        'RI1',
        theoryLevelProgress(
          quick.map((a) => ({ ...a, level: 'RI1' as const })),
          'RI1',
        ),
      ],
    ] as const);
    expect(suggestedTheoryLevel('readInterval', progress)).toBe('RI2');
    expect(suggestedTheoryLevel('keySignature', new Map())).toBe('KS1');
  });
});
