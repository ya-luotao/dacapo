import { describe, expect, it } from 'vitest';
import {
  firstNotMastered,
  levelProgress,
  MASTERY_WINDOW,
  suggestedLevel,
  type LevelProgress,
} from './mastery.ts';
import type { Attempt } from './session.ts';
import { LEVEL_IDS, type LevelId } from './levels.ts';

let clock = 0;
const attempt = (patch: Partial<Attempt> = {}): Attempt => ({
  id: `a${clock}`,
  sessionId: 's',
  level: 'L1',
  note: 'C4@treble',
  target: 60,
  played: 60,
  correct: true,
  ms: 1000,
  hinted: false,
  timedOut: false,
  at: clock++,
  ...patch,
});

const many = (n: number, patch: (i: number) => Partial<Attempt> = () => ({})) =>
  Array.from({ length: n }, (_, i) => attempt(patch(i)));

describe('levelProgress', () => {
  it('needs a full window of 40 cards', () => {
    expect(levelProgress(many(39), 'L1')).toMatchObject({ cards: 39, mastered: false });
    expect(levelProgress(many(40), 'L1')).toMatchObject({
      cards: 40,
      accuracy: 1,
      medianMs: 1000,
      mastered: true,
    });
  });

  it('needs at least 90 % accuracy', () => {
    const fourWrong = many(40, (i) => ({ correct: i >= 4 }));
    const fiveWrong = many(40, (i) => ({ correct: i >= 5 }));
    expect(levelProgress(fourWrong, 'L1')).toMatchObject({ accuracy: 0.9, mastered: true });
    expect(levelProgress(fiveWrong, 'L1').mastered).toBe(false);
  });

  it('needs a median below 2 s', () => {
    expect(
      levelProgress(
        many(40, () => ({ ms: 1999 })),
        'L1',
      ).mastered,
    ).toBe(true);
    expect(
      levelProgress(
        many(40, () => ({ ms: 2000 })),
        'L1',
      ).mastered,
    ).toBe(false);
  });

  it('only looks at the last 40 cards', () => {
    const early = many(40, () => ({ correct: false, ms: 5000 }));
    const late = many(40);
    expect(levelProgress([...early, ...late], 'L1').mastered).toBe(true);
    expect(levelProgress([...late, ...early], 'L1').mastered).toBe(false);
  });

  it('only counts attempts of that level', () => {
    const mixed = [...many(40), ...many(40, () => ({ level: 'L2', correct: false }))];
    expect(levelProgress(mixed, 'L1').mastered).toBe(true);
    expect(levelProgress(mixed, 'L2')).toMatchObject({ cards: 40, accuracy: 0, mastered: false });
    expect(levelProgress(mixed, 'L3')).toMatchObject({
      total: 0,
      cards: 0,
      accuracy: null,
      medianMs: null,
      mastered: false,
    });
  });

  it('leaves hinted cards out of the window', () => {
    const hinted = many(40, () => ({ hinted: true, ms: 300 }));
    expect(levelProgress(hinted, 'L1')).toMatchObject({ total: 40, cards: 0, mastered: false });
    const withHints = [...many(39), ...hinted];
    expect(levelProgress(withHints, 'L1')).toMatchObject({ cards: 39, mastered: false });
  });

  it('keeps timed-out cards for accuracy but not for the median', () => {
    const slow = many(MASTERY_WINDOW, (i) => ({ timedOut: i < 25, ms: i < 25 ? 40_000 : 1000 }));
    expect(levelProgress(slow, 'L1')).toMatchObject({ cards: 40, medianMs: 1000, mastered: true });
  });

  it('is not mastered without a single timely answer', () => {
    const allLate = many(40, () => ({ timedOut: true, ms: 31_000 }));
    expect(levelProgress(allLate, 'L1')).toMatchObject({ medianMs: null, mastered: false });
  });
});

