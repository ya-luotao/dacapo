import { describe, expect, it } from 'vitest';
import { DEFAULT_READ_PREFS, parseReadPrefs, READ_CHOICE_GROUPS, READ_CHOICES } from './prefs.ts';

describe('read prefs', () => {
  it('offers notes and the three kinds of theory card, then what is read in time', () => {
    expect(READ_CHOICES).toEqual([
      'notes',
      'readInterval',
      'keySignature',
      'readChord',
      'rhythm',
      'sight',
    ]);
    expect(READ_CHOICE_GROUPS.map((g) => g.id)).toEqual(['cards', 'time']);
  });

  it('reads what was stored', () => {
    const stored = { choice: 'readChord', chordBy: 'name' };
    expect(parseReadPrefs(JSON.stringify(stored))).toEqual(stored);
    expect(parseReadPrefs(JSON.stringify({ choice: 'rhythm' })).choice).toBe('rhythm');
  });

  it('falls back to the default for anything missing, unknown or broken', () => {
    expect(parseReadPrefs(null)).toEqual(DEFAULT_READ_PREFS);
    expect(parseReadPrefs('{')).toEqual(DEFAULT_READ_PREFS);
    expect(parseReadPrefs(JSON.stringify({ choice: 'sight' })).choice).toBe('sight');
    expect(parseReadPrefs(JSON.stringify({ choice: 'dictation', chordBy: 'hum' }))).toEqual(
      DEFAULT_READ_PREFS,
    );
    expect(parseReadPrefs(JSON.stringify({ choice: 'keySignature' }))).toEqual({
      choice: 'keySignature',
      chordBy: 'play',
    });
  });
});
