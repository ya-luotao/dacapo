import { describe, expect, it } from 'vitest';
import { DEFAULT_EAR_PREFS, parseEarPrefs } from './prefs.ts';

describe('ear prefs', () => {
  it('reads what was stored', () => {
    const stored = {
      family: 'chord',
      by: 'name',
      direction: 'mixed',
      chordStyle: 'block',
      length: 50,
      echoLength: 5,
    };
    expect(parseEarPrefs(JSON.stringify(stored))).toEqual(stored);
    expect(parseEarPrefs(JSON.stringify({ ...stored, family: 'echo' })).family).toBe('echo');
  });

  it('reads what an earlier version stored, without a length of melodies', () => {
    const stored = {
      family: 'chord',
      by: 'name',
      direction: 'up',
      chordStyle: 'block',
      length: 10,
    };
    expect(parseEarPrefs(JSON.stringify(stored))).toEqual({ ...stored, echoLength: 10 });
  });

  it('falls back to the default for anything missing, unknown or broken', () => {
    expect(parseEarPrefs(null)).toEqual(DEFAULT_EAR_PREFS);
    expect(parseEarPrefs('{not json')).toEqual(DEFAULT_EAR_PREFS);
    expect(parseEarPrefs('"up"')).toEqual(DEFAULT_EAR_PREFS);
    expect(
      parseEarPrefs(JSON.stringify({ family: 'song', length: 30, echoLength: 50, direction: 'x' })),
    ).toEqual(DEFAULT_EAR_PREFS);
    expect(parseEarPrefs(JSON.stringify({ by: 'name' }))).toEqual({
      ...DEFAULT_EAR_PREFS,
      by: 'name',
    });
  });
});
