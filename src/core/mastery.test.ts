import { describe, expect, it } from 'vitest';
import { levelProgress, MASTERY_WINDOW, suggestedLevel, type LevelProgress } from './mastery.ts';
import type { Attempt } from './session.ts';
import { LEVEL_IDS, type LevelId } from './levels.ts';

let clock = 0;
const attempt = (patch: Partial<Attempt> = {}): Attempt => ({
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
});
