import { EAR_FAMILIES, levelsOf, type EarFamily, type EarLevelId } from '../../core/earItems.ts';
import {
  isRhythmEarFamily,
  isRhythmEarLevelId,
  type RhythmEarFamily,
  type RhythmEarLevelId,
} from '../../core/rhythmEar.ts';
import type { LevelStart } from '../startParams.ts';

/** What Ear opens on when it is opened with a level (a task of an assignment). */
export type EarStart =
  { family: EarFamily; level: EarLevelId } | { family: RhythmEarFamily; level: RhythmEarLevelId };

/** The start as Ear can take it; null when it names nothing Ear has. */
export function earStart(start: LevelStart | null): EarStart | null {
  if (!start) return null;
  const { family, level } = start;
  if (isRhythmEarFamily(family)) return isRhythmEarLevelId(level) ? { family, level } : null;
  const known = EAR_FAMILIES.find((f) => f === family);
  const found = known && levelsOf(known).find((l) => l.id === level);
  return known && found ? { family: known, level: found.id } : null;
}
