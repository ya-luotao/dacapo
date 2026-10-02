import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { goalOn, withGoal } from '../../core/goal.ts';
import { readGoal, writeGoal } from './goal.ts';

class MemoryStorage {
  data = new Map<string, string>();
  getItem = (key: string) => this.data.get(key) ?? null;
  setItem = (key: string, value: string) => void this.data.set(key, value);
  removeItem = (key: string) => void this.data.delete(key);
}

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal('localStorage', storage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the daily goal kept in the browser', () => {
  it('is five minutes when nothing was chosen', () => {
    expect(readGoal()).toEqual([]);
    expect(goalOn(readGoal(), '2026-09-24')).toBe(5);
  });

  it('is kept as `dacapo.goal`: each change with its day', () => {
    writeGoal(withGoal(withGoal(readGoal(), '2026-09-10', 20), '2026-09-24', 10));
    expect(storage.data.get('dacapo.goal')).toBe('[["2026-09-10",20],["2026-09-24",10]]');
    expect(readGoal()).toEqual([
      ['2026-09-10', 20],
      ['2026-09-24', 10],
    ]);
  });

  it('is removed when the goal is back at five minutes for every day', () => {
    writeGoal(withGoal([], '2026-09-10', 20));
    writeGoal(withGoal(readGoal(), '2026-09-10', 5));
    expect(storage.data.has('dacapo.goal')).toBe(false);
  });

  it.each(['not json', '{"day":"2026-09-10"}', '[["2026-09-10",25]]', '[[]]', '20'])(
    'takes a damaged preference (%s) for five minutes every day',
    (kept) => {
      storage.data.set('dacapo.goal', kept);
      expect(readGoal()).toEqual([]);
    },
  );

  it('is five minutes where the browser keeps nothing', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(readGoal()).toEqual([]);
    // A choice that cannot be kept does not break the page.
    expect(() => writeGoal([['2026-09-10', 20]])).not.toThrow();
  });
});
