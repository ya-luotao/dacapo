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
    const stored = { choice: 'readChord', chordBy: 'name', levels: { notes: 'L3', sight: 'F2' } };
    expect(parseReadPrefs(JSON.stringify(stored))).toEqual(stored);
    expect(parseReadPrefs(JSON.stringify({ choice: 'rhythm' })).choice).toBe('rhythm');
  });

  it('reads what an earlier version stored, which kept no level', () => {
    expect(parseReadPrefs(JSON.stringify({ choice: 'readChord', chordBy: 'name' }))).toEqual({
      choice: 'readChord',
      chordBy: 'name',
      levels: {},
    });
  });

  it('keeps the level picked for each choice, and nothing else under levels', () => {
    const levels = { notes: 'L3', readInterval: 'RI2', rhythm: 'R4', dictation: 'D1', sight: 7 };
    expect(parseReadPrefs(JSON.stringify({ levels })).levels).toEqual({
      notes: 'L3',
      readInterval: 'RI2',
      rhythm: 'R4',
    });
    expect(parseReadPrefs(JSON.stringify({ levels: 'L3' })).levels).toEqual({});
    // A level this build does not have is kept as it came: the page opens on the suggestion.
    expect(parseReadPrefs(JSON.stringify({ levels: { notes: 'L99' } })).levels).toEqual({
      notes: 'L99',
    });
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
      levels: {},
    });
  });
});
