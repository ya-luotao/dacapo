import { describe, expect, it } from 'vitest';
import { EXTRAS, LESSONS } from '../learn/lessons.ts';
import {
  doneSlugs,
  isDoneAt,
  isLessonSlug,
  legacyLessons,
  lessonsToWrite,
  mergeLessons,
  replacesLesson,
  type LessonDone,
} from './lessonRecords.ts';

const T = Date.UTC(2026, 9, 2, 9);
const tick = (slug: string, doneAt: number): LessonDone => ({ slug, doneAt });

describe('a lesson finished', () => {
  it('is named by a slug: every lesson’s and every extra’s is one', () => {
    for (const lesson of [...LESSONS, ...EXTRAS]) {
      expect(isLessonSlug(lesson.slug), lesson.slug).toBe(true);
    }
    // One of a later build is a slug too: its shape is checked, not whether it is known here.
    expect(isLessonSlug('counterpoint-2')).toBe(true);
    for (const bad of ['', 'Staff', 'a b', 'a,b', '-staff', 'x'.repeat(65), 5, null, undefined]) {
      expect(isLessonSlug(bad), String(bad)).toBe(false);
    }
    expect(isLessonSlug('x'.repeat(64))).toBe(true);
  });

  it('has a time, or 0 for one from before ticks had a time', () => {
    for (const good of [0, 1, T, T + 0.5]) expect(isDoneAt(good)).toBe(true);
    for (const bad of [-1, NaN, Infinity, -Infinity, '5', null, undefined, {}]) {
      expect(isDoneAt(bad), JSON.stringify(bad)).toBe(false);
    }
  });

  it('gives way only to an earlier copy: a tick is never moved later', () => {
    expect(replacesLesson(tick('staff', T), undefined)).toBe(true);
    expect(replacesLesson(tick('staff', T), tick('staff', T + 1))).toBe(true);
    expect(replacesLesson(tick('staff', T), tick('staff', T))).toBe(false);
    expect(replacesLesson(tick('staff', T + 1), tick('staff', T))).toBe(false);
    // No time is before anything else, and nothing is before it.
    expect(replacesLesson(tick('staff', 0), tick('staff', T))).toBe(true);
    expect(replacesLesson(tick('staff', T), tick('staff', 0))).toBe(false);
    expect(replacesLesson(tick('staff', 0), tick('staff', 0))).toBe(false);
  });
});

describe('merging two sets of ticks', () => {
  const here = [tick('keyboard', 0), tick('landmarks', T), tick('staff', T + 500)];
  const there = [
    tick('keyboard', T + 100),
    tick('staff', T + 100),
    tick('landmarks', T + 100),
    tick('rhythm', T + 100),
    tick('lesson-of-a-later-build', T),
  ];

  it('is their union, the earlier time kept, by slug', () => {
    const merged = [
      tick('keyboard', 0),
      tick('landmarks', T),
      tick('lesson-of-a-later-build', T),
      tick('rhythm', T + 100),
      tick('staff', T + 100),
    ];
    expect(mergeLessons(here, there)).toEqual(merged);
    // The same whichever side is merged into the other, and however often.
    expect(mergeLessons(there, here)).toEqual(merged);
    expect(mergeLessons(merged, there)).toEqual(merged);
    expect(mergeLessons(mergeLessons(here, there), here)).toEqual(merged);
    // Nothing is ever taken away.
    expect(mergeLessons(here, [])).toEqual(here);
    expect(mergeLessons([], [])).toEqual([]);
  });

  it('writes only what changes the stored records, each lesson once', () => {
    const stored = (slug: string) => here.find((record) => record.slug === slug);
    expect(lessonsToWrite(there, stored)).toEqual([
      tick('staff', T + 100),
      tick('rhythm', T + 100),
      tick('lesson-of-a-later-build', T),
    ]);
    expect(lessonsToWrite(here, stored)).toEqual([]);
    // Several copies of one lesson: the earliest of them, if it changes anything.
    expect(
      lessonsToWrite(
        [tick('staff', T + 300), tick('staff', T + 200), tick('staff', T + 400)],
        stored,
      ),
    ).toEqual([tick('staff', T + 200)]);
    expect(lessonsToWrite([tick('staff', T + 900), tick('staff', T + 600)], stored)).toEqual([]);
  });

  it('gives the slugs ticked', () => {
    expect([...doneSlugs(here)].sort()).toEqual(['keyboard', 'landmarks', 'staff']);
    expect(doneSlugs([]).size).toBe(0);
  });
});

describe('the ticks an earlier version kept in the preferences', () => {
  it('are read as records without a time', () => {
    expect(legacyLessons('staff,keyboard,rhythm-2,inside')).toEqual([
      tick('inside', 0),
      tick('keyboard', 0),
      tick('rhythm-2', 0),
      tick('staff', 0),
    ]);
  });

  it('are none when there is no preference, and leave out what is not a slug', () => {
    expect(legacyLessons(null)).toEqual([]);
    expect(legacyLessons('')).toEqual([]);
    expect(legacyLessons(',staff,,staff,Not A Slug,{"a":1}')).toEqual([tick('staff', 0)]);
  });
});
