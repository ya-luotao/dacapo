import { describe, expect, it } from 'vitest';
import { TEMPO_NAMES, tempoRange } from '../../core/tempoNames.ts';
import { EXTRAS, LESSON_LANGUAGES, lessonBySlug, LESSONS } from '../../learn/lessons.ts';
import { TERM_GROUPS, TERMS, termsOf } from '../../learn/terms.ts';
import type { TermTexts } from './terms/index.ts';

// The glossary (docs/GLOSSARY.md): its list, and the texts of its entries.

/** Each group's texts, by file. */
const TEXTS = import.meta.glob<TermTexts>('./terms/*.{en,zh-CN,zh-TW}.tsx', {
  import: 'default',
  eager: true,
});

/** The same files as written. */
const FILES = import.meta.glob<string>('./terms/*.{en,zh-CN,zh-TW}.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
});

// The characters the zh-TW dictionary's test looks for (i18n.test.ts).
const SIMPLIFIED = /[们这设说时见对开关页机录键识谱乐数网络导览显练习节弹钢从择载处该让传响还]/u;

describe('the glossary’s list', () => {
  it('has unique slugs, none of them a lesson’s', () => {
    const slugs = TERMS.map((term) => term.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(lessonBySlug(slug), slug).toBeUndefined();
  });

  it('has every group filled, and every term in a group', () => {
    for (const group of TERM_GROUPS) expect(termsOf(group.id).length, group.id).toBeGreaterThan(5);
    expect(TERM_GROUPS.flatMap((group) => termsOf(group.id))).toHaveLength(TERMS.length);
  });

  it('leads only to terms and lessons that are there, never to itself', () => {
    const slugs = new Set(TERMS.map((term) => term.slug));
    const lessons = new Set([...LESSONS, ...EXTRAS].filter((l) => l.ready).map((l) => l.slug));
    for (const term of TERMS) {
      expect(term.see.length, term.slug).toBeGreaterThan(0);
      for (const other of term.see) {
        expect(slugs.has(other), `${term.slug} → ${other}`).toBe(true);
        expect(other, term.slug).not.toBe(term.slug);
      }
      for (const lesson of term.lessons)
        expect(lessons.has(lesson), `${term.slug} → ${lesson}`).toBe(true);
    }
  });

  it('names and defines every term in every language, Taiwan’s in its own characters', () => {
    for (const term of TERMS) {
      for (const language of LESSON_LANGUAGES) {
        expect(term.title[language].length, term.slug).toBeGreaterThan(0);
        expect(term.summary[language], term.slug).toMatch(/[.。]$/u);
        if (term.also) expect(term.also[language].length, term.slug).toBeGreaterThan(0);
      }
      const taiwan = [term.title['zh-TW'], term.summary['zh-TW'], ...(term.also?.['zh-TW'] ?? [])];
      for (const text of taiwan) {
        expect(text, term.slug).not.toMatch(SIMPLIFIED);
        expect(text, term.slug).not.toMatch(/[“”]/u);
      }
    }
  });

  it('gives each tempo mark the metronome’s own range', () => {
    for (const name of TEMPO_NAMES) {
      const term = TERMS.find((t) => t.slug === name)!;
      const { from, to } = tempoRange(name);
      expect(term.summary.en, name).toContain(to === null ? `${from}` : `${from} to ${to}`);
    }
  });
});

describe('the glossary’s texts', () => {
  it('are written for a group in all three languages or in none, and only for its terms', () => {
    for (const group of TERM_GROUPS) {
      const slugs = termsOf(group.id).map((term) => term.slug);
      const written = LESSON_LANGUAGES.map((language) => {
        const texts = TEXTS[`./terms/${group.id}.${language}.tsx`];
        expect(texts, `${group.id}.${language}`).toBeDefined();
        for (const slug of Object.keys(texts!))
          expect(slugs, `${group.id}.${language}`).toContain(slug);
        return Object.keys(texts!).sort();
      });
      expect(written[1], group.id).toEqual(written[0]);
      expect(written[2], group.id).toEqual(written[0]);
      if (written[0]!.length > 0) expect(written[0], group.id).toEqual([...slugs].sort());
    }
  });

  it('are written for the intervals', () => {
    expect(Object.keys(TEXTS['./terms/intervals.en.tsx']!).sort()).toEqual(
      termsOf('intervals')
        .map((term) => term.slug)
        .sort(),
    );
  });

  it('are Taiwan’s in Traditional characters, with 「」 for quotes', () => {
    for (const [path, text] of Object.entries(FILES)) {
      if (!path.endsWith('.zh-TW.tsx')) continue;
      expect(text.match(SIMPLIFIED), path).toBeNull();
      expect(text.match(/[“”‘’]/u), path).toBeNull();
    }
  });
});
