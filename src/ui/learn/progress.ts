import { useMemo } from 'react';
import { doneSlugs, legacyLessons, type LessonDone } from '../../core/lessonRecords.ts';
import { readPref } from '../../lib/localPrefs.ts';
import { usePractice } from '../practice/context.ts';

// Which lessons have been finished (their last exercise done): records of the practice store,
// exported and synced like the rest (docs/LEARN.md, "The tick is a record"). An earlier version
// kept them in this browser's preferences; those are moved into the store when it starts, and
// the preference is left as it was: it is only ever read.

const LEGACY_KEY = 'dacapo.learn.done';

/** The ticks an earlier version kept in the preferences, as records without a time. */
export function readLegacyLessons(): LessonDone[] {
  return legacyLessons(readPref(LEGACY_KEY));
}

/**
 * The lessons ticked, by slug, as the practice store has them now: a lesson finished in this
 * tab, in another, on another device or in an imported file is ticked on every page that asks.
 * Empty until the stored data is in (`useStorageStatus().loaded`).
 */
export function useLessonsDone(): ReadonlySet<string> {
  const { lessons } = usePractice();
  return useMemo(() => doneSlugs(lessons), [lessons]);
}
