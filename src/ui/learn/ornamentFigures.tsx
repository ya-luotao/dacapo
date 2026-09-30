import { useMemo, useState, type ReactNode } from 'react';
import { pitchToMidi, staffPosition } from '../../core/note.ts';
import { EngravedStaff, type Duration, type StaffNote } from '../engraving/EngravedStaff.tsx';
import {
  bodyStart,
  GLYPH,
  HEAD_WIDTH,
  SPACE,
  staffY,
  STEM_LENGTH,
  STEM_WIDTH,
} from '../engraving/geometry.ts';
import {
  ARPEGGIO_WIGGLE,
  BLACK_HEAD,
  FERMATA,
  FLAG_32ND_UP,
  FLAG_8TH_UP,
  INVERTED_MORDENT,
  MORDENT,
  TRILL,
  TRILL_WIGGLE,
  TURN,
} from '../engraving/glyphs.ts';
import { Choices, PlayButton } from './kit.tsx';
import { usePlayNotes, type TimedNote } from './lesson.ts';
import { pitch } from './notes.ts';

// Figures for the lesson on ornaments: each ornament engraved as it is written, with the notes it
// stands for written out under it, heard slowly and at tempo; spread chords and the pause.

export type OrnamentSign = 'mordent' | 'invertedMordent' | 'turn' | 'trill';

/** A note of a line: its length in 32nds (8 a quarter), and what is written with it. */
export interface LineNote {
  /** One pitch, or a chord's. */
  pitch: string | readonly string[];
  length: number;
  /** Notes with the same number are beamed together. */
  beam?: number;
  ornament?: OrnamentSign;
  /** A small note before it, slashed (acciaccatura) or not (appoggiatura). */
  grace?: { pitch: string; slash: boolean };
  /** The small notes a trill ends with, before the next note. */
  ending?: readonly string[];
  fermata?: boolean;
  /** A wavy line before the chord: spread it. */
  arpeggio?: boolean;
  /** Played just before the beat, its time taken from the note before (a crushed note). */
  early?: boolean;
  /** In a written-out line: the written note it belongs to. */
  of?: number;
}

export interface Example {
  written: readonly LineNote[];
  /** The written notes, played as they sound; none for a sign that has no single reading. */
  played?: readonly LineNote[];
  fifths?: number;
}

const G = { slash: true };

