import type { ReactNode } from 'react';
import { ledgerLineCount, staffPosition, type Clef, type Pitch } from '../../core/note.ts';
import {
  GLYPH,
  HEAD_WIDTH,
  KEY_STEP,
  keySignaturePositions,
  keySignatureX,
  LEDGER_OVERHANG,
  LEFT,
  SPACE,
  staffBottom,
  staffHeight,
  staffY,
  STEM_LENGTH,
  STEM_WIDTH,
  timeSignatureX,
  WHOLE_WIDTH,
  type StaffSystem,
} from './geometry.ts';
import {
  BLACK_HEAD,
  BRACE,
  DOT,
  FLAG_8TH_UP,
  FLAT,
  F_CLEF,
  G_CLEF,
  HALF_HEAD,
  NATURAL,
  REST_8TH,
  REST_HALF,
  REST_QUARTER,
  REST_WHOLE,
  SHARP,
  TIME_DIGITS,
  WHOLE_NOTE,
} from './glyphs.ts';

// A small engraved staff in SVG, drawn from Bravura's outlines: one staff with or without a clef,
// a braced grand staff, or a single rhythm line. For the home page's specimen and the lessons'
// figures. SVG units are 10 to a staff space; a note or a highlight is placed by its staff
// position (0 = the bottom line, one step per line or space), so the drawing needs no font and no
// layout pass: the caller says where each note goes across.

export type { StaffSystem } from './geometry.ts';

export type Duration = 'whole' | 'half' | 'quarter' | 'eighth';

export interface StaffNote {
  /** Stable across renders, so a note that moves glides to its new place. */
  id: string;
  /** The note, or null for a rest. On a rhythm line the pitch is ignored. */
  pitch: Pitch | null;
  /** The staff it is written on; on a single staff, that staff's clef. */
  clef: Clef;
  /** The notehead's left edge. */
  x: number;
  duration?: Duration;
  dotted?: boolean;
  /** Up by default below the middle line, down from it (always up on a rhythm line). */
  stem?: 'up' | 'down';
  /** False when the caller draws a beam instead of the eighth's flag. */
  flag?: boolean;
  tone?: 'ink' | 'accent' | 'good' | 'bad' | 'faint';
  /** Draw the accidental even when it is a natural (a courtesy natural). */
  natural?: boolean;
  /** Leave the accidental out: the key signature already gives it. */
  inKey?: boolean;
}

export interface StaffMark {
  clef: Clef;
  position: number;
  tone?: 'accent' | 'faint';
}

export interface StaffLabel {
  clef: Clef;
  position: number;
  x: number;
  text: string;
}

interface EngravedStaffProps {
  system: StaffSystem;
  /** Width of the drawing; the staff runs from the brace or clef to a final barline at its end. */
  width?: number;
  notes?: readonly StaffNote[];
  /** Key signature: sharps (+) or flats (−). */
  fifths?: number;
  /** Time signature, as [beats, beat unit]. */
  time?: readonly [number, number];
  /** Barlines inside the staff, by x. */
  bars?: readonly number[];
  /** Lines and spaces to wash in a colour: a line as a thicker stroke, a space as a band. */
  marks?: readonly StaffMark[];
  labels?: readonly StaffLabel[];
  /** Draws the clef (or both clefs) in the accent colour. */
  clefAccent?: boolean;
  /** Called with the position under the pointer (and the staff it is on), or null on leaving. */
  onHover?: (at: { clef: Clef; position: number } | null) => void;
  onPick?: (at: { clef: Clef; position: number }) => void;
  /** Positions the pointer can reach on each staff, as [lowest, highest]. */
  reach?: Partial<Record<Clef, readonly [number, number]>>;
  label: string;
  className?: string;
  children?: ReactNode;
}

/** The staves a system has, and the clef each is read in (plain and rhythm read as treble). */
function stavesOf(system: StaffSystem): Clef[] {
  if (system === 'grand') return ['treble', 'bass'];
  return [system === 'bass' ? 'bass' : 'treble'];
}

/** The ledger lines a note at `position` needs, as y coordinates. */
function ledgerYs(system: StaffSystem, clef: Clef, position: number): number[] {
  const ys: number[] = [];
  for (let i = 1; i <= ledgerLineCount(position); i++) {
    ys.push(staffY(system, clef, position < 0 ? -2 * i : 8 + 2 * i));
  }
  return ys;
}

