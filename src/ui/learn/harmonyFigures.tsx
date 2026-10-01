import { useMemo, useRef, useState, type ReactNode } from 'react';
import { LETTERS, pitchToMidi, staffPosition, type Clef, type Pitch } from '../../core/note.ts';
import { keyAlters, keySignature } from '../../core/keys.ts';
import { EngravedStaff, type StaffLabel, type StaffNote } from '../engraving/EngravedStaff.tsx';
import { bodyStart, HEAD_WIDTH, WHOLE_WIDTH } from '../engraving/geometry.ts';
import { ExerciseFrame } from './exercises.tsx';
import {
  accidentalShifts,
  chordOn,
  chordSymbol,
  invert,
  judgeChord,
  keyChords,
  noteName,
  ROOTS,
  CADENCE_PHRASES,
  CADENCES,
  I,
  I_AFTER_V7,
  V,
  V7,
  type Cadence,
  type Inversion,
  type Quality,
  type RowChord,
} from './harmony.ts';
import { Choices, PlayButton } from './kit.tsx';
import { LessonPiano } from './LessonPiano.tsx';
import {
  keyName,
  useCopy,
  useExercise,
  useFlash,
  useNoteOn,
  usePlayNotes,
  useStartOnPress,
  type TimedNote,
} from './lesson.ts';
import { pitch, tonicName } from './notes.ts';

// Figures for the lesson on chords and harmony: a chord built in thirds from any root, with its
// inversions; the chords of a major key under their roman numerals; chords on the grand staff (a
// cadence, V7 going to I, the first bars of Bach's Prelude in C); and an exercise that asks for a
// chord on the keyboard, its notes played together or one at a time.

const KEYS: readonly [number, number] = [48, 83]; // C3–B5
/** Every chord the builder makes lies in C4–B5, and the chords of a key in C4–E♭6 (shown from G3). */
const BUILDER_KEYS: readonly [number, number] = [60, 83];
const KEY_CHORD_KEYS: readonly [number, number] = [55, 88];
const VELOCITY = 72;

/** Seconds in a chord: the upper note of each is set beside the other, to the right. */
function headShifts(chord: readonly Pitch[], width: number): number[] {
  const step = (p: Pitch) => p.octave * 7 + LETTERS.indexOf(p.letter);
  const order = chord.map((_, i) => i).sort((a, b) => step(chord[a]!) - step(chord[b]!));
  const shifts = chord.map(() => 0);
  let below: { at: number; shifted: boolean } | null = null;
  for (const i of order) {
    const at = step(chord[i]!);
    const shifted: boolean = below !== null && !below.shifted && at - below.at === 1;
    if (shifted) shifts[i] = width - 1;
    below = { at, shifted };
  }
  return shifts;
}

/**
 * A chord as whole notes on one staff at `x`: accidentals staggered, the upper note of a second
 * set beside the lower, and after a key signature only what it does not give written.
 */
function chordNotes(
  id: string,
  chord: readonly Pitch[],
  clef: Clef,
  x: number,
  tone: StaffNote['tone'],
  fifths = 0,
): StaffNote[] {
  const alters = keyAlters(fifths);
  const inKey = (p: Pitch) => p.accidental === alters[p.letter];
  const shifts = accidentalShifts(chord, (p) => !inKey(p));
  const heads = headShifts(chord, WHOLE_WIDTH);
  return chord.map((p, i) => ({
    id: `${id}${i}`,
    pitch: p,
    clef,
    x: x + heads[i]!,
    duration: 'whole',
    inKey: inKey(p),
    natural: !inKey(p) && p.accidental === 0,
    accidentalShift: shifts[i]! + heads[i]!,
    tone,
  }));
}

/** The keys of a chord, lit and named: what the figures play and show on the keyboard. */
function keyLabels(
  pitches: readonly Pitch[],
  lit: ReadonlySet<number>,
): { names: Map<number, string>; classes: Map<number, string> } {
  const names = new Map<number, string>();
  const classes = new Map<number, string>();
  for (const p of pitches) {
    const midi = pitchToMidi(p);
    names.set(midi, noteName(p));
    classes.set(midi, lit.has(midi) ? 'lk-same' : 'lk-named');
  }
  return { names, classes };
}

