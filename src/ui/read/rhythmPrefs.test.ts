import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RHYTHM_PREFS,
  parseRhythmPrefs,
  tempoOf,
  withTempo,
  type RhythmPrefs,
} from './rhythmPrefs.ts';

describe('rhythm prefs', () => {
  it('read what was stored', () => {
    const stored: RhythmPrefs = {
      tempos: { R1: 90, R5: 48 },
      countInOnly: true,
      counts: true,
      length: 16,
    };
    expect(parseRhythmPrefs(JSON.stringify(stored))).toEqual(stored);
  });

  it('fall back to the default for anything missing, unknown or out of range', () => {
    expect(parseRhythmPrefs(null)).toEqual(DEFAULT_RHYTHM_PREFS);
    expect(parseRhythmPrefs('[')).toEqual(DEFAULT_RHYTHM_PREFS);
    expect(
      parseRhythmPrefs(
        JSON.stringify({
          tempos: { R1: 200, R2: 39, R3: 72.5, R11: 80, R4: 100 },
          countInOnly: 'yes',
          length: 10,
        }),
      ),
    ).toEqual({ ...DEFAULT_RHYTHM_PREFS, tempos: { R4: 100 } });
  });

  it('keep a tempo per level, 72 by default and 60 with sixteenths', () => {
    expect(tempoOf(DEFAULT_RHYTHM_PREFS, 'R1')).toBe(72);
    expect(tempoOf(DEFAULT_RHYTHM_PREFS, 'R5')).toBe(60);
    const faster = withTempo(DEFAULT_RHYTHM_PREFS, 'R5', 80);
    expect(tempoOf(faster, 'R5')).toBe(80);
    expect(tempoOf(faster, 'R6')).toBe(60);
    // Back to the default: nothing stored for it.
    expect(withTempo(faster, 'R5', 60).tempos).toEqual({});
  });
});
