import { describe, expect, it } from 'vitest';
import { keptLevels, openingLevel } from './levelChoice.ts';
import { LEVEL_IDS, type LevelId } from './levels.ts';
import { suggestedLevel, type LevelProgress } from './mastery.ts';
import { readingFloor } from './startingPoint.ts';

const LEVELS = ['L1', 'L2', 'L3', 'L4'] as const;
type Level = (typeof LEVELS)[number];
const mastered =
  (...levels: Level[]) =>
  (level: Level) =>
    levels.includes(level);

describe('the level a family opens on', () => {
  it('is the level suggested when none was picked', () => {
    expect(openingLevel(null, 'L1', LEVELS, mastered())).toBe('L1');
    expect(openingLevel(undefined, 'L3', LEVELS, mastered('L1', 'L2'))).toBe('L3');
  });

  it('is the level picked last, ahead of the suggestion or behind it', () => {
    expect(openingLevel('L3', 'L1', LEVELS, mastered())).toBe('L3');
    expect(openingLevel('L1', 'L3', LEVELS, mastered('L2'))).toBe('L1');
    // Picking the level suggested keeps it too: it stays when the suggestion moves on.
    expect(openingLevel('L2', 'L3', LEVELS, mastered('L1'))).toBe('L2');
  });

  it('is the level suggested again once the one picked is mastered', () => {
    expect(openingLevel('L2', 'L3', LEVELS, mastered('L1', 'L2'))).toBe('L3');
    // Every level mastered: the page suggests its last, and that is where it opens.
    expect(openingLevel('L2', 'L4', LEVELS, mastered('L1', 'L2', 'L3', 'L4'))).toBe('L4');
    // Mastery can lapse (it is judged on the latest answers): the level kept counts again.
    expect(openingLevel('L2', 'L2', LEVELS, mastered('L1'))).toBe('L2');
  });

  it('is the level suggested when what was kept is not a level of the family', () => {
    expect(openingLevel('L9', 'L2', LEVELS, mastered())).toBe('L2');
    expect(openingLevel('', 'L2', LEVELS, mastered())).toBe('L2');
    expect(openingLevel('R3', 'L2', LEVELS, mastered())).toBe('L2');
  });
});

describe('Read’s notes for someone who plays already (docs/START.md)', () => {
  // Read's own suggestion with the floor of what a player reads, as the Read page asks for it.
  const floor = readingFloor({ from: 'player', reads: 'both' });
  const progress = (...mastered: LevelId[]): LevelProgress[] =>
    LEVEL_IDS.map((level) => ({
      level,
      total: 0,
      cards: 0,
      accuracy: null,
      medianMs: null,
      mastered: mastered.includes(level),
    }));
  const opens = (kept: string | null, ...mastered: LevelId[]) =>
    openingLevel(kept, suggestedLevel(progress(...mastered), floor), LEVEL_IDS, (id) =>
      mastered.includes(id),
    );

  it('open on the floor when no level was picked', () => {
    expect(floor).toBe('L5');
    expect(opens(null)).toBe('L5');
    expect(opens(null, 'L5')).toBe('L6');
  });

  it('open on a level picked below the floor: a pick is a pick, until it is mastered', () => {
    expect(opens('L2')).toBe('L2');
    expect(opens('L2', 'L1')).toBe('L2');
    // Mastered: the suggestion again, which is the floor's, not the level after the one picked.
    expect(opens('L2', 'L2')).toBe('L5');
    expect(opens('L2', 'L2', 'L5')).toBe('L6');
  });

  it('open on a level picked above the floor, until it is mastered', () => {
    expect(opens('L7')).toBe('L7');
    expect(opens('L7', 'L7')).toBe('L5');
  });
});

describe('the levels kept in the browser', () => {
  const FAMILIES = ['notes', 'rhythm', 'sight'] as const;

  it('are read back by family, as strings', () => {
    expect(keptLevels({ notes: 'L3', sight: 'F2' }, FAMILIES)).toEqual({
      notes: 'L3',
      sight: 'F2',
    });
    expect(keptLevels({}, FAMILIES)).toEqual({});
  });

  it('leave out anything else', () => {
    expect(
      keptLevels(
        { notes: 5, rhythm: '', sight: null, chords: 'C1', echo: 'x'.repeat(65) },
        FAMILIES,
      ),
    ).toEqual({});
    expect(keptLevels({ rhythm: 'x'.repeat(65), notes: 'L2' }, FAMILIES)).toEqual({ notes: 'L2' });
    for (const junk of [null, undefined, 'L3', 7, ['L3']]) {
      expect(keptLevels(junk, FAMILIES)).toEqual({});
    }
  });
});
