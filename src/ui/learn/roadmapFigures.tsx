import { pitchToMidi } from '../../core/note.ts';
import { roadOrder, type RoadBar, type RoadJump } from '../../core/roadmap.ts';
import { EngravedStaff, type StaffNote } from '../engraving/EngravedStaff.tsx';
import { staffY } from '../engraving/geometry.ts';
import { CODA, SEGNO } from '../engraving/glyphs.ts';
import { PlayButton } from './kit.tsx';
import { LessonPiano } from './LessonPiano.tsx';
import { keyName, usePlaySequence } from './lesson.ts';
import { pitch } from './notes.ts';

// The glossary's figures for finding your way in a score (docs/GLOSSARY.md): a strip of bars with
// their repeats, endings and jumps, and the order they are played in (core/roadmap.ts); the kinds
// of barline on one staff; and an 8va, as written and as played.

// --- The road map -----------------------------------------------------------------------------

/** One bar's drawing, in pixels: a box with the signs above it and the jump under it. */
const W = 104;
const H = 96;
const TOP = 36;
const BOTTOM = 68;
/** Bravura's units to pixels: a staff space of 7. */
const GLYPH = 0.028;

/** The words under a bar that jumps, as a score prints them. */
function jumpText({ from, to }: RoadJump): string {
  const sign = from === 'dc' ? 'D.C.' : 'D.S.';
  return to === 'fine' ? `${sign} al Fine` : to === 'coda' ? `${sign} al Coda` : sign;
}

/** A repeat sign at one edge of the box: the thick line outside, the thin one and the dots in. */
function RepeatSign({ side }: { side: 'start' | 'end' }) {
  const thick = side === 'start' ? 0 : W - 4;
  const thin = side === 'start' ? 7 : W - 8;
  const dots = side === 'start' ? 12 : W - 12;
  const mid = (TOP + BOTTOM) / 2;
  return (
    <>
      <rect className="roadmap-thick" x={thick} y={TOP} width={4} height={BOTTOM - TOP} />
      <line className="roadmap-line" x1={thin} x2={thin} y1={TOP} y2={BOTTOM} />
      <circle className="roadmap-dot" cx={dots} cy={mid - 6} r={2.2} />
      <circle className="roadmap-dot" cx={dots} cy={mid + 6} r={2.2} />
    </>
  );
}

/** One bar: its number, its edges and repeat signs, its bracket, its signs and its jump. */
function Bar({
  bar,
  number,
  last,
  opensEnding,
  closesEnding,
  lit,
}: {
  bar: RoadBar;
  number: number;
  last: boolean;
  /** The first bar under its bracket: the bracket's hook and number go here. */
  opensEnding: boolean;
  /** The last bar of a first ending: its bracket closes. */
  closesEnding: boolean;
  lit: boolean;
}) {
  const ending = bar.ending;
  return (
    <svg className="roadmap-bar" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <rect
        className={lit ? 'roadmap-box is-lit' : 'roadmap-box'}
        x={0.5}
        y={TOP}
        width={W - 1}
        height={BOTTOM - TOP}
      />
      <text className="roadmap-number" x={W / 2} y={(TOP + BOTTOM) / 2} dominantBaseline="central">
        {number}
      </text>
      {bar.start && <RepeatSign side="start" />}
      {bar.end && <RepeatSign side="end" />}
      {last && !bar.end && (
        <>
          <line className="roadmap-line" x1={W - 8} x2={W - 8} y1={TOP} y2={BOTTOM} />
          <rect className="roadmap-thick" x={W - 4} y={TOP} width={4} height={BOTTOM - TOP} />
        </>
      )}

      {ending && (
        <g className="roadmap-ending">
          <line className="roadmap-line" x1={0} x2={W} y1={12} y2={12} />
          {opensEnding && (
            <>
              <line className="roadmap-line" x1={1} x2={1} y1={12} y2={TOP - 4} />
              <text className="roadmap-text" x={6} y={26}>
                {ending.map((n) => `${n}.`).join(' ')}
              </text>
            </>
          )}
          {closesEnding && (
            <line className="roadmap-line" x1={W - 1} x2={W - 1} y1={12} y2={TOP - 4} />
          )}
        </g>
      )}
      {bar.segno && (
        <path
          className="roadmap-sign"
          d={SEGNO}
          transform={`translate(6 ${TOP - 6}) scale(${GLYPH})`}
        />
      )}
      {bar.coda && (
        <path
          className="roadmap-sign"
          d={CODA}
          transform={`translate(4 ${TOP - 7}) scale(${GLYPH})`}
        />
      )}
      {bar.fine && (
        <text className="roadmap-text is-word" x={W - 6} y={TOP - 8} textAnchor="end">
          Fine
        </text>
      )}
      {bar.toCoda && (
        <>
          <text className="roadmap-text is-word" x={W - 26} y={TOP - 8} textAnchor="end">
            To Coda
          </text>
          <path
            className="roadmap-sign"
            d={CODA}
            transform={`translate(${W - 22} ${TOP - 7}) scale(0.02)`}
          />
        </>
      )}
      {bar.jump && (
        <text className="roadmap-text is-word" x={W - 4} y={H - 8} textAnchor="end">
          {jumpText(bar.jump)}
        </text>
      )}
    </svg>
  );
}

