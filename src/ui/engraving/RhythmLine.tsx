import type { CSSProperties } from 'react';
import { EngravedStaff, type StaffLabel, type StaffNote } from './EngravedStaff.tsx';
import { bodyStart, GLYPH, HEAD_WIDTH, SPACE, staffY, STEM_WIDTH, stemTop } from './geometry.ts';
import { TUPLET_3 } from './glyphs.ts';
import {
  countLabels,
  layout,
  meterOf,
  QUARTER,
  TICKS,
  type Beat,
  type Placed,
  type Time,
} from './rhythmLayout.ts';

export type { Beat, Time } from './rhythmLayout.ts';

// A rhythm written on a single line, for the rhythm lessons (learn/rhythmFigures.tsx) and for
// rhythm dictation on the Ear page: notes spaced by how long they last, beamed by the beat (by
// three eighths in 6/8), ties, triplets with their bracket, rests, the counts under the line.
// Its time is `rhythmLayout.ts`'s.

export type Tone = NonNullable<StaffNote['tone']>;

/** A tie under two noteheads (the stems are up), as a crescent: thin at its ends, full mid-way. */
function tiePath(x1: number, x2: number, y: number): string {
  const depth = Math.min(7, Math.max(3.5, (x2 - x1) * 0.12));
  const thick = 0.22 * SPACE;
  const d = (x2 - x1) / 4;
  const outer = y + depth / 0.75;
  const inner = y + (depth - thick) / 0.75;
  return (
    `M${x1} ${y}C${x1 + d} ${outer} ${x2 - d} ${outer} ${x2} ${y}` +
    `C${x2 - d} ${inner} ${x1 + d} ${inner} ${x1} ${y}Z`
  );
}

const BEAM = 0.5 * SPACE;
const BEAM_GAP = 0.25 * SPACE;
/** Room over the stems for a triplet's bracket and its 3. */
const TUPLET_ROOM = 18;
/** Room over them (and over a triplet's 3) for a line of timings. */
const MARK_ROOM = 16;

/**
 * A rhythm on one line: time signature, notes spaced by how long they last, beamed by the beat
 * (in threes in 6/8), ties, triplets with their bracket, and the count under each beat.
 */
