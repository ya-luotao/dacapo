import { useId, useState, type PointerEvent } from 'react';
import {
  COMPARE_WEEKS,
  TREND_WEEKS,
  type Trend,
  type TrendPractice,
  type TrendWeek,
} from '../../../core/trends.ts';
import { useT } from '../../../i18n/index.ts';
import { useLogFormat } from '../format.ts';
import { niceTicks } from './axis.ts';
import { useTrendFormat } from './format.ts';

// One practice over the last 26 weeks: a line through the counted weeks, the last four weeks
// shaded (the period the sentence compares), the sentence in words, the level mix where levels
// differ, and every week in a table. One series, so no legend: the caption says what is plotted,
// as on the scales' trend chart.

const WIDTH = 360;
/** The plot starts after the widest tick label, at least this far in. */
const MIN_LEFT = 32;
const RIGHT = 10;
const TOP = 10;
const PLOT = 96;
const HEIGHT = TOP + PLOT + 22;
const DOT_R = 3.5;

/** The least span of the axis, so a steady figure is drawn as steady. */
const MIN_SPAN: Record<TrendPractice, number> = {
  reading: 200,
  sight: 0.1,
  theory: 0.1,
  ear: 0.1,
  rhythmEar: 0.1,
  chords: 0.1,
  inTime: 10,
  scales: 2,
  pieces: 0.1,
};

/**
 * About how wide a tick label is at 11px, so the plot starts after it: `24 ms` is short, `24 毫秒`
 * and `24ミリ秒` are not (a wide character is about a square).
 */
const labelWidth = (text: string) =>
  [...text].reduce((w, ch) => w + (/[\u2e80-\uffef]/.test(ch) ? 11 : 6.2), 0);

