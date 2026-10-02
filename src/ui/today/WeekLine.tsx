import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { lastWeekRecap } from '../../core/recap.ts';
import type { DayKey } from '../../core/streak.ts';
import type { TodayRecords } from '../../core/today.ts';
import { FIRST_DAY, useI18n } from '../../i18n/index.ts';
import { useLogFormat } from '../progress/format.ts';
import { useRecapFormat, WEEK_ROUTE } from '../progress/recapFormat.ts';
import { readStartPref } from '../start/prefs.ts';
import { useLessonTicks } from './lessonTicks.ts';

/** The lines about where the time went are Progress's: the home page names what happened. */
const TIME_KINDS = ['most', 'none'];

/**
 * The week that ended in one line, on the first days of a new week (docs/PERSONAL.md, "Your
 * week"): "Last week: 5 days, 1 h 40 min, 2 levels mastered", leading to Progress. It keeps its
 * room when there is nothing to say (no practice last week), so the plan under it stays put.
 * Loaded with the plan's rows: a week's recap takes every practice's mastery rule.
 */
export function WeekLine({ records, today }: { records: TodayRecords; today: DayKey }) {
  const { t, locale } = useI18n();
  const log = useLogFormat();
  const format = useRecapFormat();
  const lessons = useLessonTicks();
  const [start] = useState(readStartPref);
  const recap = useMemo(
    () => lastWeekRecap(records, { today, firstDay: FIRST_DAY[locale], lessons, start }),
    [records, today, locale, lessons, start],
  );

  if (recap === null || (recap.practised === 0 && recap.lines.length === 0)) {
    return <p className="today-week" />;
  }
  const first = recap.lines[0];
  const facts = [
    log.days(recap.practised),
    log.time(recap.ms),
    ...(first && !TIME_KINDS.includes(first.kind) ? [format.headline(first)] : []),
  ].join(t('app.listSeparator'));
  return (
    <p className="today-week">
      <Link href={WEEK_ROUTE}>{t('progress.week.home', { facts })}</Link>
    </p>
  );
}
