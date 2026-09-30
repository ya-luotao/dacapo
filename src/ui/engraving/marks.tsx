import { GLYPH, SPACE } from './geometry.ts';
import { ACCENT, DYNAMIC_LETTERS, PEDAL_DOWN, PEDAL_UP, STACCATO, TENUTO } from './glyphs.ts';
import { dynamicWidth, isDynamicLetter } from './shapes.ts';

// What is written around the notes of an EngravedStaff, drawn as its children in the same units
// (10 to a staff space): dynamics, hairpins and the words for them, and the marks over a note
// (shapes.ts has their sizes and the slur's curve). The ink follows the note's tone through
// `className`.

export type ArticulationKind = 'accent' | 'staccato' | 'tenuto';

/** Each articulation's outline, width and height, in font units. */
const ARTICULATIONS: Record<ArticulationKind, { d: string; width: number; height: number }> = {
  accent: { d: ACCENT, width: 339, height: 245 },
  staccato: { d: STACCATO, width: 84, height: 84 },
  tenuto: { d: TENUTO, width: 338, height: 48 },
};

/** A dynamic (pp to ff, sf, sfz) in Bravura's letters, centred on `x`, its baseline at `y`. */
export function Dynamic({
  text,
  x,
  y,
  scale = 1,
  className,
}: {
  text: string;
  x: number;
  y: number;
  scale?: number;
  className?: string;
}) {
  let at = 0;
  const letters: { d: string; at: number }[] = [];
  for (const c of text) {
    if (!isDynamicLetter(c)) continue;
    letters.push({ d: DYNAMIC_LETTERS[c].d, at });
    at += DYNAMIC_LETTERS[c].advance;
  }
  const left = x - dynamicWidth(text, scale) / 2;
  return (
    <g className={className}>
      {letters.map((l, i) => (
        <path
          key={i}
          d={l.d}
          transform={`translate(${left + l.at * GLYPH * scale} ${y}) scale(${GLYPH * scale})`}
        />
      ))}
    </g>
  );
}

/** A dynamic on its own, set in a line of text or on a button, about as tall as the text. */
export function DynamicGlyph({ text }: { text: string }) {
  const width = dynamicWidth(text);
  return (
    <svg
      className="dynamic-glyph"
      viewBox={`-6 -18 ${width + 8} 25`}
      style={{ width: `${(width + 8) / 18}em` }}
      role="img"
      aria-label={text}
    >
      <Dynamic text={text} x={width / 2} y={0} />
    </svg>
  );
}

/** A hairpin from `x1` to `x2`, opening (crescendo) or closing (diminuendo), centred on `y`. */
export function Hairpin({
  x1,
  x2,
  y,
  kind,
  className,
}: {
  x1: number;
  x2: number;
  y: number;
  kind: 'cresc' | 'dim';
  className?: string;
}) {
  const open = 0.45 * SPACE;
  const [narrow, wide] = kind === 'cresc' ? [x1, x2] : [x2, x1];
  return (
    <g className={className}>
      <path
        className="engraved-stroke"
        d={`M${wide} ${y - open}L${narrow} ${y}L${wide} ${y + open}`}
      />
    </g>
  );
}

/** A word such as "cresc." in italics from `x`, and a dashed line after it to `x2`. */
export function Words({
  text,
  x,
  x2,
  y,
  width,
  className,
}: {
  text: string;
  x: number;
  x2?: number;
  y: number;
  /** The word's width, so the dashes start after it whatever the font. */
  width: number;
  className?: string;
}) {
  return (
    <g className={className}>
      <text
        className="engraved-words"
        x={x}
        y={y}
        textLength={width}
        lengthAdjust="spacingAndGlyphs"
      >
        {text}
      </text>
      {x2 !== undefined && x2 > x + width + 6 && (
        <line
          className="engraved-stroke engraved-dashes"
          x1={x + width + 4}
          x2={x2}
          y1={y - 3}
          y2={y - 3}
        />
      )}
    </g>
  );
}

/** The size the pedal marks are set at: Ped. about a staff space and a half tall. */
const PEDAL_SCALE = 0.6;

/** Ped. (press the sustain pedal) from `x`, or the star (let it up) centred on `x`; baseline `y`. */
export function PedalMark({
  kind,
  x,
  y,
  className,
}: {
  kind: 'down' | 'up';
  x: number;
  y: number;
  className?: string;
}) {
  const scale = GLYPH * PEDAL_SCALE;
  const left = kind === 'down' ? x : x - (450 * scale) / 2;
  return (
    <path
      className={className}
      d={kind === 'down' ? PEDAL_DOWN : PEDAL_UP}
      transform={`translate(${left} ${y}) scale(${scale})`}
    />
  );
}

/**
 * The pedal as a line under the staff: down at `x1`, a notch at each change (up and straight down
 * again), up at `x2`.
 */
export function PedalLine({
  x1,
  x2,
  y,
  changes = [],
  className,
}: {
  x1: number;
  x2: number;
  y: number;
  changes?: readonly number[];
  className?: string;
}) {
  const hook = 0.7 * SPACE;
  const notch = 0.35 * SPACE;
  let d = `M${x1} ${y - hook}V${y}`;
  for (const c of changes) d += `H${c - notch}L${c} ${y - hook}L${c + notch} ${y}`;
  d += `H${x2}V${y - hook}`;
  return (
    <g className={className}>
      <path className="engraved-stroke" d={d} />
    </g>
  );
}

/** An articulation centred on `x`: over a note with its bottom at `y`, or under it with its top. */
export function ArticulationMark({
  kind,
  x,
  y,
  below = false,
}: {
  kind: ArticulationKind;
  x: number;
  y: number;
  below?: boolean;
}) {
  const a = ARTICULATIONS[kind];
  const left = x - (a.width * GLYPH) / 2;
  const bottom = below ? y + a.height * GLYPH : y;
  return <path d={a.d} transform={`translate(${left} ${bottom}) scale(${GLYPH})`} />;
}