/** Each ornament's example, in the style of the library's minuets. */
const EXAMPLES = {
  acciaccatura: {
    written: [
      { pitch: 'G4', length: 8 },
      { pitch: 'A4', length: 8, grace: { pitch: 'B4', ...G } },
      { pitch: 'G4', length: 16 },
    ],
    played: [
      { pitch: 'G4', length: 8, of: 0 },
      { pitch: 'B4', length: 1, of: 1, early: true },
      { pitch: 'A4', length: 8, of: 1 },
      { pitch: 'G4', length: 16, of: 2 },
    ],
  },
  appoggiatura: {
    written: [
      { pitch: 'G4', length: 8 },
      { pitch: 'A4', length: 8, grace: { pitch: 'B4', slash: false } },
      { pitch: 'G4', length: 16 },
    ],
    played: [
      { pitch: 'G4', length: 8, of: 0 },
      { pitch: 'B4', length: 4, beam: 1, of: 1 },
      { pitch: 'A4', length: 4, beam: 1, of: 1 },
      { pitch: 'G4', length: 16, of: 2 },
    ],
  },
  // The Minuet in G, bar 5.
  mordent: {
    fifths: 1,
    written: [
      { pitch: 'C5', length: 8, ornament: 'mordent' },
      { pitch: 'D5', length: 4, beam: 1 },
      { pitch: 'C5', length: 4, beam: 1 },
      { pitch: 'B4', length: 4, beam: 2 },
      { pitch: 'A4', length: 4, beam: 2 },
    ],
    played: [
      { pitch: 'C5', length: 2, beam: 1, of: 0 },
      { pitch: 'B4', length: 2, beam: 1, of: 0 },
      { pitch: 'C5', length: 4, beam: 1, of: 0 },
      { pitch: 'D5', length: 4, beam: 2, of: 1 },
      { pitch: 'C5', length: 4, beam: 2, of: 2 },
      { pitch: 'B4', length: 4, beam: 3, of: 3 },
      { pitch: 'A4', length: 4, beam: 3, of: 4 },
    ],
  },
  invertedMordent: {
    fifths: 1,
    written: [
      { pitch: 'C5', length: 8, ornament: 'invertedMordent' },
      { pitch: 'D5', length: 4, beam: 1 },
      { pitch: 'C5', length: 4, beam: 1 },
      { pitch: 'B4', length: 4, beam: 2 },
      { pitch: 'A4', length: 4, beam: 2 },
    ],
    played: [
      { pitch: 'C5', length: 2, beam: 1, of: 0 },
      { pitch: 'D5', length: 2, beam: 1, of: 0 },
      { pitch: 'C5', length: 4, beam: 1, of: 0 },
      { pitch: 'D5', length: 4, beam: 2, of: 1 },
      { pitch: 'C5', length: 4, beam: 2, of: 2 },
      { pitch: 'B4', length: 4, beam: 3, of: 3 },
      { pitch: 'A4', length: 4, beam: 3, of: 4 },
    ],
  },
  turn: {
    written: [
      { pitch: 'D5', length: 8, ornament: 'turn' },
      { pitch: 'C5', length: 8 },
      { pitch: 'B4', length: 16 },
    ],
    played: [
      { pitch: 'E5', length: 2, beam: 1, of: 0 },
      { pitch: 'D5', length: 2, beam: 1, of: 0 },
      { pitch: 'C5', length: 2, beam: 1, of: 0 },
      { pitch: 'D5', length: 2, beam: 1, of: 0 },
      { pitch: 'C5', length: 8, of: 1 },
      { pitch: 'B4', length: 16, of: 2 },
    ],
  },
  // A trill from the note above, as in Bach's time, ending with a turn into the C.
  trillUpper: {
    written: [
      { pitch: 'D5', length: 16, ornament: 'trill', ending: ['C5', 'D5'] },
      { pitch: 'C5', length: 16 },
    ],
    played: [
      ...['E5', 'D5', 'E5', 'D5'].map((p) => ({ pitch: p, length: 2, beam: 1, of: 0 })),
      ...['E5', 'D5', 'C5', 'D5'].map((p) => ({ pitch: p, length: 2, beam: 2, of: 0 })),
      { pitch: 'C5', length: 16, of: 1 },
    ],
  },
  // From the written note, as later music has it.
  trillMain: {
    written: [
      { pitch: 'D5', length: 16, ornament: 'trill', ending: ['C5', 'D5'] },
      { pitch: 'C5', length: 16 },
    ],
    played: [
      ...['D5', 'E5', 'D5', 'E5'].map((p) => ({ pitch: p, length: 2, beam: 1, of: 0 })),
      ...['D5', 'E5', 'C5', 'D5'].map((p) => ({ pitch: p, length: 2, beam: 2, of: 0 })),
      { pitch: 'C5', length: 16, of: 1 },
    ],
  },
  arpeggio: {
    written: [
      { pitch: ['C4', 'E4', 'G4', 'C5'], length: 16, arpeggio: true },
      { pitch: ['C4', 'E4', 'G4', 'C5'], length: 16 },
    ],
  },
  fermata: {
    written: [
      { pitch: 'E4', length: 8 },
      { pitch: 'F4', length: 8 },
      { pitch: 'G4', length: 16, fermata: true },
    ],
  },
} as const satisfies Record<string, Example>;

export type ExampleName = keyof typeof EXAMPLES;

const GRACE_SCALE = 0.66;

function pitches(n: LineNote): readonly string[] {
  return typeof n.pitch === 'string' ? [n.pitch] : n.pitch;
}

/** A note's value on the staff for its length in 32nds. */
function value(length: number): { duration: Duration; dotted: boolean } {
  if (length >= 32) return { duration: 'whole', dotted: false };
  if (length >= 16) return { duration: 'half', dotted: length === 24 };
  if (length >= 8) return { duration: 'quarter', dotted: length === 12 };
  if (length >= 4) return { duration: 'eighth', dotted: length === 6 };
  return { duration: 'sixteenth', dotted: length === 3 };
}

/** How many beams a note of this length has. */
function beamsOf(length: number): number {
  if (length <= 1) return 3;
  if (length <= 3) return 2;
  return 1;
}

