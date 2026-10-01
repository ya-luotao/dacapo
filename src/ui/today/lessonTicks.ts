import type { LessonTick } from '../../core/recap.ts';
import { usePractice } from '../practice/context.ts';

// Where the recap of a week gets the lessons' ticks (docs/PERSONAL.md, "Your week"): the records
// of the practice store (docs/LEARN.md, "The tick is a record"), each a slug and `doneAt`.

/**
 * The lessons ticked, each with the time it was ticked, as stored: a lesson is counted for the
 * week it was finished in, on whichever device that was. A tick moved from the preference an
 * earlier version kept has no time (0): such a lesson is ticked from before anything else (it
 * opens its practices) and is never a week's "lesson finished" (the recap's rule). Empty until
 * the stored data is in; the recap waits for the records before it is worked out.
 */
export function useLessonTicks(): readonly LessonTick[] {
  return usePractice().lessons;
}
