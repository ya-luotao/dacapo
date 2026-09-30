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
    };
    expect(parseEarPrefs(JSON.stringify(stored))).toEqual(stored);
  });

  it('falls back to the default for anything missing, unknown or broken', () => {
    expect(parseEarPrefs(null)).toEqual(DEFAULT_EAR_PREFS);
    expect(parseEarPrefs('{not json')).toEqual(DEFAULT_EAR_PREFS);
    expect(parseEarPrefs('"up"')).toEqual(DEFAULT_EAR_PREFS);
    expect(parseEarPrefs(JSON.stringify({ family: 'echo', length: 30, direction: 'up' }))).toEqual(
      DEFAULT_EAR_PREFS,
    );
    expect(parseEarPrefs(JSON.stringify({ by: 'name' }))).toEqual({
      ...DEFAULT_EAR_PREFS,
      by: 'name',
    });
  });
});
