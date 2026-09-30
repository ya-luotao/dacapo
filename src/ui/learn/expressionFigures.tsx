import { useEffect, useMemo, useState } from 'react';
import { pitchToMidi, staffPosition } from '../../core/note.ts';
import { EngravedStaff, type Duration, type StaffNote } from '../engraving/EngravedStaff.tsx';
import { bodyStart, HEAD_WIDTH, SPACE, staffY } from '../engraving/geometry.ts';
import {
  ArticulationMark,
  Dynamic,
  DynamicGlyph,
  Hairpin,
  Words,
  type ArticulationKind,
} from '../engraving/marks.tsx';
import { dynamicWidth, slurPath } from '../engraving/shapes.ts';
import { useHubState } from '../input/context.ts';
import { useKeyboardFallback } from '../input/useKeyboardFallback.ts';
import { ExerciseFrame } from './exercises.tsx';
import {
  isCrescendo,
  joinOf,
  judgeCrescendo,
  type CrescendoVerdict,
  type Stroke,
} from './expression.ts';
import { Choices, PlayButton } from './kit.tsx';
import {
  useCopy,
  useExercise,
  useKeyEvents,
  useNoteOn,
  usePlayNotes,
  type TimedNote,
} from './lesson.ts';
import { pitch } from './notes.ts';

// Figures for the lesson on touch: the dynamics from pp to ff, getting louder and softer, accents,
// the melody over its chords, how hard each key was struck, and how long each note was held and
// how it met the next (legato, staccato, tenuto).

/** A quarter note in the figures, in ms: about 115 to the minute. */
const BEAT = 520;

// A phrase on the treble staff, with what is written around it.

export interface PhraseNote {
  pitch: string;
  duration?: Duration;
  dotted?: boolean;
  mark?: ArticulationKind;
}

export interface PhraseMarks {
  dynamics?: readonly { at: number; text: string }[];
  hairpins?: readonly { from: number; to: number; kind: 'cresc' | 'dim' }[];
  /** "cresc." and "dim.": `width` is the word's, so its dashes start after it. */
  words?: readonly { from: number; to: number; text: string; width: number }[];
  slurs?: readonly { from: number; to: number }[];
}

/** Where dynamics and hairpins go: under the treble staff. */
const DYNAMIC_Y = staffY('treble', 'treble', -4) + 10;
const NONE: ReadonlySet<number> = new Set();

/**
 * A phrase of notes evenly spaced on the treble staff, bars marked by the index of their first
 * note, with dynamics, hairpins, words and slurs; the notes sounding are lit.
 */