/** A chord's notes one after another, then together. */
function brokenThenBlock(keys: readonly number[], step = 420, hold = 1500): TimedNote[] {
  const broken = keys.map((midi, i) => ({ midi, at: i * step, ms: step - 40, velocity: VELOCITY }));
  const at = keys.length * step + 200;
  return [...broken, ...keys.map((midi) => ({ midi, at, ms: hold, velocity: VELOCITY }))];
}

// The chord builder.

export interface BuilderLabels {
  root: string;
  qualities: Partial<Record<Quality, string>>;
  /** How each quality's thirds are stacked: "a major third, then a minor third". */
  steps: Partial<Record<Quality, string>>;
  inversions?: readonly [string, string, string];
  /** Said of an inverted chord: '{note} in the bass'. */
  bass?: string;
}

/**
 * Build a chord from any root and quality: its notes one after another and then stacked on the
 * treble staff, named on the keyboard, heard broken and together. With `inversions`, the 3rd or
 * the 5th can go to the bottom.
 */
export function ChordBuilder({
  qualities,
  inversions = false,
  initialRoot = 'C',
  labels,
  staffLabel,
}: {
  qualities: readonly Quality[];
  inversions?: boolean;
  initialRoot?: (typeof ROOTS)[number];
  labels: BuilderLabels;
  staffLabel: string;
}) {
  const player = usePlayNotes();
  const [root, setRoot] = useState<string>(initialRoot);
  const [quality, setQuality] = useState<Quality>(qualities[0]!);
  const [inversion, setInversion] = useState<Inversion>(0);
  const rootPosition = useMemo(() => chordOn(root, quality), [root, quality]);
  const chord = useMemo(() => invert(rootPosition, inversion), [rootPosition, inversion]);
  const keys = chord.map(pitchToMidi);
  const n = chord.length;
  const lit = new Set([...player.lit].map((i) => keys[i % n]!));
  const litIndex = (i: number) => player.lit.has(i);
  const blockLit = [...player.lit].some((i) => i >= n);

  const start = bodyStart('treble') + 14;
  const step = 34;
  const bar = start + n * step + 6;
  const blockX = bar + 30;
  const width = blockX + 60;
  const shifts = accidentalShifts(chord);
  const notes: StaffNote[] = [
    ...chord.map((p, i): StaffNote => ({
      id: `b${i}`,
      pitch: p,
      clef: 'treble',
      x: start + i * step,
      duration: 'quarter',
      tone: litIndex(i) ? 'accent' : 'ink',
    })),
    ...chord.map((p, i): StaffNote => ({
      id: `c${i}`,
      pitch: p,
      clef: 'treble',
      x: blockX,
      duration: 'whole',
      accidentalShift: shifts[i],
      tone: blockLit ? 'accent' : 'ink',
    })),
  ];
  const names: StaffLabel[] = chord.map((p, i) => ({
    clef: 'treble',
    position: -5,
    x: start + i * step + HEAD_WIDTH / 2,
    text: noteName(p),
  }));
  const { names: keyNames, classes } = keyLabels(chord, lit);
  const symbol = chordSymbol(rootPosition[0]!, quality, chord[0]);
  const bassNote = noteName(chord[0]!);
  const choose = (next: () => void) => {
    next();
    player.stop();
  };

  return (
    <>
      <div className="plate-toolbar">
        <label className="plate-select">
          <span>{labels.root}</span>
          <select
            className="is-compact"
            value={root}
            onChange={(e) => choose(() => setRoot(e.target.value))}
          >
            {ROOTS.map((r) => (
              <option key={r} value={r}>
                {tonicName(r)}
              </option>
            ))}
          </select>
        </label>
        <Choices
          className={qualities.length > 3 ? 'is-grid' : undefined}
          value={quality}
          onChange={(q) => choose(() => setQuality(q))}
          options={qualities.map((q) => ({ value: q, label: labels.qualities[q] ?? q }))}
        />
        {inversions && labels.inversions && (
          <Choices
            className="is-fit"
            value={String(inversion) as '0' | '1' | '2'}
            onChange={(v) => choose(() => setInversion(Number(v) as Inversion))}
            options={labels.inversions.map((label, i) => ({
              value: String(i) as '0' | '1' | '2',
              label,
            }))}
          />
        )}
      </div>
      <p className="plate-readout is-small" aria-live="polite">
        <span className="plate-readout-name">{symbol}</span>
        <span className="plate-readout-label">
          {chord.map(noteName).join(' ')} · {labels.steps[quality]}
          {inversion > 0 && labels.bass ? ` · ${labels.bass.replace('{note}', bassNote)}` : ''}
        </span>
      </p>
      {/* The notes the size of the scales' in the lesson on minor keys, whatever the chord. */}
      <div className="plate-scale" style={{ maxWidth: `${(width * 34) / 420}rem` }}>
        <EngravedStaff
          system="treble"
          width={width}
          className="plate-staff"
          label={`${staffLabel}: ${chord.map(noteName).join(' ')}`}
          notes={notes}
          labels={names}
          bars={[bar]}
        />
      </div>
      <div className="plate-actions">
        <PlayButton onClick={() => player.play(brokenThenBlock(keys))} />
      </div>
      <LessonPiano range={BUILDER_KEYS} keyNames={keyNames} keyClasses={classes} />
    </>
  );
}

