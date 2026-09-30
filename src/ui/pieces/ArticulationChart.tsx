import { useId, useMemo, useState, type PointerEvent } from 'react';
import type { ArticulationAnalysis, BeatSlot } from '../../core/expression.ts';
import { useI18n } from '../../i18n/index.ts';
import { CHART_LEFT, CHART_WIDTH, createBarGrid } from './barGrid.ts';
import { BarLines } from './BarLines.tsx';
import type { ExpressionWords } from './expressionWords.ts';
import type { PieceFormat } from './format.ts';

// One run's articulation: per bar played, the share of its notes held as written, as a column
// from none (bottom) to all (top) over the column's outline, under the bar numbers with the
// score's slurs, staccatos and tenutos above them. A bar with nothing to judge has no column. The
// same figures are in a table.

/** Rows above the plot: the slurs, the staccato and tenuto marks, the bar numbers. */
const SLUR_Y = 14;
const TOUCH_Y = 26;
const BARS_Y = 42;
const PLOT_TOP = 50;
const PLOT_HEIGHT = 84;

export function ArticulationChart({
  slots,
  articulation,
  rounds,
  format,
  words,
}: {
  slots: readonly BeatSlot[];
  articulation: ArticulationAnalysis;
  rounds: number;
  format: PieceFormat;
  words: ExpressionWords;
}) {
  const { t, locale } = useI18n();
  const id = useId();
  const grid = useMemo(() => createBarGrid(slots, format), [slots, format]);
  const [hover, setHover] = useState<number | null>(null);
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  const { marks } = articulation;
  const byBar = new Map(articulation.bars.map((b) => [`${b.round}:${b.played}`, b]));
  const y = (share: number) => PLOT_TOP + (1 - share) * PLOT_HEIGHT;

  function onPointer(e: PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * CHART_WIDTH;
    const i = grid.bars.findLast((b) => grid.x(b) <= px);
    setHover(i !== undefined && px < grid.x(grid.barEnd(i)) && px >= CHART_LEFT ? i : null);
  }

  const barLabel = (i: number) => {
    const s = slots[i]!;
    const bar = byBar.get(`${s.round}:${s.played}`);
    const name = words.barRow(s, rounds);
    return bar && bar.judged > 0
      ? t('pieces.expression.articulation.chart.bar', {
          bar: name,
          n: bar.right,
          total: bar.judged,
        })
      : t('pieces.expression.articulation.chart.nothing', { bar: name });
  };

  return (
    <figure className="expression-chart">
      <figcaption id={`${id}-title`}>{t('pieces.expression.articulation.chart')}</figcaption>
      <ul className="expression-legend">
        <li>
          <svg viewBox="0 0 28 10" aria-hidden="true">
            <path className="chart-mark-line" d="M2 9Q14 -1 26 9" />
          </svg>
          {t('pieces.expression.touch.legato')}
        </li>
        <li>
          <svg viewBox="0 0 10 10" aria-hidden="true">
            <circle className="articulation-dot" cx="5" cy="5" r="1.75" />
          </svg>
          {t('pieces.expression.touch.staccato')}
        </li>
        <li>
          <svg viewBox="0 0 10 10" aria-hidden="true">
            <path className="chart-mark-line" d="M1 5H9" />
          </svg>
          {t('pieces.expression.touch.tenuto')}
        </li>
      </ul>
      <div className="expression-frame">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${PLOT_TOP + PLOT_HEIGHT + 6}`}
          role="img"
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-desc`}
          onPointerMove={onPointer}
          onPointerLeave={() => setHover(null)}
        >
          <rect
            className="expression-band"
            x={CHART_LEFT}
            width={grid.plotWidth}
            y={PLOT_TOP}
            height={PLOT_HEIGHT}
          />
          <text className="chart-axis" x={CHART_LEFT - 6} y={PLOT_TOP + 4} textAnchor="end">
            {percent.format(1)}
          </text>
          <text
            className="chart-axis"
            x={CHART_LEFT - 6}
            y={PLOT_TOP + PLOT_HEIGHT}
            textAnchor="end"
          >
            {percent.format(0)}
          </text>
          <BarLines
            grid={grid}
            format={format}
            labelY={BARS_Y}
            top={BARS_Y + 4}
            bottom={PLOT_TOP + PLOT_HEIGHT}
          />
          {grid.rounds.map((round) => (
            <g key={round}>
              {marks.slurs.map((s, k) => {
                const x1 = grid.xAt(round, s.tick);
                const x2 = grid.xEnd(round, s.end);
                if (x1 === null || x2 === null || x2 - x1 < 3) return null;
                return (
                  <path
                    key={`s${k}`}
                    className="chart-mark-line"
                    d={`M${x1 + 1} ${SLUR_Y + 4}Q${(x1 + x2) / 2} ${SLUR_Y - 8} ${x2 - 1} ${SLUR_Y + 4}`}
                  />
                );
              })}
              {marks.short.map((m, k) => {
                const x = grid.xAt(round, m.tick);
                return x === null ? null : (
                  <circle key={`d${k}`} className="articulation-dot" cx={x} cy={TOUCH_Y} r={1.75} />
                );
              })}
              {marks.held.map((m, k) => {
                const x = grid.xAt(round, m.tick);
                return x === null ? null : (
                  <path
                    key={`t${k}`}
                    className="chart-mark-line"
                    d={`M${x - 4} ${TOUCH_Y}H${x + 4}`}
                  />
                );
              })}
            </g>
          ))}
          {grid.bars.map((i) => {
            const s = slots[i]!;
            const bar = byBar.get(`${s.round}:${s.played}`);
            if (!bar || bar.judged === 0) return null;
            const share = bar.right / bar.judged;
            const x1 = grid.x(i) + 1.5;
            const x2 = grid.x(grid.barEnd(i)) - 1.5;
            // The whole column is its track, so a bar judged with none as written still shows.
            return (
              <g key={i} className={hover === i ? 'articulation-bar is-hover' : 'articulation-bar'}>
                <rect
                  className="articulation-track"
                  x={x1}
                  width={Math.max(1, x2 - x1)}
                  y={PLOT_TOP}
                  height={PLOT_HEIGHT}
                />
                {share > 0 && (
                  <rect
                    className="articulation-share"
                    x={x1}
                    width={Math.max(1, x2 - x1)}
                    y={y(share)}
                    height={PLOT_TOP + PLOT_HEIGHT - y(share)}
                  />
                )}
              </g>
            );
          })}
        </svg>
        {hover !== null && (
          <p
            className="deviation-tip"
            style={{
              left: `${((grid.x(hover) + grid.x(grid.barEnd(hover))) / 2 / CHART_WIDTH) * 100}%`,
            }}
            aria-hidden="true"
          >
            {barLabel(hover)}
          </p>
        )}
      </div>
      <p id={`${id}-desc`} className="help">
        {t('pieces.expression.articulation.chart.desc')}
      </p>
    </figure>
  );
}