export function PhraseStaff({
  notes,
  bars = [],
  marks = {},
  lit = NONE,
  width = 360,
  label,
  className = 'plate-staff is-phrase',
}: {
  notes: readonly PhraseNote[];
  bars?: readonly number[];
  marks?: PhraseMarks;
  lit?: ReadonlySet<number>;
  width?: number;
  label: string;
  className?: string;
}) {
  const pitches = notes.map((n) => pitch(n.pitch));
  const single = notes.length === 1;
  const start = single ? (width + bodyStart('treble')) / 2 - 12 : bodyStart('treble') + 10;
  const unit = single ? 0 : (width - 34 - start) / (notes.length - 1 + bars.length * 0.5);
  const xs = notes.map((_, i) => start + (i + bars.filter((b) => b <= i).length * 0.5) * unit);
  const positions = pitches.map((p) => staffPosition(p, 'treble'));
  const ys = positions.map((p) => staffY('treble', 'treble', p));
  const up = positions.map((p) => p < 4);
  const mid = (i: number) => xs[i]! + HEAD_WIDTH / 2;
  const staffNotes: StaffNote[] = notes.map((n, i) => ({
    id: `${i}`,
    pitch: pitches[i]!,
    clef: 'treble',
    x: xs[i]!,
    duration: n.duration ?? 'quarter',
    dotted: n.dotted,
    stem: up[i] ? 'up' : 'down',
    tone: lit.has(i) ? 'accent' : 'ink',
  }));
  const barXs = bars.map((b) => (xs[b - 1]! + HEAD_WIDTH + xs[b]!) / 2 - 1);
  const tone = (i: number) => `engraved-note is-${lit.has(i) ? 'accent' : 'ink'}`;
  // A mark sits on the notehead's side, away from the stem; a slur over it goes above the mark.
  const markY = (i: number) => {
    const room = notes[i]!.mark === 'accent' ? 1 : 0.8;
    return up[i] ? ys[i]! + room * SPACE : ys[i]! - room * SPACE;
  };
  const dynamicAt = new Map((marks.dynamics ?? []).map((d) => [d.at, d.text]));

  return (
    <EngravedStaff
      system="treble"
      width={width}
      className={className}
      label={label}
      notes={staffNotes}
      bars={barXs}
    >
      {notes.map(
        (n, i) =>
          n.mark && (
            <g key={`m${i}`} className={tone(i)}>
              <ArticulationMark kind={n.mark} x={mid(i)} y={markY(i)} below={up[i]} />
            </g>
          ),
      )}
      {(marks.slurs ?? []).map(({ from, to }) => {
        const above = !up[from];
        const sign = above ? -1 : 1;
        const endY = (i: number) =>
          (notes[i]!.mark ? markY(i) + sign * 0.6 * SPACE : ys[i]!) + sign * 0.9 * SPACE;
        const y1 = endY(from);
        const y2 = endY(to);
        const span = ys.slice(from, to + 1);
        const extreme = above ? Math.min(...span) - 1.3 * SPACE : Math.max(...span) + 1.3 * SPACE;
        const base = above ? Math.min(y1, y2) : Math.max(y1, y2);
        const height = Math.max(0.6 * SPACE, (base - extreme) * -sign + 2);
        return (
          <path
            key={`s${from}`}
            className="engraved-note is-ink engraved-slur"
            d={slurPath(mid(from) + 1, y1, mid(to) - 1, y2, height, above)}
          />
        );
      })}
      {(marks.dynamics ?? []).map(({ at, text }) => (
        <Dynamic key={`d${at}`} text={text} x={mid(at)} y={DYNAMIC_Y} className={tone(at)} />
      ))}
      {(marks.hairpins ?? []).map(({ from, to, kind }) => {
        const x1 =
          mid(from) + (dynamicAt.has(from) ? dynamicWidth(dynamicAt.get(from)!) / 2 + 4 : 0);
        const x2 = mid(to) - (dynamicAt.has(to) ? dynamicWidth(dynamicAt.get(to)!) / 2 + 4 : 0);
        return (
          <Hairpin
            key={`h${from}`}
            x1={x1}
            x2={x2}
            y={DYNAMIC_Y - 4}
            kind={kind}
            className="engraved-note is-ink"
          />
        );
      })}
      {(marks.words ?? []).map(({ from, to, text, width: w }) => (
        <Words
          key={`w${from}`}
          text={text}
          x={xs[from]! - 2}
          x2={mid(to)}
          y={DYNAMIC_Y}
          width={w}
          className="engraved-note is-ink"
        />
      ))}
    </EngravedStaff>
  );
}

/** Notes one beat apart (a half or whole note longer), held `hold` of their length. */
function timed(
  notes: readonly PhraseNote[],
  velocity: (i: number) => number,
  hold: (i: number) => number = () => 0.92,
): TimedNote[] {
  let at = 0;
  return notes.map((n, i) => {
    const beats =
      (n.duration === 'half' ? 2 : n.duration === 'whole' ? 4 : n.duration === 'eighth' ? 0.5 : 1) *
      (n.dotted ? 1.5 : 1);
    const note = {
      midi: pitchToMidi(pitch(n.pitch)),
      at,
      ms: Math.round(beats * BEAT * hold(i)),
      velocity: velocity(i),
    };
    at += beats * BEAT;
    return note;
  });
}

/**
 * For a question: one note with a mark over it, or a few under a hairpin or a dynamic.
 */
export function MarkCard({
  mark,
  hairpin,
  dynamic,
  label,
}: {
  mark?: ArticulationKind;
  hairpin?: 'cresc' | 'dim';
  dynamic?: string;
  label: string;
}) {
  const notes: PhraseNote[] = hairpin
    ? ['C5', 'D5', 'E5', 'F5'].map((p) => ({ pitch: p }))
    : [{ pitch: 'C5', mark }];
  const marks: PhraseMarks = {
    hairpins: hairpin ? [{ from: 0, to: 3, kind: hairpin }] : [],
    dynamics: dynamic ? [{ at: 0, text: dynamic }] : [],
  };
  return (
    <PhraseStaff
      notes={notes}
      marks={marks}
      width={hairpin ? 240 : 180}
      label={label}
      className="plate-staff is-card"
    />
  );
}