/** The room a note takes across, by its length; a grace note or a trill's ending adds some. */
function advance(n: LineNote): number {
  return 12 + 7 * Math.sqrt(n.length);
}

const BEAM = 0.5 * SPACE;
const BEAM_STEP = 0.75 * SPACE;

/** A small note: a grace note (with its flag, and its slash when crushed) or a trill's ending. */
function SmallNote({
  x,
  y,
  flag,
  slash,
  stem = STEM_LENGTH * GRACE_SCALE,
}: {
  x: number;
  y: number;
  flag: boolean;
  slash: boolean;
  stem?: number;
}) {
  const head = HEAD_WIDTH * GRACE_SCALE;
  const stemX = x + head - STEM_WIDTH * GRACE_SCALE;
  return (
    <g>
      <path d={BLACK_HEAD} transform={`translate(${x} ${y}) scale(${GLYPH * GRACE_SCALE})`} />
      <rect x={stemX} y={y - stem} width={STEM_WIDTH * GRACE_SCALE + 0.2} height={stem - 1.2} />
      {flag && (
        <path
          d={FLAG_8TH_UP}
          transform={`translate(${stemX} ${y - stem}) scale(${GLYPH * GRACE_SCALE})`}
        />
      )}
      {slash && (
        <line
          className="engraved-stroke"
          x1={stemX - 4}
          y1={y - stem + 13}
          x2={stemX + 7}
          y2={y - stem + 5}
        />
      )}
    </g>
  );
}

/**
 * A line of notes on the treble staff, beamed where asked, with its ornaments, grace notes, a
 * trill's wavy line and ending, spread chords and pauses; the notes sounding are lit.
 */
