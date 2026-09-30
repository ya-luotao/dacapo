import { useId, useMemo, useState, type PointerEvent } from 'react';
import {
  PEDAL_DOWN,
  type BeatSlot,
  type PedalAnalysis,
  type PedalPoint,
  type PedalVerdict,
} from '../../core/expression.ts';
import { useI18n } from '../../i18n/index.ts';
import { CHART_LEFT, CHART_WIDTH, createBarGrid, type BarGrid } from './barGrid.ts';
import { BarLines } from './BarLines.tsx';
import type { ExpressionWords } from './expressionWords.ts';
import type { PieceFormat } from './format.ts';

// One run's pedalling: how far the sustain pedal was down (its raw position, so a half pedal
// shows), under the bar numbers with the score's pedal marks above them as the edition draws a
// bracket line (down, a notch at each change, up). Each mark judged has its sign above it: a tick
// clean, two bars a gap, a wave a blur, a cross missed, named in the legend, so colour is never
// the only sign. The sostenuto and una corda have lanes of their own when they were used.

/** Rows above the plot: the verdicts, the marks' bracket, the bar numbers. */
const VERDICT_Y = 10;
const MARK_Y = 26;
const BARS_Y = 44;
const PLOT_TOP = 52;
const PLOT_HEIGHT = 72;
const LANE_HEIGHT = 12;
const LANE_GAP = 8;

/** A verdict's sign, drawn around (0, 0). */
export function PedalGlyph({ verdict, x, y }: { verdict: PedalVerdict; x: number; y: number }) {
  const d =
    verdict === 'clean'
      ? 'M-3.5 0l2.5 3l4.5-6'
      : verdict === 'gap'
        ? 'M-3 -3.5v7M3 -3.5v7'
        : verdict === 'blur'
          ? 'M-5 0q1.25-3.5 2.5 0t2.5 0t2.5 0t2.5 0'
          : 'M-3 -3l6 6M3 -3l-6 6';
  return <path className={`pedal-glyph is-${verdict}`} d={d} transform={`translate(${x} ${y})`} />;
}

/** x of a place in the score, held at the edge of the beats played when outside them. */
function placeX(grid: BarGrid, round: number, tick: number): number {
  const x = grid.xAt(round, tick);
  if (x !== null) return x;
  const { slots } = grid;
  const first = slots.findIndex((s) => s.round === round);
  if (first < 0) return round < (slots[0]?.round ?? 0) ? grid.x(0) : grid.x(slots.length);
  if (tick < slots[first]!.tick) return grid.x(first);
  return grid.x(slots.findLastIndex((s) => s.round === round) + 1);
}

/** A pedal's positions as a filled step line from `top` (all the way down) to `bottom` (up). */
function area(grid: BarGrid, points: readonly PedalPoint[], top: number, bottom: number) {
  if (points.length === 0) return { fill: '', line: '' };
  const y = (v: number) => bottom - (Math.min(127, Math.max(0, v)) / 127) * (bottom - top);
  const end = grid.x(grid.slots.length);
  const start = Math.max(CHART_LEFT, placeX(grid, points[0]!.round, points[0]!.tick));
  let x = start;
  let line = `M${x.toFixed(1)} ${y(points[0]!.value).toFixed(1)}`;
  for (let i = 0; i < points.length; i++) {
    const next = points[i + 1];
    const to = next ? Math.max(x, placeX(grid, next.round, next.tick)) : end;
    line += `H${to.toFixed(1)}`;
    if (next) line += `V${y(next.value).toFixed(1)}`;
    x = to;
  }
  return { fill: `${line}V${bottom}H${start.toFixed(1)}Z`, line };
}