// The chords of a key.

const KEY_TONICS = ['C', 'G', 'D', 'A', 'F', 'Bb', 'Eb'] as const;

/**
 * The seven triads of a major key on the treble staff, after its key signature, each under its
 * chord symbol and over its roman numeral: pick one to hear it, or hear them all in turn.
 */
export function KeyChords({
  labels,
  staffLabel,
}: {
  labels: { key: string; qualities: Record<'major' | 'minor' | 'diminished', string> };
  staffLabel: string;
}) {
  const player = usePlayNotes();
  const [tonic, setTonic] = useState<string>('C');
  const [picked, setPicked] = useState<number>(0);
  const [list, setList] = useState<readonly number[]>([]);
  const chords = useMemo(() => keyChords(tonic), [tonic]);
  const fifths = keySignature('major', tonic).fifths;
  const start = bodyStart('treble', fifths) + 12;
  const width = 360;
  const step = (width - 26 - start) / 7;
  const sounding = new Set([...player.lit].map((i) => list[Math.floor(i / 3)]!));
  const notes = chords.flatMap((c, k) =>
    chordNotes(
      `k${k}`,
      c.notes,
      'treble',
      start + k * step,
      sounding.has(k) || (sounding.size === 0 && k === picked) ? 'accent' : 'ink',
      fifths,
    ),
  );
  const top = Math.max(...chords.flatMap((c) => c.notes.map((p) => staffPosition(p, 'treble'))));
  // The symbols go over the highest note, with room made over the staff when that is far up (the
  // vii° of A or B♭ major reaches D6 or E♭6).
  const symbolAt = Math.max(11, top + 3);
  const above = Math.max(0, symbolAt * 5 - 72);
  const staffLabels: StaffLabel[] = chords.flatMap((c, k) => [
    {
      clef: 'treble',
      position: -6,
      x: start + k * step + WHOLE_WIDTH / 2,
      text: c.numeral,
    },
    {
      clef: 'treble',
      position: symbolAt,
      x: start + k * step + WHOLE_WIDTH / 2,
      text: chordSymbol(c.notes[0]!, c.quality),
    },
  ]);
  const current = chords[sounding.size > 0 ? [...sounding][0]! : picked]!;
  const heard = sounding.size > 0 ? [...sounding].flatMap((k) => chords[k]!.notes) : current.notes;
  const { names, classes } = keyLabels(
    heard,
    new Set(sounding.size > 0 ? heard.map(pitchToMidi) : []),
  );
  const play = (next: readonly number[], ms: number) => {
    setList(next);
    player.play(
      next.flatMap((k, j) =>
        chords[k]!.notes.map((p) => ({
          midi: pitchToMidi(p),
          at: j * ms,
          ms: ms - 60,
          velocity: VELOCITY,
        })),
      ),
    );
  };
  const pick = (k: number) => {
    setPicked(k);
    play([k], 1200);
  };
  const quality = current.quality as 'major' | 'minor' | 'diminished';

  return (
    <>
      <div className="plate-toolbar">
        <label className="plate-select">
          <span>{labels.key}</span>
          <select
            className="is-compact"
            value={tonic}
            onChange={(e) => {
              setTonic(e.target.value);
              player.stop();
            }}
          >
            {KEY_TONICS.map((t) => (
              <option key={t} value={t}>
                {tonicName(t)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="plate-readout is-small" aria-live="polite">
        <span className="plate-readout-name">
          {current.numeral} · {chordSymbol(current.notes[0]!, current.quality)}
        </span>
        <span className="plate-readout-label">
          {current.notes.map(noteName).join(' ')} · {labels.qualities[quality]}
        </span>
      </p>
      <EngravedStaff
        system="treble"
        width={width}
        above={above}
        className="plate-staff is-key-chords"
        label={staffLabel}
        notes={notes}
        labels={staffLabels}
        fifths={fifths}
      />
      <div className="plate-actions is-center" role="group" aria-label={staffLabel}>
        {chords.map((c, k) => (
          <button
            key={c.numeral}
            type="button"
            className={picked === k ? 'button is-compact is-current' : 'button is-compact'}
            aria-pressed={picked === k}
            onClick={() => pick(k)}
          >
            {c.numeral}
          </button>
        ))}
        <PlayButton
          onClick={() => {
            setPicked(0);
            play([0, 1, 2, 3, 4, 5, 6, 0], 700);
          }}
        />
      </div>
      <LessonPiano range={KEY_CHORD_KEYS} keyNames={names} keyClasses={classes} />
    </>
  );
}

// Chords on the grand staff.

/** Chords on the grand staff, spaced evenly, with a label over and under each. */
function ChordRow({
  chords,
  tone,
  width,
  label,
  bars = false,
}: {
  chords: readonly RowChord[];
  tone: (k: number) => StaffNote['tone'];
  width: number;
  label: string;
  bars?: boolean;
}) {
  const start = bodyStart('grand') + 14;
  const unit = (width - 24 - start) / chords.length;
  const xs = chords.map((_, k) => start + k * unit + (unit - WHOLE_WIDTH) / 2 - 4);
  const notes = chords.flatMap((c, k) => [
    ...chordNotes(`t${k}`, c.treble.map(pitch), 'treble', xs[k]!, tone(k)),
    ...chordNotes(`b${k}`, c.bass.map(pitch), 'bass', xs[k]!, tone(k)),
  ]);
  // One height for every label of a row: over the highest note, under the lowest.
  const top = Math.max(
    ...chords.flatMap((c) => c.treble.map((p) => staffPosition(pitch(p), 'treble'))),
  );
  const low = Math.min(
    ...chords.flatMap((c) => c.bass.map((p) => staffPosition(pitch(p), 'bass'))),
  );
  const labels: StaffLabel[] = chords.flatMap((c, k) => {
    const x = xs[k]! + WHOLE_WIDTH / 2;
    return [
      ...(c.above
        ? [{ clef: 'treble' as const, position: Math.max(11, top + 3), x, text: c.above }]
        : []),
      ...(c.below
        ? [{ clef: 'bass' as const, position: Math.min(-3, low - 3), x, text: c.below }]
        : []),
    ];
  });
  return (
    <EngravedStaff
      system="grand"
      width={width}
      className="plate-staff is-grand is-chord-row"
      label={label}
      notes={notes}
      labels={labels}
      bars={bars ? chords.slice(1).map((_, k) => start + (k + 1) * unit - 4) : []}
    />
  );
}

/** Chords one after another, the last held longer: `ms` apart. */
function chordRowNotes(chords: readonly RowChord[], ms: number, last = 1.8): TimedNote[] {
  return chords.flatMap((c, k) =>
    [...c.bass, ...c.treble].map((p) => ({
      midi: pitchToMidi(pitch(p)),
      at: k * ms,
      ms: k === chords.length - 1 ? ms * last : ms - 50,
      velocity: VELOCITY,
    })),
  );
}

/** Which chord of a row is sounding, from the indexes `usePlayNotes` lights. */
function soundingChord(chords: readonly RowChord[], lit: ReadonlySet<number>): number | null {
  let at = 0;
  for (const [k, c] of chords.entries()) {
    const size = c.bass.length + c.treble.length;
    for (let i = at; i < at + size; i++) if (lit.has(i)) return k;
    at += size;
  }
  return null;
}

/** A short phrase in C major ending with each cadence: its last two chords are the cadence. */
export function Cadences({
  labels,
  readouts,
  staffLabel,
}: {
  labels: Record<Cadence, string>;
  readouts: Record<Cadence, string>;
  staffLabel: string;
}) {
  const player = usePlayNotes();
  const [cadence, setCadence] = useState<Cadence>('authentic');
  const chords = CADENCE_PHRASES[cadence];
  const at = soundingChord(chords, player.lit);
  const tone = (k: number): StaffNote['tone'] =>
    at === null ? (k >= chords.length - 2 ? 'accent' : 'ink') : at === k ? 'accent' : 'ink';
  return (
    <>
      <Choices
        className="is-grid"
        value={cadence}
        onChange={(next) => {
          setCadence(next);
          player.stop();
        }}
        options={CADENCES.map((c) => ({ value: c, label: labels[c] }))}
      />
      <p className="plate-readout is-small" aria-live="polite">
        <span className="plate-readout-name">
          {chords
            .slice(-2)
            .map((c) => c.below)
            .join(' → ')}
        </span>
        <span className="plate-readout-label">{readouts[cadence]}</span>
      </p>
      <ChordRow chords={chords} tone={tone} width={340} label={staffLabel} bars />
      <div className="plate-actions">
        <PlayButton onClick={() => player.play(chordRowNotes(chords, 900))} />
      </div>
    </>
  );
}

/** V and V7 going to I: with the seventh, F falls to E as B rises to C. */
export function Resolution({
  labels,
  readouts,
  staffLabel,
}: {
  labels: Record<'triad' | 'seventh', string>;
  readouts: Record<'triad' | 'seventh', string>;
  staffLabel: string;
}) {
  const player = usePlayNotes();
  const [which, setWhich] = useState<'triad' | 'seventh'>('seventh');
  const chords = which === 'seventh' ? [V7, I_AFTER_V7] : [V, I];
  const at = soundingChord(chords, player.lit);
  const all = chords.flatMap((c) => [...c.bass, ...c.treble].map(pitch));
  const sounding = at === null ? [] : [...chords[at]!.bass, ...chords[at]!.treble].map(pitch);
  const { names, classes } = keyLabels(
    at === null ? [...chords[0]!.bass, ...chords[0]!.treble].map(pitch) : all,
    new Set(sounding.map(pitchToMidi)),
  );
  return (
    <>
      <Choices
        value={which}
        onChange={(next) => {
          setWhich(next);
          player.stop();
        }}
        options={[
          { value: 'triad', label: labels.triad },
          { value: 'seventh', label: labels.seventh },
        ]}
      />
      <p className="plate-readout is-small" aria-live="polite">
        <span className="plate-readout-label">{readouts[which]}</span>
      </p>
      <ChordRow
        chords={chords}
        tone={(k) => (at === k ? 'accent' : 'ink')}
        width={240}
        label={staffLabel}
      />
      <div className="plate-actions">
        <PlayButton onClick={() => player.play(chordRowNotes(chords, 1300, 1.4))} />
      </div>
      <LessonPiano range={[36, 83]} keyNames={names} keyClasses={classes} />
    </>
  );
}

// Bach's Prelude in C, bars 1–4: each bar one chord, broken.

const PRELUDE: readonly RowChord[] = [
  { bass: ['C4', 'E4'], treble: ['G4', 'C5', 'E5'], above: 'C', below: 'I' },
  { bass: ['C4', 'D4'], treble: ['A4', 'D5', 'F5'], above: 'Dm7/C', below: 'ii7' },
  { bass: ['B3', 'D4'], treble: ['G4', 'D5', 'F5'], above: 'G7/B', below: 'V7' },
  { bass: ['C4', 'E4'], treble: ['G4', 'C5', 'E5'], above: 'C', below: 'I' },
];

/** The bars as Bach wrote them: in each half bar, the two low notes held, the three high ones twice. */
function preludeWritten(sixteenth: number): TimedNote[] {
  return PRELUDE.flatMap((bar, b) =>
    [0, 8].flatMap((half) => {
      const at = (s: number) => (b * 16 + half + s) * sixteenth;
      const [low, high] = bar.bass.map((p) => pitchToMidi(pitch(p))) as [number, number];
      const top = bar.treble.map((p) => pitchToMidi(pitch(p)));
      return [
        { midi: low, at: at(0), ms: 8 * sixteenth - 30, velocity: VELOCITY },
        { midi: high, at: at(1), ms: 7 * sixteenth - 30, velocity: VELOCITY - 6 },
        ...[0, 1].flatMap((r) =>
          top.map((midi, i) => ({
            midi,
            at: at(2 + r * 3 + i),
            ms: sixteenth - 20,
            velocity: VELOCITY - 8,
          })),
        ),
      ];
    }),
  );
}

/**
 * The first four bars of Bach's Prelude in C folded into chords on the grand staff, with their
 * symbols and numerals; heard as Bach wrote them, or each bar as one chord.
 */
export function PreludeHarmony({
  labels,
  staffLabel,
}: {
  labels: { written: string; chords: string };
  staffLabel: string;
}) {
  const player = usePlayNotes();
  const [mode, setMode] = useState<'written' | 'chords' | null>(null);
  const sixteenth = 170;
  const bar = (): number | null => {
    if (player.started === null || mode === null || player.lit.size === 0) return null;
    const first = Math.min(...player.lit);
    return mode === 'chords' ? Math.floor(first / 5) : Math.floor(first / 16);
  };
  const at = bar();
  return (
    <>
      <ChordRow
        chords={PRELUDE}
        tone={(k) => (at === k ? 'accent' : 'ink')}
        width={360}
        label={staffLabel}
        bars
      />
      <div className="plate-actions">
        <PlayButton
          label={labels.written}
          onClick={() => {
            setMode('written');
            player.play(preludeWritten(sixteenth));
          }}
        />
        <PlayButton
          label={labels.chords}
          onClick={() => {
            setMode('chords');
            player.play(chordRowNotes(PRELUDE, 16 * sixteenth, 1));
          }}
        />
      </div>
    </>
  );
}

// The exercise: a chord on the keyboard.

interface Progress {
  at: number;
  /** Keys pressed for this question so far. */
  pressed: readonly number[];
  firstTime: number;
  missed: boolean;
  /** Keys before this (the rest of a chord just judged) are let go. */
  quietUntil: number;
}

const START: Progress = { at: 0, pressed: [], firstTime: 0, missed: false, quietUntil: 0 };

/** After a chord is judged, keys still arriving from it for this long are not the next answer. */
const SETTLE_MS = 250;

export interface ChordItem {
  /** The question, set large: "Play a minor triad on D", "Play this chord". */
  ask: string;
  /** The chord's keys, its bass first. */
  keys: readonly number[];
  /** Its notes as named in the answer: "D F A". */
  answer: string;
  /** A slash chord: the lowest key must be the bass. */
  bass?: boolean;
  /** A key marked from the start: the root to build on. */
  given?: number;
  /** What to answer from: a chord symbol. */
  figure?: ReactNode;
}

/**
 * Asks for chords one at a time, played in any octave and any order, together or one key at a
 * time: every key pressed since the question began counts. A key outside the chord starts it
 * again, with the chord marked on the keyboard.
 */
export function ChordQuiz({
  items,
  onComplete,
}: {
  items: readonly ChordItem[];
  onComplete?: () => void;
}) {
  const copy = useCopy();
  const exercise = useExercise();
  // Read and written as each key arrives, not at the next render: a MIDI keyboard's chord comes
  // as several note-ons at once.
  const progress = useRef<Progress>(START);
  const [{ at, pressed, missed }, setView] = useState<Progress>(START);
  const update = (next: Progress) => {
    progress.current = next;
    setView(next);
  };
  const [message, setMessage] = useState<string | null>(null);
  const [wrong, flashWrong] = useFlash();
  const done = at >= items.length;
  const item = items[Math.min(at, items.length - 1)]!;
  const { onPointerDownCapture, listening } = useStartOnPress(exercise, done);

  useNoteOn((midi, time) => {
    const now = progress.current;
    const asked = items[now.at];
    if (!listening() || !asked || time < now.quietUntil) return;
    const next = [...now.pressed, midi];
    const result = judgeChord(asked.keys, next, asked.bass);
    if (result === 'pending') {
      update({ ...now, pressed: next });
      setMessage(copy('chordSoFar', { notes: next.map(keyName).join(' ') }));
      return;
    }
    if (result === 'wrong') {
      // Every key in the chord, but the wrong one lowest: a slash chord's bass.
      const inChord = asked.keys.some((k) => (k - midi) % 12 === 0);
      if (!inChord) flashWrong(midi);
      update({ ...now, pressed: [], missed: true, quietUntil: time + SETTLE_MS });
      setMessage(
        inChord
          ? copy('chordBass', { answer: asked.answer })
          : copy('chordWrong', { name: keyName(midi), answer: asked.answer }),
      );
      return;
    }
    const right = now.firstTime + (now.missed ? 0 : 1);
    update({
      at: now.at + 1,
      pressed: [],
      firstTime: right,
      missed: false,
      quietUntil: time + SETTLE_MS,
    });
    if (now.at + 1 >= items.length) {
      setMessage(copy('done', { right, total: items.length }));
      exercise.stop();
      onComplete?.();
    } else {
      setMessage(copy('chordRight', { answer: asked.answer }));
    }
  });

  const restart = () => {
    update(START);
    setMessage(null);
    exercise.start();
  };
  const marked = useMemo(() => {
    if (done) return new Set<number>();
    if (missed) return new Set(item.keys);
    return item.given !== undefined && exercise.active ? new Set([item.given]) : new Set<number>();
  }, [done, missed, item, exercise.active]);
  const classes = useMemo(() => new Map(pressed.map((k) => [k, 'lk-same'])), [pressed]);

  return (
    <ExerciseFrame
      active={exercise.active}
      onPointerDownCapture={onPointerDownCapture}
      ask
      prompt={done || !exercise.active ? ' ' : item.ask}
      progress={copy('progress', { n: Math.min(at + 1, items.length), total: items.length })}
      message={message ?? (exercise.active ? copy('chordListening') : copy('ready'))}
      action={
        exercise.active
          ? null
          : {
              label: done ? copy('again') : copy('start'),
              onClick: done ? restart : exercise.start,
            }
      }
    >
      {item.figure && <div className="exercise-card">{item.figure}</div>}
      <LessonPiano range={KEYS} wrong={wrong} marked={marked} keyClasses={classes} />
    </ExerciseFrame>
  );
}

/** A chord symbol printed large, as a lead sheet prints it over the tune. */
export function SymbolCard({ symbol }: { symbol: string }) {
  return <p className="chord-symbol">{symbol}</p>;
}