/** A note a bar sounds when the map is played: C4 for bar 1, then up the scale. */
const BAR_NOTES = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'].map((p) =>
  pitchToMidi(pitch(p)),
);

/**
 * A short score as a strip of numbered bars with its signs, and under it the order the bars are
 * played in. Played, each bar sounds one note (bar 1 a C, bar 2 a D…), lit with its number as it
 * sounds, so a jump back is heard as the tune coming round again.
 */
export function RoadMap({
  bars,
  label,
  orderLabel,
}: {
  bars: readonly RoadBar[];
  /** The figure's name for assistive technology: what the bars say. */
  label: string;
  /** "Played:", before the order. */
  orderLabel: string;
}) {
  const listen = usePlaySequence();
  const order = roadOrder(bars);
  const sounding = listen.at === null ? null : order[listen.at];
  return (
    <>
      <div className="roadmap" role="img" aria-label={label}>
        {bars.map((bar, i) => {
          const before = bars[i - 1]?.ending;
          const after = bars[i + 1]?.ending;
          return (
            <Bar
              key={i}
              bar={bar}
              number={i + 1}
              last={i === bars.length - 1}
              opensEnding={Boolean(bar.ending) && before?.join() !== bar.ending?.join()}
              closesEnding={Boolean(bar.ending && bar.end) && after?.join() !== bar.ending?.join()}
              lit={sounding === i}
            />
          );
        })}
      </div>
      <div className="roadmap-order">
        <span className="roadmap-order-label">{orderLabel}</span>
        <ol>
          {order.map((at, step) => (
            <li key={step} className={listen.at === step ? 'is-lit' : undefined}>
              {at + 1}
            </li>
          ))}
        </ol>
      </div>
      <div className="plate-actions">
        <PlayButton
          onClick={() =>
            listen.play(
              order.map((at) => BAR_NOTES[at % BAR_NOTES.length]!),
              420,
            )
          }
        />
      </div>
    </>
  );
}

// --- Barlines ---------------------------------------------------------------------------------

const BARLINE_X = { single: 130, double: 230, repeat: 330 } as const;

/**
 * Four bars on one staff, a whole note in each, ended by the four kinds of barline: a single one,
 * a double one, the end of a repeat and the end of the piece. `names` are the barlines' names, in
 * that order, written under each.
 */
