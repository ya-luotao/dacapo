import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SIGHT_PREFS,
  parseSightPrefs,
  sightTempoOf,
  withSightTempo,
  type SightPrefs,
} from './sightPrefs.ts';

describe('sight-reading prefs', () => {
  it('read what was stored', () => {
    const stored: SightPrefs = {
      tempos: { F1: 90, F8: 48 },
      play: 'wait',
      readAhead: 'hard',
      look: 30,
      countInOnly: true,
      length: 8,
    };
    expect(parseSightPrefs(JSON.stringify(stored))).toEqual(stored);
  });

  it('fall back to the default for anything missing, unknown or out of range', () => {
    expect(DEFAULT_SIGHT_PREFS).toMatchObject({
      play: 'time',
      readAhead: 'off',
      look: 20,
      length: 4,
    });
    expect(parseSightPrefs(null)).toEqual(DEFAULT_SIGHT_PREFS);
    expect(parseSightPrefs('[')).toEqual(DEFAULT_SIGHT_PREFS);
    expect(
      parseSightPrefs(
        JSON.stringify({
          tempos: { F1: 200, F2: 39, F3: 72.5, F9: 80, F4: 100 },
          play: 'slow',
          readAhead: true,
          look: 12,
          countInOnly: 'yes',
          length: 16,
        }),
      ),
    ).toEqual({ ...DEFAULT_SIGHT_PREFS, tempos: { F4: 100 } });
  });

  it('keep a tempo per level, 72 by default and 60 with sixteenths', () => {
    expect(sightTempoOf(DEFAULT_SIGHT_PREFS, 'F1')).toBe(72);
    expect(sightTempoOf(DEFAULT_SIGHT_PREFS, 'F8')).toBe(60);
    const faster = withSightTempo(DEFAULT_SIGHT_PREFS, 'F8', 80);
    expect(sightTempoOf(faster, 'F8')).toBe(80);
    expect(sightTempoOf(faster, 'F7')).toBe(72);
    expect(withSightTempo(faster, 'F8', 60).tempos).toEqual({});
  });
});
