import { useId, useState, type PointerEvent } from 'react';
import { addDays, type DayKey } from '../../core/streak.ts';
import { useT } from '../../i18n/index.ts';
import { useLogFormat } from '../progress/format.ts';

// One scale over the last 30 days: the median timing spread of each day it was played, lower is
// more even, with the professional pianists' figure as a reference line. One series, so no
// legend: the caption says what is plotted. The same days are listed in a table.

const WIDTH = 640;
const LEFT = 44;
const RIGHT = 12;
const TOP = 12;
const PLOT = 110;
const HEIGHT = TOP + PLOT + 22;
const DOT_R = 4;
/** Professional pianists measure about 8–9 ms at eight notes a second (docs/SCALES.md). */
export const REFERENCE_MS = 9;
export const TREND_SPAN_DAYS = 30;

export interface TrendDay {
  day: DayKey;
  /** Median spread of the day's runs, ms. */
  spread: number;
  runs: number;
}

export function TrendChart({ days, today }: { days: readonly TrendDay[]; today: DayKey }) {
  const t = useT();
  const format = useLogFormat();
  const id = useId();
  const [hover, setHover] = useState<{ day: TrendDay; x: number } | null>(null);
  const first = addDays(today, -(TREND_SPAN_DAYS - 1));
  const shown = days.filter((d) => d.day >= first && d.day <= today);
  const top = Math.max(40, Math.ceil(Math.max(0, ...shown.map((d) => d.spread)) / 10) * 10);
  const ticks = [0, top / 2, top];
  const indexOf = (day: DayKey) => {
    let n = 0;
    for (let d = first; d < day && n < TREND_SPAN_DAYS; d = addDays(d, 1)) n++;
    return n;
  };
  const x = (day: DayKey) => LEFT + (indexOf(day) / (TREND_SPAN_DAYS - 1)) * (WIDTH - LEFT - RIGHT);
  const y = (ms: number) => TOP + (1 - Math.min(ms, top) / top) * PLOT;
  const points = shown.map((d) => ({ d, cx: x(d.day), cy: y(d.spread) }));
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.cx} ${p.cy}`).join(' ');

  function onPointer(e: PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * WIDTH;
    let best: (typeof points)[number] | null = null;
    for (const p of points) if (!best || Math.abs(p.cx - px) < Math.abs(best.cx - px)) best = p;
    if (!best || Math.abs(best.cx - px) > 24) setHover(null);
    else setHover({ day: best.d, x: (best.cx / WIDTH) * 100 });
  }

  const label = (d: TrendDay) =>
    t('scales.trend.point', {
      day: format.longDay(d.day),
      ms: Math.round(d.spread),
      runs:
        d.runs === 1
          ? t('progress.session.runs.one')
          : t('progress.session.runs.other', { n: d.runs }),
    });

  return (
    <figure className="deviation scale-trend">
      <figcaption id={`${id}-title`}>{t('scales.trend')}</figcaption>
      <div className="deviation-frame">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-desc`}
          onPointerMove={onPointer}
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map((ms) => (
            <g key={ms} className={ms === 0 ? 'deviation-zero' : 'deviation-grid'}>
              <line
                className="scale-trend-grid"
                x1={LEFT}
                x2={WIDTH - RIGHT}
                y1={y(ms)}
                y2={y(ms)}
              />
              <text x={LEFT - 6} y={y(ms)} dy="0.32em" textAnchor="end">
                {ms}
              </text>
            </g>
          ))}
          <g className="scale-trend-reference">
            <line x1={LEFT} x2={WIDTH - RIGHT} y1={y(REFERENCE_MS)} y2={y(REFERENCE_MS)} />
            {/* On the left: the latest days, on the right, are where the dots are. */}
            <text x={LEFT + 4} y={y(REFERENCE_MS) - 4}>
              {t('scales.trend.reference', { ms: REFERENCE_MS })}
            </text>
          </g>
          {points.length > 1 && <path className="scale-trend-line" d={path} />}
          {points.map(({ d, cx, cy }) => (
            <circle
              key={d.day}
              className={hover?.day === d ? 'deviation-dot is-hover' : 'deviation-dot'}
              cx={cx}
              cy={cy}
              r={DOT_R}
            />
          ))}
          <text className="deviation-word" x={LEFT} y={HEIGHT - 4}>
            {format.shortDay(first)}
          </text>
          <text className="deviation-word" x={WIDTH - RIGHT} y={HEIGHT - 4} textAnchor="end">
            {t('progress.history.today')}
          </text>
        </svg>
        {hover && (
          <p className="deviation-tip" style={{ left: `${hover.x}%` }} aria-hidden="true">
            {label(hover.day)}
          </p>
        )}
      </div>
      <p id={`${id}-desc`} className="help">
        {t('scales.trend.desc')}
      </p>
      <details className="history-details">
        <summary>{t('scales.table')}</summary>
        <table className="history-table">
          <thead>
            <tr>
              <th scope="col">{t('progress.history.day')}</th>
              <th scope="col">{t('scales.result.spread')}</th>
              <th scope="col">{t('progress.session.runs')}</th>
            </tr>
          </thead>
          <tbody>
            {[...shown].reverse().map((d) => (
              <tr key={d.day}>
                <th scope="row">{format.longDay(d.day)}</th>
                <td>{t('scales.result.ms', { ms: Math.round(d.spread) })}</td>
                <td>{d.runs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