export function Barlines({
  label,
  names,
}: {
  label: string;
  names: readonly [string, string, string, string];
}) {
  const top = staffY('plain', 'treble', 8);
  const bottom = staffY('plain', 'treble', 0);
  const notes: StaffNote[] = ['G4', 'A4', 'B4', 'C5'].map((p, i) => ({
    id: p,
    pitch: pitch(p),
    clef: 'treble',
    x: [70, 172, 272, 370][i]!,
  }));
  const repeat = BARLINE_X.repeat;
  return (
    <EngravedStaff
      system="plain"
      width={440}
      below={18}
      className="plate-staff"
      label={label}
      notes={notes}
      bars={[BARLINE_X.single, BARLINE_X.double - 6, BARLINE_X.double, repeat - 7]}
      labels={[
        { clef: 'treble', position: -5, x: BARLINE_X.single, text: names[0] },
        { clef: 'treble', position: -5, x: BARLINE_X.double - 3, text: names[1] },
        { clef: 'treble', position: -5, x: repeat - 4, text: names[2] },
        { clef: 'treble', position: -5, x: 424, text: names[3] },
      ]}
    >
      <rect className="engraved-final" x={repeat - 4} y={top} width={4} height={bottom - top} />
      <circle
        className="engraved-glyph"
        cx={repeat - 13}
        cy={staffY('plain', 'treble', 5)}
        r={2.6}
      />
      <circle
        className="engraved-glyph"
        cx={repeat - 13}
        cy={staffY('plain', 'treble', 3)}
        r={2.6}
      />
    </EngravedStaff>
  );
}

// --- 8va --------------------------------------------------------------------------------------

const WRITTEN = ['C5', 'D5', 'E5'];
const SOUNDING = ['C6', 'D6', 'E6'];

/**
 * Three notes written under an 8va line, and the same three as they sound an octave higher, with
 * the keyboard outlining the keys they are written on and marking the keys played.
 */
export function Ottava({
  label,
  written,
  played,
}: {
  label: string;
  /** Under the written notes: "As written". */
  written: string;
  /** Under the notes as played: "As played". */
  played: string;
}) {
  const listen = usePlaySequence();
  const keys = SOUNDING.map((p) => pitchToMidi(pitch(p)));
  const notes: StaffNote[] = [
    ...WRITTEN.map((p, i) => ({
      id: `w${p}`,
      pitch: pitch(p),
      clef: 'treble' as const,
      x: 70 + i * 36,
      tone: listen.at === i ? ('accent' as const) : ('ink' as const),
    })),
    ...SOUNDING.map((p, i) => ({
      id: `s${p}`,
      pitch: pitch(p),
      clef: 'treble' as const,
      x: 222 + i * 36,
      tone: listen.at === i ? ('accent' as const) : ('ink' as const),
    })),
  ];
  const lineY = staffY('treble', 'treble', 14);
  // The keys the notes are written on, outlined; the keys played, tinted and named.
  const writtenKeys = new Set(WRITTEN.map((p) => pitchToMidi(pitch(p))));
  const classes = new Map(keys.map((k) => [k, 'lk-named']));
  const names = new Map(keys.map((k) => [k, keyName(k)]));
  return (
    <>
      <EngravedStaff
        system="treble"
        width={340}
        below={8}
        className="plate-staff"
        label={label}
        notes={notes}
        bars={[192]}
        labels={[
          { clef: 'treble', position: -4, x: 106, text: written },
          { clef: 'treble', position: -4, x: 258, text: played },
        ]}
      >
        <text className="roadmap-ottava" x={62} y={lineY + 4}>
          8va
        </text>
        <line className="roadmap-ottava-line" x1={90} x2={176} y1={lineY} y2={lineY} />
        <line className="roadmap-ottava-line" x1={176} x2={176} y1={lineY} y2={lineY + 8} />
      </EngravedStaff>
      <div className="plate-actions">
        <PlayButton onClick={() => listen.play(keys, 450)} />
      </div>
      <LessonPiano range={[60, 91]} keyNames={names} keyClasses={classes} hinted={writtenKeys} />
    </>
  );
}
