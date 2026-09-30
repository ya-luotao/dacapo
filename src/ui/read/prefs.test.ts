import { describe, expect, it } from 'vitest';
import { DEFAULT_READ_PREFS, parseReadPrefs, READ_CHOICE_GROUPS, READ_CHOICES } from './prefs.ts';

describe('read prefs', () => {
  it('offers notes and the three kinds of theory card, as one group for now', () => {
    expect(READ_CHOICES).toEqual(['notes', 'readInterval', 'keySignature', 'readChord']);
    expect(READ_CHOICE_GROUPS.map((g) => g.id)).toEqual(['cards']);
  });

  it('reads what was stored', () => {
    const stored = { choice: 'readChord', chordBy: 'name' };
    expect(parseReadPrefs(JSON.stringify(stored))).toEqual(stored);
  });

  it('falls back to the default for anything missing, unknown or broken', () => {
    expect(parseReadPrefs(null)).toEqual(DEFAULT_READ_PREFS);
    expect(parseReadPrefs('{')).toEqual(DEFAULT_READ_PREFS);
    expect(parseReadPrefs(JSON.stringify({ choice: 'rhythm', chordBy: 'hum' }))).toEqual(
      DEFAULT_READ_PREFS,
    );
    expect(parseReadPrefs(JSON.stringify({ choice: 'keySignature' }))).toEqual({
      choice: 'keySignature',
      chordBy: 'play',
    });
  });
});
