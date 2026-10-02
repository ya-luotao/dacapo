// "Practise these" (docs/ADVICE.md, "Cards"): a short session of some of a level's items is
// offered where a session draws its items by weight. This says which families those are and what
// each of their levels draws from: what a summary's list is checked against, what a link's items
// are checked against on arrival, and what the level's weakest are taken from to fill a session
// up. Pure.

import { levelOfItems } from './advice.ts';
import type { LevelFamily } from './assignmentRecords.ts';
import { getHarmonyLevel, harmonyLevelItems, isHarmonyLevelId } from './chordSymbols.ts';
import { DIRECTIONS, levelItems, levelsOf } from './earItems.ts';
import { getLevel, isLevelId } from './levels.ts';
import { getRhythmLevel, isRhythmLevelId, rhythmItem, rhythmItemInLevel } from './rhythmCells.ts';
import { getTheoryLevel, isTheoryLevelId, theoryLevelItems } from './theoryItems.ts';

/** The families a session of some items is offered in, in the pages' order. */
export const PRACTISE_FAMILIES = [
  'notes',
  'readInterval',
  'keySignature',
  'readChord',
  'rhythm',
  'interval',
  'chord',
  'chordSymbol',
] as const satisfies readonly LevelFamily[];
export type PractiseFamily = (typeof PRACTISE_FAMILIES)[number];

export const isPractiseFamily = (family: unknown): family is PractiseFamily =>
  (PRACTISE_FAMILIES as readonly unknown[]).includes(family);

/**
 * The items a level of a family draws from, in the level's order: Read's notes, its intervals in
 * each direction, its key signatures and chords, the cells of a rhythm level in each of its
 * meters, Ear's intervals in every direction and its chords, Harmony's symbols. Null for a family
 * that has no such session, or a level that is not the family's.
 */
export function practiceLevelItems(family: LevelFamily, level: string): string[] | null {
  switch (family) {
    case 'notes':
      return isLevelId(level) ? getLevel(level).notes.map((note) => note.key) : null;
    case 'readInterval':
    case 'keySignature':
    case 'readChord': {
      if (!isTheoryLevelId(level)) return null;
      const found = getTheoryLevel(level);
      return found.family === family ? theoryLevelItems(found) : null;
    }
    case 'rhythm': {
      if (!isRhythmLevelId(level)) return null;
      const found = getRhythmLevel(level);
      return found.meters.flatMap((meter) =>
        found.cells
          .filter((cell) => rhythmItemInLevel(found, cell, meter))
          .map((cell) => rhythmItem(cell, meter)),
      );
    }
    case 'interval':
    case 'chord': {
      const found = levelsOf(family).find((l) => l.id === level);
      return found ? levelItems(found, DIRECTIONS) : null;
    }
    case 'chordSymbol':
      return isHarmonyLevelId(level) ? harmonyLevelItems(getHarmonyLevel(level)) : null;
    default:
      return null;
  }
}

/**
 * Where a list of items is practised from outside a session (Progress's weakest): at `level` when
 * one is given and has any of them, else at the level `levelOfItems` finds among `levels` (the
 * family's, in order); the items are those the level has. Null when no level has any.
 */
export function practiceStart(
  family: PractiseFamily,
  items: readonly string[],
  levels: readonly string[],
  level: string | null = null,
): { family: PractiseFamily; level: string; items: string[] } | null {
  const own = (id: string) => {
    const has = new Set(practiceLevelItems(family, id) ?? []);
    return items.filter((item) => has.has(item));
  };
  const at =
    level !== null && own(level).length > 0
      ? level
      : levelOfItems(
          items,
          levels.map((id) => ({ id, items: practiceLevelItems(family, id) ?? [] })),
        );
  return at === null ? null : { family, level: at, items: own(at) };
}
