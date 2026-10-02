import { describe, expect, it } from 'vitest';
import { lessonLinks } from '../../core/lessonLinks.ts';
import {
  EXTRAS,
  LESSON_LANGUAGES,
  lessonLanguage,
  LESSONS,
  neighbours,
} from '../../learn/lessons.ts';
import { NAV_ITEMS } from '../routes.ts';
import { practiceLinkPath } from '../startParams.ts';
import { LESSON_WORDS, type LessonCopyKey } from './lesson.ts';
import { LESSON_TEXTS } from './lessons/index.ts';

/** The languages the lessons are written in, in the order of their names. */
const WRITTEN = ['en', 'zh-CN', 'zh-TW'];

/** The lessons and extras that are written: the ones that can be opened. */
const WRITTEN_SLUGS = [...LESSONS, ...EXTRAS].filter((l) => l.ready).map((l) => l.slug);

/** Every lesson's text as it is written, by its file. */
const FILES = import.meta.glob<string>('./lessons/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
});

// The characters the zh-TW dictionary's test looks for (i18n.test.ts): Simplified forms that
// Traditional text never has.
const SIMPLIFIED = /[们这设说时见对开关页机录键识谱乐数网络导览显练习节弹钢从择载处该让传响还]/u;

describe('the lessons', () => {
  it('have unique slugs', () => {
    const slugs = LESSONS.map((lesson) => lesson.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('have a text in every language for every lesson that can be opened, and none for the rest', () => {
    for (const lesson of LESSONS) {
      if (lesson.ready) {
        expect(Object.keys(LESSON_TEXTS[lesson.slug] ?? {}).sort(), lesson.slug).toEqual(WRITTEN);
      } else {
        expect(LESSON_TEXTS[lesson.slug], lesson.slug).toBeUndefined();
      }
    }
  });

  it('have their extras written in every language, apart from the lessons', () => {
    for (const extra of EXTRAS) {
      expect(Object.keys(LESSON_TEXTS[extra.slug] ?? {}).sort(), extra.slug).toEqual(WRITTEN);
      expect(LESSONS.some((l) => l.slug === extra.slug)).toBe(false);
      expect(neighbours(extra.slug)).toEqual({});
    }
  });

  it('are read in each Chinese by its own readers, and in English otherwise', () => {
    expect(lessonLanguage('zh-CN')).toBe('zh-CN');
    expect(lessonLanguage('zh-TW')).toBe('zh-TW');
    for (const locale of ['en', 'ja', 'ko'] as const) {
      expect(lessonLanguage(locale)).toBe('en');
    }
  });

  it('are written in English and in both Chinese: a file, a title and a summary for every slug', () => {
    expect([...LESSON_LANGUAGES].sort()).toEqual(WRITTEN);
    // Every file of the folder is the text of a lesson that can be opened, in one of the
    // languages, and none is missing; a planned lesson has a title and a summary, and no text.
    expect(Object.keys(FILES).sort()).toEqual(
      WRITTEN_SLUGS.flatMap((slug) =>
        WRITTEN.map((language) => `./lessons/${slug}.${language}.tsx`),
      ).sort(),
    );
    for (const lesson of [...LESSONS, ...EXTRAS]) {
      for (const text of [lesson.title, lesson.summary]) {
        expect(Object.keys(text).sort(), lesson.slug).toEqual(WRITTEN);
        for (const language of LESSON_LANGUAGES) {
          expect(text[language].trim(), `${lesson.slug} ${language}`).not.toBe('');
        }
      }
      // Each Chinese in its own characters: no title or summary is left as the other's.
      expect(lesson.title['zh-TW'], lesson.slug).not.toMatch(SIMPLIFIED);
      expect(lesson.summary['zh-TW'], lesson.slug).not.toMatch(SIMPLIFIED);
      expect(lesson.summary['zh-TW'], lesson.slug).not.toBe(lesson.summary['zh-CN']);
    }
  });

  it('have Taiwan’s text in Traditional characters, with 「」 for quotes', () => {
    const texts = Object.entries(FILES).filter(([path]) => path.endsWith('.zh-TW.tsx'));
    expect(texts).toHaveLength(WRITTEN_SLUGS.length);
    for (const [path, text] of texts) {
      expect(text.match(SIMPLIFIED), path).toBeNull();
      expect(text.match(/[“”‘’]/u), path).toBeNull();
    }
  });

  it('give the figures the same words in every language: the same keys and placeholders', () => {
    expect(Object.keys(LESSON_WORDS).sort()).toEqual(WRITTEN);
    const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const language of LESSON_LANGUAGES) {
      const words = LESSON_WORDS[language];
      expect(Object.keys(words), language).toEqual(Object.keys(LESSON_WORDS.en));
      for (const [key, value] of Object.entries(LESSON_WORDS.en)) {
        const word = words[key as LessonCopyKey];
        expect(word.trim(), `${language} ${key}`).not.toBe('');
        expect(placeholders(word), `${language} ${key}`).toEqual(placeholders(value));
      }
    }
    for (const word of Object.values(LESSON_WORDS['zh-TW'])) {
      expect(word).not.toMatch(SIMPLIFIED);
      expect(word).not.toMatch(/[“”]/u);
    }
  });

  it('lead from one written lesson to the next', () => {
    expect(neighbours('keyboard')).toMatchObject({ previous: undefined, next: { slug: 'staff' } });
    expect(neighbours('staff').previous?.slug).toBe('keyboard');
    expect(neighbours('posture').next?.slug).toBe('rhythm-2');
    expect(neighbours('rhythm-2').next?.slug).toBe('minor-keys');
    expect(neighbours('minor-keys').next?.slug).toBe('dynamics');
    expect(neighbours('dynamics').next?.slug).toBe('pedals');
    expect(neighbours('pedals').next?.slug).toBe('ornaments');
    expect(neighbours('ornaments').next?.slug).toBe('chords');
    expect(neighbours('chords').next?.slug).toBe('practising');
    expect(neighbours('practising').next?.slug).toBe('styles');
    expect(neighbours('styles')).toMatchObject({
      previous: { slug: 'practising' },
      next: undefined,
    });
    expect(neighbours('unknown')).toEqual({});
  });

  it('each say where to practise: one place or two, each on a page the app has', () => {
    for (const lesson of [...LESSONS.filter((l) => l.ready), ...EXTRAS]) {
      expect([1, 2], lesson.slug).toContain(lesson.practice.length);
      // Before a link is resolved (and when what it names is not there) it leads to its page.
      for (const link of lessonLinks(lesson.practice, null)) {
        expect(link.kind, lesson.slug).toBe('page');
        expect(
          NAV_ITEMS.map((item) => item.path),
          lesson.slug,
        ).toContain(practiceLinkPath(link));
      }
    }
  });
});
