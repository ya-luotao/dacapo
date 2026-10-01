import { describe, expect, it } from 'vitest';
import { DEFAULT_IMPROV_PREFS, parseImprovPrefs, prefsSpec } from './improvPrefs.ts';

describe('improvise prefs', () => {
  it('falls back to the defaults for anything missing or unknown', () => {
    expect(parseImprovPrefs(null)).toEqual(DEFAULT_IMPROV_PREFS);
    expect(parseImprovPrefs('[1]')).toEqual(DEFAULT_IMPROV_PREFS);
    expect(
      parseImprovPrefs(JSON.stringify({ backing: 'rondo', bpm: 81, channel: 16, click: 'yes' })),
    ).toEqual(DEFAULT_IMPROV_PREFS);
    expect(DEFAULT_IMPROV_PREFS.choices.blues).toEqual({
      key: 'C',
      scale: 'blues',
      pattern: 'shuffle',
      feel: 'swing',
    });
  });

  it('keeps each backing’s own choices, and only those its backing can take', () => {
    const prefs = parseImprovPrefs(
      JSON.stringify({
        backing: 'vamp',
        choices: {
          vamp: { key: 'A', scale: 'minorPentatonic', pattern: 'alberti', feel: 'swing' },
          // The shuffle and the blues scale are the blues backing's only; D is not one of its keys.
          'ii-V-I': { key: 'D', scale: 'blues', pattern: 'shuffle', feel: 'straight' },
        },
        bpm: 112,
        click: true,
        call: true,
        channel: 1,
      }),
    );
    expect(prefs.choices['ii-V-I']).toEqual({
      key: 'D',
      scale: 'major',
      pattern: 'stride',
      feel: 'straight',
    });
    expect(prefsSpec(prefs)).toEqual({
      backing: 'vamp',
      key: 'A',
      scale: 'minorPentatonic',
      pattern: 'alberti',
      feel: 'swing',
      bpm: 112,
      call: true,
    });
    expect(prefs).toMatchObject({ click: true, channel: 1 });
  });
});
