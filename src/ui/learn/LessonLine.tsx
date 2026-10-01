import { useState } from 'react';
import { Link } from 'wouter';
import { lessonNumber, lessonToRead, type Practice } from '../../core/curriculum.ts';
import { SENTENCE_GAP, useI18n } from '../../i18n/index.ts';
import { lessonBySlug, lessonLanguage } from '../../learn/lessons.ts';
import { useStorageStatus } from '../practice/context.ts';
import { readStartPref } from '../start/prefs.ts';
import { useLessonsDone } from './progress.ts';

/**
 * One quiet line on a practice's setup for someone new to it (docs/LEARN.md, "A practice names
 * its lesson"): the lesson that opens the practice, as a link. It goes once that lesson is
 * ticked or the practice is `known` (a level of it mastered; for Scales five runs; for Pieces a
 * piece played to its end): someone who knows it is not told again. Nor is someone who said on
 * the start page that they play already (docs/START.md): every practice is open to them, and
 * the line is on none. Nothing until the records are read, and nothing for a practice no lesson
 * opens.
 */
export function LessonLine({ practice, known }: { practice: Practice; known: boolean }) {
  const { t, locale } = useI18n();
  const { loaded } = useStorageStatus();
  const lessonsDone = useLessonsDone();
  // Where the visitor said they start from, as it is when the page opens.
  const [start] = useState(readStartPref);
  const slug = loaded ? lessonToRead(practice, lessonsDone, known, start) : null;
  const lesson = slug === null ? undefined : lessonBySlug(slug);
  if (!lesson) return null;
  const language = lessonLanguage(locale);
  const gap = SENTENCE_GAP[locale];

  return (
    <p className="help lesson-line">
      {t('learn.new')}
      {gap}
      <Link href={`/learn/${lesson.slug}`}>
        {t('learn.new.lesson', { n: lessonNumber(lesson.slug), title: lesson.title[language] })}
      </Link>
      {/* The lessons are not written in this language: the line says so, as the Learn page does. */}
      {language === 'en' && locale !== 'en' && gap + t('learn.new.english')}
    </p>
  );
}
