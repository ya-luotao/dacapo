import { Fragment, useId, useState } from 'react';
import { goalSteps, type DayKey, type DayTotal } from '../../core/streak.ts';
import { useT } from '../../i18n/index.ts';
import { readPref, writePref } from '../../lib/localPrefs.ts';
import { useLogFormat } from './format.ts';
import { YearGrid } from './YearGrid.tsx';

const MINUTE_MS = 60_000;
const CHART_PREF = 'dacapo.progress.chart';

type Chart = 'bars' | 'year';
const CHARTS: readonly Chart[] = ['bars', 'year'];

/**
 * Practice per day: the last 30 days as bars, or the last year as a grid of weeks. `goal` is each
 * day's goal in ms: a day is judged by the goal it had (docs/PERSONAL.md).
 */
export function DayHistory({
  history,
  totals,
  today,
  goal,
}: {
  history: readonly DayTotal[];
  totals: ReadonlyMap<DayKey, number>;
  today: DayKey;
  goal: (day: DayKey) => number;
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
        <DayBars history={history} today={today} goal={goal} />
      ) : (
        <YearGrid totals={totals} today={today} goal={goal} />
      )}
    </section>
  );
}

/** Minutes per day as bars, with the same figures as a table for screen readers and keyboards. */
function DayBars({
  history,
  today,
  goal,
}: {
  history: readonly DayTotal[];
  today: DayKey;
  goal: (day: DayKey) => number;
}) {
  const t = useT();
  const format = useLogFormat();
  // The goal line: one level stretch per goal, so it steps on the day the goal was changed.
  const steps = goalSteps(history, goal);
  // The highest goal line sits at most halfway up, so short days still show as bars.
  const scale = Math.max(...steps.map((s) => s.goalMs * 2), ...history.map((d) => d.ms));
  const percent = (ms: number) => `${((ms / scale) * 100).toFixed(2)}%`;
  /** A share of the chart's width, in days. */
  const across = (days: number) => `${((days / history.length) * 100).toFixed(2)}%`;
  const reached = history.filter((d) => d.ms >= goal(d.day)).length;

  return (
    <>
      <div
        className="history-chart"
        role="img"
        aria-label={t('progress.history.label', { reached })}
      >
        {steps.map((step, i) => {
          const before = steps[i - 1];
          return (
            <Fragment key={step.start}>
              {before && (
                <div
                  className="history-goal-step"
                  style={{
                    insetInlineStart: across(step.start),
                    bottom: percent(Math.min(before.goalMs, step.goalMs)),
                    height: percent(Math.abs(step.goalMs - before.goalMs)),
                  }}
                />
              )}
              <div
                className="history-goal"
                style={{
                  bottom: percent(step.goalMs),
                  insetInlineStart: across(step.start),
                  insetInlineEnd: across(history.length - step.start - step.days),
                }}
              >
                {/* The margin names the goal of today; an earlier one is in the table. */}
                {i === steps.length - 1 && (
                  <span className="history-goal-label">{format.minutes(step.goalMs)}</span>
                )}
              </div>
            </Fragment>
          );
        })}
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
                ms >= goal(day)
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
                  {/* Where the goal changed within these days, each day names its own. */}
                  {steps.length > 1 && `${format.minutes(goal(day))} · `}
                  {ms >= goal(day)
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
