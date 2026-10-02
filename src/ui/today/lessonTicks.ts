import { useState } from 'react';
import type { LessonTick } from '../../core/recap.ts';
import { readDone } from '../learn/progress.ts';

// Where the recap of a week gets the lessons' ticks (docs/PERSONAL.md, "Your week"). This is the
// one place to change when a tick becomes a record with its time (docs/LEARN.md, G3: the store
// `lessons`, each record a slug and `doneAt`): return those records here, and a lesson is counted
// for the week it was finished in.

/**
 * The lessons ticked on this device, each with the time it was ticked. A tick kept in the browser
 * has no time: 0, as its record will have once it is moved into the store. Such a lesson is
 * ticked from before anything else (it opens its practices) and is never a week's "lesson
 * finished".
 */
export function useLessonTicks(): readonly LessonTick[] {
  const [ticks] = useState(() => [...readDone()].map((slug) => ({ slug, doneAt: 0 })));
  return ticks;
}
