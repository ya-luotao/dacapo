import { describe, expect, it } from 'vitest';
import { hiddenBars, isPickup, phraseStarts, promptsByBar, randomPhraseStart } from './memory.ts';
import { bar, bars, Q } from './scoreFixtures.ts';
import type { Measure } from './score.ts';

const shown = (measures: Measure[], stage: Parameters<typeof hiddenBars>[1], first = 0) => {
  const hidden = hiddenBars(measures, stage, first);
  return measures.map((m) => m.index).filter((i) => !hidden.has(i));
};

/** An upbeat of one quarter, then `count` bars of 4/4. */
function withPickup(count: number): Measure[] {
  const list = [bar(0, 0, { duration: Q })];
  for (let i = 1; i <= count; i++) list.push(bar(i, Q + (i - 1) * 4 * Q));
  return list;
}

describe('phrases', () => {
  it('are four bars, counted again at each double bar, repeat sign, volta or rehearsal mark', () => {
    const m = bars(14);
    m[5] = { ...m[5]!, doubleBar: true }; // a section from bar 7 (index 6)
    m[9] = { ...m[9]!, rehearsal: 'B' }; // and from index 9
    m[12] = { ...m[12]!, repeat: { forward: false, backwardTimes: null, ending: [1] } };
    expect(phraseStarts(m)).toEqual([0, 4, 6, 9, 12]);
    const r = bars(6);
    r[1] = { ...r[1]!, repeat: { forward: false, backwardTimes: 2, ending: [] } };
    r[4] = { ...r[4]!, repeat: { forward: true, backwardTimes: null, ending: [] } };
    expect(phraseStarts(r)).toEqual([0, 2, 4]);
  });

  it('start after an upbeat, which belongs to the first', () => {
    const m = withPickup(9);
    expect(isPickup(m, 0)).toBe(true);
    expect(isPickup(bars(3), 0)).toBe(false);
    expect(phraseStarts(m)).toEqual([1, 5, 9]);
  });
});

describe('hiddenBars', () => {
  const m = bars(9);

  it('fades in stages: all, every other bar, each phrase’s first, the first only', () => {
    expect(shown(m, 'all')).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(shown(m, 'alternate')).toEqual([0, 2, 4, 6, 8]);
    expect(shown(m, 'phrases')).toEqual([0, 4, 8]);
    expect(shown(m, 'first')).toEqual([0]);
  });

  it('always shows the bar the run starts from', () => {
    expect(shown(m, 'phrases', 6)).toEqual([0, 4, 6, 8]);
    expect(shown(m, 'first', 5)).toEqual([5]);
  });

  it('shows an upbeat with its phrase, and with the first bar after it', () => {
    const p = withPickup(8);
    expect(shown(p, 'alternate')).toEqual([0, 1, 3, 5, 7]);
    expect(shown(p, 'phrases')).toEqual([0, 1, 5]);
    expect(shown(p, 'first', 0)).toEqual([0, 1]);
    expect(shown(p, 'first', 5)).toEqual([5]);
  });

  it('keeps every other bar within each phrase, so every phrase starts shown', () => {
    const s = bars(7);
    s[2] = { ...s[2]!, doubleBar: true }; // phrases from 0 and 3
    expect(shown(s, 'alternate')).toEqual([0, 2, 3, 5]);
  });
});

describe('promptsByBar', () => {
  it('adds up the prompts of each written bar, most first', () => {
    expect(
      promptsByBar([
        { measure: 2, prompts: 1 },
        { measure: 0, prompts: 0 },
        { measure: 3, prompts: 2 },
        { measure: 2, prompts: 2 },
        { measure: 1 },
      ]),
    ).toEqual([
      { measure: 2, prompts: 3 },
      { measure: 3, prompts: 2 },
    ]);
  });
});

describe('randomPhraseStart', () => {
  it('picks a phrase start in the span, another than the current one', () => {
    const m = bars(12);
    expect(randomPhraseStart(m, [0, 1, 2, 3, 4, 5, 6, 7], 0, () => 0)).toBe(4);
    expect(randomPhraseStart(m, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 4, () => 0.99)).toBe(8);
    expect(randomPhraseStart(m, [4, 5], 4, () => 0.5)).toBe(4);
    expect(randomPhraseStart(m, [5, 6], 4, () => 0.5)).toBeNull();
  });
});
