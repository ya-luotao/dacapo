import { useId, useMemo } from 'react';
import type { Answer } from '../../../core/answers.ts';
import type { SessionRecord } from '../../../core/log.ts';
import type { Attempt } from '../../../core/session.ts';
import type { DayKey } from '../../../core/streak.ts';
import {
  createDayOf,
  earliestInstant,
  MIN_WEEKS,
  TREND_PRACTICES,
  trends,
  trendWeekStarts,
  type Trend,
} from '../../../core/trends.ts';
import { FIRST_DAY, useI18n } from '../../../i18n/index.ts';
import { TrendCard } from './TrendCard.tsx';
import { useTrendRecords } from './useTrendRecords.ts';

/**
 * Q1: how you are doing, practice by practice, over the last 26 weeks (docs/PROGRESS.md). A
 * practice with enough weeks has a chart; one practised too little has a line saying what would
 * bring it in; one not practised in these weeks is not named.
 */
export function Trends({
  sessions,
  attempts,
  answers,
  today,
}: {
  sessions: readonly SessionRecord[];
  attempts: readonly Attempt[];
  answers: readonly Answer[];
  today: DayKey;
}) {
  const { t, locale } = useI18n();
  const id = useId();
  const firstDay = FIRST_DAY[locale];
  const since = useMemo(
    () => earliestInstant(trendWeekStarts(today, firstDay)[0]!),
    [today, firstDay],
  );
  const { loaded, failed } = useTrendRecords(sessions, since);
  const all = useMemo(
    () =>
      trends({ attempts, answers, sessions, loaded }, { today, firstDay, dayOf: createDayOf() }),
    [attempts, answers, sessions, loaded, today, firstDay],
  );

  const list = TREND_PRACTICES.map((p) => all[p]);
  const shown = list.filter((trend): trend is Trend => trend !== null && trend.shown);
  const few = list.filter((trend): trend is Trend => trend !== null && !trend.shown && trend.any);
  const pending = !failed && list.some((trend) => trend === null);

  return (
    <section className="trends" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{t('trends.title')}</h2>
      <p className="help trends-intro">{t('trends.intro', { weeks: MIN_WEEKS })}</p>
      {shown.length > 0 && (
        <div className="trends-grid">
          {shown.map((trend) => (
            <TrendCard key={trend.practice} trend={trend} />
          ))}
        </div>
      )}
      {(few.length > 0 || pending || failed) && (
        <ul className="trends-few">
          {few.map((trend) => (
            <li key={trend.practice}>
              <strong>
                {t('trends.few.practice', {
                  practice: t(`trends.practice.${trend.practice}`),
                })}
              </strong>
              {t('trends.few', {
                counted: trend.counted,
                weeks: MIN_WEEKS,
                minimum: t(`trends.minimum.${trend.practice}`, { n: trend.rule.minimum }),
                n: trend.thisWeek,
              })}
            </li>
          ))}
          {pending && (
            <li className="muted" role="status">
              {t('trends.loading')}
            </li>
          )}
          {failed && <li>{t('trends.failed')}</li>}
        </ul>
      )}
      {shown.length === 0 && few.length === 0 && !pending && !failed && (
        <p className="muted">{t('trends.none')}</p>
      )}
    </section>
  );
}
