import { useCallback } from 'react';
import {
  cardAdvice,
  familyAfter,
  practiceItems,
  practiceLength,
  type CardAction,
  type CardAdvice,
} from '../core/advice.ts';
import type { LevelFamily } from '../core/assignmentRecords.ts';
import { levelsOfFamily, pageOfFamily } from '../core/assignments.ts';
import { dayKey } from '../core/streak.ts';
import { curriculumState } from '../core/today.ts';
import { navigate } from './hashRoute.ts';
import { useLessonsDone } from './learn/progress.ts';
import { usePractice } from './practice/context.ts';
import { readStartPref } from './start/prefs.ts';
import { levelStartPath } from './startParams.ts';

// What a summary of cards on Read, Ear or Harmony needs for its advice (docs/ADVICE.md, "Cards"):
// the session among the level's other answers, the levels either side of it, and after a family's
// last level the family to go on with. The rules are in core/advice.ts; this joins them to the
// records the page has.

type Next = { family: LevelFamily; level: string } | null;

/** "Practise these": the items a short session draws from, and its cards. */
export type Practise = Extract<CardAction, { kind: 'practise' }>;

/**
 * The family to go on with after the last level of one (`familyAfter`), from where every family
 * stands now. Worked out only when asked: it reads every answer there is. The pieces are not
 * needed for it and are left out.
 */
export function useFamilyAfter(): (family: LevelFamily) => Next {
  const { sessions, attempts, answers } = usePractice();
  const lessonsDone = useLessonsDone();
  return useCallback(
    (family) => {
      const state = curriculumState(
        { sessions, attempts, answers, pieces: [] },
        { today: dayKey(Date.now()), lessonsDone, start: readStartPref() },
      );
      return familyAfter(family, state.families, pageOfFamily);
    },
    [sessions, attempts, answers, lessonsDone],
  );
}

export interface SessionFigures {
  family: LevelFamily;
  level: string;
  /** The level's mastery by the family's own rule, without the session's answers and with them. */
  masteredBefore: boolean;
  mastered: boolean;
  /** Whether another level of the family is mastered. */
  isMastered: (level: string) => boolean;
  /** The session's answers, and those right (none for a session without answers to count). */
  answers: number;
  correct: number;
  /** It was played to its end. */
  complete: boolean;
  /** The items "Practise these" would take; empty where it is not offered. */
  practise?: readonly string[];
  familyAfter: (family: LevelFamily) => Next;
}

/** The advice for a session of cards; a tune, which is learnt and not mastered, has none. */
export function sessionAdvice(figures: SessionFigures): CardAdvice | null {
  const { family, level, masteredBefore, mastered } = figures;
  if (family === 'tune') return null;
  const levels = levelsOfFamily(family);
  const at = levels.indexOf(level);
  const nextLevel = levels[at + 1] ?? null;
  const below = at > 0 ? levels[at - 1]! : null;
  const last = mastered && !masteredBefore && nextLevel === null;
  return cardAdvice({
    masteredBefore,
    mastered,
    nextLevel,
    nextFamily: last ? figures.familyAfter(family) : null,
    answers: figures.answers,
    correct: figures.correct,
    complete: figures.complete,
    below: below === null ? null : { level: below, mastered: figures.isMastered(below) },
    practise: figures.practise ?? [],
  });
}

/**
 * What a list of items becomes as a short session ("Practise these"): those of the level's own,
 * filled up to three with its weakest, and its cards; null when none of them is the level's.
 */
export function practiceOf(
  listed: readonly string[],
  levelItems: readonly string[],
  weight: (item: string) => number,
): Practise | null {
  const items = practiceItems(listed, levelItems, weight);
  return items.length === 0
    ? null
    : { kind: 'practise', items, length: practiceLength(items.length) };
}

/**
 * An advice's button: another level of the family (the page starts it and keeps it, as a level
 * picked is kept), another family opened on the level it suggests, or a session of some items.
 */
export function takeAdvice(
  action: CardAction,
  level: (id: string) => void,
  practise: (items: Practise) => void,
): void {
  if (action.kind === 'family') {
    navigate(levelStartPath(pageOfFamily(action.family), action));
  } else if (action.kind === 'level') level(action.level);
  else practise(action);
}
