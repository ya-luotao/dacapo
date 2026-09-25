import { memo, type Ref } from 'react';
import {
  BAND_ADVANCE,
  BAND_SIZE,
  BAND_X,
  CASE_BOTTOM,
  CASE_TOP,
  caseHalf,
  CX,
  LABEL_SIZE,
  LABEL_X,
  pct,
  PIVOT_ORIGIN,
  PLATE_MARGIN,
  PIVOT_Y,
  PLINTH_BOTTOM,
  RECESS_BOTTOM,
  RECESS_INSET,
  RECESS_TOP,
  ROD_LENGTH,
  ROD_TOP,
  SCALE_LABELS,
  SCALE_LABELS_NARROW,
  SCALE_MARKS,
  SHADOW_OFFSET,
  TEMPO_BANDS,
  VIEW_H,
  VIEW_W,
  WEIGHT_BOTTOM_HALF,
  WEIGHT_H,
  WEIGHT_TOP_HALF,
  weightY,
} from './geometry.ts';

// A Maelzel metronome: a walnut pyramid with an ivory scale in its recess, a brass rod and weight.
// It is drawn in layers that share one viewBox and one box. The case never changes; the rod, its
// shadow on the plate and the front of the clip are separate SVGs, so a frame moves them with a
// transform and nothing is painted again. No filters anywhere: shadows are gradients, the grain is
// lines.

const VIEW_BOX = `0 0 ${VIEW_W} ${VIEW_H}`;
/** Ticks reach further towards the numbers (left) than towards the Italian marks. */
const TICK: [number, number] = [3.2, 2.2];
const TICK_MAJOR: [number, number] = [5.4, 2.8];
const ROD_HALF = 1.3;
const HUB_R = 5.5;

/** The case's outline, for the shadow's clip: the shadow falls only on the case. */
const CASE_CLIP = `polygon(${[
  [CX - caseHalf(CASE_TOP), CASE_TOP],
  [CX + caseHalf(CASE_TOP), CASE_TOP],
  [CX + caseHalf(CASE_BOTTOM), CASE_BOTTOM],
  [CX - caseHalf(CASE_BOTTOM), CASE_BOTTOM],
]
  .map(([x, y]) => `${pct(x!, VIEW_W)} ${pct(y!, VIEW_H)}`)
  .join(', ')})`;

const f = (n: number) => Number(n.toFixed(2));

/** A trapezoid, symmetric about the centre line, from `top` to `bottom`. */
function trapezoid(top: number, bottom: number, topHalf: number, bottomHalf: number): string {
  return `M${f(CX - topHalf)} ${f(top)}H${f(CX + topHalf)}L${f(CX + bottomHalf)} ${f(bottom)}H${f(CX - bottomHalf)}Z`;
}

/** The recess (or the plate in it, `inset` further in): straight sides and an arched top. */
function recessPath(inset: number): string {
  return `${recessEdge(inset)}L${f(CX + recessHalf(RECESS_BOTTOM - inset, inset))} ${f(RECESS_BOTTOM - inset)}Z`;
}

/** The recess's left side and top: the walls in shadow. */
function recessEdge(inset: number): string {
  const top = RECESS_TOP + inset;
  const shoulder = top + 7;
  const bottom = RECESS_BOTTOM - inset;
  return [
    `M${f(CX - recessHalf(bottom, inset))} ${f(bottom)}`,
    `L${f(CX - recessHalf(shoulder, inset))} ${f(shoulder)}`,
    `Q${f(CX)} ${f(top - 7)} ${f(CX + recessHalf(shoulder, inset))} ${f(shoulder)}`,
  ].join('');
}

const recessHalf = (y: number, inset: number) => caseHalf(y) - RECESS_INSET - inset;

const CASE = trapezoid(CASE_TOP, CASE_BOTTOM, caseHalf(CASE_TOP), caseHalf(CASE_BOTTOM));
const WEIGHT = trapezoid(0, WEIGHT_H, WEIGHT_TOP_HALF, WEIGHT_BOTTOM_HALF);