// The dynamics, soft to loud.

const DYNAMICS = ['pp', 'p', 'mp', 'mf', 'f', 'ff'] as const;
export type DynamicMark = (typeof DYNAMICS)[number];

/** How hard the figures play each dynamic, of 127. */
const VELOCITY: Record<DynamicMark, number> = { pp: 24, p: 40, mp: 56, mf: 74, f: 94, ff: 116 };

/** The start of the Ode to Joy, high enough that its stems go down and the marks sit under it. */
const ODE: readonly PhraseNote[] = [
  ...['E5', 'E5', 'F5', 'G5', 'G5', 'F5', 'E5', 'D5'].map((p) => ({ pitch: p })),
  { pitch: 'C5', duration: 'half' },
];
const ODE_BARS = [4, 8];

/** One phrase at any dynamic from pp to ff, and the first bar at all six in turn. */
export function DynamicLevels({
  labels,
  staffLabel,
}: {
  labels: { levels: Record<DynamicMark, { name: string; meaning: string }>; all: string };
  staffLabel: string;
}) {
  const player = usePlayNotes();
  const [level, setLevel] = useState<DynamicMark>('mf');
  const [all, setAll] = useState(false);
  const playingAll = all && player.started !== null;
  const lit = useMemo(() => {
    if (!playingAll) return player.lit;
    return new Set([...player.lit].map((i) => i % 4));
  }, [player.lit, playingAll]);
  const sounding =
    playingAll && player.lit.size > 0 ? DYNAMICS[Math.floor(Math.max(...player.lit) / 4)]! : null;
  const shown = sounding ?? level;

  const play = () => {
    setAll(false);
    player.play(timed(ODE, () => VELOCITY[level]));
  };
  const playAll = () => {
    setAll(true);
    const bar = ODE.slice(0, 4);
    player.play(
      DYNAMICS.flatMap((mark, k) =>
        timed(bar, () => VELOCITY[mark]).map((n) => ({ ...n, at: n.at + k * 5 * BEAT })),
      ),
    );
  };

  return (
    <>
      <Choices
        className="is-dynamics"
        value={shown}
        onChange={(next) => {
          setLevel(next);
          player.stop();
        }}
        options={DYNAMICS.map((d) => ({ value: d, label: <DynamicGlyph text={d} /> }))}
      />
      <p className="plate-readout is-small" aria-live="polite">
        <span className="plate-readout-name is-italic">{labels.levels[shown].name}</span>
        <span className="plate-readout-label">{labels.levels[shown].meaning}</span>
      </p>
      <PhraseStaff
        notes={ODE}
        bars={ODE_BARS}
        marks={{ dynamics: [{ at: 0, text: shown }] }}
        lit={lit}
        label={staffLabel}
      />
      <div className="plate-actions">
        <PlayButton onClick={play} />
        <PlayButton onClick={playAll} label={labels.all} />
      </div>
    </>
  );
}

// How hard each key was struck.

function VelocityBars({ values, slots }: { values: readonly number[]; slots: number }) {
  const shown = values.slice(-slots);
  return (
    <div className="velocity-bars" aria-hidden="true">
      {Array.from({ length: slots }, (_, i) => {
        const v = shown[i];
        return (
          <span key={i} className={v === undefined ? 'velocity-bar is-empty' : 'velocity-bar'}>
            <i style={{ height: `${((v ?? 0) / 127) * 100}%` }} />
            <b>{v ?? ''}</b>
          </span>
        );
      })}
    </div>
  );
}

/** How hard each of the last notes was struck, from 1 to 127. */
export function VelocityMeter({ label }: { label: string }) {
  const copy = useCopy();
  const fallback = useKeyboardFallback();
  const [values, setValues] = useState<number[]>([]);
  useNoteOn((_midi, _time, velocity) => setValues((now) => [...now.slice(-11), velocity]));
  const last = values.at(-1);
  return (
    <div className="velocity-meter">
      <p className="plate-readout is-small" aria-live="polite">
        {last === undefined ? (
          <span className="plate-readout-empty">{copy('playSome')}</span>
        ) : (
          <>
            <span className="plate-readout-name">{copy('velocity', { v: last })}</span>
            <span className="plate-readout-label">{label}</span>
          </>
        )}
      </p>
      <VelocityBars values={values} slots={12} />
      {fallback && <p className="plate-note">{copy('fixedTouch')}</p>}
    </div>
  );
}

