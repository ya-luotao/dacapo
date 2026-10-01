import { isLevelId, type LevelId } from '../../core/levels.ts';
import { isRhythmLevelId, type RhythmLevelId } from '../../core/rhythmCells.ts';
import { isSightLevelId, type SightLevelId } from '../../core/sightLevels.ts';
import {
  isTheoryFamily,
  theoryLevelsOf,
  type TheoryFamily,
  type TheoryLevelId,
} from '../../core/theoryItems.ts';
import type { LevelStart } from '../startParams.ts';

/** What Read opens on when it is opened with a level (a task of an assignment). */
export type ReadStart =
  | { choice: 'notes'; level: LevelId }
  | { choice: 'rhythm'; level: RhythmLevelId }
  | { choice: 'sight'; level: SightLevelId }
  | { choice: 'theory'; family: TheoryFamily; level: TheoryLevelId };

/** The start as Read can take it; null when it names nothing Read has. */
export function readStart(start: LevelStart | null): ReadStart | null {
  if (!start) return null;
  const { family, level } = start;
  if (family === 'notes') return isLevelId(level) ? { choice: 'notes', level } : null;
  if (family === 'rhythm') return isRhythmLevelId(level) ? { choice: 'rhythm', level } : null;
  if (family === 'sight') return isSightLevelId(level) ? { choice: 'sight', level } : null;
  if (!isTheoryFamily(family)) return null;
  const found = theoryLevelsOf(family).find((l) => l.id === level);
  return found ? { choice: 'theory', family, level: found.id } : null;
}