export function OrnamentStaff({
  notes,
  fifths = 0,
  lit,
  width = 300,
  label,
  className = 'plate-staff is-ornament',
}: {
  notes: readonly LineNote[];
  fifths?: number;
  lit: ReadonlySet<number>;
  width?: number;
  label: string;
  className?: string;
}) {
  // Across: each note's room, a grace note's before it, a trill's ending after it.
  const start = bodyStart('treble', fifths) + 8;
  const rooms = notes.map(
    (n, i) => advance(n) + (n.grace ? 14 : 0) + (notes[i - 1]?.ending ? 26 : 0),
  );
  const total = rooms.reduce((a, b) => a + b, 0);
  const stretch = (width - 26 - start) / total;
  const xs: number[] = [];
  let at = start;
  notes.forEach((n, i) => {
    const before = (n.grace ? 14 : 0) + (notes[i - 1]?.ending ? 26 : 0);
    xs.push(at + before * stretch);
    at += rooms[i]! * stretch;
  });
  const ys = notes.map((n) =>
    pitches(n).map((p) => staffY('treble', 'treble', staffPosition(pitch(p), 'treble'))),
  );
  const top = (i: number) => Math.min(...ys[i]!);
  const bottom = (i: number) => Math.max(...ys[i]!);
  const positions = notes.map((n) => pitches(n).map((p) => staffPosition(pitch(p), 'treble')));

  // Stems: a beamed group all one way, by its notes' average; a note alone by its own place, and
  // up when it has a flag to show.
  const groups = new Map<number, number[]>();
  notes.forEach((n, i) => {
    if (n.beam !== undefined) groups.set(n.beam, [...(groups.get(n.beam) ?? []), i]);
  });
  const up = notes.map((n, i) => {
    const members = n.beam !== undefined ? groups.get(n.beam)! : [i];
    const all = members.flatMap((m) => positions[m]!);
    if (n.beam === undefined && n.length < 8) return true;
    return all.reduce((a, b) => a + b, 0) / all.length < 4;
  });
  const stemX = (i: number) => (up[i] ? xs[i]! + HEAD_WIDTH - STEM_WIDTH : xs[i]!);
  const tone = (i: number): StaffNote['tone'] => (lit.has(i) ? 'accent' : 'ink');

  const staffNotes: StaffNote[] = notes.flatMap((n, i) =>
    pitches(n).map((p, k): StaffNote => ({
      id: `${i}.${k}`,
      pitch: pitch(p),
      clef: 'treble',
      x: xs[i]!,
      ...value(n.length),
      stem: up[i] ? 'up' : 'down',
      flag: n.beam === undefined && n.length > 1,
      inKey: true,
      tone: tone(i),
    })),
  );

  // Beams, and the stems lengthened to meet them.
  const beams: ReactNode[] = [];
  for (const [id, members] of groups) {
    const dir = up[members[0]!]!;
    const ends = members.map((m) => (dir ? top(m) - STEM_LENGTH : bottom(m) + STEM_LENGTH));
    const beamY = dir ? Math.min(...ends) : Math.max(...ends);
    const className = `engraved-note is-${members.every((m) => lit.has(m)) ? 'accent' : 'ink'}`;
    members.forEach((m, k) => {
      const reach = Math.abs(beamY - ends[k]!);
      if (reach > 0.1) {
        beams.push(
          <rect
            key={`e${m}`}
            className={`engraved-note is-${tone(m)}`}
            x={stemX(m)}
            y={dir ? beamY : ends[k]!}
            width={STEM_WIDTH}
            height={reach}
          />,
        );
      }
    });
    const levelY = (level: number) =>
      dir ? beamY + level * BEAM_STEP : beamY - BEAM - level * BEAM_STEP;
    const first = members[0]!;
    const last = members.at(-1)!;
    beams.push(
      <rect
        key={`b${id}`}
        className={className}
        x={stemX(first)}
        y={levelY(0)}
        width={stemX(last) - stemX(first) + STEM_WIDTH}
        height={BEAM}
      />,
    );
    // Second and third beams: across neighbours that have them, or a stub pointing into the group.
    for (let level = 1; level < 3; level++) {
      members.forEach((m, k) => {
        if (beamsOf(notes[m]!.length) <= level) return;
        const next = members[k + 1];
        const prev = members[k - 1];
        const nextHas = next !== undefined && beamsOf(notes[next]!.length) > level;
        const prevHas = prev !== undefined && beamsOf(notes[prev]!.length) > level;
        if (nextHas) {
          beams.push(
            <rect
              key={`b${id}.${level}.${m}`}
              className={className}
              x={stemX(m)}
              y={levelY(level)}
              width={stemX(next) - stemX(m) + STEM_WIDTH}
              height={BEAM}
            />,
          );
        } else if (!prevHas) {
          const stub = HEAD_WIDTH * 0.9;
          const left = next === undefined;
          beams.push(
            <rect
              key={`b${id}.${level}.${m}`}
              className={className}
              x={left ? stemX(m) - stub + STEM_WIDTH : stemX(m)}
              y={levelY(level)}
              width={stub}
              height={BEAM}
            />,
          );
        }
      });
    }
  }

  // Over the notes: where a sign sits, clear of the staff and of an up-stem.
  const above = (i: number) =>
    Math.min(staffY('treble', 'treble', 8) - 4, up[i] ? top(i) - STEM_LENGTH - 3 : top(i) - 12);
  const marks: ReactNode[] = [];
  notes.forEach((n, i) => {
    const mid = xs[i]! + HEAD_WIDTH / 2;
    const y = above(i);
    const cls = `engraved-note is-${tone(i)}`;
    if (n.ornament === 'trill') {
      const end = (xs[i + 1] ?? width - 20) - (n.ending ? 28 : 6);
      const from = xs[i]! - 2 + 521 * GLYPH + 2;
      const count = Math.max(0, Math.floor((end - from) / (262 * GLYPH)));
      marks.push(
        <g key={`o${i}`} className={cls}>
          <path d={TRILL} transform={`translate(${xs[i]! - 2} ${y}) scale(${GLYPH})`} />
          {Array.from({ length: count }, (_, k) => (
            <path
              key={k}
              d={TRILL_WIGGLE}
              transform={`translate(${from + 2 + k * 262 * GLYPH} ${y - 3}) scale(${GLYPH})`}
            />
          ))}
        </g>,
      );
    } else if (n.ornament) {
      const glyph = { mordent: MORDENT, invertedMordent: INVERTED_MORDENT, turn: TURN }[n.ornament];
      const w = { mordent: 729, invertedMordent: 730, turn: 460 }[n.ornament] * GLYPH;
      const lift = n.ornament === 'mordent' ? 73 * GLYPH : 0;
      marks.push(
        <path
          key={`o${i}`}
          className={cls}
          d={glyph}
          transform={`translate(${mid - w / 2} ${y - lift}) scale(${GLYPH})`}
        />,
      );
    }
    if (n.fermata) {
      marks.push(
        <path
          key={`f${i}`}
          className={cls}
          d={FERMATA}
          transform={`translate(${mid - (605 * GLYPH) / 2} ${y}) scale(${GLYPH})`}
        />,
      );
    }
    if (n.grace) {
      const gy = staffY('treble', 'treble', staffPosition(pitch(n.grace.pitch), 'treble'));
      marks.push(
        <g key={`g${i}`} className={cls}>
          <SmallNote x={xs[i]! - 13} y={gy} flag slash={n.grace.slash} />
        </g>,
      );
    }
    if (n.ending) {
      // Two small sixteenths, beamed, just before the next note.
      const nx = (xs[i + 1] ?? width - 20) - 25;
      const heads = n.ending.map((p, k) => ({
        x: nx + k * 9,
        y: staffY('treble', 'treble', staffPosition(pitch(p), 'treble')),
      }));
      const stemTop = Math.min(...heads.map((h) => h.y)) - STEM_LENGTH * GRACE_SCALE;
      const head = HEAD_WIDTH * GRACE_SCALE;
      marks.push(
        <g key={`n${i}`} className={cls}>
          {heads.map((h, k) => (
            <SmallNote key={k} x={h.x} y={h.y} flag={false} slash={false} stem={h.y - stemTop} />
          ))}
          {[0, 1].map((level) => (
            <rect
              key={level}
              x={heads[0]!.x + head - STEM_WIDTH * GRACE_SCALE}
              y={stemTop + level * BEAM_STEP * GRACE_SCALE}
              width={heads.at(-1)!.x - heads[0]!.x + STEM_WIDTH * GRACE_SCALE + 0.2}
              height={BEAM * GRACE_SCALE}
            />
          ))}
        </g>,
      );
    }
    if (n.arpeggio) {
      const low = bottom(i) + 5;
      const high = top(i) - 5;
      const step = 255 * GLYPH;
      const count = Math.ceil((low - high) / step);
      marks.push(
        <g key={`a${i}`} className={cls}>
          {Array.from({ length: count }, (_, k) => (
            <path
              key={k}
              d={ARPEGGIO_WIGGLE}
              transform={`translate(${xs[i]! - 5} ${low - k * step}) rotate(-90) scale(${GLYPH})`}
            />
          ))}
        </g>,
      );
    }
    // A lone 32nd: its flag, and its stem lengthened to carry it.
    if (n.beam === undefined && n.length === 1) {
      const sx = stemX(i);
      const y0 = top(i) - STEM_LENGTH;
      marks.push(
        <g key={`t${i}`} className={cls}>
          <rect x={sx} y={y0 - 6} width={STEM_WIDTH} height={6} />
          <path d={FLAG_32ND_UP} transform={`translate(${sx} ${y0 - 6}) scale(${GLYPH})`} />
        </g>,
      );
    }
  });

  return (
    <EngravedStaff
      system="treble"
      width={width}
      className={className}
      label={label}
      notes={staffNotes}
      fifths={fifths}
    >
      {beams}
      {marks}
    </EngravedStaff>
  );
}

