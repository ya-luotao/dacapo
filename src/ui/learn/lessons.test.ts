import { describe, expect, it } from 'vitest';
import { lessonLanguage, LESSONS, neighbours } from '../../learn/lessons.ts';
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

  it('are read in Simplified Chinese only in zh-CN, and in English otherwise', () => {
    expect(lessonLanguage('zh-CN')).toBe('zh-CN');
    for (const locale of ['en', 'zh-TW', 'ja', 'ko'] as const) {
      expect(lessonLanguage(locale)).toBe('en');
    }
  });

  it('lead from one written lesson to the next', () => {
    expect(neighbours('keyboard')).toMatchObject({ previous: undefined, next: { slug: 'staff' } });
    expect(neighbours('staff').previous?.slug).toBe('keyboard');
    expect(neighbours('posture')).toMatchObject({ next: undefined });
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