describe('suggestedLevel', () => {
  const progress = (mastered: LevelId[]): LevelProgress[] =>
    LEVEL_IDS.map((level) => ({
      level,
      total: 0,
      cards: 0,
      accuracy: null,
      medianMs: null,
      mastered: mastered.includes(level),
    }));

  it('suggests the first level not mastered yet', () => {
    expect(suggestedLevel(progress([]))).toBe('L1');
    expect(suggestedLevel(progress(['L1', 'L2']))).toBe('L3');
    expect(suggestedLevel(progress(['L1', 'L3']))).toBe('L2');
    expect(suggestedLevel(progress([...LEVEL_IDS]))).toBe('L7');
  });

  // docs/START.md: someone who plays already says what they read; Read begins beyond it.
  it('begins at the floor: the later of the first level not mastered and the floor', () => {
    expect(suggestedLevel(progress([]), 'L3')).toBe('L3');
    expect(suggestedLevel(progress([]), 'L5')).toBe('L5');
    expect(suggestedLevel(progress([]), 'L7')).toBe('L7');
    // No floor ("I would rather find out") is the rule as it was.
    expect(suggestedLevel(progress([]), null)).toBe('L1');
    expect(suggestedLevel(progress(['L1']), null)).toBe('L2');
    // The first level not mastered is the later of the two.
    expect(suggestedLevel(progress(['L1', 'L2', 'L3', 'L4', 'L5']), 'L3')).toBe('L6');
    expect(suggestedLevel(progress(['L1', 'L2']), 'L3')).toBe('L3');
  });

  it('moves on from the floor as its levels are mastered', () => {
    expect(suggestedLevel(progress(['L3']), 'L3')).toBe('L4');
    expect(suggestedLevel(progress(['L5', 'L6']), 'L5')).toBe('L7');
    // A level mastered above the floor is passed over, one not mastered is not.
    expect(suggestedLevel(progress(['L3', 'L5']), 'L3')).toBe('L4');
  });

  it('stays above the floor: the last level once everything from the floor on is mastered', () => {
    // The levels below the floor are not where the page opens, mastered or not.
    expect(suggestedLevel(progress(['L7']), 'L7')).toBe('L7');
    expect(suggestedLevel(progress(['L1', 'L5', 'L6', 'L7']), 'L5')).toBe('L7');
    expect(suggestedLevel(progress(['L3', 'L4', 'L5', 'L6', 'L7']), 'L3')).toBe('L7');
    expect(suggestedLevel(progress([...LEVEL_IDS]), 'L5')).toBe('L7');
  });

  it('never rests on a mastered floor while a later level is left', () => {
    // Read as a plain maximum, the rule would hold the page at a mastered L5: the first level
    // not mastered stays L1 for someone who never plays the levels below.
    expect(suggestedLevel(progress(['L5']), 'L5')).toBe('L6');
    expect(suggestedLevel(progress(['L3', 'L4']), 'L3')).toBe('L5');
  });

  it('does not report the levels below the floor as mastered', () => {
    // The floor changes the suggestion alone: a level's own figures say what was measured.
    const none = LEVEL_IDS.map((level) => levelProgress([], level));
    expect(suggestedLevel(none, 'L5')).toBe('L5');
    expect(none.every((p) => !p.mastered && p.cards === 0)).toBe(true);
  });
});

describe('firstNotMastered', () => {
  const levels = (mastered: string) =>
    ['a', 'b', 'c', 'd'].map((level) => ({ level, mastered: mastered.includes(level) }));

  it('is the first not mastered, from the floor on and then below it; null once all are', () => {
    expect(firstNotMastered(levels(''))).toBe('a');
    expect(firstNotMastered(levels('ab'))).toBe('c');
    expect(firstNotMastered(levels(''), 'c')).toBe('c');
    expect(firstNotMastered(levels('c'), 'c')).toBe('d');
    expect(firstNotMastered(levels('cd'), 'c')).toBe('a');
    expect(firstNotMastered(levels('abcd'), 'c')).toBeNull();
    expect(firstNotMastered(levels('abcd'))).toBeNull();
    // A floor that is no level of these is no floor.
    expect(firstNotMastered(levels('a'), 'z')).toBe('b');
  });
});
