import { useMemo } from 'react';
import type { DayKey } from '../../core/streak.ts';
import { useI18n } from '../../i18n/index.ts';

const MINUTE_MS = 60_000;

/** A `YYYY-MM-DD` key as a UTC instant, to be formatted in UTC so the calendar date never shifts. */
function dayInstant(day: DayKey): number {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y!, m! - 1, d);
}

/** Locale-aware formatting for the practice log. */
export function useLogFormat() {
  const { t, locale } = useI18n();
  return useMemo(() => {
    const dateTime = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
    const shortDay = new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
    const longDay = new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
    const fullDay = new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
    const month = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' });
    const monthYear = new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    });
    const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
    return {
      /** Whole minutes, rounded down, so "5 min" always means the goal is reached. */
      minutes: (ms: number) => t('progress.minutes', { n: Math.floor(ms / MINUTE_MS) }),
      days: (n: number) => (n === 1 ? t('progress.days.one') : t('progress.days.other', { n })),
      /** A week's time, in hours and whole minutes: "45 min", "2 h", "1 h 40 min". */
      time: (ms: number) => {
        const minutes = Math.floor(ms / MINUTE_MS);
        const [h, m] = [Math.floor(minutes / 60), minutes % 60];
        if (h === 0) return t('progress.minutes', { n: m });
        return m === 0 ? t('progress.hours', { h }) : t('progress.hoursMinutes', { h, m });
      },
      duration: (ms: number) => {
        const seconds = Math.round(ms / 1000);
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return m === 0
          ? t('progress.duration.seconds', { s })
          : t('progress.duration.minutes', { m, s });
      },
      dateTime: (epochMs: number) => dateTime.format(epochMs),
      shortDay: (day: DayKey) => shortDay.format(dayInstant(day)),
      longDay: (day: DayKey) => longDay.format(dayInstant(day)),
      fullDay: (day: DayKey) => fullDay.format(dayInstant(day)),
      month: (day: DayKey) => month.format(dayInstant(day)),
      /** `YYYY-MM`, as in `MonthTotal`. */
      monthYear: (month: string) => monthYear.format(dayInstant(`${month}-01`)),
      weekday: (day: DayKey) => weekday.format(dayInstant(day)),
    };
  }, [t, locale]);
}

export type LogFormat = ReturnType<typeof useLogFormat>;
