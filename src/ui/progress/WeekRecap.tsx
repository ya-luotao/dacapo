import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { weekRecaps, type WeekRecap as Recap } from '../../core/recap.ts';
import type { DayKey } from '../../core/streak.ts';
import { FIRST_DAY, useI18n } from '../../i18n/index.ts';
import { useRouteSearch } from '../hashRoute.ts';
import { readStartPref } from '../start/prefs.ts';
import { useLessonTicks } from '../today/lessonTicks.ts';
import { useTodayRecords } from '../today/useTodayRecords.ts';
import { useLogFormat } from './format.ts';
import { useRecapFormat } from './recapFormat.ts';

/**
 * Last week, with this week so far beside it (docs/PERSONAL.md, "Your week"): the days practised
 * and the time, then what happened, the most telling first. Facts from the records, not trends:
 * "How you are doing", below, has those.
 */
export function WeekRecap({ today }: { today: DayKey }) {
  const { t, locale } = useI18n();
  const records = useTodayRecords();
  const lessons = useLessonTicks();
  // Where the visitor said they start from (docs/START.md): a player has every practice open.
  const [start] = useState(readStartPref);
  const recaps = useMemo(
    () =>
      records ? weekRecaps(records, { today, firstDay: FIRST_DAY[locale], lessons, start }) : null,
    [records, today, locale, lessons, start],
  );

  // Come from the home page's line: the page opens on this section, once it is laid out.
  const section = useRef<HTMLDivElement>(null);
  const asked = new URLSearchParams(useRouteSearch()).get('show') === 'week';
  const ready = recaps !== null;
  useEffect(() => {
    if (asked && ready) section.current?.scrollIntoView({ block: 'start' });
  }, [asked, ready]);

  return (
    <div ref={section} className="recap">
      {!recaps ? (
        <p className="muted recap-waiting" role="status">
          {t('storage.loading')}
        </p>
      ) : (
        <>
          {recaps.last && (
            <Week
              title={t('progress.week.last')}
              empty={t('progress.week.empty.last')}
              recap={recaps.last}
            />
          )}
          <Week
            title={t('progress.week.current')}
            empty={t('progress.week.empty.current')}
            recap={recaps.current}
          />
        </>
      )}
    </div>
  );
}

/** One week: its days, its figures, and a row for each thing that happened. */
function Week({ title, empty, recap }: { title: string; empty: string; recap: Recap }) {
  const { t } = useI18n();
  const id = useId();
  const log = useLogFormat();
  const format = useRecapFormat();
  const of = (n: number, days: number) => t('progress.week.days.of', { n, of: days });
  const before = (value: string) => <small>{t('progress.week.before', { value })}</small>;

  return (
    <section className="recap-week" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{title}</h2>
      <p className="help">{format.range(recap)}</p>
      {recap.practised === 0 && recap.lines.length === 0 ? (
        <p className="recap-empty">{empty}</p>
      ) : (
        <ul className="recap-rows">
          <li>
            <span className="recap-what">{t('progress.week.days')}</span>
            <span className="recap-figure">
              {of(recap.practised, recap.days)}
              {recap.before && before(of(recap.before.practised, 7))}
            </span>
          </li>
          <li>
            <span className="recap-what">{t('progress.week.time')}</span>
            <span className="recap-figure">
              {log.time(recap.ms)}
              {recap.before && before(log.time(recap.before.ms))}
            </span>
          </li>
          {recap.lines.map((line) => (
            <li key={line.kind}>
              <span className="recap-what">{format.headline(line)}</span>
              <span className="recap-names">
                {format.names(line).map((name, i) => (
                  <span key={i}>{name}</span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
