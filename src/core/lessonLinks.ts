// From a lesson to the practice of what it teaches (docs/LEARN.md, "Practise it goes to the thing
// itself"). A lesson names one or two practices as plain data (`learn/lessons.ts`); here each is
// resolved against how far the reader has got when the lesson is read: the level a family's page
// would suggest, the first level that has what the lesson is about, the next scale never played,
// the piece in hand. What a link names that the build does not have falls back to its page.
// Pure: the routes are built from the result by ui/startParams.ts.

import type { LessonLevel, LessonPractice } from '../learn/lessons.ts';
import type { LevelFamily } from './assignmentRecords.ts';
import {
  levelsMastered,
  levelsOfFamily,
  pageOfFamily,
  type LevelPage,
  type ProgressInput,
} from './assignments.ts';
import { LEVELS } from './levels.ts';
import { cellLines, RHYTHM_LEVELS } from './rhythmCells.ts';
import { exerciseKeyParts } from './scaleTypes.ts';
import { readingFloor } from './startingPoint.ts';
import { KEY_SIGNATURE_LEVELS } from './theoryItems.ts';
import { curriculumState, type StateOptions, type TodayRecords } from './today.ts';

/** A page a link can lead to, as it is. */
export type LinkPage = LevelPage | 'play' | 'metronome' | 'scales' | 'pieces';

/** Where one of a lesson's links leads. */
export type PracticeLink =
  | { kind: 'page'; page: LinkPage }
  /** A level of a family, on the page that practises it. */
  | { kind: 'level'; page: LevelPage; family: LevelFamily; level: string }
  /** A scale or a technique exercise, by its exercise key. */
  | { kind: 'scale'; exercise: string }
  | { kind: 'piece'; id: string };

/** What the links are resolved against: where the reader stands now. */
export interface LinkState {
  /**
   * Each family's own suggestion (its first level not mastered), or null once all its levels
   * are: its page then suggests its last. Read's notes begin at the floor of a player's starting
   * point, as on the Read page: the first level not mastered from the floor on, null once those
   * all are.
   */
  suggested: (family: LevelFamily) => string | null;
  /** Whether a level is mastered, by the rule of its page. */
  mastered: (family: LevelFamily, level: string) => boolean;
  /** The next rung of the scale ladder; null once every rung was played. */
  nextRung: string | null;
  /** The piece in hand, else the next piece to begin; null when there is neither. */
  piece: string | null;
  /** Whether a piece is on this device: a built-in piece, or one imported here. */
  hasPiece: (id: string) => boolean;
}

/**
 * The state the links are resolved against, from the records: what today's plan and "Where you
 * are" are made from (core/today.ts), as it is now, with the visitor's starting point
 * (`options.start`, docs/START.md): someone who plays already has Pieces open, so a piece to
 * begin, and Read's notes from where their reading begins.
 */
export function linkState(records: TodayRecords, options: StateOptions): LinkState {
  const state = curriculumState(records, options);
  const { sessions, attempts, answers } = records;
  const input: ProgressInput = {
    sessions,
    attempts,
    answers,
    pieces: [],
    lessonsDone: options.lessonsDone,
    timeZone: options.timeZone,
  };
  const pieces = new Set(records.pieces.map((piece) => piece.id));
  const mastered = (family: LevelFamily, level: string) =>
    levelsMastered([{ family, level }], options.today, input)[0] ?? false;
  // The Read page's own rule for the notes of someone who plays already (`suggestedLevel` with
  // its floor): the levels below the floor are not where the page opens, whatever is mastered.
  const floor = readingFloor(options.start ?? null);
  const notesFromFloor = (from: string) => {
    const levels = levelsOfFamily('notes');
    return (
      levels.slice(Math.max(0, levels.indexOf(from))).find((l) => !mastered('notes', l)) ?? null
    );
  };
  return {
    suggested: (family) =>
      family === 'notes' && floor !== null
        ? notesFromFloor(floor)
        : (state.families.find((f) => f.family === family)?.suggested ?? null),
    mastered,
    nextRung: state.scales.next,
    piece: state.pieces.inHand?.id ?? state.pieces.next,
    hasPiece: (id) => pieces.has(id),
  };
}