export function RhythmLine({
  rhythm,
  time = [4, 4],
  label,
  current = null,
  tones,
  counts = true,
  bracket = false,
  spacing,
  words,
  bare = false,
  marks = [],
  className,
}: {
  rhythm: readonly Beat[];
  time?: Time;
  label: string;
  /** The note sounding, drawn in the accent. */
  current?: number | null;
  /** A colour for each note, after an exercise run. */
  tones?: readonly (Tone | undefined)[];
  counts?: boolean;
  /** Counts only what each beat needs, the ones not played on in brackets: "1 (2) & 3". */
  bracket?: boolean;
  /** The width of a quarter note, when lines set one under another should share it. */
  spacing?: number;
  /** The triplet's words in the counts: the page's language's. */
  words: { trip: string; let: string };
  /** The notes alone, set close, with no line, time signature or counts: a rhythm's figure. */
  bare?: boolean;
  /** Written over the notes (a timing after a run): where, in ticks, what, and in what tone. */
  marks?: readonly { tick: number; text: string; tone: Tone }[];
  className?: string;
}) {
  const meter = meterOf(time);
  const { placed, bars, total } = layout(rhythm, meter);
  const fine = placed.some((b) => b.duration === 'sixteenth' || b.triplet);
  const triplets = placed.some((b) => b.triplet);
  const x0 = bare ? 0 : bodyStart('rhythm', 0, true);
  // Two bars or more are set closer, so they stay legible at a phone's width; sixteenths and
  // triplets need more room. Short notes get more room before each barline too. A figure is set
  // closer still.
  const quarterWidth =
    spacing ?? (bare ? (fine ? 52 : 34) : fine ? (bars > 1 ? 64 : 88) : bars > 1 ? 46 : 64);
  const barGap = placed.some((b) => TICKS[b.duration] <= TICKS.eighth) ? 14 : 0;
  const tickWidth = quarterWidth / QUARTER;
  const xAt = (tick: number) =>
    x0 + tick * tickWidth + 8 + Math.floor(tick / meter.bar + 1e-9) * barGap;
  const last = placed.at(-1);
  const width = bare
    ? last
      ? xAt(last.at) + (last.duration === 'whole' ? 17 : HEAD_WIDTH) + (last.dotted ? 8 : 0) + 10
      : xAt(total) + 8
    : x0 + bars * meter.bar * tickWidth + (bars - 1) * barGap + 24;
  const marksAt = triplets ? -TUPLET_ROOM - 6 : -6;
  const above = (triplets ? TUPLET_ROOM : 0) + (marks.length > 0 ? MARK_ROOM : 0);

  // A tie's second note takes the colour of its first.
  const toneOf = (i: number): Tone => {
    const own = tones?.[i];
    if (own) return own;
    if (tones && placed[i]?.held) return toneOf(i - 1);
    return current === i ? 'accent' : 'ink';
  };
  const notes: StaffNote[] = placed.map((b, i) => ({
    id: `${i}`,
    pitch: b.rest ? null : { letter: 'B', accidental: 0, octave: 4 },
    clef: 'treble',
    x: xAt(b.at),
    duration: b.duration,
    dotted: b.dotted,
    flag: false,
    tone: toneOf(i),
  }));
  // A barline goes half-way between the last note of a bar (and its dot) and the next downbeat.
  const barlines = Array.from({ length: bars - 1 }, (_, i) => {
    const downbeat = xAt((i + 1) * meter.bar);
    const before = placed.findLast((b) => b.at < (i + 1) * meter.bar);
    if (!barGap || !before) return downbeat - 14;
    const end = xAt(before.at) + HEAD_WIDTH + (before.dotted ? 8 : 0);
    return (end + downbeat) / 2;
  });

  const labels: StaffLabel[] =
    counts && !bare
      ? countLabels(placed, meter, bars, bracket, {
          trip: words.trip,
          let: words.let,
        }).map(({ tick, text, held }) => ({
          clef: 'treble',
          position: -1,
          x: xAt(tick) + HEAD_WIDTH / 2,
          text,
          held,
        }))
      : [];

  // Beams: notes of an eighth or shorter, one after another within a beat, are joined; a note
  // alone in its beat keeps its flag.
  const beamable = (b: Placed) => !b.rest && TICKS[b.duration] <= TICKS.eighth;
  const groups: number[][] = [];
  placed.forEach((b, i) => {
    const beat = Math.floor(b.at / meter.beat);
    const fits = beamable(b) && b.at + b.length <= (beat + 1) * meter.beat;
    const last = groups.at(-1);
    const prev = placed[i - 1];
    if (
      fits &&
      last &&
      last.at(-1) === i - 1 &&
      prev &&
      Math.floor(prev.at / meter.beat) === beat
    ) {
      last.push(i);
    } else if (fits) {
      groups.push([i]);
    }
  });
  for (const group of groups) {
    if (group.length === 1) notes[group[0]!] = { ...notes[group[0]!]!, flag: true };
  }
  const beamed = groups.filter((g) => g.length > 1);

  const toneAcross = (a: number, b: number) =>
    notes[a]!.tone === notes[b]!.tone ? notes[a]!.tone : 'ink';
  const beamRects: { key: string; x: number; y: number; width: number; tone: Tone }[] = [];
  for (const group of beamed) {
    const first = group[0]!;
    const last = group.at(-1)!;
    const from = stemTop('rhythm', notes[first]!.x);
    const to = stemTop('rhythm', notes[last]!.x);
    beamRects.push({
      key: `${first}`,
      x: from.x - STEM_WIDTH,
      y: from.y,
      width: to.x - from.x + STEM_WIDTH,
      tone: toneAcross(first, last) ?? 'ink',
    });
    // The sixteenths' second beam: across neighbouring sixteenths, or a stub a notehead long,
    // pointing into the beat (back towards a dotted eighth).
    const y = from.y + BEAM + BEAM_GAP;
    group.forEach((i, k) => {
      if (placed[i]!.duration !== 'sixteenth') return;
      const x = stemTop('rhythm', notes[i]!.x).x;
      const next = group[k + 1];
      const prev = group[k - 1];
      const nextSixteenth = next !== undefined && placed[next]!.duration === 'sixteenth';
      const prevSixteenth = prev !== undefined && placed[prev]!.duration === 'sixteenth';
      if (nextSixteenth) {
        const nx = stemTop('rhythm', notes[next]!.x).x;
        beamRects.push({
          key: `${i}s`,
          x: x - STEM_WIDTH,
          y,
          width: nx - x + STEM_WIDTH,
          tone: toneAcross(i, next) ?? 'ink',
        });
      } else if (!prevSixteenth) {
        const left = next === undefined || (prev !== undefined && placed[prev]!.dotted);
        const stub = HEAD_WIDTH * 0.9;
        beamRects.push({
          key: `${i}s`,
          x: left ? x - stub : x - STEM_WIDTH,
          y,
          width: stub + (left ? 0 : STEM_WIDTH),
          tone: notes[i]!.tone ?? 'ink',
        });
      }
    });
  }

  // Ties, under the heads.
  const lineY = staffY('rhythm', 'treble', 4);
  const ties = placed.flatMap((b, i) => {
    if (!b.tie || b.rest || !placed[i + 1] || placed[i + 1]!.rest) return [];
    const x1 = notes[i]!.x + HEAD_WIDTH * 0.62;
    const x2 = notes[i + 1]!.x + HEAD_WIDTH * 0.38;
    return [{ key: i, d: tiePath(x1, x2, lineY + SPACE * 0.5 + 2), tone: toneAcross(i, i + 1) }];
  });

  // Triplets: three notes in one beat, under a bracket with a 3.
  const tuplets: number[][] = [];
  placed.forEach((b, i) => {
    if (!b.triplet) return;
    const last = tuplets.at(-1);
    const prev = placed[i - 1];
    if (
      last &&
      last.at(-1) === i - 1 &&
      prev &&
      Math.floor(prev.at / meter.beat) === Math.floor(b.at / meter.beat)
    )
      last.push(i);
    else tuplets.push([i]);
  });
  const bracketY = -9;
  const three = { width: 1.224 * SPACE * 0.8, height: 1.5 * SPACE * 0.8 };

  return (
    <EngravedStaff
      system="rhythm"
      width={width}
      above={above}
      className={
        className ?? (triplets ? 'plate-staff is-rhythm is-tall' : 'plate-staff is-rhythm')
      }
      label={label}
      time={bare ? undefined : time}
      notes={notes}
      bars={bare ? [] : barlines}
      labels={labels}
      bare={bare}
      // Its height in drawing units, for a page that sizes lines by their notes (0.1rem a unit).
      style={{ '--rhythm-units': bare ? above + 52 : 70 + above } as CSSProperties}
    >
      {beamRects.map((r) => (
        <rect
          key={r.key}
          className={`engraved-note is-${r.tone} engraved-beam`}
          x={r.x}
          y={r.y}
          width={r.width}
          height={BEAM}
        />
      ))}
      {ties.map((t) => (
        <path key={t.key} className={`engraved-note is-${t.tone ?? 'ink'} engraved-tie`} d={t.d} />
      ))}
      {marks.map((m, i) => (
        <text
          key={i}
          className={`engraved-timing is-${m.tone}`}
          x={xAt(m.tick) + HEAD_WIDTH / 2}
          y={marksAt}
          textAnchor="middle"
        >
          {m.text}
        </text>
      ))}
      {tuplets.map((group) => {
        const left = notes[group[0]!]!.x;
        const right = notes[group.at(-1)!]!.x + HEAD_WIDTH;
        const mid = (left + right) / 2;
        const gap = three.width / 2 + 3;
        return (
          <g key={group[0]} className="engraved-tuplet">
            <path
              d={`M${left} ${bracketY + 5}V${bracketY}H${mid - gap}M${mid + gap} ${bracketY}H${right}V${bracketY + 5}`}
            />
            <path
              className="engraved-tuplet-number"
              d={TUPLET_3}
              transform={`translate(${mid - three.width / 2} ${bracketY + three.height / 2}) scale(${GLYPH * 0.8})`}
            />
          </g>
        );
      })}
    </EngravedStaff>
  );
}
