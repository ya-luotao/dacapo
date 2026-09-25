import { describe, expect, it } from 'vitest';
import { matchNotes, NEARBY_TICKS, writtenOnsets, type DrawnNote } from './mapping.ts';

const ours = (id: string, onset: number, midi: number, tieStop = false) => ({
  id,
  onset,
  midi,
  tieStop,
});
const drawn = (item: string, tick: number, midi: number, grace = false): DrawnNote<string> => ({
  item,
  tick,
  midi,
  grace,
});

describe('matchNotes', () => {
  it('matches by onset and pitch, unisons in order', () => {
    const result = matchNotes(
      [ours('a', 0, 60), ours('b', 0, 64), ours('c', 0, 64)],
      [drawn('x', 0, 64), drawn('y', 0, 60), drawn('z', 0, 64)],
    );
    expect([...result.notes]).toEqual([
      ['a', 'y'],
      ['b', 'x'],
      ['c', 'z'],
    ]);
    expect(result).toMatchObject({ unplaced: [], nearby: 0 });
  });

  it('never matches a grace note, and falls back to the nearest note of the same key', () => {
    // An engine that plays the grace note on the beat draws the main note a little later.
    const result = matchNotes(
      [ours('main', 960, 69)],
      [drawn('grace', 960, 69, true), drawn('far', 960 + 400, 69), drawn('near', 960 + 120, 69)],
    );
    expect(result.notes.get('main')).toBe('near');
    expect(result.nearby).toBe(1);
  });

  it('reports what cannot be placed, except tied continuations', () => {
    const result = matchNotes(
      [ours('a', 0, 60), ours('held', 960, 60, true), ours('lost', 0, 62)],
      [drawn('x', 0, 60), drawn('other', NEARBY_TICKS + 1, 62)],
    );
    expect(result.unplaced).toEqual(['lost']);
    expect(result.notes.has('held')).toBe(false);
  });
});

describe('writtenOnsets', () => {
  it('anchors onsets on our measure starts', () => {
    // The engine thinks the pickup is a whole 3/8 bar; we know it is one eighth long.
    const timemap = [
      { qstamp: 0, measureOn: 'm0', on: ['a'] },
      { qstamp: 0.25, on: ['b'] },
      { qstamp: 1.5, measureOn: 'm1', on: ['c', 'd'] },
      { qstamp: 1.75, on: ['e'] },
      { qstamp: 3, measureOn: 'unknown', on: ['f'] },
    ];
    const index = new Map([
      ['m0', 0],
      ['m1', 1],
    ]);
    expect(writtenOnsets(timemap, index, [0, 480])).toEqual([
      { id: 'a', tick: 0 },
      { id: 'b', tick: 240 },
      { id: 'c', tick: 480 },
      { id: 'd', tick: 480 },
      { id: 'e', tick: 720 },
      // An unknown measure keeps the last anchor.
      { id: 'f', tick: 480 + 1.5 * 960 },
    ]);
  });
});
