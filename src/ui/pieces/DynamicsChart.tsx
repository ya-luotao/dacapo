import { useId, useMemo, useState, type PointerEvent } from 'react';
import { slotOf, type BeatSlot, type DynamicsAnalysis } from '../../core/expression.ts';
import type { Hand } from '../../core/score.ts';
import { useT } from '../../i18n/index.ts';
import { BALANCE_GLYPH, type ExpressionWords } from './expressionWords.ts';
import type { PieceFormat } from './format.ts';

// One run's loudness: per hand the median velocity of each beat, soft at the bottom and loud at
// the top, over the band of the run's own range, under the bar numbers with the score's dynamics
// and hairpins above them. The right hand is a solid line with dots, the left a dashed line with
// squares, named in the legend, so colour is never the only sign. Below, per bar, whether the
// melody sounded over the accompaniment. The same figures are in a table.

const WIDTH = 640;
const LEFT = 36;
const RIGHT = 8;
/** Rows above the plot: the dynamics, then hairpins and accents, then the bar numbers. */
const DYN_Y = 13;
const WEDGE_Y = 26;
const BARS_Y = 44;
const PLOT_TOP = 52;
/** A dynamic's letters are about this wide each, so one that would run into the last is left out. */
const LETTER_WIDTH = 8;
const PLOT_HEIGHT = 112;
const BALANCE_Y = PLOT_TOP + PLOT_HEIGHT + 16;
/** Bar numbers at least this far apart (in the chart's units), and never over the one before. */
const LABEL_GAP = 26;

const HANDS: readonly Hand[] = ['right', 'left'];

/** About how wide a label is at the chart's 11px: CJK characters twice a Latin one. */
function textWidth(text: string): number {
  let width = 0;
  for (const c of text) width += c.codePointAt(0)! >= 0x2e80 ? 11 : 6;
  return width;
}

