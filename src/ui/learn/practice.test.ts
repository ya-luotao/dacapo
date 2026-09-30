import { describe, expect, it } from 'vitest';
import { splitMinutes, tempoLadder } from './practice.ts';

describe('a practice session', () => {
  it('is split into whole minutes that add up to its length', () => {
    const weights = [15, 40, 15, 20, 10];
    for (const total of [10, 20, 30, 45]) {
      const parts = splitMinutes(total, weights);
      expect(
        parts.reduce((a, b) => a + b, 0),
        String(total),
      ).toBe(total);
      expect(Math.min(...parts), String(total)).toBeGreaterThanOrEqual(1);
    }
    expect(splitMinutes(20, weights)).toEqual([3, 8, 3, 4, 2]);
    expect(splitMinutes(10, weights)).toEqual([2, 4, 1, 2, 1]);
  });

  it('climbs to its tempo in steps', () => {
    expect(tempoLadder(100, [60, 70, 80, 90, 100])).toEqual([60, 70, 80, 90, 100]);
    expect(tempoLadder(120, [60, 70, 80, 90, 100])).toEqual([72, 84, 96, 108, 120]);
  });
});
