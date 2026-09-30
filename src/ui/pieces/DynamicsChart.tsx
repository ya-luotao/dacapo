import { useId, useMemo, useState, type PointerEvent } from 'react';
import type { BeatSlot, DynamicsAnalysis } from '../../core/expression.ts';
import type { Hand } from '../../core/score.ts';
import { useT } from '../../i18n/index.ts';
import { CHART_LEFT, CHART_WIDTH, createBarGrid } from './barGrid.ts';
import { BarLines } from './BarLines.tsx';
import { BALANCE_GLYPH, type ExpressionWords } from './expressionWords.ts';
import type { PieceFormat } from './format.ts';

// One run's loudness: per hand the median velocity of each beat, soft at the bottom and loud at
// the top, over the band of the run's own range, under the bar numbers with the score's dynamics
// and hairpins above them. The right hand is a solid line with dots, the left a dashed line with
// squares, named in the legend, so colour is never the only sign. Below, per bar, whether the
// melody sounded over the accompaniment. The same figures are in a table.

/** Rows above the plot: the dynamics, then hairpins and accents, then the bar numbers. */
const DYN_Y = 13;
const WEDGE_Y = 26;
const BARS_Y = 44;
const PLOT_TOP = 52;
const PLOT_HEIGHT = 112;
const BALANCE_Y = PLOT_TOP + PLOT_HEIGHT + 16;
/** A dynamic's letters are about this wide each, so one that would run into the last is left out. */
const LETTER_WIDTH = 8;

const HANDS: readonly Hand[] = ['right', 'left'];