// Getting louder and softer, and accents.

/** Up five notes and back down: a swell. */
const SWELL: readonly PhraseNote[] = [
  ...['C5', 'D5', 'E5', 'F5', 'G5', 'F5', 'E5', 'D5'].map((p) => ({ pitch: p })),
  { pitch: 'C5', duration: 'half' },
];

/** Louder to the G, then softer: as hairpins, or as the words cresc. and dim. */
export function Hairpins({
  labels,
  staffLabel,
}: {
  labels: { hairpins: string; words: string };
  staffLabel: string;
}) {
  const player = usePlayNotes();
  const [view, setView] = useState<'hairpins' | 'words'>('hairpins');
  const marks: PhraseMarks =
    view === 'hairpins'
      ? {
          dynamics: [{ at: 0, text: 'p' }],
          hairpins: [
            { from: 0, to: 4, kind: 'cresc' },
            { from: 4, to: 8, kind: 'dim' },
          ],
        }
      : {
          dynamics: [{ at: 0, text: 'p' }],
          words: [
            { from: 1, to: 3, text: 'cresc.', width: 26 },
            { from: 5, to: 7, text: 'dim.', width: 18 },
          ],
        };
  // Soft, up to the G, and back.
  const velocity = (i: number) => Math.round(36 + (70 * (4 - Math.abs(4 - i))) / 4);
  return (
    <>
      <Choices
        value={view}
        onChange={setView}
        options={[
          { value: 'hairpins', label: labels.hairpins },
          { value: 'words', label: labels.words },
        ]}
      />
      <PhraseStaff notes={SWELL} bars={[4, 8]} marks={marks} lit={player.lit} label={staffLabel} />
      <div className="plate-actions">
        <PlayButton onClick={() => player.play(timed(SWELL, velocity))} />
      </div>
    </>
  );
}

const ARPEGGIO: readonly PhraseNote[] = [
  ...['C5', 'E5', 'G5', 'E5', 'C5', 'E5', 'G5', 'E5'].map((p) => ({ pitch: p })),
  { pitch: 'C5', duration: 'half' },
];

/** A soft line with accented notes, or one sudden sf. */
export function Accents({
  labels,
  staffLabel,
}: {
  labels: { accents: string; sf: string };
  staffLabel: string;
}) {
  const player = usePlayNotes();
  const [view, setView] = useState<'accents' | 'sf'>('accents');
  const accented = new Set(view === 'accents' ? [2, 6] : []);
  const notes = ARPEGGIO.map((n, i) => (accented.has(i) ? { ...n, mark: 'accent' as const } : n));
  const marks: PhraseMarks =
    view === 'accents'
      ? { dynamics: [{ at: 0, text: 'p' }] }
      : {
          dynamics: [
            { at: 0, text: 'p' },
            { at: 6, text: 'sf' },
          ],
        };
  const velocity = (i: number) =>
    view === 'accents' ? (accented.has(i) ? 96 : 44) : i === 6 ? 120 : 42;
  return (
    <>
      <Choices
        value={view}
        onChange={setView}
        options={[
          { value: 'accents', label: labels.accents },
          { value: 'sf', label: labels.sf },
        ]}
      />
      <PhraseStaff notes={notes} bars={[4, 8]} marks={marks} lit={player.lit} label={staffLabel} />
      <div className="plate-actions">
        <PlayButton onClick={() => player.play(timed(ARPEGGIO, velocity))} />
      </div>
    </>
  );
}

// The melody over its chords.

type BalanceKind = 'balanced' | 'even' | 'under';

const TUNE = ['E4', 'E4', 'F4', 'G4', 'G4', 'F4', 'E4', 'D4', 'C4'];
const CHORDS = [
  ['C3', 'E3', 'G3'],
  ['B2', 'D3', 'G3'],
  ['C3', 'E3', 'G3'],
];
const BALANCE: Record<BalanceKind, { tune: number; chords: number }> = {
  balanced: { tune: 96, chords: 40 },
  even: { tune: 68, chords: 68 },
  under: { tune: 42, chords: 92 },
};

