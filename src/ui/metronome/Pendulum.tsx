import type { Ref } from 'react';
import { LABEL_SIDE, PIVOT_X, PIVOT_Y, ROD_TOP, SCALE_MARKS, weightY } from './paint.ts';

// A Maelzel metronome in ink: a pyramid case, the tempo scale on its face, and a pendulum on a
// pivot near the foot with a weight that slides up the rod for slower tempos. The drawing is
// static; paint.ts moves it, from the animation frame.

export function Pendulum({ bpm, ref }: { bpm: number; ref?: Ref<SVGSVGElement> }) {
  return (
    <svg className="pendulum" viewBox="0 0 240 340" ref={ref} aria-hidden="true">
      <path className="pendulum-case" d="M26 324 88 30q32-14 64 0l62 294z" />
      <path className="pendulum-face" d="M56 304 98 46h44l42 258z" />
      <g className="pendulum-scale">
        {SCALE_MARKS.map((mark) => {
          const y = weightY(mark);
          const side = LABEL_SIDE.get(mark);
          const labelled = side !== undefined;
          return (
            <g key={mark}>
              <line
                x1={PIVOT_X - (labelled ? 7 : 4)}
                x2={PIVOT_X + (labelled ? 7 : 4)}
                y1={y}
                y2={y}
                className={labelled ? 'is-major' : undefined}
              />
              {side !== undefined && (
                <text
                  x={PIVOT_X + side * 21}
                  y={y}
                  textAnchor={side < 0 ? 'end' : 'start'}
                  dominantBaseline="central"
                >
                  {mark}
                </text>
              )}
            </g>
          );
        })}
      </g>
      <g className="pendulum-rod">
        <line x1={PIVOT_X} y1={PIVOT_Y} x2={PIVOT_X} y2={ROD_TOP} />
        <g className="pendulum-weight" style={{ transform: `translateY(${weightY(bpm)}px)` }}>
          <path d="M107 0h26l5 20h-36z" />
          <path className="pendulum-flash" d="M107 0h26l5 20h-36z" />
          <line className="pendulum-index" x1="104" x2="136" y1="0" y2="0" />
        </g>
        <path className="pendulum-bob" d="M111 300h18l4 18h-26z" />
      </g>
      <circle className="pendulum-pivot" cx={PIVOT_X} cy={PIVOT_Y} r="3.5" />
      <rect className="pendulum-base" x="14" y="324" width="212" height="9" rx="1.5" />
    </svg>
  );
}
