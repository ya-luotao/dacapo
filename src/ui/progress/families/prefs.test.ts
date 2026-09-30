import { describe, expect, it } from 'vitest';
import { chooseSection, isSectionOpen, parseSectionChoices } from './prefs.ts';

const none = { open: [], folded: [] };

describe('progress prefs', () => {
  it('reads the sections opened and folded, in the page’s order', () => {
    expect(
      parseSectionChoices(JSON.stringify({ open: ['readChord', 'interval'], folded: ['echo'] })),
    ).toEqual({ open: ['interval', 'readChord'], folded: ['echo'] });
  });

  it('leaves out anything unknown or broken, and a family in both lists', () => {
    expect(parseSectionChoices(null)).toEqual(none);
    expect(parseSectionChoices('{not json')).toEqual(none);
    expect(parseSectionChoices('null')).toEqual(none);
    expect(parseSectionChoices(JSON.stringify({ folded: 'echo' }))).toEqual(none);
    expect(parseSectionChoices(JSON.stringify({ folded: ['echo', 'song', 3] }))).toEqual({
      open: [],
      folded: ['echo'],
    });
    expect(
      parseSectionChoices(JSON.stringify({ open: ['chord', 'echo'], folded: ['chord'] })),
    ).toEqual({ open: ['echo'], folded: [] });
  });

  it('opens only the family practised last, until a section is opened or folded by hand', () => {
    expect(isSectionOpen('chord', none, 'chord')).toBe(true);
    expect(isSectionOpen('interval', none, 'chord')).toBe(false);
    expect(isSectionOpen('interval', none, null)).toBe(false);
    const folded = chooseSection(none, 'chord', false);
    expect(isSectionOpen('chord', folded, 'chord')).toBe(false);
    const opened = chooseSection(folded, 'interval', true);
    expect(opened).toEqual({ open: ['interval'], folded: ['chord'] });
    expect(isSectionOpen('interval', opened, 'chord')).toBe(true);
    expect(chooseSection(opened, 'chord', true)).toEqual({
      open: ['interval', 'chord'],
      folded: [],
    });
  });
});