/** On a grand staff the two staves share the space between them: middle C is the border. */
function defaultReach(system: StaffSystem, clef: Clef): readonly [number, number] {
  if (system !== 'grand') return [-4, 12];
  return clef === 'treble' ? [-2, 12] : [-4, 10];
}

function accidentalGlyph(pitch: Pitch, natural: boolean | undefined): string | null {
  if (pitch.accidental === 1) return SHARP;
  if (pitch.accidental === -1) return FLAT;
  return natural ? NATURAL : null;
}

const RESTS: Record<Duration, { glyph: string; position: number }> = {
  whole: { glyph: REST_WHOLE, position: 6 },
  half: { glyph: REST_HALF, position: 4 },
  quarter: { glyph: REST_QUARTER, position: 4 },
  eighth: { glyph: REST_8TH, position: 4 },
};

function Note({ system, note }: { system: StaffSystem; note: StaffNote }) {
  const duration = note.duration ?? 'whole';
  const tone = `engraved-note is-${note.tone ?? 'ink'}`;

  if (note.pitch === null) {
    const rest = RESTS[duration];
    const y = staffY(system, note.clef, rest.position);
    return (
      <g className={tone}>
        <path d={rest.glyph} transform={`translate(${note.x} ${y}) scale(${GLYPH})`} />
      </g>
    );
  }

  const position = system === 'rhythm' ? 4 : staffPosition(note.pitch, note.clef);
  const y = staffY(system, note.clef, position);
  const width = duration === 'whole' ? WHOLE_WIDTH : HEAD_WIDTH;
  const head = duration === 'whole' ? WHOLE_NOTE : duration === 'half' ? HALF_HEAD : BLACK_HEAD;
  const up = system === 'rhythm' || (note.stem ?? (position < 4 ? 'up' : 'down')) === 'up';
  const accidental =
    system === 'rhythm' || note.inKey ? null : accidentalGlyph(note.pitch, note.natural);
  // A dot beside a note on a line sits in the space above.
  const dotY = position % 2 === 0 ? -SPACE / 2 : 0;

  return (
    <g className={tone}>
      <g key={`${note.clef}${position}`} className="engraved-ledgers">
        {ledgerYs(system, note.clef, position).map((ly) => (
          <line
            key={ly}
            x1={note.x - LEDGER_OVERHANG}
            x2={note.x + width + LEDGER_OVERHANG}
            y1={ly}
            y2={ly}
          />
        ))}
      </g>
      <g className="engraved-head" style={{ transform: `translate(${note.x}px, ${y}px)` }}>
        {accidental && <path d={accidental} transform={`translate(-15 0) scale(${GLYPH})`} />}
        <path d={head} transform={`scale(${GLYPH})`} />
        {duration !== 'whole' &&
          (up ? (
            <rect
              x={width - STEM_WIDTH}
              y={-STEM_LENGTH}
              width={STEM_WIDTH}
              height={STEM_LENGTH - 1.7}
            />
          ) : (
            <rect x={0} y={1.7} width={STEM_WIDTH} height={STEM_LENGTH - 1.7} />
          ))}
        {duration === 'eighth' && up && note.flag !== false && (
          <path
            d={FLAG_8TH_UP}
            transform={`translate(${width - STEM_WIDTH} ${-STEM_LENGTH}) scale(${GLYPH})`}
          />
        )}
        {note.dotted && (
          <path d={DOT} transform={`translate(${width + 4} ${dotY}) scale(${GLYPH})`} />
        )}
      </g>
    </g>
  );
}

