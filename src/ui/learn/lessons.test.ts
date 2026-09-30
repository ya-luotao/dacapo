import { describe, expect, it } from 'vitest';
import { EXTRAS, lessonLanguage, LESSONS, neighbours } from '../../learn/lessons.ts';
import { NAV_ITEMS } from '../routes.ts';
import { LESSON_TEXTS } from './lessons/index.ts';

describe('the lessons', () => {
  it('have unique slugs', () => {
    const slugs = LESSONS.map((lesson) => lesson.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('have a text in both languages for every lesson that can be opened, and none for the rest', () => {
    for (const lesson of LESSONS) {
      if (lesson.ready) {
        expect(Object.keys(LESSON_TEXTS[lesson.slug] ?? {}).sort(), lesson.slug).toEqual([
          'en',
          'zh-CN',
        ]);
      } else {
        expect(LESSON_TEXTS[lesson.slug], lesson.slug).toBeUndefined();
      }
    }
  });

  it('have their extras written in both languages, apart from the lessons', () => {
    for (const extra of EXTRAS) {
      expect(Object.keys(LESSON_TEXTS[extra.slug] ?? {}).sort(), extra.slug).toEqual([
        'en',
        'zh-CN',
      ]);
      expect(LESSONS.some((l) => l.slug === extra.slug)).toBe(false);
      expect(neighbours(extra.slug)).toEqual({});
    }
  });

  it('are read in Simplified Chinese only in zh-CN, and in English otherwise', () => {
    expect(lessonLanguage('zh-CN')).toBe('zh-CN');
    for (const locale of ['en', 'zh-TW', 'ja', 'ko'] as const) {
      expect(lessonLanguage(locale)).toBe('en');
    }
  });

  it('lead from one written lesson to the next', () => {
    expect(neighbours('keyboard')).toMatchObject({ previous: undefined, next: { slug: 'staff' } });
    expect(neighbours('staff').previous?.slug).toBe('keyboard');
    expect(neighbours('posture').next?.slug).toBe('rhythm-2');
    expect(neighbours('rhythm-2').next?.slug).toBe('minor-keys');
    expect(neighbours('minor-keys').next?.slug).toBe('dynamics');
    expect(neighbours('dynamics').next?.slug).toBe('pedals');
    expect(neighbours('pedals')).toMatchObject({
      previous: { slug: 'dynamics' },
      next: undefined,
    });
    expect(neighbours('unknown')).toEqual({});
  });

  it('each say where to practise, on a page the app has', () => {
    for (const lesson of LESSONS.filter((l) => l.ready)) {
      expect(
        NAV_ITEMS.map((item) => item.path),
        lesson.slug,
      ).toContain(lesson.practice);
    }
  });
});
