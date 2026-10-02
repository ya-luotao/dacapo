import { describe, expect, it } from 'vitest';
import type { LevelFamily } from './assignmentRecords.ts';
import { LEVEL_FAMILIES, levelsOfFamily } from './assignments.ts';
import { getLevel } from './levels.ts';
import {
  isPractiseFamily,
  PRACTISE_FAMILIES,
  practiceLevelItems,
  practiceStart,
} from './practiceLevels.ts';

describe('the items a level draws from', () => {
  it('are given for every level of every family a session of some items is offered in', () => {
    for (const family of PRACTISE_FAMILIES) {
      for (const level of levelsOfFamily(family)) {
        const items = practiceLevelItems(family, level);
        expect(items, `${family} ${level}`).not.toBeNull();
        expect(items!.length, `${family} ${level}`).toBeGreaterThan(0);
        expect(new Set(items).size, `${family} ${level}`).toBe(items!.length);
        // An item goes into a link as it is, the items joined by commas.
        for (const item of items!) expect(item).not.toContain(',');
      }
    }
  });

  it('are none for a family without such a session', () => {
    const others = LEVEL_FAMILIES.filter((family) => !isPractiseFamily(family));
    expect([...others].sort()).toEqual(['cadence', 'echo', 'rhythmEar', 'sight', 'tune']);
    for (const family of others) {
      for (const level of levelsOfFamily(family)) {
        expect(practiceLevelItems(family, level)).toBeNull();
      }
    }
  });

  it('are none for a level that is not the family’s', () => {
    expect(practiceLevelItems('notes', 'RI1')).toBeNull();
    expect(practiceLevelItems('readInterval', 'KS1')).toBeNull();
    expect(practiceLevelItems('keySignature', 'RI1')).toBeNull();
    expect(practiceLevelItems('interval', 'C1')).toBeNull();
    expect(practiceLevelItems('chord', 'I1')).toBeNull();
    expect(practiceLevelItems('rhythm', 'L1')).toBeNull();
    expect(practiceLevelItems('chordSymbol', 'nope')).toBeNull();
    expect(practiceLevelItems('nope' as LevelFamily, 'L1')).toBeNull();
  });

  it('are a level’s notes, an interval in each direction, a cell in each meter', () => {
    expect(practiceLevelItems('notes', 'L1')).toEqual(getLevel('L1').notes.map((n) => n.key));
    const intervals = practiceLevelItems('interval', levelsOfFamily('interval')[0]!)!;
    for (const direction of ['up', 'down', 'harm']) {
      expect(intervals.some((item) => item.endsWith(`:${direction}`))).toBe(true);
    }
    for (const level of levelsOfFamily('rhythm')) {
      for (const item of practiceLevelItems('rhythm', level)!) {
        expect(item.startsWith('rhythm:')).toBe(true);
      }
    }
  });
});

describe('where a list of items is practised from Progress', () => {
  const levels = levelsOfFamily('notes');
  const l1 = practiceLevelItems('notes', 'L1')!;
  const l3 = practiceLevelItems('notes', 'L3')!;
  const [a, b, c] = l1 as [string, string, string];
  /** A note L3 has and L1 has not. */
  const bass = l3.find((item) => !l1.includes(item))!;

  it('is the first level that has them all', () => {
    expect(practiceStart('notes', [a, b, c], levels)).toEqual({
      family: 'notes',
      level: 'L1',
      items: [a, b, c],
    });
    expect(practiceStart('notes', [bass], levels)?.level).toBe('L3');
  });

  it('is the level chosen when it has any of them, with those it has', () => {
    expect(l3).not.toContain(a);
    expect(practiceStart('notes', [bass, a], levels, 'L3')).toEqual({
      family: 'notes',
      level: 'L3',
      items: [bass],
    });
    // A level chosen that has none of them: the level that has them.
    expect(practiceStart('notes', [a], levels, 'L3')?.level).toBe('L1');
  });

  it('leaves out what the level has not, and is nowhere with items no level has', () => {
    expect(practiceStart('notes', [a, 'X9@treble'], levels)).toEqual({
      family: 'notes',
      level: 'L1',
      items: [a],
    });
    expect(practiceStart('notes', ['X9@treble'], levels)).toBeNull();
    expect(practiceStart('notes', [], levels)).toBeNull();
    expect(practiceStart('notes', [], levels, 'L2')).toBeNull();
  });

  it('finds a level for the weakest of every family it is offered in', () => {
    for (const family of PRACTISE_FAMILIES) {
      const all = levelsOfFamily(family);
      const last = practiceLevelItems(family, all[all.length - 1]!)!;
      const start = practiceStart(family, last.slice(-3), all);
      expect(start, family).not.toBeNull();
      expect(start!.items.length, family).toBeGreaterThan(0);
    }
  });
});
