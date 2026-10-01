// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { READS, type StartingPoint } from '../../core/startingPoint.ts';
import { readStartPref, writeStartPref } from './prefs.ts';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('the starting point kept in this browser', () => {
  it('is no answer until one is given', () => {
    expect(readStartPref()).toBeNull();
  });

  it('keeps the answer and the reading level, and gives them back', () => {
    const answers: StartingPoint[] = [
      { from: 'new' },
      ...READS.map((reads): StartingPoint => ({ from: 'player', reads })),
    ];
    for (const answer of answers) {
      writeStartPref(answer);
      expect(readStartPref()).toEqual(answer);
    }
    expect(localStorage.getItem('dacapo.start')).toBe('{"from":"player","reads":"unknown"}');
  });

  it('is no answer when what is kept is anything else', () => {
    for (const kept of ['', 'new', '{', '[]', 'null', '{"from":"player"}', '{"from":"both"}']) {
      localStorage.setItem('dacapo.start', kept);
      expect(readStartPref(), kept).toBeNull();
    }
  });

  it('does without the browser’s storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readStartPref()).toBeNull();
    expect(() => writeStartPref({ from: 'new' })).not.toThrow();
  });
});