export function DynamicsChart({
  slots,
  dynamics,
  format,
  words,
}: {
  slots: readonly BeatSlot[];
  dynamics: DynamicsAnalysis;
  format: PieceFormat;
  words: ExpressionWords;
}) {
  const t = useT();
  const id = useId();
  const { curve, range, marks, balance } = dynamics;
  const [hover, setHover] = useState<number | null>(null);
  const grid = useMemo(() => createBarGrid(slots, format), [slots, format]);
  const { cx, xAt, xEnd, unit } = grid;

  const [lo, hi] = useMemo(() => {
    const values = [...curve.right, ...curve.left].filter((v): v is number => v !== null);
    const low = Math.min(range?.low ?? 64, ...values);
    const high = Math.max(range?.high ?? 64, ...values);
    return [Math.max(0, Math.floor(low - 4)), Math.min(127, Math.ceil(high + 4))];
  }, [curve, range]);
  const y = (v: number) => PLOT_TOP + ((hi - v) / Math.max(1, hi - lo)) * PLOT_HEIGHT;

  // The dynamics' letters in the order played, each clear of the one before.
  const letters: { x: number; dynamic: string }[] = [];
  for (const round of grid.rounds) {
    for (const d of marks.dynamics) {
      const x = xAt(round, d.tick);
      const previous = letters.at(-1);
      if (x === null) continue;
      if (previous && x < previous.x + previous.dynamic.length * LETTER_WIDTH + 4) continue;
      letters.push({ x, dynamic: d.dynamic });
    }
  }
  const balanceOf = new Map(balance?.bars.map((b) => [b.measure, b.verdict]) ?? []);

  const path = (values: readonly (number | null)[]) => {
    let d = '';
    let open = false;
    values.forEach((v, i) => {
      if (v === null) {
        open = false;
        return;
      }
      d += `${open ? 'L' : 'M'}${cx(i).toFixed(1)} ${y(v).toFixed(1)}`;
      open = true;
    });
    return d;
  };

  function onPointer(e: PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * CHART_WIDTH;
    const i = Math.floor((px - CHART_LEFT) / unit);
    setHover(i >= 0 && i < slots.length ? i : null);
  }

  const slotLabel = (i: number) => {
    const s = slots[i]!;
    const values = HANDS.flatMap((h) => {
      const v = curve[h][i];
      return v === null || v === undefined
        ? []
        : [t('pieces.expression.chart.value', { hand: words.hand(h), velocity: Math.round(v) })];
    });
    return t('pieces.expression.chart.beat', {
      bar:
        grid.rounds.length > 1
          ? t('pieces.rhythm.barsRound', { bars: format.barTitle(s.measure), n: s.round + 1 })
          : format.barTitle(s.measure),
      beat: s.beat + 1,
      values: values.length > 0 ? values.join(' · ') : t('pieces.expression.chart.silent'),
    });
  };
  const dot = unit > 6 ? 2.5 : 1.5;

  return (
    <figure className="expression-chart">
      <figcaption id={`${id}-title`}>{t('pieces.expression.chart')}</figcaption>
      <ul className="expression-legend">
        <li>
          <svg viewBox="0 0 28 10" aria-hidden="true">
            <path className="dynamics-line is-right" d="M1 5H27" />
            <circle className="dynamics-dot is-right" cx="14" cy="5" r="2.5" />
          </svg>
          {words.hand('right')}
        </li>
        <li>
          <svg viewBox="0 0 28 10" aria-hidden="true">
            <path className="dynamics-line is-left" d="M1 5H27" />
            <rect className="dynamics-dot is-left" x="11.5" y="2.5" width="5" height="5" />
          </svg>
          {words.hand('left')}
        </li>
        {balance && (
          <li className="expression-legend-glyphs">
            {(['balanced', 'equal', 'under'] as const).map((v) => (
              <span key={v}>
                <span aria-hidden="true">{BALANCE_GLYPH[v]}</span> {words.balance(v)}
              </span>
            ))}
          </li>
        )}
      </ul>
      <div className="expression-frame">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${balance ? BALANCE_Y + 10 : PLOT_TOP + PLOT_HEIGHT + 6}`}
          role="img"
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-desc`}
          onPointerMove={onPointer}
          onPointerLeave={() => setHover(null)}
        >
          {range && (
            <rect
              className="expression-band"
              x={CHART_LEFT}
              width={grid.plotWidth}
              y={y(range.high)}
              height={Math.max(1, y(range.low) - y(range.high))}
            />
          )}
          <text className="chart-axis" x={CHART_LEFT - 6} y={PLOT_TOP + 4} textAnchor="end">
            {t('pieces.expression.chart.loud')}
          </text>
          <text
            className="chart-axis"
            x={CHART_LEFT - 6}
            y={PLOT_TOP + PLOT_HEIGHT}
            textAnchor="end"
          >
            {t('pieces.expression.chart.soft')}
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
              {marks.hairpins.map((h, k) => {
                const x1 = xAt(round, h.tick);
                const x2 = xEnd(round, h.end);
                if (x1 === null || x2 === null || x2 - x1 < 4) return null;
                if (h.written === 'words')
                  return (
                    <g key={`h${k}`} className="dynamics-words">
                      <text x={x1} y={WEDGE_Y + 4}>
                        {h.kind === 'crescendo' ? 'cresc.' : 'dim.'}
                      </text>
                      {x2 - x1 > 40 && <line x1={x1 + 36} x2={x2} y1={WEDGE_Y} y2={WEDGE_Y} />}
                    </g>
                  );
                const [open, closed] = h.kind === 'crescendo' ? [x2, x1] : [x1, x2];
                return (
                  <path
                    key={`h${k}`}
                    className="chart-mark-line"
                    d={`M${open} ${WEDGE_Y - 4}L${closed} ${WEDGE_Y}L${open} ${WEDGE_Y + 4}`}
                  />
                );
              })}
              {marks.accents.map((a, k) => {
                const x = xAt(round, a.tick);
                return x === null ? null : (
                  <path
                    key={`a${k}`}
                    className="chart-mark-line"
                    d={`M${x - 3} ${WEDGE_Y - 3}l6 3l-6 3`}
                  />
                );
              })}
            </g>
          ))}
          {letters.map(({ x, dynamic }, k) => (
            <text key={k} className="dynamics-mark" x={x} y={DYN_Y}>
              {dynamic}
            </text>
          ))}
          {HANDS.map((h) => (
            <g key={h}>
              <path className={`dynamics-line is-${h}`} d={path(curve[h])} />
              {curve[h].map((v, i) =>
                v === null ? null : h === 'right' ? (
                  <circle key={i} className="dynamics-dot is-right" cx={cx(i)} cy={y(v)} r={dot} />
                ) : (
                  <rect
                    key={i}
                    className="dynamics-dot is-left"
                    x={cx(i) - dot}
                    y={y(v) - dot}
                    width={2 * dot}
                    height={2 * dot}
                  />
                ),
              )}
            </g>
          ))}
          {hover !== null && (
            <line
              className="chart-hover"
              x1={cx(hover)}
              x2={cx(hover)}
              y1={PLOT_TOP}
              y2={PLOT_TOP + PLOT_HEIGHT}
            />
          )}
          {balance &&
            grid.bars.map((i) => {
              const verdict = balanceOf.get(slots[i]!.measure);
              if (!verdict) return null;
              return (
                <text
                  key={i}
                  className={`dynamics-balance is-${verdict}`}
                  x={(grid.x(i) + grid.x(grid.barEnd(i))) / 2}
                  y={BALANCE_Y}
                  textAnchor="middle"
                >
                  {BALANCE_GLYPH[verdict]}
                </text>
              );
            })}
        </svg>
        {hover !== null && (
          <p
            className="deviation-tip"
            style={{ left: `${(cx(hover) / CHART_WIDTH) * 100}%` }}
            aria-hidden="true"
          >
            {slotLabel(hover)}
          </p>
        )}
      </div>
      <p id={`${id}-desc`} className="help">
        {range
          ? t('pieces.expression.chart.desc', {
              low: Math.round(range.low),
              high: Math.round(range.high),
            })
          : null}
      </p>
    </figure>
  );
}