/** The Ode to Joy over its chords, the tune sung out over them, level with them, or under them. */
export function Balance({
  labels,
  readouts,
  staffLabel,
}: {
  labels: Record<BalanceKind, string>;
  readouts: Record<BalanceKind, string>;
  staffLabel: string;
}) {
  const player = usePlayNotes();
  const [kind, setKind] = useState<BalanceKind>('balanced');
  const width = 360;
  const start = bodyStart('grand') + 10;
  const unit = (width - 40 - start) / 9;
  const xs = TUNE.map((_, i) => start + (i + (i >= 4 ? 0.5 : 0) + (i >= 8 ? 0.5 : 0)) * unit);
  const chordX = [xs[0]!, xs[4]!, xs[8]!];
  const tone = (i: number): StaffNote['tone'] => (player.lit.has(i) ? 'accent' : 'ink');
  const notes: StaffNote[] = [
    ...TUNE.map((p, i): StaffNote => ({
      id: `t${i}`,
      pitch: pitch(p),
      clef: 'treble',
      x: xs[i]!,
      duration: i === 8 ? 'whole' : 'quarter',
      stem: 'up',
      tone: tone(i),
    })),
    ...CHORDS.flatMap((chord, c) =>
      chord.map((p, k): StaffNote => ({
        id: `c${c}${k}`,
        pitch: pitch(p),
        clef: 'bass',
        x: chordX[c]!,
        duration: 'whole',
        tone: tone(TUNE.length + c * 3 + k),
      })),
    ),
  ];
  const bars = [4, 8].map((b) => (xs[b - 1]! + HEAD_WIDTH + xs[b]!) / 2 - 1);
  const play = () => {
    const { tune, chords } = BALANCE[kind];
    const melody: TimedNote[] = TUNE.map((p, i) => ({
      midi: pitchToMidi(pitch(p)),
      at: i * BEAT,
      ms: i === 8 ? 4 * BEAT - 60 : BEAT - 30,
      velocity: tune,
    }));
    const below: TimedNote[] = CHORDS.flatMap((chord, c) =>
      chord.map((p) => ({
        midi: pitchToMidi(pitch(p)),
        at: c * 4 * BEAT,
        ms: 4 * BEAT - 40,
        velocity: chords,
      })),
    );
    player.play([...melody, ...below]);
  };
  return (
    <>
      <Choices
        value={kind}
        onChange={(next) => {
          setKind(next);
          player.stop();
        }}
        options={[
          { value: 'balanced', label: labels.balanced },
          { value: 'even', label: labels.even },
          { value: 'under', label: labels.under },
        ]}
      />
      <p className="plate-readout is-small" aria-live="polite">
        <span className="plate-readout-label">{readouts[kind]}</span>
      </p>
      <EngravedStaff
        system="grand"
        width={width}
        className="plate-staff is-grand"
        label={staffLabel}
        notes={notes}
        bars={bars}
      />
      <div className="plate-actions">
        <PlayButton onClick={play} />
      </div>
    </>
  );
}

// Joined and detached: legato, non legato, staccato and tenuto, and what your fingers did.

export type Touch = 'legato' | 'nonLegato' | 'staccato' | 'tenuto';

const SCALE_LINE: readonly PhraseNote[] = [
  ...['C5', 'D5', 'E5', 'F5', 'G5', 'F5', 'E5', 'D5'].map((p) => ({ pitch: p })),
  { pitch: 'C5', duration: 'half' },
];

/** How long each touch holds a note, as a share of its length; the slur's last note breathes. */
function holdFor(touch: Touch): (i: number) => number {
  switch (touch) {
    case 'legato':
      return (i) => (i === 3 ? 0.72 : i === 8 ? 0.92 : 1.04);
    case 'nonLegato':
      return (i) => (i === 8 ? 0.92 : 0.78);
    case 'staccato':
      return (i) => (i === 8 ? 0.3 : 0.32);
    case 'tenuto':
      return (i) => (i === 8 ? 0.95 : 0.97);
  }
}

interface Heard extends Stroke {
  demo: boolean;
}

