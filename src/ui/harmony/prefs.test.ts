import { describe, expect, it } from 'vitest';
import { DEFAULT_HARMONY_PREFS, parseHarmonyPrefs, prefsKey } from './prefs.ts';

describe('harmony prefs', () => {
  it('keeps the chord-symbol level picked last, when it is one', () => {
    expect(parseHarmonyPrefs(JSON.stringify({ level: 'H3' })).level).toBe('H3');
    for (const level of ['H9', 'L1', '', 3, null]) {
      expect(parseHarmonyPrefs(JSON.stringify({ level })).level).toBeNull();
    }
    expect(DEFAULT_HARMONY_PREFS.level).toBeNull();
  });

  it('falls back to the defaults for anything missing or unknown', () => {
    expect(parseHarmonyPrefs(null)).toEqual(DEFAULT_HARMONY_PREFS);
    expect(parseHarmonyPrefs('not json')).toEqual(DEFAULT_HARMONY_PREFS);
    expect(
      parseHarmonyPrefs(
        JSON.stringify({ practice: 'compose', progression: 'x', majorKey: 'C#', bpm: 81 }),
      ),
    ).toEqual(DEFAULT_HARMONY_PREFS);
  });

  it('keeps a key per mode, and the progression chooses which', () => {
    const prefs = parseHarmonyPrefs(
      JSON.stringify({
        practice: 'progressions',
        progression: 'i-iv-V-i',
        majorKey: 'Eb',
        minorKey: 'F#m',
        pattern: 'stride',
        bpm: 96,
      }),
    );
    expect(prefs).toEqual({
      practice: 'progressions',
      progression: 'i-iv-V-i',
      majorKey: 'Eb',
      minorKey: 'F#m',
      pattern: 'stride',
      bpm: 96,
      // Stored by an earlier version, which kept no level.
      level: null,
    });
    expect(prefsKey(prefs)).toBe('F#m');
    expect(prefsKey({ ...prefs, progression: 'blues' })).toBe('Eb');
  });
});
