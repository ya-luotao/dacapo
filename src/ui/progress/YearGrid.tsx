import { useLayoutEffect, useMemo, useRef } from 'react';
import {
  LEVEL_GOALS,
  monthStarts,
  monthTotals,
  practiceLevel,
  STREAK_GOAL_MS,
  weekday,
  yearGrid,
  type DayKey,
} from '../../core/streak.ts';
import { FIRST_DAY, useI18n } from '../../i18n/index.ts';
import { useLogFormat } from './format.ts';

const MINUTE_MS = 60_000;
/** Monday, Wednesday and Friday are labelled, wherever the week starts. */
const LABELLED_WEEKDAYS = [1, 3, 5];

/** A year of practice as a grid of weeks, each day shaded by how long it was practised. */
export function YearGrid({
  totals,
  today,
}: {
  totals: ReadonlyMap<DayKey, number>;
  today: DayKey;
}) {
  const { t, locale } = useI18n();
  const format = useLogFormat();
  const scroller = useRef<HTMLDivElement>(null);
  const columns = useMemo(
    () => yearGrid(totals, today, { firstDay: FIRST_DAY[locale] }),
    [totals, today, locale],
  );
  const days = useMemo(() => columns.flat().filter((d) => d !== null), [columns]);
  const months = useMemo(() => monthTotals(days), [days]);
  const labels = useMemo(() => monthStarts(columns), [columns]);
  const practised = days.filter((d) => d.ms > 0).length;
  const reached = days.filter((d) => d.ms >= STREAK_GOAL_MS).length;
  const goal = STREAK_GOAL_MS / MINUTE_MS;

  // On a narrow screen the grid scrolls; start at the end, where today is. Keyed on the day, not
  // the totals, which are recomputed every minute and would undo the reader's scrolling.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [today, locale]);

  return (
    <>
      <div
        ref={scroller}
        className="year-scroll"
        role="img"
        aria-label={t('progress.year.label', { practised, reached })}
        tabIndex={0}
      >
        <div className="year-grid">
          <span />
          {columns[0]!.map((d) => (
            <span key={d!.day} className="year-weekday">
              {LABELLED_WEEKDAYS.includes(weekday(d!.day)) ? format.weekday(d!.day) : ''}
            </span>
          ))}
          {columns.map((column, c) => {
            const label = labels.get(c);
            return [
              <span key={`m${c}`} className="year-month">
                {label ? format.month(label) : ''}
              </span>,
              ...column.map((d, r) =>
                d === null ? (
                  <span key={`${c}-${r}`} />
                ) : (
                  <span
                    key={d.day}
                    className="year-cell"
                    data-level={practiceLevel(d.ms)}
                    data-today={d.day === today || undefined}
                    title={t('progress.history.bar', {
                      day: format.fullDay(d.day),
                      minutes: format.minutes(d.ms),
                    })}
                  />
                ),
              ),
            ];
          })}
        </div>
      </div>
      <ul className="year-legend">
        <li>
          <span className="year-cell" data-level={0} aria-hidden="true" />
          {t('progress.year.none')}
        </li>
        <li>
          <span className="year-cell" data-level={1} aria-hidden="true" />
          {t('progress.year.under', { n: goal })}
        </li>
        {LEVEL_GOALS.map((times, i) => (
          <li key={times}>
            <span className="year-cell" data-level={i + 2} aria-hidden="true" />
            {t('progress.year.atLeast', { n: goal * times })}
          </li>
        ))}
      </ul>
      <details className="history-details">
        <summary>{t('progress.history.table')}</summary>
        <table className="history-table">
          <thead>
            <tr>
              <th scope="col">{t('progress.year.month')}</th>
              <th scope="col">{t('progress.year.practised')}</th>
              <th scope="col">{t('progress.year.reached')}</th>
              <th scope="col">{t('progress.history.minutes')}</th>
            </tr>
          </thead>
          <tbody>
            {[...months].reverse().map((m) => (
              <tr key={m.month}>
                <th scope="row">{format.monthYear(m.month)}</th>
                <td>{m.practised}</td>
                <td>{m.reached}</td>
                <td>{Math.floor(m.ms / MINUTE_MS)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}