export function DynamicsChart({
  dynamics,
  format,
  words,
}: {
  dynamics: DynamicsAnalysis;
  format: PieceFormat;
  words: ExpressionWords;
}) {
  const t = useT();
  const id = useId();
  const { slots, curve, range, marks, balance } = dynamics;
  const [hover, setHover] = useState<number | null>(null);
  const plotWidth = WIDTH - LEFT - RIGHT;
  const unit = plotWidth / Math.max(1, slots.length);
  const cx = (i: number) => LEFT + (i + 0.5) * unit;

  /** x of a performance tick in a round, between the slots' centres' edges. */
  const xAt = (round: number, tick: number) => {
    const i = slotOf(slots, round, tick);
    if (i < 0) return null;
    const s = slots[i]!;
    return LEFT + (i + (tick - s.tick) / s.length) * unit;
  };
  /** The end of a span: its last tick's place, or the right edge when it runs past the slots. */
  const xEnd = (round: number, tick: number) => {
    const inside = xAt(round, tick);
    if (inside !== null) return inside;
    const last = slots.findLastIndex((s) => s.round === round);
    return last >= 0 && tick > slots[last]!.tick ? LEFT + (last + 1) * unit : null;
  };

  const [lo, hi] = useMemo(() => {
    const values = [...curve.right, ...curve.left].filter((v): v is number => v !== null);
    const low = Math.min(range?.low ?? 64, ...values);
    const high = Math.max(range?.high ?? 64, ...values);
    return [Math.max(0, Math.floor(low - 4)), Math.min(127, Math.ceil(high + 4))];
  }, [curve, range]);
  const y = (v: number) => PLOT_TOP + ((hi - v) / Math.max(1, hi - lo)) * PLOT_HEIGHT;

  const rounds = [...new Set(slots.map((s) => s.round))];
  // Bar starts, with every label far enough from the one before.
  const barStarts = slots.flatMap((s, i) => (s.beat === 0 || i === 0 ? [i] : []));
  let labelEnd = -Infinity;
  const labelled = new Set<number>();
  for (const i of barStarts) {
    const x = LEFT + i * unit;
    if (x < labelEnd) continue;
    labelled.add(i);
    labelEnd = x + Math.max(LABEL_GAP, textWidth(format.barShort(slots[i]!.measure)) + 8);
  }
  // The dynamics' letters in the order played, each clear of the one before.
  const letters: { x: number; dynamic: string }[] = [];
  for (const round of rounds) {
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
    const px = ((e.clientX - box.left) / box.width) * WIDTH;
    const i = Math.floor((px - LEFT) / unit);
    setHover(i >= 0 && i < slots.length ? i : null);
  }

  const slotLabel = (i: number) => {
    const s: BeatSlot = slots[i]!;
    const values = HANDS.flatMap((h) => {
      const v = curve[h][i];
      return v === null || v === undefined
        ? []
        : [t('pieces.expression.chart.value', { hand: words.hand(h), velocity: Math.round(v) })];
    });
    return t('pieces.expression.chart.beat', {
      bar:
        rounds.length > 1
          ? t('pieces.rhythm.barsRound', { bars: format.barTitle(s.measure), n: s.round + 1 })
          : format.barTitle(s.measure),
      beat: s.beat + 1,
      values: values.length > 0 ? values.join(' · ') : t('pieces.expression.chart.silent'),
    });
  };

  return (
    <figure className="dynamics-chart">
      <figcaption id={`${id}-title`}>{t('pieces.expression.chart')}</figcaption>
      <ul className="dynamics-legend">
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
          <li className="dynamics-legend-balance">
            {(['balanced', 'equal', 'under'] as const).map((v) => (
              <span key={v}>
                <span aria-hidden="true">{BALANCE_GLYPH[v]}</span> {words.balance(v)}
              </span>
            ))}
          </li>
        )}
      </ul>
      <div className="dynamics-frame">
        <svg
          viewBox={`0 0 ${WIDTH} ${balance ? BALANCE_Y + 10 : PLOT_TOP + PLOT_HEIGHT + 6}`}
          role="img"
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-desc`}
          onPointerMove={onPointer}
          onPointerLeave={() => setHover(null)}
        >
          {range && (
            <rect
              className="dynamics-band"
              x={LEFT}
              width={plotWidth}
              y={y(range.high)}
              height={Math.max(1, y(range.low) - y(range.high))}
            />
          )}
          <text className="dynamics-axis" x={LEFT - 6} y={PLOT_TOP + 4} textAnchor="end">
            {t('pieces.expression.chart.loud')}
          </text>
          <text className="dynamics-axis" x={LEFT - 6} y={PLOT_TOP + PLOT_HEIGHT} textAnchor="end">
            {t('pieces.expression.chart.soft')}
          </text>
          {barStarts.map((i) => (
            <g
              key={i}
              className={
                slots[i]!.round > 0 && slots[i - 1]?.round !== slots[i]!.round
                  ? 'dynamics-bar is-round'
                  : 'dynamics-bar'
              }
            >
              <line
                x1={LEFT + i * unit}
                x2={LEFT + i * unit}
                y1={BARS_Y + 4}
                y2={PLOT_TOP + PLOT_HEIGHT}
              />
              {labelled.has(i) && (
                <text x={LEFT + i * unit + 2} y={BARS_Y}>
                  {format.barShort(slots[i]!.measure)}
                </text>
              )}
            </g>
          ))}
          {rounds.map((round) => (
            <g key={round} className="dynamics-marks">
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
                    className="dynamics-hairpin"
                    d={`M${open} ${WEDGE_Y - 4}L${closed} ${WEDGE_Y}L${open} ${WEDGE_Y + 4}`}
                  />
                );
              })}
              {marks.accents.map((a, k) => {
                const x = xAt(round, a.tick);
                return x === null ? null : (
                  <path
                    key={`a${k}`}
                    className="dynamics-accent"
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
                  <circle
                    key={i}
                    className="dynamics-dot is-right"
                    cx={cx(i)}
                    cy={y(v)}
                    r={unit > 6 ? 2.5 : 1.5}
                  />
                ) : (
                  <rect
                    key={i}
                    className="dynamics-dot is-left"
                    x={cx(i) - (unit > 6 ? 2.5 : 1.5)}
                    y={y(v) - (unit > 6 ? 2.5 : 1.5)}
                    width={unit > 6 ? 5 : 3}
                    height={unit > 6 ? 5 : 3}
                  />
                ),
              )}
            </g>
          ))}
          {hover !== null && (
            <line
              className="dynamics-hover"
              x1={cx(hover)}
              x2={cx(hover)}
              y1={PLOT_TOP}
              y2={PLOT_TOP + PLOT_HEIGHT}
            />
          )}
          {balance &&
            barStarts.map((i) => {
              const s = slots[i]!;
              const verdict = balanceOf.get(s.measure);
              if (!verdict) return null;
              const end = slots.findIndex((x, k) => k > i && (x.beat === 0 || x.round !== s.round));
              const mid = LEFT + ((i + (end < 0 ? slots.length : end)) / 2) * unit;
              return (
                <text
                  key={i}
                  className={`dynamics-balance is-${verdict}`}
                  x={mid}
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
            style={{ left: `${(cx(hover) / WIDTH) * 100}%` }}
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