export function TrendCard({ trend }: { trend: Trend }) {
  const t = useT();
  const log = useLogFormat();
  const format = useTrendFormat();
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const { practice, rule, weeks } = trend;

  const points = weeks.flatMap((w, i) =>
    w.counted && w.value !== null ? [{ week: w, i, value: w.value }] : [],
  );
  const values = points.map((p) => p.value);
  const ticks = niceTicks(Math.min(...values), Math.max(...values), {
    minSpan: MIN_SPAN[practice],
    ceiling: rule.figure === 'share' ? 1 : Infinity,
  });
  const labels = ticks.map((v) => format.tick(practice, v));
  const LEFT = Math.ceil(Math.max(MIN_LEFT, ...labels.map(labelWidth)) + 8);
  const x = (week: number) => LEFT + (week / (TREND_WEEKS - 1)) * (WIDTH - LEFT - RIGHT);
  const y = (v: number) => TOP + (1 - (v - ticks[0]) / (ticks[2] - ticks[0])) * PLOT;
  const path = points.map((p, k) => `${k === 0 ? 'M' : 'L'}${x(p.i)} ${y(p.value)}`).join(' ');
  const halfStep = (x(1) - x(0)) / 2;
  const bandFrom = x(TREND_WEEKS - COMPARE_WEEKS) - halfStep;

  function onPointer(e: PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * WIDTH;
    let best: (typeof points)[number] | null = null;
    for (const p of points) if (!best || Math.abs(x(p.i) - px) < Math.abs(x(best.i) - px)) best = p;
    setHover(best && Math.abs(x(best.i) - px) <= 24 ? best.i : null);
  }

  const pointLabel = (w: TrendWeek) =>
    t('trends.point', {
      week: log.shortDay(w.start),
      value: format.value(practice, w.value!),
      count: format.count(rule, w.count),
    });
  const hovered = hover === null ? null : weeks[hover]!;

  return (
    <figure className="deviation trend">
      <figcaption id={`${id}-title`}>{t(`trends.practice.${practice}`)}</figcaption>
      <p className="help trend-measure">{t(`trends.measure.${practice}`)}</p>
      <div className="deviation-frame">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-verdict`}
          onPointerMove={onPointer}
          onPointerLeave={() => setHover(null)}
        >
          <rect
            className="deviation-band"
            x={bandFrom}
            y={TOP}
            width={WIDTH - RIGHT - bandFrom}
            height={PLOT}
          />
          {ticks.map((v, k) => (
            <g key={k} className="deviation-grid">
              <line className="scale-trend-grid" x1={LEFT} x2={WIDTH - RIGHT} y1={y(v)} y2={y(v)} />
              <text x={LEFT - 6} y={y(v)} dy="0.32em" textAnchor="end">
                {labels[k]}
              </text>
            </g>
          ))}
          {points.length > 1 && <path className="scale-trend-line" d={path} />}
          {points.map((p) => (
            <circle
              key={p.week.start}
              className={hover === p.i ? 'deviation-dot is-hover' : 'deviation-dot'}
              cx={x(p.i)}
              cy={y(p.value)}
              r={DOT_R}
            />
          ))}
          <text className="deviation-word" x={LEFT} y={HEIGHT - 4}>
            {log.shortDay(weeks[0]!.start)}
          </text>
          <text className="deviation-word" x={WIDTH - RIGHT} y={HEIGHT - 4} textAnchor="end">
            {t('trends.thisWeek')}
          </text>
        </svg>
        {hovered && (
          <p
            className="deviation-tip"
            style={{ left: `${(x(hover!) / WIDTH) * 100}%` }}
            aria-hidden="true"
          >
            {pointLabel(hovered)}
          </p>
        )}
      </div>
      <Verdict trend={trend} id={`${id}-verdict`} />
      {trend.levels && trend.levels.length > 1 && <LevelMix trend={trend} />}
      <details className="history-details">
        <summary>{t('progress.history.table')}</summary>
        <table className="history-table trend-table">
          <thead>
            <tr>
              <th scope="col">{t('trends.table.week')}</th>
              <th scope="col">{t(`trends.table.${practice}`)}</th>
              <th scope="col">{t(`trends.unit.${rule.unit}`)}</th>
              {rule.levels && <th scope="col">{t('trends.table.levels')}</th>}
            </tr>
          </thead>
          <tbody>
            {[...weeks].reverse().flatMap((w, k) =>
              w.count === 0
                ? []
                : [
                    <tr key={w.start}>
                      <th scope="row">
                        {log.shortDay(w.start)}
                        {k === 0 && t('trends.table.thisWeek')}
                      </th>
                      <td>
                        {w.value === null
                          ? t('read.none')
                          : w.counted
                            ? format.value(practice, w.value)
                            : t('trends.table.notCounted', {
                                value: format.value(practice, w.value),
                              })}
                      </td>
                      <td>{w.count}</td>
                      {rule.levels && (
                        <td>
                          {w.levels.map((l, i) => (
                            <span key={l.level} className="trend-table-level">
                              {i > 0 && ', '}
                              {format.levelTag(l.level)} {l.count}
                            </span>
                          ))}
                        </td>
                      )}
                    </tr>,
                  ],
            )}
          </tbody>
        </table>
        <p className="help">{t(`trends.table.help.${rule.unit}`, { n: rule.minimum })}</p>
      </details>
    </figure>
  );
}

/** The last four weeks against the four before, in words. */
function Verdict({ trend, id }: { trend: Trend; id: string }) {
  const t = useT();
  const format = useTrendFormat();
  const { practice, comparison } = trend;

  if (!comparison) {
    return (
      <p id={id} className="trend-verdict is-none">
        {t(
          trend.noComparison === 'levels'
            ? 'trends.noComparison.levels'
            : 'trends.noComparison.few',
        )}
      </p>
    );
  }
  const figures = {
    recent: format.value(practice, comparison.recent),
    earlier: format.value(practice, comparison.earlier),
  };
  const sentence =
    comparison.verdict === 'same'
      ? t('trends.verdict.same', figures)
      : t(`trends.verdict.${practice}.${comparison.verdict}`, figures);
  return (
    <div id={id} className="trend-verdict-block">
      <p className="trend-verdict" data-verdict={comparison.verdict}>
        {sentence}
      </p>
      {trend.rule.levels && (comparison.levels.length > 1 || comparison.leftOut.length > 0) && (
        <p className="help trend-within">
          {t('trends.within', { levels: format.list(comparison.levels.map(format.levelTag)) })}
          {comparison.leftOut.length > 0 &&
            ` ${t('trends.leftOut', { levels: format.list(comparison.leftOut.map(format.levelTag)) })}`}
        </p>
      )}
    </div>
  );
}

/** The share of each level over the counted weeks: a bar split by level, and the same in words. */
function LevelMix({ trend }: { trend: Trend }) {
  const t = useT();
  const format = useTrendFormat();
  const shares = trend.levels!;
  const percent = (share: number) => format.value('ear', share);
  /** `EC3 · Up to the octave`; a tune, headed by its title, by that alone. */
  const levelTitle = (level: string) =>
    format.levelTag(level) === level
      ? `${level} · ${format.levelName(level)}`
      : format.levelName(level);

  return (
    <div className="trend-levels">
      <p className="trend-levels-title">{t('trends.levels')}</p>
      <div className="trend-levels-bar" aria-hidden="true">
        {shares.map((l, i) => (
          <span
            key={l.level}
            data-tone={i % 2}
            style={{ flexGrow: l.share }}
            title={`${levelTitle(l.level)}: ${percent(l.share)}`}
          />
        ))}
      </div>
      <ul className="trend-levels-list">
        {shares.map((l) => (
          <li key={l.level} title={format.levelName(l.level)}>
            <span className="trend-level-id">{format.levelTag(l.level)}</span>
            <span className="visually-hidden">
              {format.levelTag(l.level) === l.level ? ` · ${format.levelName(l.level)}:` : ':'}
            </span>{' '}
            {percent(l.share)}
          </li>
        ))}
      </ul>
    </div>
  );
}
