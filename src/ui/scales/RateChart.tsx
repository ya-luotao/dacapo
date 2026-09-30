import { useId } from 'react';
import type { TrillFigures } from '../../core/trill.ts';
import { useI18n } from '../../i18n/index.ts';

// A trill's rate over time: notes a second, a window of intervals at a time, from the first key
// on, with the fitted line from its start to its end. One series, so no legend: the caption says
// what is plotted. The same windows are listed in a table.

const WIDTH = 640;
const LEFT = 44;
const RIGHT = 12;
const TOP = 12;
const PLOT = 90;
const HEIGHT = TOP + PLOT + 22;
const DOT_R = 3.5;

export function RateChart({ trill, caption }: { trill: TrillFigures; caption?: string }) {
  const { t, locale } = useI18n();
  const id = useId();
  const tenth = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });
  const rates = trill.rates;
  if (rates.length < 2) return null;
  const top = Math.max(4, Math.ceil(Math.max(...rates.map((r) => r.rate)) / 2) * 2);
  const end = Math.max(...rates.map((r) => r.at));
  const x = (at: number) => LEFT + (at / Math.max(end, 0.001)) * (WIDTH - LEFT - RIGHT);
  const y = (rate: number) => TOP + (1 - Math.min(rate, top) / top) * PLOT;
  const ticks = [0, top / 2, top];
  const path = rates.map((r, i) => `${i === 0 ? 'M' : 'L'}${x(r.at)} ${y(r.rate)}`).join(' ');
  const perSecond = (n: number) => t('scales.result.perSecond', { n: tenth.format(n) });

  return (
    <figure className="deviation scale-rate">
      <figcaption id={`${id}-title`}>{caption ?? t('scales.trill.chart')}</figcaption>
      <div className="deviation-frame">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-desc`}
        >
          {ticks.map((n) => (
            <g key={n} className={n === 0 ? 'deviation-zero' : 'deviation-grid'}>
              <line className="scale-trend-grid" x1={LEFT} x2={WIDTH - RIGHT} y1={y(n)} y2={y(n)} />
              <text x={LEFT - 6} y={y(n)} dy="0.32em" textAnchor="end">
                {n}
              </text>
            </g>
          ))}
          {trill.startRate !== null && trill.endRate !== null && (
            <line
              className="scale-rate-fit"
              x1={x(rates[0]!.at)}
              x2={x(end)}
              y1={y(trill.startRate)}
              y2={y(trill.endRate)}
            />
          )}
          <path className="scale-trend-line" d={path} />
          {rates.map((r) => (
            <circle key={r.at} className="deviation-dot" cx={x(r.at)} cy={y(r.rate)} r={DOT_R} />
          ))}
          <text className="deviation-word" x={LEFT} y={HEIGHT - 4}>
            {t('scales.trill.seconds', { s: 0 })}
          </text>
          <text className="deviation-word" x={WIDTH - RIGHT} y={HEIGHT - 4} textAnchor="end">
            {t('scales.trill.seconds', { s: tenth.format(end) })}
          </text>
        </svg>
      </div>
      <p id={`${id}-desc`} className="help">
        {t('scales.trill.chart.desc')}
      </p>
      <details className="history-details">
        <summary>{t('scales.table')}</summary>
        <table className="history-table">
          <thead>
            <tr>
              <th scope="col">{t('scales.trill.table.at')}</th>
              <th scope="col">{t('scales.trill.rate')}</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((r) => (
              <tr key={r.at}>
                <th scope="row">{t('scales.trill.seconds', { s: tenth.format(r.at) })}</th>
                <td>{perSecond(r.rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
