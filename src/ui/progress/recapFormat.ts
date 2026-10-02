import { useMemo } from 'react';
import { isLevelFamily } from '../../core/assignments.ts';
import type { RecapLine, RecapPractice, WeekSpan } from '../../core/recap.ts';
import type { DayKey } from '../../core/streak.ts';
import { useI18n } from '../../i18n/index.ts';
import { lessonBySlug, lessonLanguage } from '../../learn/lessons.ts';
import { useTodayFormat } from '../today/format.ts';
import { useLogFormat } from './format.ts';

/**
 * The way to the recap from elsewhere: Progress, with the setting that opens it on the week
 * (`WeekRecap` reads it, as a practice page reads its settings from the route).
 */
export const WEEK_ROUTE = '/progress?show=week';

/** A `YYYY-MM-DD` key as a UTC instant, to be formatted in UTC so the calendar date never shifts. */
function dayInstant(day: DayKey): number {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y!, m! - 1, d);
}

/**
 * A week's recap in words (docs/PERSONAL.md, "Your week"): what each line says in a few words,
 * and what it names. One place, so Progress and the home page's line say the same. Practices,
 * levels, scales and pieces are named as today's plan names them.
 */
export function useRecapFormat() {
  const { t, locale } = useI18n();
  const log = useLogFormat();
  const today = useTodayFormat();

  return useMemo(() => {
    const days = new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
    const piece = (id: string) => today.pieceTitle(id) ?? t('pieces.untitled');
    const item = (name: string, what: string) => t('progress.week.item', { name, what });

    /** A practice by the name its page gives it; free play and Improvise as the log names them. */
    const practice = (p: RecapPractice): string => {
      if (isLevelFamily(p)) return today.family(p);
      if (p === 'scales') return t('nav.scales');
      if (p === 'pieces') return t('nav.pieces');
      return t(p === 'free' ? 'progress.kind.free' : 'progress.kind.improv');
    };

    /**
     * What a line says in a few words: how many of what, for the lines about what happened ("2
     * levels mastered"), and what the line is about for the two about where the time went.
     */
    const headline = (line: RecapLine): string => {
      const count = (n: number) =>
        n === 1
          ? t(`progress.week.${line.kind as 'lessons'}.one`)
          : t(`progress.week.${line.kind as 'lessons'}.other`, { n });
      switch (line.kind) {
        case 'lessons':
          return count(line.lessons.length);
        case 'levels':
          return count(line.levels.length);
        case 'tunes':
          return count(line.tunes.length);
        case 'reviewIn':
        case 'reviewUp':
        case 'reviewBack':
        case 'tempo':
          return count(line.pieces.length);
        case 'scales':
          return count(line.exercises.length);
        case 'most':
          return t('progress.week.most');
        case 'none':
          return t('progress.week.none');
      }
    };

    /** What a line names, one of them to a row: the levels, the pieces, the scales. */
    const names = (line: RecapLine): string[] => {
      switch (line.kind) {
        case 'lessons':
          return line.lessons.map(
            (slug) => lessonBySlug(slug)?.title[lessonLanguage(locale)] ?? slug,
          );
        case 'levels':
          return line.levels.map((l) =>
            item(today.family(l.family), today.level(l.family, l.level)),
          );
        case 'tunes':
          return line.tunes.map((tune) => today.level('tune', tune));
        case 'reviewIn':
          return line.pieces.map(piece);
        case 'reviewUp':
        case 'reviewBack':
          return line.pieces.map((p) =>
            item(
              piece(p.id),
              p.interval === 1
                ? t('progress.week.interval.one')
                : t('progress.week.interval.other', { n: p.interval }),
            ),
          );
        case 'tempo':
          return line.pieces.map((p) => {
            const what = t('pieces.progress.ladder', {
              tempo: t('pieces.tempo.percent', { percent: p.tempo }),
            });
            // The hands are named when it was one of them: the piece is played with both.
            return p.hands === 'both'
              ? item(piece(p.id), what)
              : t('progress.week.item.hands', {
                  name: piece(p.id),
                  hands: t(`pieces.progress.hands.${p.hands}`),
                  what,
                });
          });
        case 'scales':
          return line.exercises.map(today.exercise);
        case 'most':
          return [item(practice(line.practice), log.time(line.ms))];
        case 'none':
          return [practice(line.practice)];
      }
    };

    return {
      headline,
      names,
      /** The days of a week, as the language writes a span of days: "Sep 20 – 26". */
      range: ({ start, end }: Pick<WeekSpan, 'start' | 'end'>): string =>
        start === end
          ? days.format(dayInstant(start))
          : days.formatRange(dayInstant(start), dayInstant(end)),
    };
  }, [t, locale, log, today]);
}

export type RecapFormat = ReturnType<typeof useRecapFormat>;
