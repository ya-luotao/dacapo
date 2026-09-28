import { useId, useState } from 'react';
import { STREAK_GOAL_MS, type DayKey, type DayTotal } from '../../core/streak.ts';
import { useT } from '../../i18n/index.ts';
import { readPref, writePref } from '../../lib/localPrefs.ts';
import { useLogFormat } from './format.ts';
import { YearGrid } from './YearGrid.tsx';

const MINUTE_MS = 60_000;
const CHART_PREF = 'dacapo.progress.chart';

type Chart = 'bars' | 'year';
const CHARTS: readonly Chart[] = ['bars', 'year'];

/** Practice per day: the last 30 days as bars, or the last year as a grid of weeks. */
export function DayHistory({
  history,
  totals,
  today,
}: {
  history: readonly DayTotal[];
  totals: ReadonlyMap<DayKey, number>;
  today: DayKey;
}) {
  const t = useT();
  const id = useId();
  const [chart, setChartState] = useState<Chart>(() =>
    readPref(CHART_PREF) === 'year' ? 'year' : 'bars',
  );
  const setChart = (next: Chart) => {
    setChartState(next);
    writePref(CHART_PREF, next === 'bars' ? null : next);
  };

  return (
    <section className="history" aria-labelledby={`${id}-title`}>
      <div className="history-head">
        <h2 id={`${id}-title`}>{chart === 'bars' ? t('progress.history') : t('progress.year')}</h2>
        <fieldset className="history-switch">
          <legend className="visually-hidden">{t('progress.chart')}</legend>
          <div className="segmented">
            {CHARTS.map((c) => (
              <label key={c}>
                <input
                  type="radio"
                  name={`${id}-chart`}
                  value={c}
                  checked={chart === c}
                  onChange={() => setChart(c)}
                />
                <span>{t(`progress.chart.${c}`)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      {chart === 'bars' ? (
        <DayBars history={history} today={today} />
      ) : (
        <YearGrid totals={totals} today={today} />
      )}
    </section>
  );
}

/** Minutes per day as bars, with the same figures as a table for screen readers and keyboards. */
function DayBars({ history, today }: { history: readonly DayTotal[]; today: DayKey }) {
  const t = useT();
  const format = useLogFormat();
  // The goal line sits at most halfway up, so short days still show as bars.
  const scale = Math.max(STREAK_GOAL_MS * 2, ...history.map((d) => d.ms));
  const percent = (ms: number) => `${((ms / scale) * 100).toFixed(2)}%`;
  const reached = history.filter((d) => d.ms >= STREAK_GOAL_MS).length;

  return (
    <>
      <div
        className="history-chart"
        role="img"
        aria-label={t('progress.history.label', { reached })}
      >
        <div className="history-goal" style={{ bottom: percent(STREAK_GOAL_MS) }}>
          <span className="history-goal-label">{format.minutes(STREAK_GOAL_MS)}</span>
        </div>
        {history.map(({ day, ms }) => (
          <div
            key={day}
            className="history-day"
            data-today={day === today || undefined}
            title={t('progress.history.bar', {
              day: format.longDay(day),
              minutes: format.minutes(ms),
            })}
          >
            <div
              className={
                ms >= STREAK_GOAL_MS
                  ? 'history-bar is-reached'
                  : ms > 0
                    ? 'history-bar is-some'
                    : 'history-bar'
              }
              style={{ height: percent(ms) }}
            />
          </div>
        ))}
      </div>
      <div className="history-axis" aria-hidden="true">
        <span>{history[0] ? format.shortDay(history[0].day) : ''}</span>
        <span>{t('progress.history.today')}</span>
      </div>
      <details className="history-details">
        <summary>{t('progress.history.table')}</summary>
        <table className="history-table">
          <thead>
            <tr>
              <th scope="col">{t('progress.history.day')}</th>
              <th scope="col">{t('progress.history.minutes')}</th>
              <th scope="col">{t('progress.history.goal')}</th>
            </tr>
          </thead>
          <tbody>
            {[...history].reverse().map(({ day, ms }) => (
              <tr key={day}>
                <th scope="row">
                  {format.longDay(day)}
                  {day === today && t('progress.history.todayMark')}
                </th>
                <td>{Math.floor(ms / MINUTE_MS)}</td>
                <td>
                  {ms >= STREAK_GOAL_MS
                    ? `✓ ${t('progress.history.reached')}`
                    : t('progress.history.notReached')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}