/** The notes of a line as they sound, `unit` ms to a 32nd; a crushed note steals a little time. */
function sounding(line: readonly LineNote[], unit: number): TimedNote[] {
  let at = 0;
  const out: TimedNote[] = [];
  line.forEach((n) => {
    const ms = n.length * unit;
    if (n.early) {
      // Just before the beat: its time comes off the note before, so the next is on time.
      at -= ms;
      for (const prev of out) if (prev.at + prev.ms > at) prev.ms = Math.max(50, at - prev.at);
    }
    for (const p of pitches(n)) {
      out.push({ midi: pitchToMidi(pitch(p)), at, ms: Math.max(50, ms - 20), velocity: 70 });
    }
    at += ms;
  });
  return out;
}

/** 32nds, in ms: slowly (a quarter a second) and at tempo. */
const SLOW = 125;
const TEMPO = 55;

/**
 * An ornament as written, and under it the notes it stands for, written out; both heard slowly or
 * at tempo, the notes lit as they sound. With several examples, a choice between them.
 */
export function Ornaments({
  names,
  labels,
  staffLabels,
}: {
  names: readonly ExampleName[];
  labels: Partial<Record<ExampleName, string>> & {
    written: string;
    played: string;
    slowly: string;
    atTempo: string;
  };
  staffLabels: Partial<Record<ExampleName, string>>;
}) {
  const player = usePlayNotes();
  const [name, setName] = useState<ExampleName>(names[0]!);
  const example: Example = EXAMPLES[name];
  const played = example.played ?? example.written;
  // Each sounding note's place in the written-out line (a chord sounds several).
  const owner = useMemo(() => played.flatMap((n, i) => pitches(n).map(() => i)), [played]);
  const litPlayed = useMemo(
    () => new Set([...player.lit].map((k) => owner[k]!)),
    [player.lit, owner],
  );
  const litWritten = useMemo(
    () => new Set([...litPlayed].map((i) => played[i]!.of ?? i)),
    [litPlayed, played],
  );
  const play = (unit: number) => player.play(sounding(played, unit));

  return (
    <>
      {names.length > 1 && (
        <Choices
          value={name}
          onChange={(next) => {
            setName(next);
            player.stop();
          }}
          options={names.map((n) => ({ value: n, label: labels[n]! }))}
        />
      )}
      <div className="ornament-pair">
        <p className="ornament-label">{labels.written}</p>
        <OrnamentStaff
          notes={example.written}
          fifths={example.fifths}
          lit={litWritten}
          label={`${staffLabels[name] ?? ''} (${labels.written})`}
        />
        <p className="ornament-label">{labels.played}</p>
        <OrnamentStaff
          notes={played}
          fifths={example.fifths}
          lit={litPlayed}
          label={`${staffLabels[name] ?? ''} (${labels.played})`}
        />
      </div>
      <div className="plate-actions">
        <PlayButton onClick={() => play(SLOW)} label={labels.slowly} />
        <PlayButton onClick={() => play(TEMPO)} label={labels.atTempo} />
      </div>
    </>
  );
}

