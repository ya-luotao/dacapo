import type { ReactNode } from 'react';
import { ledgerLineCount, staffPosition, type Clef, type Pitch } from '../../core/note.ts';
import {
  GLYPH,
  LEDGER_OVERHANG,
  LEFT,
  NOTE_WIDTH,
  SPACE,
  staffBottom,
  staffHeight,
  staffY,
  type StaffSystem,
} from './geometry.ts';
import { BRACE, FLAT, F_CLEF, G_CLEF, NATURAL, SHARP, WHOLE_NOTE } from './glyphs.ts';

// A small engraved staff in SVG, drawn from Bravura's outlines: one staff with or without a clef,
// or a braced grand staff. For the home page's specimen and the lessons' figures. SVG units are
// 10 to a staff space; a note or a highlight is placed by its staff position (0 = the bottom line,
// one step per line or space), so the drawing needs no font and no layout pass.

export type { StaffSystem } from './geometry.ts';

export interface StaffNote {
  /** Stable across renders, so a note that moves glides to its new place. */
  id: string;
  pitch: Pitch;
  /** The staff it is written on; on a single staff, that staff's clef. */
  clef: Clef;
  /** The notehead's left edge. */
  x: number;
  tone?: 'ink' | 'accent' | 'good' | 'bad' | 'faint';
  /** Draw the accidental even when it is a natural (a courtesy natural). */
  natural?: boolean;
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

/** The staves a system has, and the clef each is read in (a plain staff reads as treble). */
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

function accidentalGlyph(note: StaffNote): string | null {
  if (note.pitch.accidental === 1) return SHARP;
  if (note.pitch.accidental === -1) return FLAT;
  return note.natural ? NATURAL : null;
}

export function EngravedStaff({
  system,
  width = 300,
  notes = [],
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
  const top = staffY(system, staves[0]!, 8);
  const bottom = staffBottom(system, staves.at(-1)!);
  const interactive = Boolean(onHover || onPick);
  const hasClef = system !== 'plain';

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
          [0, 2, 4, 6, 8].map((p) => (
            <line
              key={`${clef}${p}`}
              x1={LEFT}
              x2={right}
              y1={staffY(system, clef, p)}
              y2={staffY(system, clef, p)}
            />
          )),
        )}
        {system === 'grand' && (
          <line className="engraved-bar" x1={LEFT} x2={LEFT} y1={top} y2={bottom} />
        )}
        <line className="engraved-bar" x1={right - 7} x2={right - 7} y1={top} y2={bottom} />
        {staves.length === 1 && (
          <line className="engraved-bar" x1={LEFT} x2={LEFT} y1={top} y2={bottom} />
        )}
      </g>
      <rect className="engraved-final" x={right - 4} y={top} width={4} height={bottom - top} />

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

      {notes.map((note) => {
        const position = staffPosition(note.pitch, note.clef);
        const y = staffY(system, note.clef, position);
        const accidental = accidentalGlyph(note);
        return (
          <g key={note.id} className={`engraved-note is-${note.tone ?? 'ink'}`}>
            <g key={`${note.clef}${position}`} className="engraved-ledgers">
              {ledgerYs(system, note.clef, position).map((ly) => (
                <line
                  key={ly}
                  x1={note.x - LEDGER_OVERHANG}
                  x2={note.x + NOTE_WIDTH + LEDGER_OVERHANG}
                  y1={ly}
                  y2={ly}
                />
              ))}
            </g>
            <g className="engraved-head" style={{ transform: `translate(${note.x}px, ${y}px)` }}>
              {accidental && <path d={accidental} transform={`translate(-15 0) scale(${GLYPH})`} />}
              <path d={WHOLE_NOTE} transform={`scale(${GLYPH})`} />
            </g>
          </g>
        );
      })}

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