// --- The first level with what a lesson teaches ----------------------------------------------

/**
 * The first level of a family that has what a lesson is about, found in the levels' own data
 * rather than named here: Read's notes with a sharp or a flat, Read's rhythm with a dotted note
 * or a tie, the key signatures in minor. Null when no level has it.
 */
export function firstLevelWith(what: Exclude<LessonLevel, 'suggested'>): {
  family: LevelFamily;
  level: string | null;
} {
  switch (what) {
    case 'sharps':
      return {
        family: 'notes',
        level: LEVELS.find((l) => l.notes.some((note) => note.pitch.accidental !== 0))?.id ?? null,
      };
    case 'dotted':
      return {
        family: 'rhythm',
        // By the cells a level adds: the level that teaches them, not one that only has them.
        level:
          RHYTHM_LEVELS.find((l) =>
            l.adds.some((cell) => cellLines(cell).some((line) => line.some(isDottedOrTied))),
          )?.id ?? null,
      };
    case 'minor':
      return {
        family: 'keySignature',
        level: KEY_SIGNATURE_LEVELS.find((l) => l.mode === 'minor')?.id ?? null,
      };
  }
}

const isDottedOrTied = (note: { dot: boolean; tied: boolean; tie: boolean; rest: boolean }) =>
  !note.rest && (note.dot || note.tied || note.tie);

// --- Resolving -------------------------------------------------------------------------------

const page = (to: LinkPage): PracticeLink => ({ kind: 'page', page: to });

/**
 * The page a link falls back to: the one that practises what it names. It is where the link
 * leads before the records are read, and when it names a level, an exercise or a piece this
 * build does not have.
 */
export function fallbackLink(practice: LessonPractice): PracticeLink {
  if ('page' in practice) return page(practice.page);
  if ('family' in practice) return page(pageOfFamily(practice.family));
  return page('scale' in practice ? 'scales' : 'pieces');
}

function levelOf(family: LevelFamily, which: LessonLevel, state: LinkState): string | null {
  const levels = levelsOfFamily(family);
  // Its page's own rule: the first level not mastered, the last once all are.
  const suggested = state.suggested(family) ?? levels.at(-1) ?? null;
  if (which === 'suggested') return suggested;
  const first = firstLevelWith(which);
  // Asked of another family than the one that has it: nothing to name.
  if (first.family !== family || first.level === null) return null;
  // Dots and ties are a rung on the way: once it is mastered, on to where the page would go.
  if (which === 'dotted' && state.mastered(family, first.level)) return suggested;
  return first.level;
}

/** Where a lesson's link leads now. */
export function resolvePractice(practice: LessonPractice, state: LinkState): PracticeLink {
  const fallback = fallbackLink(practice);
  if ('page' in practice) return fallback;
  if ('family' in practice) {
    const { family } = practice;
    const level = levelOf(family, practice.level, state);
    return level !== null && levelsOfFamily(family).includes(level)
      ? { kind: 'level', page: pageOfFamily(family), family, level }
      : fallback;
  }
  if ('scale' in practice) {
    const exercise = practice.scale === 'next' ? state.nextRung : practice.scale;
    return exercise !== null && exerciseKeyParts(exercise) !== null
      ? { kind: 'scale', exercise }
      : fallback;
  }
  const id = practice.piece === 'inHand' ? state.piece : practice.piece;
  return id !== null && state.hasPiece(id) ? { kind: 'piece', id } : fallback;
}

/** A lesson's links, in its order: resolved, or each at its page while there is no state yet. */
export function lessonLinks(
  practice: readonly LessonPractice[],
  state: LinkState | null,
): PracticeLink[] {
  return practice.map((p) => (state ? resolvePractice(p, state) : fallbackLink(p)));
}