/** A spread chord, rolled up from the bottom; or a pause, held about twice as long. */
export function SpreadAndPause({
  labels,
  staffLabels,
}: {
  labels: { arpeggio: string; fermata: string; with: string; without: string };
  staffLabels: { arpeggio: string; fermata: string };
}) {
  const player = usePlayNotes();
  const [name, setName] = useState<'arpeggio' | 'fermata'>('arpeggio');
  const example = EXAMPLES[name];
  const play = (marked: boolean) => {
    if (name === 'arpeggio') {
      const chord = ['C4', 'E4', 'G4', 'C5'].map((p) => pitchToMidi(pitch(p)));
      // The first chord spread (when marked), a key every 60 ms, the second struck together.
      player.play([
        ...chord.map((midi, k) => ({
          midi,
          at: marked ? k * 60 : 0,
          ms: 1700 - (marked ? k * 60 : 0),
          velocity: 64,
        })),
        ...chord.map((midi) => ({ midi, at: 1900, ms: 1700, velocity: 64 })),
      ]);
    } else {
      const notes = sounding(example.written, 60);
      if (marked) notes[2] = { ...notes[2]!, ms: notes[2]!.ms * 2 };
      player.play(notes);
    }
  };
  const lit = useMemo(() => {
    const out = new Set<number>();
    for (const k of player.lit) out.add(name === 'arpeggio' ? Math.floor(k / 4) : k);
    return out;
  }, [player.lit, name]);
  return (
    <>
      <Choices
        value={name}
        onChange={(next) => {
          setName(next);
          player.stop();
        }}
        options={[
          { value: 'arpeggio', label: labels.arpeggio },
          { value: 'fermata', label: labels.fermata },
        ]}
      />
      <OrnamentStaff notes={example.written} lit={lit} label={staffLabels[name]} />
      <div className="plate-actions">
        <PlayButton onClick={() => play(true)} label={labels.with} />
        <PlayButton onClick={() => play(false)} label={labels.without} />
      </div>
    </>
  );
}

/** An ornament as written, for a question. */
export function OrnamentCard({ name, label }: { name: ExampleName; label: string }) {
  const example: Example = EXAMPLES[name];
  return (
    <OrnamentStaff
      notes={example.written}
      fifths={example.fifths}
      lit={new Set()}
      width={240}
      label={label}
      className="plate-staff is-card is-ornament"
    />
  );
}
