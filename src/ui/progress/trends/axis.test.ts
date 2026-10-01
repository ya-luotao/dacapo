import { describe, expect, it } from 'vitest';
import { niceTicks } from './axis.ts';

describe('niceTicks', () => {
  it('covers the values with three ticks that read as they are', () => {
    // Tenths of a second, whole ms, whole percent.
    expect(niceTicks(1380, 1720, { minSpan: 200 })).toEqual([1200, 1500, 1800]);
    expect(niceTicks(18, 31, { minSpan: 10 })).toEqual([16, 24, 32]);
    expect(niceTicks(4.1, 7.3, { minSpan: 2 })).toEqual([4, 6, 8]);
  });

  it('widens a flat line to the least span', () => {
    expect(niceTicks(1500, 1500, { minSpan: 200 })).toEqual([1400, 1500, 1600]);
  });

  it('stays within the floor and the ceiling', () => {
    expect(niceTicks(0.92, 0.99, { minSpan: 0.1, ceiling: 1 })).toEqual([0.9, 0.95, 1]);
    expect(niceTicks(0.6, 0.97, { minSpan: 0.1, ceiling: 1 })).toEqual([0.6, 0.8, 1]);
    expect(niceTicks(0.01, 0.04, { minSpan: 0.1, ceiling: 1 })).toEqual([0, 0.05, 0.1]);
    expect(niceTicks(2, 3, { minSpan: 10 })).toEqual([0, 5, 10]);
  });
});