/** Fine vertical grain: thin wandering lines, seeded so the drawing is the same every time. */
const GRAIN = (() => {
  let seed = 0x5eed;
  const random = () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    return seed / 2_147_483_648;
  };
  const half = caseHalf(CASE_BOTTOM);
  const lines: { d: string; width: number; opacity: number; light: boolean }[] = [];
  for (let x = CX - half; x < CX + half; x += 1.2 + random() * 2.6) {
    const wander = () => f(x + (random() - 0.5) * 2.2);
    const d = `M${wander()} ${CASE_TOP}C${wander()} 90 ${wander()} 150 ${wander()} 190S${wander()} 280 ${wander()} ${CASE_BOTTOM}`;
    lines.push({
      d,
      width: f(0.25 + random() * random() * 1.4),
      opacity: f(0.08 + random() * 0.22),
      light: random() < 0.22,
    });
  }
  return lines;
})();

function stop(offset: number, color: string, opacity = 1) {
  return <stop offset={offset} style={{ stopColor: color, stopOpacity: opacity }} />;
}

/** The case, the plate and its scale: drawn once. */
const Case = memo(function Case() {
  const labels = new Set(SCALE_LABELS);
  const narrow = new Set(SCALE_LABELS_NARROW);
  return (
    <svg className="pendulum-case" viewBox={VIEW_BOX}>
      <defs>
        <linearGradient id="met-walnut" x1="0" x2="1" y1="0" y2="0.3">
          {stop(0, 'var(--walnut-hi)')}
          {stop(0.45, 'var(--walnut)')}
          {stop(1, 'var(--walnut-lo)')}
        </linearGradient>
        <linearGradient id="met-sheen" x1="0" x2="0" y1="0" y2="1">
          {stop(0, 'var(--walnut-sheen)', 0.16)}
          {stop(0.35, 'var(--walnut-sheen)', 0)}
          {stop(0.8, '#000', 0)}
          {stop(1, '#000', 0.22)}
        </linearGradient>
        <linearGradient id="met-polish" x1="0" x2="1" y1="0" y2="0.4">
          {stop(0.12, 'var(--walnut-sheen)', 0)}
          {stop(0.24, 'var(--walnut-sheen)', 0.1)}
          {stop(0.34, 'var(--walnut-sheen)', 0)}
        </linearGradient>
        <linearGradient id="met-plinth" x1="0" x2="0" y1="0" y2="1">
          {stop(0, 'var(--walnut-hi)')}
          {stop(0.5, 'var(--walnut)')}
          {stop(1, 'var(--walnut-lo)')}
        </linearGradient>
        <linearGradient id="met-recess" x1="0" x2="1" y1="0" y2="0.25">
          {stop(0, 'var(--walnut-edge)')}
          {stop(0.55, 'var(--walnut-edge)')}
          {stop(1, 'var(--walnut-hi)')}
        </linearGradient>
        <linearGradient id="met-ivory" x1="0" x2="0.35" y1="0" y2="1">
          {stop(0, 'var(--ivory-hi)')}
          {stop(0.6, 'var(--ivory)')}
          {stop(1, 'var(--ivory-lo)')}
        </linearGradient>
        <linearGradient id="met-brass" x1="0" x2="1" y1="0" y2="1">
          {stop(0, 'var(--brass-hi)')}
          {stop(0.5, 'var(--brass)')}
          {stop(1, 'var(--brass-lo)')}
        </linearGradient>
        <radialGradient id="met-contact" cx="0.5" cy="0.5" r="0.5">
          {stop(0, 'var(--met-shadow)', 0.55)}
          {stop(0.6, 'var(--met-shadow)', 0.18)}
          {stop(1, 'var(--met-shadow)', 0)}
        </radialGradient>
        <clipPath id="met-case-clip">
          <path d={CASE} />
        </clipPath>
        <clipPath id="met-plate-clip">
          <path d={recessPath(PLATE_MARGIN)} />
        </clipPath>
      </defs>

      <ellipse
        cx={CX}
        cy={PLINTH_BOTTOM}
        rx={caseHalf(CASE_BOTTOM) + 34}
        ry={7}
        fill="url(#met-contact)"
      />

      {/* The plinth: a moulded foot, its own grain running across. */}
      <path
        d={trapezoid(
          CASE_BOTTOM + 4,
          PLINTH_BOTTOM,
          caseHalf(CASE_BOTTOM) + 12,
          caseHalf(CASE_BOTTOM) + 12,
        )}
        fill="url(#met-plinth)"
      />
      <path
        d={trapezoid(
          CASE_BOTTOM,
          CASE_BOTTOM + 4,
          caseHalf(CASE_BOTTOM) + 5,
          caseHalf(CASE_BOTTOM) + 7,
        )}
        fill="url(#met-plinth)"
      />
      <path
        className="pendulum-bevel-light"
        d={`M${f(CX - caseHalf(CASE_BOTTOM) - 12)} ${CASE_BOTTOM + 4.4}H${f(CX + caseHalf(CASE_BOTTOM) + 12)}`}
      />
      <path
        className="pendulum-bevel-light"
        d={`M${f(CX - caseHalf(CASE_BOTTOM) - 5)} ${CASE_BOTTOM + 0.4}H${f(CX + caseHalf(CASE_BOTTOM) + 5)}`}
      />
      <path
        className="pendulum-bevel-dark"
        d={`M${f(CX - caseHalf(CASE_BOTTOM) - 12)} ${PLINTH_BOTTOM - 0.4}H${f(CX + caseHalf(CASE_BOTTOM) + 12)}`}
      />

      {/* The winding key, on the right side. */}
      <g className="pendulum-key">
        <rect
          x={CX + caseHalf(256) - 1}
          y={253.5}
          width={7}
          height={5}
          rx={1}
          fill="url(#met-brass)"
        />
        <path
          d={`M${f(CX + caseHalf(256) + 5)} 247q4-1.6 8 0v18q-4 1.6-8 0z`}
          fill="url(#met-brass)"
        />
      </g>

      {/* The case: walnut, grain, a polish, bevelled edges. */}
      <path d={CASE} fill="url(#met-walnut)" />
      <g clipPath="url(#met-case-clip)">
        {GRAIN.map((line, i) => (
          <path
            key={i}
            d={line.d}
            className={line.light ? 'pendulum-grain is-light' : 'pendulum-grain'}
            strokeWidth={line.width}
            strokeOpacity={line.opacity}
          />
        ))}
        <path d={CASE} fill="url(#met-sheen)" />
        <path d={CASE} fill="url(#met-polish)" />
      </g>
      <path
        className="pendulum-bevel-light"
        d={`M${f(CX - caseHalf(CASE_BOTTOM) + 0.6)} ${CASE_BOTTOM}L${f(CX - caseHalf(CASE_TOP) + 0.5)} ${CASE_TOP + 0.5}H${f(CX + caseHalf(CASE_TOP) - 0.5)}`}
      />
      <path
        className="pendulum-bevel-dark"
        d={`M${f(CX + caseHalf(CASE_TOP) - 0.5)} ${CASE_TOP + 0.5}L${f(CX + caseHalf(CASE_BOTTOM) - 0.6)} ${CASE_BOTTOM}`}
      />

      {/* The recess: its walls, then the plate set in it. */}
      <path d={recessPath(0)} fill="url(#met-recess)" />
      <path
        className="pendulum-bevel-light"
        d={`M${f(CX + caseHalf(RECESS_BOTTOM) - RECESS_INSET - 0.3)} ${RECESS_BOTTOM - 0.4}H${f(CX - caseHalf(RECESS_BOTTOM) + RECESS_INSET + 0.3)}`}
      />
      <path d={recessPath(PLATE_MARGIN)} fill="url(#met-ivory)" />
      {/* Where the plate meets the walls: a shade all round, deeper under the top and left. */}
      <g clipPath="url(#met-plate-clip)" className="pendulum-inner">
        {[7, 4, 1.8].map((width) => (
          <path key={width} d={recessPath(PLATE_MARGIN)} strokeWidth={width} />
        ))}
        {[9, 5, 2.4].map((width) => (
          <path key={width} d={recessEdge(PLATE_MARGIN)} strokeWidth={width} />
        ))}
      </g>
      <path d={recessPath(PLATE_MARGIN + 2)} className="pendulum-frame" />

      {/* The scale: a tick for every mark, numbers left, the Italian marks right. */}
      <g className="pendulum-ticks">
        {SCALE_MARKS.map((mark) => {
          const y = f(weightY(mark));
          const major = labels.has(mark);
          const [left, right] = major ? TICK_MAJOR : TICK;
          return (
            <path
              key={mark}
              d={`M${f(CX - left)} ${y}H${f(CX + right)}`}
              className={major ? 'is-major' : undefined}
            />
          );
        })}
      </g>
      <g className="pendulum-numbers" fontSize={LABEL_SIZE}>
        {SCALE_LABELS.map((mark) => (
          <text
            key={mark}
            x={LABEL_X}
            y={f(weightY(mark))}
            textAnchor="end"
            dominantBaseline="central"
            className={narrow.has(mark) ? undefined : 'is-minor'}
          >
            {mark}
          </text>
        ))}
      </g>
      <g className="pendulum-bands" fontSize={BAND_SIZE}>
        {TEMPO_BANDS.map((band) => (
          <text
            key={band.name}
            x={BAND_X}
            y={f(band.y)}
            dominantBaseline="central"
            textLength={f(band.word.length * BAND_ADVANCE)}
            lengthAdjust="spacingAndGlyphs"
            lang="it"
          >
            {band.word}
          </text>
        ))}
      </g>

      {/* The clip's plate, screwed to the case above the recess. */}
      <rect x={CX - 6.5} y={31.5} width={13} height={9} rx={1.8} fill="url(#met-brass)" />
      <circle cx={CX - 4.2} cy={38.4} r={0.8} className="pendulum-screw" />
      <circle cx={CX + 4.2} cy={38.4} r={0.8} className="pendulum-screw" />
    </svg>
  );
});