/** Keys going down and up, from every keyboard and the figure's own Listen, as one phrase. */
function useStrokes(): { strokes: readonly Heard[]; now: number } {
  const [strokes, setStrokes] = useState<Heard[]>([]);
  const [now, setNow] = useState(() => performance.now());
  useKeyEvents((event, demo) => {
    if (event.type === 'on') {
      setStrokes((list) => {
        const last = list.at(-1);
        const quiet =
          last !== undefined &&
          list.every((s) => s.off !== null) &&
          event.time - Math.max(...list.map((s) => s.off ?? s.on)) > 2000;
        const kept = quiet ? [] : list.slice(-11);
        return [
          ...kept,
          { midi: event.midi, on: event.time, off: null, velocity: event.velocity, demo },
        ];
      });
    } else if (event.type === 'off') {
      setStrokes((list) => {
        const i = list.findLastIndex((s) => s.midi === event.midi && s.off === null);
        if (i < 0) return list;
        const next = [...list];
        next[i] = { ...next[i]!, off: event.time };
        return next;
      });
    }
  });
  const held = strokes.some((s) => s.off === null);
  useEffect(() => {
    if (!held) {
      setNow(performance.now());
      return;
    }
    let frame = requestAnimationFrame(function tick(t) {
      setNow(t);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [held]);
  return { strokes, now };
}

/**
 * Each note of the last phrase as a bar as long as it was held, a row to each key, and under them
 * how each met the next: joined, a gap, or an overlap.
 */
function TouchTimeline({ strokes, now }: { strokes: readonly Heard[]; now: number }) {
  const copy = useCopy();
  const { sustain } = useHubState();
  const width = 560;
  const rows = [...new Set(strokes.map((s) => s.midi))].sort((a, b) => b - a);
  const rowHeight = 9;
  const laneY = 8 + Math.max(rows.length, 5) * rowHeight + 6;
  const height = laneY + 22;
  const t0 = (strokes[0]?.on ?? now) - 60;
  const end = Math.max(now, ...strokes.map((s) => s.off ?? now));
  const t1 = Math.max(end + 80, t0 + 3200);
  const x = (t: number) => 8 + ((t - t0) / (t1 - t0)) * (width - 16);
  const joins = strokes
    .slice(1)
    .map((next, i) => ({ from: strokes[i]!, next, join: joinOf(strokes[i]!, next, now) }));
  const count = (kind: string) => joins.filter((j) => j.join.kind === kind).length;
  const last = joins.at(-1)?.join;

  return (
    <div className="touch-timeline">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={copy('joins', {
          joined: count('joined'),
          gaps: count('gap'),
          overlaps: count('overlap'),
        })}
      >
        {rows.map((midi, r) => (
          <line
            key={midi}
            className="touch-row"
            x1={8}
            x2={width - 8}
            y1={8 + r * rowHeight + rowHeight / 2}
            y2={8 + r * rowHeight + rowHeight / 2}
          />
        ))}
        {strokes.map((s, i) => {
          const r = rows.indexOf(s.midi);
          return (
            <rect
              key={i}
              className="touch-bar"
              x={x(s.on)}
              y={8 + r * rowHeight + 1}
              width={Math.max(2, x(s.off ?? now) - x(s.on))}
              height={rowHeight - 2}
              rx={2}
            />
          );
        })}
        <line className="touch-lane" x1={8} x2={width - 8} y1={laneY} y2={laneY} />
        {joins.map(({ from, next, join }, i) => {
          const off = from.off ?? now;
          if (join.kind === 'joined') {
            return (
              <circle key={i} className="touch-join is-joined" cx={x(next.on)} cy={laneY} r={2.6} />
            );
          }
          const [a, b] = join.kind === 'gap' ? [off, next.on] : [next.on, off];
          const wide = x(b) - x(a) > 34;
          return (
            <g key={i} className={`touch-join is-${join.kind}`}>
              <rect x={x(a)} y={laneY - 2.5} width={Math.max(2, x(b) - x(a))} height={5} rx={1} />
              {wide && (
                <text x={(x(a) + x(b)) / 2} y={laneY + 14} textAnchor="middle">
                  {join.ms}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="touch-summary" aria-live="polite">
        {strokes.length < 2 ? (
          <span className="muted">{copy('playSome')}</span>
        ) : (
          <>
            {copy('joins', {
              joined: count('joined'),
              gaps: count('gap'),
              overlaps: count('overlap'),
            })}{' '}
            {last && (
              <>
                {copy('lastJoin')}
                <b className={`is-${last.kind}`}>
                  {last.kind === 'joined' ? copy('joined') : copy(last.kind, { ms: last.ms })}
                </b>
              </>
            )}
          </>
        )}
      </p>
      {sustain && <p className="plate-note">{copy('fingersOnly')}</p>}
    </div>
  );
}

/**
 * A line of nine notes played one way or another (a slur and its breath, dots, lines, or plain),
 * and under it every note you or the figure plays: how long it was held and how it met the next.
 */
export function Articulation({
  touches,
  labels,
  staffLabel,
}: {
  touches: readonly Touch[];
  labels: Partial<Record<Touch, { name: string; text: string }>>;
  staffLabel: string;
}) {
  const player = usePlayNotes();
  const [touch, setTouch] = useState<Touch>(touches[0]!);
  const { strokes, now } = useStrokes();
  const mark: ArticulationKind | undefined =
    touch === 'staccato' ? 'staccato' : touch === 'tenuto' ? 'tenuto' : undefined;
  const notes = SCALE_LINE.map((n) => (mark ? { ...n, mark } : n));
  const marks: PhraseMarks =
    touch === 'legato'
      ? {
          slurs: [
            { from: 0, to: 3 },
            { from: 4, to: 8 },
          ],
        }
      : {};
  const hold = holdFor(touch);
  const play = () => player.play(timed(SCALE_LINE, () => (touch === 'tenuto' ? 72 : 64), hold));
  const info = labels[touch]!;
  return (
    <>
      <Choices
        value={touch}
        onChange={(next) => {
          setTouch(next);
          player.stop();
        }}
        options={touches.map((t) => ({ value: t, label: labels[t]!.name }))}
      />
      <p className="plate-readout is-small" aria-live="polite">
        <span className="plate-readout-label">{info.text}</span>
      </p>
      <PhraseStaff notes={notes} bars={[4, 8]} marks={marks} lit={player.lit} label={staffLabel} />
      <div className="plate-actions">
        <PlayButton onClick={play} />
      </div>
      <TouchTimeline strokes={strokes} now={now} />
    </>
  );
}

// The exercise: five notes, each louder.

const CRESCENDO_NOTES = 5;

/**
 * Five notes, any keys, each louder than the last. It needs a keyboard that senses touch, so it
 * says so without one, and can always be skipped: the lesson ends with an exercise everyone can do.
 */
export function CrescendoExercise({
  prompt,
  verdicts,
  needsTouch,
  skipTo,
}: {
  prompt: string;
  verdicts: Record<CrescendoVerdict, string>;
  needsTouch: string;
  /** The id of the section to go on to. */
  skipTo: string;
}) {
  const copy = useCopy();
  const exercise = useExercise();
  const fallback = useKeyboardFallback();
  const [values, setValues] = useState<number[]>([]);
  const done = values.length >= CRESCENDO_NOTES;
  const verdict = done ? judgeCrescendo(values) : null;

  useNoteOn((_midi, _time, velocity) => {
    if (!exercise.active || done) return;
    const next = [...values, velocity];
    setValues(next);
    if (next.length >= CRESCENDO_NOTES) exercise.stop();
  });

  const restart = () => {
    setValues([]);
    exercise.start();
  };
  const skip = () => {
    exercise.stop();
    document.getElementById(skipTo)?.scrollIntoView({
      behavior: globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
      block: 'start',
    });
  };

  return (
    <ExerciseFrame
      active={exercise.active}
      keys={false}
      prompt={prompt}
      progress={copy('noteProgress', {
        n: Math.min(values.length + 1, CRESCENDO_NOTES),
        total: CRESCENDO_NOTES,
      })}
      message={verdict ? verdicts[verdict] : exercise.active ? copy('listening') : copy('ready')}
      action={
        exercise.active
          ? null
          : {
              label: done ? copy('again') : copy('start'),
              onClick: done ? restart : exercise.start,
            }
      }
    >
      <VelocityBars values={values} slots={CRESCENDO_NOTES} />
      {verdict && (
        <p className={isCrescendo(verdict) ? 'exercise-verdict is-good' : 'exercise-verdict'}>
          {values.join(' → ')}
        </p>
      )}
      <div className="exercise-skip">
        {fallback && <p className="plate-note">{needsTouch}</p>}
        <button type="button" className="button is-compact" onClick={skip}>
          {copy('skip')}
        </button>
      </div>
    </ExerciseFrame>
  );
}