export function PedalChart({
  slots,
  pedal,
  rounds,
  format,
  words,
}: {
  slots: readonly BeatSlot[];
  pedal: PedalAnalysis;
  rounds: number;
  format: PieceFormat;
  words: ExpressionWords;
}) {
  const { t, locale } = useI18n();
  const id = useId();
  const grid = useMemo(() => createBarGrid(slots, format), [slots, format]);
  const [hover, setHover] = useState<number | null>(null);
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  const bottom = PLOT_TOP + PLOT_HEIGHT;
  const lanes = (
    [
      ['sostenuto', pedal.lines.sostenuto, 'pieces.expression.pedal.chart.sostenuto'],
      ['una-corda', pedal.lines.unaCorda, 'pieces.expression.pedal.chart.unaCorda'],
    ] as const
  ).flatMap(([key, points, label]) => (points ? [{ key, points, label }] : []));
  const height = bottom + 6 + lanes.length * (LANE_HEIGHT + LANE_GAP);
  const sustain = area(grid, pedal.lines.sustain, PLOT_TOP, bottom);
  const threshold = bottom - (PEDAL_DOWN / 127) * PLOT_HEIGHT;
  const byBar = new Map(pedal.bars.map((b) => [`${b.round}:${b.played}`, b]));

  // The bracket of each round, as the edition draws it: a hook down at a start, a notch at each
  // change, a hook up at a stop; a line still open runs to the end of the beats played.
  const brackets = grid.rounds.flatMap((round) => {
    const marks = pedal.marks.filter((m) => m.round === round);
    return marks.flatMap((m, k) => {
      if (m.type === 'stop') return [];
      const next = marks[k + 1];
      const x1 = placeX(grid, round, m.tick);
      const x2 = next ? placeX(grid, round, next.tick) : grid.x(grid.slots.length);
      const head =
        m.type === 'start'
          ? `M${x1} ${MARK_Y - 6}V${MARK_Y}`
          : `M${x1} ${MARK_Y - 5}L${x1 + 3} ${MARK_Y}`;
      const tail = !next
        ? `H${x2}`
        : next.type === 'stop'
          ? `H${x2}V${MARK_Y - 6}`
          : next.type === 'change'
            ? `H${Math.max(x1 + 3, x2 - 3)}L${x2} ${MARK_Y - 5}`
            : `H${x2}`;
      return [head + tail];
    });
  });

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
    if (!bar || bar.down === null) return t('pieces.expression.pedal.chart.nothing', { bar: name });
    return bar.judged > 0
      ? t('pieces.expression.pedal.chart.barMarks', {
          bar: name,
          percent: percent.format(bar.down),
          n: bar.clean,
          total: bar.judged,
        })
      : t('pieces.expression.pedal.chart.bar', { bar: name, percent: percent.format(bar.down) });
  };

  const verdicts: PedalVerdict[] = ['clean', 'gap', 'blur', 'missed'];
  return (
    <figure className="expression-chart">
      <figcaption id={`${id}-title`}>{t('pieces.expression.pedal.chart')}</figcaption>
      <ul className="expression-legend">
        <li>
          <svg viewBox="0 0 28 10" aria-hidden="true">
            <path className="chart-mark-line" d="M2 2V8H14L17 3L20 8H26V2" />
          </svg>
          {t('pieces.expression.pedal.legend.marks')}
        </li>
        <li className="expression-legend-glyphs">
          {verdicts.map((v) => (
            <span key={v}>
              <svg viewBox="-7 -5 14 10" aria-hidden="true" className="pedal-legend-glyph">
                <PedalGlyph verdict={v} x={0} y={0} />
              </svg>{' '}
              {t(`pieces.expression.pedal.kind.${v}`)}
            </span>
          ))}
        </li>
      </ul>
      <div className="expression-frame">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${height}`}
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
          <text className="chart-axis" x={CHART_LEFT - 6} y={threshold + 4} textAnchor="end">
            {t('pieces.expression.pedal.chart.down')}
          </text>
          <text className="chart-axis" x={CHART_LEFT - 6} y={bottom} textAnchor="end">
            {t('pieces.expression.pedal.chart.up')}
          </text>
          <BarLines grid={grid} format={format} labelY={BARS_Y} top={BARS_Y + 4} bottom={bottom} />
          <line
            className="pedal-threshold"
            x1={CHART_LEFT}
            x2={CHART_LEFT + grid.plotWidth}
            y1={threshold}
            y2={threshold}
          />
          <path className="pedal-fill" d={sustain.fill} />
          <path className="pedal-line" d={sustain.line} />
          {brackets.map((d, k) => (
            <path key={k} className="chart-mark-line" d={d} />
          ))}
          {pedal.judgements.map((j, k) => (
            <PedalGlyph
              key={k}
              verdict={j.verdict}
              x={placeX(grid, j.round, j.tick)}
              y={VERDICT_Y}
            />
          ))}
          {lanes.map((lane, k) => {
            const top = bottom + 6 + LANE_GAP + k * (LANE_HEIGHT + LANE_GAP);
            const drawn = area(grid, lane.points, top, top + LANE_HEIGHT);
            return (
              <g key={lane.key}>
                <text
                  className="chart-axis"
                  x={CHART_LEFT - 6}
                  y={top + LANE_HEIGHT}
                  textAnchor="end"
                >
                  {t(lane.label)}
                </text>
                <rect
                  className="expression-band"
                  x={CHART_LEFT}
                  width={grid.plotWidth}
                  y={top}
                  height={LANE_HEIGHT}
                />
                <path className="pedal-fill is-lane" d={drawn.fill} />
              </g>
            );
          })}
          {hover !== null && (
            <rect
              className="pedal-hover"
              x={grid.x(hover)}
              width={Math.max(1, grid.x(grid.barEnd(hover)) - grid.x(hover))}
              y={PLOT_TOP}
              height={PLOT_HEIGHT}
            />
          )}
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
        {t('pieces.expression.pedal.chart.desc')}
      </p>
    </figure>
  );
}