/** A shape's shadow: copies growing outwards, each faint, for a soft edge without a filter. */
function Soft({ d, stroke }: { d: string; stroke?: boolean }) {
  return (
    <>
      {[4.2, 2.8, 1.4, 0].map((spread) => (
        <path
          key={spread}
          d={d}
          strokeWidth={stroke ? ROD_HALF * 2 + spread : spread}
          className={stroke ? 'pendulum-soft is-stroke' : 'pendulum-soft'}
        />
      ))}
    </>
  );
}

/** The pendulum; `bpm` places the weight. The painter (paint.ts) swings the layers. */
export function Pendulum({ bpm, ref }: { bpm: number; ref?: Ref<HTMLDivElement> }) {
  const weight = { transform: `translateY(${f(weightY(bpm))}px)` };
  return (
    <div
      className="pendulum"
      ref={ref}
      aria-hidden="true"
      style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}
    >
      <Case />
      <div className="pendulum-shade" style={{ clipPath: CASE_CLIP }}>
        <svg
          className="pendulum-shadow"
          viewBox={VIEW_BOX}
          style={{ transformOrigin: PIVOT_ORIGIN, transform: SHADOW_OFFSET }}
        >
          <Soft d={`M${CX} ${ROD_TOP + 2}V${PIVOT_Y}`} stroke />
          <g className="pendulum-weight" style={weight}>
            <Soft d={WEIGHT} />
          </g>
        </svg>
      </div>
      <svg className="pendulum-rod" viewBox={VIEW_BOX} style={{ transformOrigin: PIVOT_ORIGIN }}>
        <defs>
          <linearGradient id="met-rod" x1="0" x2="1" y1="0" y2="0">
            {stop(0, 'var(--brass-lo)')}
            {stop(0.28, 'var(--brass-spec)')}
            {stop(0.5, 'var(--brass)')}
            {stop(1, 'var(--brass-lo)')}
          </linearGradient>
          <linearGradient
            id="met-weight"
            gradientUnits="userSpaceOnUse"
            x1={CX - WEIGHT_BOTTOM_HALF}
            x2={CX + WEIGHT_BOTTOM_HALF}
            y1="0"
            y2="4"
          >
            {stop(0, 'var(--brass-hi)')}
            {stop(0.3, 'var(--brass-spec)')}
            {stop(0.55, 'var(--brass)')}
            {stop(1, 'var(--brass-lo)')}
          </linearGradient>
          <linearGradient id="met-weight-shade" x1="0" x2="0" y1="0" y2="1">
            {stop(0, '#fff8e6', 0.35)}
            {stop(0.12, '#fff8e6', 0)}
            {stop(0.7, '#2a1c06', 0)}
            {stop(1, '#2a1c06', 0.35)}
          </linearGradient>
          <linearGradient id="met-glint" x1="0" x2="1" y1="0" y2="0">
            {stop(0, '#fffaf0', 0)}
            {stop(0.5, '#fffaf0', 0.95)}
            {stop(1, '#fffaf0', 0)}
          </linearGradient>
          <radialGradient id="met-hub" cx="0.5" cy="0.5" r="0.5">
            {stop(0, 'var(--brass-spec)')}
            {stop(0.35, 'var(--brass)')}
            {stop(0.7, 'var(--brass-hi)')}
            {stop(0.86, 'var(--brass-lo)')}
            {stop(1, 'var(--brass-lo)')}
          </radialGradient>
          <clipPath id="met-weight-clip">
            <path d={WEIGHT} />
          </clipPath>
        </defs>
        <rect
          x={CX - ROD_HALF}
          y={ROD_TOP}
          width={ROD_HALF * 2}
          height={ROD_LENGTH}
          rx={ROD_HALF}
          fill="url(#met-rod)"
        />
        <ellipse cx={CX} cy={ROD_TOP + 0.6} rx={1.9} ry={1.5} fill="url(#met-hub)" />
        <g className="pendulum-weight" style={weight}>
          <path d={WEIGHT} fill="url(#met-weight)" />
          <path d={WEIGHT} fill="url(#met-weight-shade)" />
          <path
            className="pendulum-engraving"
            d={`M${f(CX - WEIGHT_TOP_HALF - 0.9)} 8H${f(CX + WEIGHT_TOP_HALF + 0.9)}`}
          />
          <path
            className="pendulum-index"
            d={`M${f(CX - WEIGHT_TOP_HALF + 0.3)} 0.35H${f(CX + WEIGHT_TOP_HALF - 0.3)}`}
          />
          <g clipPath="url(#met-weight-clip)">
            <path
              className="pendulum-glint"
              d={`M${f(CX - WEIGHT_BOTTOM_HALF - 12)} ${WEIGHT_H + 2}l6-${WEIGHT_H + 4}h7l-6 ${WEIGHT_H + 4}z`}
              fill="url(#met-glint)"
            />
          </g>
        </g>
        <circle cx={CX} cy={PIVOT_Y} r={HUB_R} fill="url(#met-hub)" />
        <path
          className="pendulum-slot"
          d={`M${CX} ${PIVOT_Y - HUB_R * 0.55}V${PIVOT_Y + HUB_R * 0.55}`}
        />
      </svg>
      <svg className="pendulum-front" viewBox={VIEW_BOX}>
        <path className="pendulum-jaw-shade" d={`M${CX - 4.6} 36.4q4.6 3 9.2 0`} />
        <path className="pendulum-jaw" d={`M${CX - 4.6} 35.8q4.6 3 9.2 0`} />
      </svg>
    </div>
  );
}