export function EngravedStaff({
  system,
  width = 300,
  notes = [],
  fifths = 0,
  time,
  bars = [],
  marks = [],
  labels = [],
  clefAccent = false,
  onHover,
  onPick,
  reach,
  label,
  className,
  children,
}: EngravedStaffProps) {
  const staves = stavesOf(system);
  const height = staffHeight(system);
  const right = width - 12;
  const rhythm = system === 'rhythm';
  const top = staffY(system, staves[0]!, 8);
  const bottom = staffBottom(system, staves.at(-1)!);
  const [barTop, barBottom] = rhythm
    ? [staffY(system, 'treble', 6), staffY(system, 'treble', 2)]
    : [top, bottom];
  const interactive = Boolean(onHover || onPick);
  const hasClef = system === 'treble' || system === 'bass' || system === 'grand';
  const lines = rhythm ? [4] : [0, 2, 4, 6, 8];

  return (
    <svg
      className={className ? `engraved ${className}` : 'engraved'}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      onPointerLeave={onHover ? () => onHover(null) : undefined}
    >
      {marks.map(({ clef, position, tone = 'accent' }) =>
        position % 2 === 0 ? (
          <line
            key={`${clef}${position}`}
            className={`engraved-mark is-${tone}`}
            x1={LEFT}
            x2={right}
            y1={staffY(system, clef, position)}
            y2={staffY(system, clef, position)}
          />
        ) : (
          <rect
            key={`${clef}${position}`}
            className={`engraved-band is-${tone}`}
            x={LEFT}
            y={staffY(system, clef, position) - SPACE / 2}
            width={right - LEFT}
            height={SPACE}
          />
        ),
      )}

      <g className="engraved-lines">
        {staves.flatMap((clef) =>
          lines.map((p) => (
            <line
              key={`${clef}${p}`}
              x1={LEFT}
              x2={right}
              y1={staffY(system, clef, p)}
              y2={staffY(system, clef, p)}
            />
          )),
        )}
        {/* A system of two staves is joined at its start; a single staff starts open. */}
        {system === 'grand' && (
          <line className="engraved-bar" x1={LEFT} x2={LEFT} y1={barTop} y2={barBottom} />
        )}
        {bars.map((x) => (
          <line key={x} className="engraved-bar" x1={x} x2={x} y1={barTop} y2={barBottom} />
        ))}
        <line className="engraved-bar" x1={right - 7} x2={right - 7} y1={barTop} y2={barBottom} />
      </g>
      <rect
        className="engraved-final"
        x={right - 4}
        y={barTop}
        width={4}
        height={barBottom - barTop}
      />

      {system === 'grand' && (
        <path
          className="engraved-glyph"
          d={BRACE}
          transform={`translate(${LEFT - 12} ${bottom}) scale(${(bottom - top) / 997})`}
        />
      )}
      {hasClef && (
        <g className={clefAccent ? 'engraved-clefs is-accent' : 'engraved-clefs'}>
          {staves.map((clef) => (
            <path
              key={clef}
              d={clef === 'treble' ? G_CLEF : F_CLEF}
              transform={`translate(${LEFT + 8} ${staffY(system, clef, clef === 'treble' ? 2 : 6)}) scale(${GLYPH})`}
            />
          ))}
        </g>
      )}
      {fifths !== 0 && hasClef && (
        <g className="engraved-signature">
          {staves.flatMap((clef) =>
            keySignaturePositions(fifths, clef).map((position, i) => (
              <path
                key={`${clef}${i}`}
                d={fifths > 0 ? SHARP : FLAT}
                transform={`translate(${keySignatureX(system) + i * KEY_STEP} ${staffY(system, clef, position)}) scale(${GLYPH})`}
              />
            )),
          )}
        </g>
      )}
      {time && (
        <g className="engraved-time">
          {staves.flatMap((clef) =>
            time.map((n, i) => (
              <path
                key={`${clef}${i}`}
                d={TIME_DIGITS[n] ?? ''}
                transform={`translate(${timeSignatureX(system, fifths)} ${staffY(system, clef, i === 0 ? 6 : 2)}) scale(${GLYPH})`}
              />
            )),
          )}
        </g>
      )}

      {labels.map(({ clef, position, x, text }) => (
        <text
          key={`${clef}${position}${x}`}
          className="engraved-label"
          x={x}
          y={staffY(system, clef, position)}
          dominantBaseline="central"
          textAnchor="middle"
        >
          {text}
        </text>
      ))}

      {notes.map((note) => (
        <Note key={note.id} system={system} note={note} />
      ))}

      {interactive &&
        staves.flatMap((clef) => {
          const [low, high] = reach?.[clef] ?? defaultReach(system, clef);
          const cells = [];
          for (let p = low; p <= high; p++) {
            cells.push(
              <rect
                key={`${clef}${p}`}
                className="engraved-hit"
                x={hasClef ? LEFT + 40 : LEFT}
                y={staffY(system, clef, p) - SPACE / 4}
                width={right - (hasClef ? LEFT + 40 : LEFT)}
                height={SPACE / 2}
                onPointerEnter={onHover ? () => onHover({ clef, position: p }) : undefined}
                onPointerDown={onPick ? () => onPick({ clef, position: p }) : undefined}
              />,
            );
          }
          return cells;
        })}
      {children}
    </svg>
  );
}
