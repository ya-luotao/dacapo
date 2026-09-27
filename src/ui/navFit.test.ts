import { describe, expect, it } from 'vitest';
import { fitNav } from './navFit.ts';

// Play, Read, Scales, Pieces, Metronome, Progress, Settings.
const WIDTHS = [40, 40, 50, 50, 80, 70, 60];
const PRIORITIES = [Infinity, Infinity, 5, 6, 2, 3, 1];
const GAP = 10;
const MORE = 45;
const total = WIDTHS.reduce((a, b) => a + b, 0) + GAP * (WIDTHS.length - 1);

describe('fitNav', () => {
  it('shows everything when it fits, without a More button', () => {
    expect(fitNav(WIDTHS, PRIORITIES, total, GAP, MORE)).toEqual({
      shown: [0, 1, 2, 3, 4, 5, 6],
      more: [],
    });
  });

  it('moves the lowest priority first and keeps the order of the rest', () => {
    // Without Settings (60 + gap) but with More (45 + gap): 35 px less.
    expect(fitNav(WIDTHS, PRIORITIES, total - 1, GAP, MORE)).toEqual({
      shown: [0, 1, 2, 3, 4, 5],
      more: [6],
    });
    expect(fitNav(WIDTHS, PRIORITIES, total - 60, GAP, MORE)).toEqual({
      shown: [0, 1, 2, 3, 5],
      more: [4, 6],
    });
  });

  it('never moves the items that must stay, however narrow', () => {
    expect(fitNav(WIDTHS, PRIORITIES, 10, GAP, MORE)).toEqual({
      shown: [0, 1],
      more: [2, 3, 4, 5, 6],
    });
  });

  it('moves the later of two equal priorities first', () => {
    expect(fitNav([50, 50, 50], [1, 1, Infinity], 150, GAP, 20).more).toEqual([1]);
  });
});
