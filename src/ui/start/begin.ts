import { useCallback } from 'react';
import { CURRICULUM_LESSONS, nextLesson } from '../../core/curriculum.ts';
import { doneSlugs } from '../../core/lessonRecords.ts';
import type { StartingPoint } from '../../core/startingPoint.ts';
import { usePracticeStore } from '../practice/context.ts';
import { recordsKnown } from '../practice/store.ts';

/**
 * Where the start page's Begin goes (docs/START.md). Someone who plays goes to Today. Someone new
 * goes to the next lesson: the first not ticked, the first of all once every one is. `lessonsDone`
 * is null while the ticks are not known (the records are not read yet, or cannot be): the Learn
 * page then, which marks the next lesson once it knows, and never lesson 1 for someone with ticks.
 */
export function beginPath(start: StartingPoint, lessonsDone: ReadonlySet<string> | null): string {
  if (start.from !== 'new') return '/';
  if (lessonsDone === null) return '/learn';
  return `/learn/${nextLesson(lessonsDone) ?? CURRICULUM_LESSONS[0]!}`;
}

/**
 * `beginPath` for the store as it is when Begin is pressed, not as it was when the page was drawn.
 * The ticks are known once the records are read, and where there is no storage to read; they are
 * not while the store is loading, after a read that failed, and over a database of a later
 * version, whose ticks this page cannot see (`recordsKnown`).
 */
export function useBeginPath(): (start: StartingPoint) => string {
  const store = usePracticeStore();
  return useCallback(
    (start) => {
      const known = recordsKnown(store.getStatus());
      return beginPath(start, known ? doneSlugs(store.getSnapshot().lessons) : null);
    },
    [store],
  );
}
