// A lesson finished (docs/LEARN.md, "The tick is a record"): one record per lesson, by its slug,
// with when its last exercise was first done. A tick is never taken back, so two copies of the
// records (two devices, a file and what is stored) merge as their union, and of two copies of one
// lesson the earlier is kept. Plain data and loaded at the start: the home page reads the ticks.

export interface LessonDone {
  /**
   * The lesson's slug (`rhythm-2`), or that of a page beside the lessons (`inside`). One this
   * build does not know (a lesson a later build added) is kept as it came, and not shown.
   */
  slug: string;
  /**
   * Epoch ms of the first time the lesson's last exercise was done; 0 for a tick from before
   * ticks had a time, which is before anything else.
   */
  doneAt: number;
}

/** A slug as lessons are named: lower-case letters, digits and hyphens, at most 64. */
export const isLessonSlug = (v: unknown): v is string =>
  typeof v === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(v);

/** A time a lesson can have been finished at: epoch ms, or 0. */
export const isDoneAt = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0;

export function byLessonSlug(a: LessonDone, b: LessonDone): number {
  return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
}

/**
 * Whether `record` takes the place of the stored copy of its lesson: there is none, or this one
 * is earlier. The same time changes nothing.
 */
export function replacesLesson(record: LessonDone, stored: LessonDone | undefined): boolean {
  return stored === undefined || record.doneAt < stored.doneAt;
}

/**
 * The records of `added` that change what is stored, each lesson once (its earliest copy):
 * those not stored, and those earlier than the stored copy.
 */
export function lessonsToWrite(
  added: readonly LessonDone[],
  stored: (slug: string) => LessonDone | undefined,
): LessonDone[] {
  const earliest = new Map<string, LessonDone>();
  for (const record of added) {
    if (replacesLesson(record, earliest.get(record.slug))) earliest.set(record.slug, record);
  }
  return [...earliest.values()].filter((record) => replacesLesson(record, stored(record.slug)));
}

/** The union of two sets of records, the earlier copy of a lesson kept, by slug. */
export function mergeLessons(
  stored: readonly LessonDone[],
  added: readonly LessonDone[],
): LessonDone[] {
  const bySlug = new Map(stored.map((record) => [record.slug, record]));
  for (const record of lessonsToWrite(added, (slug) => bySlug.get(slug))) {
    bySlug.set(record.slug, record);
  }
  return [...bySlug.values()].sort(byLessonSlug);
}

/**
 * The ticks an earlier version kept in the browser's preferences (`dacapo.learn.done`: slugs,
 * comma-separated) as records: they have no time, so each is `doneAt` 0. Anything that is not a
 * slug is left out.
 */
export function legacyLessons(pref: string | null): LessonDone[] {
  const slugs = new Set((pref ?? '').split(',').filter(isLessonSlug));
  return [...slugs].sort().map((slug) => ({ slug, doneAt: 0 }));
}

/** The lessons ticked, by slug: what the plan, the checklist and the pages ask. */
export function doneSlugs(records: readonly LessonDone[]): Set<string> {
  return new Set(records.map((record) => record.slug));
}
