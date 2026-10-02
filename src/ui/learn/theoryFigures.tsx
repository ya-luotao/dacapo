import { useMemo, useState } from 'react';
import {
  midiToPitch,
  MIDDLE_C,
  pitchAtPosition,
  pitchToMidi,
  staffPosition,
  type Clef,
  type Pitch,
} from '../../core/note.ts';
import { keyAlters, keySignature, MAJOR_TONICS, MINOR_TONICS } from '../../core/keys.ts';
import { formatMessage } from '../../i18n/locale.ts';
import { EngravedStaff, type StaffLabel, type StaffNote } from '../engraving/EngravedStaff.tsx';
import { bodyStart, HEAD_WIDTH } from '../engraving/geometry.ts';
import { Choices, Picture, PlayButton } from './kit.tsx';
import { LessonPiano } from './LessonPiano.tsx';
import {
  keyName,
  useCopy,
  useNoteOn,
  usePlayKey,
  usePlaySequence,
  useStaticPage,
} from './lesson.ts';
import {
  majorScale,
  phraseIn,
  pitch,
  pitchName,
  relativeMinor,
  scaleRun,
  tonicName,
  type ScaleKind,
  type ScaleStep,
  type SnippetKey,
} from './notes.ts';

// Figures for the lessons after the staff: landmarks and intervals, half and whole steps and
// accidentals, the major scale and key signatures, the hands and their fingers, and minor keys.

const STAFF_KEYS: readonly [number, number] = [36, 84]; // C2–C6
const MIDDLE_KEYS: readonly [number, number] = [48, 83]; // C3–B5

// Lesson 3: landmarks and intervals.

const LANDMARKS: readonly { text: string; clef: Clef }[] = [
  { text: 'C2', clef: 'bass' },
  { text: 'C3', clef: 'bass' },
  { text: 'F3', clef: 'bass' },
  { text: 'C4', clef: 'treble' },
  { text: 'G4', clef: 'treble' },
  { text: 'C5', clef: 'treble' },
  { text: 'C6', clef: 'treble' },
];

/** The landmark notes on the grand staff and the keyboard; pick one to hear it and see its key. */
export function LandmarkMap({ label }: { label: string }) {
  const staticPage = useStaticPage();
  const play = usePlayKey();
  const [picked, setPicked] = useState<number | null>(null);
  const notes: StaffNote[] = LANDMARKS.map(({ text, clef }, i) => ({
    id: text,
    pitch: pitch(text),
    clef,
    x: 70 + i * 36,
    tone: picked === null || picked === i ? 'accent' : 'faint',
  }));
  const names = useMemo(
    () => new Map(LANDMARKS.map(({ text }) => [pitchToMidi(pitch(text)), text])),
    [],
  );
  const classes = useMemo(
    () =>
      new Map(
        LANDMARKS.map(({ text }, i) => [
          pitchToMidi(pitch(text)),
          picked === null || picked === i ? 'lk-named' : '',
        ]),
      ),
    [picked],
  );
  const pick = (i: number) => {
    setPicked(i);
    play(pitchToMidi(pitch(LANDMARKS[i]!.text)), 700);
  };

  return (
    <>
      <EngravedStaff
        system="grand"
        width={340}
        className="plate-staff is-grand"
        label={label}
        notes={notes}
      />
      {!staticPage && (
        <div className="plate-actions is-center" role="group" aria-label={label}>
          {LANDMARKS.map(({ text }, i) => (
            <button
              key={text}
              type="button"
              className={picked === i ? 'button is-compact is-current' : 'button is-compact'}
              aria-pressed={picked === i}
              onClick={() => pick(i)}
            >
              {text}
            </button>
          ))}
        </div>
      )}
      <LessonPiano range={STAFF_KEYS} keyNames={names} keyClasses={classes} />
    </>
  );
}

export type IntervalSize = 2 | 3 | 4 | 5 | 8;
const STARTS = ['E4', 'F4', 'G4', 'A4', 'D4', 'C4'].map(pitch);

/**
 * Two notes and the distance between them, counted in letters: a 2nd is a step (line to space),
 * a 3rd a skip (line to line, space to space), and so on up to the octave.
 */
export function IntervalExplorer({
  labels,
  shapes,
  staffLabel,
}: {
  labels: Record<IntervalSize, string>;
  /** How the interval looks on the staff, for each size. */
  shapes: Record<IntervalSize, string>;
  staffLabel: string;
}) {
  const staticPage = useStaticPage();
  const copy = useCopy();
  const listen = usePlaySequence();
  const [size, setSize] = useState<IntervalSize>(2);
  const [start, setStart] = useState(0);
  const low = STARTS[start]!;
  const high = pitchAtPosition('treble', staffPosition(low, 'treble') + size - 1);
  const keys = [pitchToMidi(low), pitchToMidi(high)];
  const notes: StaffNote[] = [
    { id: 'a', pitch: low, clef: 'treble', x: 120, tone: listen.at === 0 ? 'accent' : 'ink' },
    { id: 'b', pitch: high, clef: 'treble', x: 190, tone: listen.at === 1 ? 'accent' : 'ink' },
  ];
  const names = new Map(keys.map((k) => [k, keyName(k)]));
  const classes = new Map(keys.map((k) => [k, 'lk-named']));

  return (
    <>
      <Choices
        value={String(size) as `${IntervalSize}`}
        onChange={(v) => setSize(Number(v) as IntervalSize)}
        options={([2, 3, 4, 5, 8] as const).map((n) => ({
          value: `${n}` as const,
          label: labels[n],
        }))}
      />
      <p className="plate-readout is-small" aria-live="polite">
        <span className="plate-readout-name">
          {pitchName(low)} → {pitchName(high)}
        </span>
        <span className="plate-readout-label">{shapes[size]}</span>
      </p>
      <EngravedStaff
        system="treble"
        width={300}
        className="plate-staff"
        label={staffLabel}
        notes={notes}
      />
      <div className="plate-actions">
        <PlayButton onClick={() => listen.play(keys, 600)} />
        {!staticPage && (
          <button
            type="button"
            className="button is-compact"
            onClick={() => setStart((start + 1) % STARTS.length)}
          >
            {copy('another')}
          </button>
        )}
      </div>
      <LessonPiano range={MIDDLE_KEYS} keyNames={names} keyClasses={classes} />
    </>
  );
}

// Lesson 5: half and whole steps, sharps and flats.

/**
 * Play or click any key: the keys a half step (or a whole step) above and below it are marked,
 * so you see that a half step is simply the very next key, black or white.
 */
export function StepExplorer() {
  const copy = useCopy();
  const [from, setFrom] = useState(64); // E4: its half step up is a white key
  const [size, setSize] = useState<'1' | '2'>('1');
  useNoteOn((midi) => {
    if (midi >= MIDDLE_KEYS[0] + 2 && midi <= MIDDLE_KEYS[1] - 2) setFrom(midi);
  });
  const step = Number(size);
  const { names, classes } = useMemo(() => {
    const names = new Map([
      [from - step, keyName(from - step)],
      [from, keyName(from)],
      [from + step, keyName(from + step)],
    ]);
    const classes = new Map([
      [from, 'lk-named'],
      [from - step, 'lk-same'],
      [from + step, 'lk-same'],
    ]);
    return { names, classes };
  }, [from, step]);

  return (
    <>
      <Choices
        value={size}
        onChange={setSize}
        options={[
          { value: '1', label: copy('halfStep') },
          { value: '2', label: copy('wholeStep') },
        ]}
      />
      <p className="plate-readout is-small" aria-live="polite">
        <span className="plate-readout-name">
          {keyName(from - step)} ← {keyName(from)} → {keyName(from + step)}
        </span>
      </p>
      <LessonPiano range={MIDDLE_KEYS} keyNames={names} keyClasses={classes} />
    </>
  );
}

export type Sign = 'sharp' | 'natural' | 'flat';

/** A note with a sharp, a natural or a flat: the note moves a half step, the letter stays. */
export function AccidentalExplorer({
  labels,
  staffLabel,
}: {
  labels: Record<Sign, string>;
  staffLabel: string;
}) {
  const play = usePlayKey();
  const [position, setPosition] = useState(3); // A4
  const [sign, setSign] = useState<Sign>('sharp');
  const natural = pitchAtPosition('treble', position);
  const shown: Pitch = {
    ...natural,
    accidental: sign === 'sharp' ? 1 : sign === 'flat' ? -1 : 0,
  };
  const midi = pitchToMidi(shown);
  const names = new Map([
    [pitchToMidi(natural), pitchName(natural)],
    [midi, pitchName(shown)],
  ]);
  const classes = new Map([[midi, 'lk-named']]);

  return (
    <>
      <Choices
        value={sign}
        onChange={(next) => {
          setSign(next);
          play(
            pitchToMidi({
              ...natural,
              accidental: next === 'sharp' ? 1 : next === 'flat' ? -1 : 0,
            }),
          );
        }}
        options={[
          { value: 'flat', label: labels.flat },
          { value: 'natural', label: labels.natural },
          { value: 'sharp', label: labels.sharp },
        ]}
      />
      <p className="plate-readout is-small" aria-live="polite">
        <span className="plate-readout-name">{pitchName(shown)}</span>
      </p>
      <EngravedStaff
        system="treble"
        width={300}
        className="plate-staff"
        label={staffLabel}
        notes={[
          {
            id: 'n',
            pitch: shown,
            clef: 'treble',
            x: 150,
            natural: sign === 'natural',
            tone: 'accent',
          },
        ]}
        reach={{ treble: [-2, 9] }}
        onPick={(at) => {
          setPosition(at.position);
          const next = pitchAtPosition('treble', at.position);
          play(pitchToMidi({ ...next, accidental: shown.accidental }));
        }}
      />
      <LessonPiano range={MIDDLE_KEYS} keyNames={names} keyClasses={classes} />
    </>
  );
}

/** One black key, two names: C♯ and D♭ side by side, the same key lit below. */
export function SameKey({ label }: { label: string }) {
  const listen = usePlaySequence();
  const classes = useMemo(() => new Map([[61, 'lk-named']]), []);
  return (
    <>
      <EngravedStaff
        system="treble"
        width={300}
        className="plate-staff"
        label={label}
        notes={[
          {
            id: 'a',
            pitch: pitch('C#4'),
            clef: 'treble',
            x: 118,
            tone: listen.at === 0 ? 'accent' : 'ink',
          },
          {
            id: 'b',
            pitch: pitch('Db4'),
            clef: 'treble',
            x: 196,
            tone: listen.at === 1 ? 'accent' : 'ink',
          },
        ]}
        labels={[
          { clef: 'treble', position: -5, x: 126, text: 'C♯4' },
          { clef: 'treble', position: -5, x: 204, text: 'D♭4' },
        ]}
      />
      <div className="plate-actions">
        <PlayButton onClick={() => listen.play([61, 61], 700)} />
      </div>
      <LessonPiano range={MIDDLE_KEYS} keyClasses={classes} />
    </>
  );
}

/** A sharp lasts to the end of its bar: F♯, F (still sharp) | F (natural again). */
export function BarRule({ label, sounds }: { label: string; sounds: string }) {
  const listen = usePlaySequence();
  const keys = [66, 66, 65];
  const tone = (i: number) => (listen.at === i ? 'accent' : 'ink') as StaffNote['tone'];
  const notes: StaffNote[] = [
    { id: 'a', pitch: pitch('F#4'), clef: 'treble', x: 96, duration: 'half', tone: tone(0) },
    // Still sharp: the sharp before it lasts to the barline, so none is written here.
    {
      id: 'b',
      pitch: pitch('F#4'),
      clef: 'treble',
      x: 150,
      duration: 'half',
      inKey: true,
      tone: tone(1),
    },
    { id: 'c', pitch: pitch('F4'), clef: 'treble', x: 216, tone: tone(2) },
  ];
  const labels: StaffLabel[] = [
    { clef: 'treble', position: -3, x: 102, text: 'F♯' },
    { clef: 'treble', position: -3, x: 156, text: 'F♯' },
    { clef: 'treble', position: -3, x: 224, text: 'F' },
  ];
  return (
    <>
      <EngravedStaff
        system="treble"
        width={300}
        className="plate-staff"
        label={label}
        notes={notes}
        labels={labels}
        bars={[186]}
      />
      <div className="plate-actions">
        <PlayButton onClick={() => listen.play(keys, 600)} label={sounds} />
      </div>
    </>
  );
}

// Lesson 6: the major scale and key signatures.

const PATTERN = ['W', 'W', 'H', 'W', 'W', 'W', 'H'];

/**
 * Build a major scale from any key: whole, whole, half, whole, whole, whole, half. The keyboard
 * shows the steps, the staff the notes, with their sharps or flats or with the key signature.
 */
export function ScaleBuilder({
  labels,
  staffLabel,
}: {
  labels: {
    tonic: string;
    accidentals: string;
    signature: string;
    steps: string;
    whole: string;
    half: string;
  };
  staffLabel: string;
}) {
  const staticPage = useStaticPage();
  const listen = usePlaySequence();
  const [tonic, setTonic] = useState<string>('C');
  const [view, setView] = useState<'accidentals' | 'signature'>('accidentals');
  const scale = useMemo(() => majorScale(tonic).slice(0, 8), [tonic]);
  const fifths = keySignature('major', tonic).fifths;
  const withSignature = view === 'signature';
  const start = bodyStart('treble', withSignature ? fifths : 0) + 8;
  const step = (340 - 20 - start) / 8;
  const notes: StaffNote[] = scale.map((n, i) => ({
    id: `${i}`,
    pitch: n.pitch,
    clef: 'treble',
    x: start + i * step,
    inKey: withSignature,
    tone: listen.at === i ? 'accent' : 'ink',
  }));
  const names = useMemo(
    () => new Map(scale.map((n) => [n.midi, pitchName(n.pitch, false)])),
    [scale],
  );
  const classes = useMemo(() => {
    const current = listen.at === null ? null : scale[listen.at]?.midi;
    return new Map(scale.map((n) => [n.midi, n.midi === current ? 'lk-same' : 'lk-named']));
  }, [scale, listen.at]);

  return (
    <>
      <div className="plate-toolbar">
        {!staticPage && (
          <label className="plate-select">
            <span>{labels.tonic}</span>
            <select className="is-compact" value={tonic} onChange={(e) => setTonic(e.target.value)}>
              {MAJOR_TONICS.map((t) => (
                <option key={t} value={t}>
                  {tonicName(t)}
                </option>
              ))}
            </select>
          </label>
        )}
        <Choices
          value={view}
          onChange={setView}
          options={[
            { value: 'accidentals', label: labels.accidentals },
            { value: 'signature', label: labels.signature },
          ]}
        />
      </div>
      <ol className="scale-steps" aria-label={labels.steps}>
        {PATTERN.map((s, i) => (
          <li key={i} className={listen.at === i + 1 ? 'is-current' : undefined}>
            <span>{pitchName(scale[i]!.pitch, false)}</span>
            <b>{s === 'W' ? labels.whole : labels.half}</b>
          </li>
        ))}
        <li className={listen.at === 0 || listen.at === 7 ? 'is-current' : undefined}>
          <span>{pitchName(scale[7]!.pitch, false)}</span>
        </li>
      </ol>
      <EngravedStaff
        system="treble"
        width={340}
        className="plate-staff"
        label={staffLabel}
        notes={notes}
        fifths={withSignature ? fifths : 0}
      />
      <div className="plate-actions">
        <PlayButton
          onClick={() =>
            listen.play(
              scale.map((n) => n.midi),
              420,
            )
          }
        />
      </div>
      <LessonPiano range={MIDDLE_KEYS} keyNames={names} keyClasses={classes} />
    </>
  );
}

const SIGNATURE_KEYS = ['C', 'G', 'D', 'A', 'F', 'Bb', 'Eb'] as const;

/** A key's signature on the grand staff, and its sharps or flats named in order. */
export function KeySignatures({ staffLabel, none }: { staffLabel: string; none: string }) {
  const [tonic, setTonic] = useState<(typeof SIGNATURE_KEYS)[number]>('G');
  const fifths = keySignature('major', tonic).fifths;
  const order =
    fifths > 0 ? ['F', 'C', 'G', 'D', 'A', 'E', 'B'] : ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
  const sign = fifths > 0 ? '♯' : '♭';
  const listed = order.slice(0, Math.abs(fifths)).map((l) => `${l}${sign}`);
  return (
    <>
      <Choices
        value={tonic}
        onChange={setTonic}
        options={SIGNATURE_KEYS.map((t) => ({ value: t, label: tonicName(t) }))}
      />
      <p className="plate-readout is-small" aria-live="polite">
        <span className="plate-readout-name">{listed.length > 0 ? listed.join(' ') : none}</span>
      </p>
      <EngravedStaff
        system="grand"
        width={260}
        className="plate-staff is-grand"
        label={staffLabel}
        fifths={fifths}
      />
    </>
  );
}

// Lesson 7: fingers.

/** The five-finger position: each finger over its own key, thumb on C for the right hand. */
export function FivePosition({
  labels,
}: {
  labels: { right: string; left: string; both: string };
}) {
  const [hand, setHand] = useState<'right' | 'left' | 'both'>('right');
  const { marked, fingers } = useMemo(() => {
    const fingers = new Map<number, number>();
    const whites = [0, 2, 4, 5, 7];
    if (hand !== 'left') whites.forEach((w, i) => fingers.set(MIDDLE_C + w, i + 1));
    if (hand !== 'right') whites.forEach((w, i) => fingers.set(MIDDLE_C - 12 + w, 5 - i));
    return { marked: new Set(fingers.keys()), fingers };
  }, [hand]);
  return (
    <>
      <Choices
        value={hand}
        onChange={setHand}
        options={[
          { value: 'left', label: labels.left },
          { value: 'right', label: labels.right },
          { value: 'both', label: labels.both },
        ]}
      />
      <LessonPiano range={MIDDLE_KEYS} marked={marked} fingers={fingers} />
    </>
  );
}

/** Where each finger's number sits on the picture of two hands, in per cent of its width and height. */
const FINGER_SPOTS: readonly { n: number; x: number; y: number }[] = [
  { n: 5, x: 12.6, y: 21.6 },
  { n: 4, x: 21.7, y: 9.9 },
  { n: 3, x: 29.1, y: 6.0 },
  { n: 2, x: 37.2, y: 12.1 },
  { n: 1, x: 47.3, y: 38.8 },
  { n: 1, x: 52.7, y: 38.8 },
  { n: 2, x: 62.9, y: 12.1 },
  { n: 3, x: 71.0, y: 6.0 },
  { n: 4, x: 78.4, y: 9.9 },
  { n: 5, x: 87.5, y: 21.6 },
];

/** Two hands, each finger numbered: thumbs are 1, little fingers 5, in both hands. */
export function FingerNumbers({
  alt,
  left,
  right,
  caption,
}: {
  alt: string;
  left: string;
  right: string;
  caption: string;
}) {
  return (
    <div className="finger-figure">
      <Picture src="learn/two-hands.webp" alt={alt} caption={caption} />
      <div className="finger-spots" aria-hidden="true">
        {FINGER_SPOTS.map(({ n, x, y }, i) => (
          <span key={i} style={{ left: `${x}%`, top: `${y}%` }}>
            {n}
          </span>
        ))}
        <b style={{ left: '24%' }}>{left}</b>
        <b style={{ left: '76%' }}>{right}</b>
      </div>
    </div>
  );
}

/** Finger numbers over the notes, as printed in a score: 1 2 3 4 5 over C D E F G. */
export function FingeringOnStaff({ label }: { label: string }) {
  const listen = usePlaySequence();
  const keys = [60, 62, 64, 65, 67];
  const notes: StaffNote[] = keys.map((k, i) => ({
    id: `${i}`,
    pitch: midiToPitch(k),
    clef: 'treble',
    x: 96 + i * 38,
    duration: 'quarter',
    tone: listen.at === i ? 'accent' : 'ink',
  }));
  const labels: StaffLabel[] = keys.map((_, i) => ({
    clef: 'treble',
    position: 11,
    x: 102 + i * 38,
    text: String(i + 1),
  }));
  return (
    <>
      <EngravedStaff
        system="treble"
        width={320}
        className="plate-staff is-fingering"
        label={label}
        notes={notes}
        labels={labels}
      />
      <div className="plate-actions">
        <PlayButton onClick={() => listen.play(keys, 450)} />
      </div>
    </>
  );
}

/** Two notes on the treble staff, for a question about the interval between them. */
export function IntervalCard({ low, high, label }: { low: string; high: string; label: string }) {
  return (
    <EngravedStaff
      system="treble"
      width={220}
      className="plate-staff is-card"
      label={label}
      notes={[
        { id: 'a', pitch: pitch(low), clef: 'treble', x: 110 },
        { id: 'b', pitch: pitch(high), clef: 'treble', x: 160 },
      ]}
    />
  );
}

/** A key signature on the treble staff, for a question about its key. */
export function SignatureCard({ tonic, label }: { tonic: string; label: string }) {
  return (
    <EngravedStaff
      system="treble"
      width={200}
      className="plate-staff is-card"
      label={label}
      fifths={keySignature('major', tonic).fifths}
    />
  );
}

// Lesson 9: minor keys.

/**
 * Which notes of a line need their sign written after a key signature: those whose sharp, flat or
 * natural neither the signature nor an earlier note on the same line or space in the bar gives.
 * `bars` are the indexes of the first note of each new bar.
 */
function writtenSigns(
  pitches: readonly Pitch[],
  fifths: number,
  bars: readonly number[] = [],
): { inKey: boolean; natural: boolean }[] {
  const alters = keyAlters(fifths);
  let bar = new Map<string, number>();
  return pitches.map((p, i) => {
    if (bars.includes(i)) bar = new Map();
    const at = `${p.letter}${p.octave}`;
    const expected = bar.get(at) ?? alters[p.letter];
    bar.set(at, p.accidental);
    const inKey = p.accidental === expected;
    return { inKey, natural: !inKey && p.accidental === 0 };
  });
}

const RELATIVE_MAJORS = MAJOR_TONICS.filter((t) => relativeMinor(t) !== undefined);

// Frère Jacques, its first three phrases: the third, E, is the one note major and minor disagree on.
const TUNE = ['C4', 'D4', 'E4', 'C4', 'C4', 'D4', 'E4', 'C4', 'E4', 'F4', 'G4'];
const TUNE_BARS = [4, 8];

/** A tune in C major and in C minor: the same notes but one, E or E♭. */
export function MajorAndMinor({
  labels,
  staffLabel,
}: {
  labels: { major: string; minor: string };
  staffLabel: string;
}) {
  const listen = usePlaySequence();
  const [mode, setMode] = useState<'major' | 'minor'>('major');
  const tune = useMemo(
    () => TUNE.map((t) => pitch(mode === 'minor' && t === 'E4' ? 'Eb4' : t)),
    [mode],
  );
  const keys = useMemo(() => tune.map(pitchToMidi), [tune]);
  const signs = writtenSigns(tune, 0, TUNE_BARS);
  const start = bodyStart('treble') + 8;
  const unit = (360 - 34 - start) / 12;
  const xs = tune.map((_, i) => start + (i + TUNE_BARS.filter((b) => b <= i).length * 0.5) * unit);
  const notes: StaffNote[] = tune.map((p, i) => ({
    id: `${i}`,
    pitch: p,
    clef: 'treble',
    x: xs[i]!,
    duration: i === tune.length - 1 ? 'half' : 'quarter',
    stem: 'up',
    ...signs[i],
    tone: listen.at === i ? 'accent' : 'ink',
  }));
  const bars = TUNE_BARS.map((b) => (xs[b - 1]! + HEAD_WIDTH + xs[b]! - 12) / 2);
  const names = useMemo(() => new Map(keys.map((k, i) => [k, pitchName(tune[i]!)])), [keys, tune]);
  const classes = useMemo(() => {
    const current = listen.at === null ? null : keys[listen.at];
    return new Map(keys.map((k) => [k, k === current ? 'lk-same' : 'lk-named']));
  }, [keys, listen.at]);

  return (
    <>
      <Choices
        value={mode}
        onChange={(next) => {
          setMode(next);
          listen.stop();
        }}
        options={[
          { value: 'major', label: labels.major },
          { value: 'minor', label: labels.minor },
        ]}
      />
      <EngravedStaff
        system="treble"
        width={360}
        className="plate-staff"
        label={staffLabel}
        notes={notes}
        bars={bars}
      />
      <div className="plate-actions">
        <PlayButton onClick={() => listen.play(keys, 380)} />
      </div>
      <LessonPiano range={MIDDLE_KEYS} keyNames={names} keyClasses={classes} />
    </>
  );
}

/** The third above the tonic, major or minor, and the chord built on it. */
export function ThirdAndChord({
  labels,
  staffLabel,
}: {
  labels: {
    major: string;
    minor: string;
    third: string;
    chord: string;
    readout: Record<'major' | 'minor', { name: string; label: string }>;
  };
  staffLabel: string;
}) {
  const listen = usePlaySequence();
  const [mode, setMode] = useState<'major' | 'minor'>('minor');
  const [playing, setPlaying] = useState<'third' | 'chord'>('third');
  const third = pitch(mode === 'major' ? 'E4' : 'Eb4');
  const keys = [60, pitchToMidi(third), 67];
  const lit = (step: 'third' | 'chord', i: number) =>
    listen.at !== null && playing === step && listen.at === i;
  const tone = (on: boolean): StaffNote['tone'] => (on ? 'accent' : 'ink');
  const notes: StaffNote[] = [
    { id: 'c', pitch: pitch('C4'), clef: 'treble', x: 110, tone: tone(lit('third', 0)) },
    { id: 'e', pitch: third, clef: 'treble', x: 160, tone: tone(lit('third', 1)) },
    ...[pitch('C4'), third, pitch('G4')].map((p, i): StaffNote => ({
      id: `chord${i}`,
      pitch: p,
      clef: 'treble',
      x: 240,
      tone: tone(lit('chord', 0)),
    })),
  ];
  const names = new Map(keys.map((k, i) => [k, i === 1 ? pitchName(third) : keyName(k)]));
  const classes = new Map<number, string>(keys.map((k) => [k, 'lk-named']));
  if (listen.at !== null) {
    const sounding = playing === 'chord' ? keys : [keys[listen.at === 0 ? 0 : 1]!];
    for (const k of sounding) classes.set(k, 'lk-same');
  }
  const play = (step: 'third' | 'chord') => {
    setPlaying(step);
    if (step === 'third') listen.play(keys.slice(0, 2), 700);
    else listen.play([keys], 1400);
  };

  return (
    <>
      <Choices
        value={mode}
        onChange={(next) => {
          setMode(next);
          listen.stop();
        }}
        options={[
          { value: 'major', label: labels.major },
          { value: 'minor', label: labels.minor },
        ]}
      />
      <p className="plate-readout is-small" aria-live="polite">
        <span className="plate-readout-name">{labels.readout[mode].name}</span>
        <span className="plate-readout-label">{labels.readout[mode].label}</span>
      </p>
      <EngravedStaff
        system="treble"
        width={300}
        className="plate-staff"
        label={staffLabel}
        notes={notes}
        bars={[205]}
      />
      <div className="plate-actions">
        <PlayButton onClick={() => play('third')} label={labels.third} />
        <PlayButton onClick={() => play('chord')} label={labels.chord} />
      </div>
      <LessonPiano range={MIDDLE_KEYS} keyNames={names} keyClasses={classes} />
    </>
  );
}

/**
 * A major key and its relative minor: the same notes and the same key signature, the minor
 * starting on the major scale's 6th note.
 */
export function RelativeMinor({
  labels,
  staffLabel,
}: {
  labels: {
    key: string;
    /** '{tonic} major'. */
    majorName: string;
    /** '{tonic} minor'. */
    minorName: string;
    /** Said of the major scale and of its relative minor; {major} and {minor} name the keys. */
    readout: Record<'major' | 'minor', string>;
  };
  staffLabel: string;
}) {
  const staticPage = useStaticPage();
  const listen = usePlaySequence();
  const [major, setMajor] = useState<string>('C');
  const [view, setView] = useState<'major' | 'minor'>('major');
  const minor = relativeMinor(major)!;
  const scale = useMemo(
    () =>
      view === 'major'
        ? scaleRun('major', major).slice(0, 8)
        : scaleRun('naturalMinor', minor).slice(0, 8),
    [view, major, minor],
  );
  const fifths = keySignature('major', major).fifths;
  const start = bodyStart('treble', fifths) + 8;
  const step = (340 - 20 - start) / 8;
  const signs = writtenSigns(
    scale.map((n) => n.pitch),
    fifths,
  );
  // At rest, the note the relative minor starts on: the major's 6th, the minor's tonic.
  const home = (i: number) => (view === 'major' ? i === 5 : i === 0 || i === 7);
  const notes: StaffNote[] = scale.map((n, i) => ({
    id: `${i}`,
    pitch: n.pitch,
    clef: 'treble',
    x: start + i * step,
    ...signs[i],
    tone: listen.at === i || (listen.at === null && home(i)) ? 'accent' : 'ink',
  }));
  const degrees: StaffLabel[] =
    view === 'major'
      ? scale.map((_, i) => ({
          clef: 'treble',
          position: -5,
          x: start + i * step + 6,
          text: String(i + 1),
        }))
      : [];
  const names = useMemo(
    () => new Map(scale.map((n) => [n.midi, pitchName(n.pitch, false)])),
    [scale],
  );
  const classes = useMemo(() => {
    const current = listen.at === null ? null : scale[listen.at]?.midi;
    return new Map(scale.map((n) => [n.midi, n.midi === current ? 'lk-same' : 'lk-named']));
  }, [scale, listen.at]);
  const vars = { major: tonicName(major), minor: tonicName(minor) };

  return (
    <>
      <div className="plate-toolbar">
        {!staticPage && (
          <label className="plate-select">
            <span>{labels.key}</span>
            <select
              className="is-compact"
              value={major}
              onChange={(e) => {
                setMajor(e.target.value);
                listen.stop();
              }}
            >
              {RELATIVE_MAJORS.map((t) => (
                <option key={t} value={t}>
                  {tonicName(t)}
                </option>
              ))}
            </select>
          </label>
        )}
        <Choices
          value={view}
          onChange={(next) => {
            setView(next);
            listen.stop();
          }}
          options={[
            { value: 'major', label: formatMessage(labels.majorName, { tonic: vars.major }) },
            { value: 'minor', label: formatMessage(labels.minorName, { tonic: vars.minor }) },
          ]}
        />
      </div>
      <p className="plate-readout is-small" aria-live="polite">
        <span className="plate-readout-label">{formatMessage(labels.readout[view], vars)}</span>
      </p>
      <EngravedStaff
        system="treble"
        width={340}
        className="plate-staff"
        label={staffLabel}
        notes={notes}
        labels={degrees}
        fifths={fifths}
      />
      <div className="plate-actions">
        <PlayButton
          onClick={() =>
            listen.play(
              scale.map((n) => n.midi),
              420,
            )
          }
        />
      </div>
      <LessonPiano range={MIDDLE_KEYS} keyNames={names} keyClasses={classes} />
    </>
  );
}

export type MinorKind = Exclude<ScaleKind, 'major'>;

/** G♯ minor is left out: its harmonic and melodic scales need F𝄪. */
const BUILDER_MINORS = MINOR_TONICS.filter((t) => t !== 'G#');

/** The step from each note of a line to the next: 1 (half), 2 (whole) or 3 half steps. */
function stepSizes(run: readonly ScaleStep[]): number[] {
  return run.slice(1).map((n, i) => Math.abs(n.midi - run[i]!.midi));
}

/**
 * Build a minor scale from any key, natural, harmonic or melodic: the steps between its notes,
 * the notes on the staff (with their sharps and flats, or after the key signature with only what
 * it does not give), the notes each form raises marked. The melodic minor goes up and comes down.
 */
export function MinorScaleBuilder({
  initial = 'naturalMinor',
  labels,
  staffLabel,
}: {
  initial?: MinorKind;
  labels: {
    tonic: string;
    natural: string;
    harmonic: string;
    melodic: string;
    accidentals: string;
    signature: string;
    steps: string;
    up: string;
    down: string;
    whole: string;
    half: string;
    /** A step and a half. */
    augmented: string;
  };
  staffLabel: string;
}) {
  const staticPage = useStaticPage();
  const listen = usePlaySequence();
  const [tonic, setTonic] = useState<string>('A');
  const [kind, setKind] = useState<MinorKind>(initial);
  const [view, setView] = useState<'accidentals' | 'signature'>('accidentals');
  const { run, raised } = useMemo(() => {
    const full = scaleRun(kind, tonic);
    const natural = scaleRun('naturalMinor', tonic);
    const run = kind === 'melodicMinor' ? full : full.slice(0, 8);
    return { run, raised: run.map((n, i) => n.midi !== natural[i]!.midi) };
  }, [kind, tonic]);
  const fifths = view === 'signature' ? keySignature('naturalMinor', tonic).fifths : 0;
  // Eight notes to a staff: the melodic minor comes down on a second one. Its signs are those of
  // one bar, so a note going down that differs from the way up keeps its natural or flat.
  const start = bodyStart('treble', fifths) + 10;
  const step = 38;
  const width = start + 8 * step + 18;
  const signs = writtenSigns(
    run.map((n) => n.pitch),
    fifths,
  );
  const resting = listen.at === null;
  const staves = (kind === 'melodicMinor' ? [0, 7] : [0]).map((from) =>
    run.slice(from, from + 8).map((n, j): StaffNote => ({
      id: `${from + j}`,
      pitch: n.pitch,
      clef: 'treble',
      x: start + j * step,
      ...signs[from + j],
      tone: listen.at === from + j || (resting && raised[from + j]) ? 'accent' : 'ink',
    })),
  );
  const names = useMemo(() => new Map(run.map((n) => [n.midi, pitchName(n.pitch, false)])), [run]);
  const classes = useMemo(() => {
    const current = listen.at === null ? null : run[listen.at]?.midi;
    const map = new Map<number, string>();
    for (const [i, n] of run.entries()) {
      const lit = current === null ? raised[i] : n.midi === current;
      if (lit || !map.has(n.midi)) map.set(n.midi, lit ? 'lk-same' : 'lk-named');
    }
    return map;
  }, [run, raised, listen.at]);
  const stepName = (size: number) =>
    size === 1 ? labels.half : size === 2 ? labels.whole : labels.augmented;
  const rows =
    kind === 'melodicMinor'
      ? [
          { from: 0, notes: run.slice(0, 8), label: labels.up, way: '↑' },
          { from: 7, notes: run.slice(7), label: labels.down, way: '↓' },
        ]
      : [{ from: 0, notes: run, label: labels.steps, way: null }];

  return (
    <>
      <div className="plate-toolbar">
        {!staticPage && (
          <label className="plate-select">
            <span>{labels.tonic}</span>
            <select
              className="is-compact"
              value={tonic}
              onChange={(e) => {
                setTonic(e.target.value);
                listen.stop();
              }}
            >
              {BUILDER_MINORS.map((t) => (
                <option key={t} value={t}>
                  {tonicName(t)}
                </option>
              ))}
            </select>
          </label>
        )}
        <Choices
          value={kind}
          onChange={(next) => {
            setKind(next);
            listen.stop();
          }}
          options={[
            { value: 'naturalMinor', label: labels.natural },
            { value: 'harmonicMinor', label: labels.harmonic },
            { value: 'melodicMinor', label: labels.melodic },
          ]}
        />
        <Choices
          value={view}
          onChange={setView}
          options={[
            { value: 'accidentals', label: labels.accidentals },
            { value: 'signature', label: labels.signature },
          ]}
        />
      </div>
      {rows.map((row) => {
        const sizes = stepSizes(row.notes);
        return (
          <ol key={row.from} className="scale-steps" aria-label={row.label}>
            {row.way && (
              <li className="scale-steps-way" aria-hidden="true">
                {row.way}
              </li>
            )}
            {row.notes.map((n, j) => {
              const i = row.from + j;
              const size = sizes[j];
              return (
                <li
                  key={i}
                  className={
                    listen.at === i ? 'is-current' : resting && raised[i] ? 'is-raised' : undefined
                  }
                >
                  <span>{pitchName(n.pitch, false)}</span>
                  {size !== undefined && (
                    <b className={size > 2 ? 'is-wide' : undefined}>{stepName(size)}</b>
                  )}
                </li>
              );
            })}
          </ol>
        );
      })}
      {/* One size whatever the key signature's width. */}
      <div className="plate-scale" style={{ maxWidth: `${(width * 34) / 420}rem` }}>
        {staves.map((notes, k) => (
          <EngravedStaff
            key={k}
            system="treble"
            width={width}
            className="plate-staff"
            label={staves.length > 1 ? `${staffLabel} ${k === 0 ? '↑' : '↓'}` : staffLabel}
            notes={notes}
            fifths={fifths}
          />
        ))}
      </div>
      <div className="plate-actions">
        <PlayButton
          onClick={() =>
            listen.play(
              run.map((n) => n.midi),
              380,
            )
          }
        />
      </div>
      <LessonPiano range={MIDDLE_KEYS} keyNames={names} keyClasses={classes} />
    </>
  );
}

const TOP = { natural: ['E4', 'F4', 'G4', 'A4'], raised: ['E4', 'F4', 'G#4', 'A4'] } as const;

/**
 * The top of A minor with its 7th natural or raised, and the two chords that end a piece in A
 * minor: with G♯ the step to A is a half step, a leading note that pulls up into the tonic.
 */
export function LeadingNote({
  labels,
  staffLabel,
}: {
  labels: {
    natural: string;
    raised: string;
    scale: string;
    chords: string;
    readout: Record<'natural' | 'raised', { name: string; label: string }>;
  };
  staffLabel: string;
}) {
  const listen = usePlaySequence();
  const [seventh, setSeventh] = useState<'natural' | 'raised'>('raised');
  const [playing, setPlaying] = useState<'scale' | 'chords'>('scale');
  const top = TOP[seventh].map(pitch);
  const topKeys = top.map(pitchToMidi);
  const chords = [
    [top[0]!, top[2]!, pitch('B4')],
    [pitch('A4'), pitch('C5'), pitch('E5')],
  ];
  const chordKeys = chords.map((c) => c.map(pitchToMidi));
  const lit = (step: 'scale' | 'chords', i: number) =>
    listen.at !== null && playing === step && listen.at === i;
  const tone = (on: boolean): StaffNote['tone'] => (on ? 'accent' : 'ink');
  const notes: StaffNote[] = [
    ...top.map((p, i): StaffNote => ({
      id: `t${i}`,
      pitch: p,
      clef: 'treble',
      x: 96 + i * 36,
      tone: tone(lit('scale', i)),
    })),
    ...chords.flatMap((chord, c) =>
      chord.map((p, i): StaffNote => ({
        id: `c${c}${i}`,
        pitch: p,
        clef: 'treble',
        x: 264 + c * 46,
        tone: tone(lit('chords', c)),
      })),
    ),
  ];
  const names = new Map<number, string>(topKeys.map((k, i) => [k, pitchName(top[i]!)]));
  const classes = new Map<number, string>(topKeys.map((k) => [k, 'lk-named']));
  if (listen.at !== null) {
    const sounding = playing === 'scale' ? [topKeys[listen.at]!] : chordKeys[listen.at]!;
    for (const k of sounding) {
      classes.set(k, 'lk-same');
      if (!names.has(k)) names.set(k, keyName(k));
    }
  }
  const play = (step: 'scale' | 'chords') => {
    setPlaying(step);
    if (step === 'scale') listen.play(topKeys, 520);
    else listen.play(chordKeys, 1100);
  };

  return (
    <>
      <Choices
        value={seventh}
        onChange={(next) => {
          setSeventh(next);
          listen.stop();
        }}
        options={[
          { value: 'natural', label: labels.natural },
          { value: 'raised', label: labels.raised },
        ]}
      />
      <p className="plate-readout is-small" aria-live="polite">
        <span className="plate-readout-name">{labels.readout[seventh].name}</span>
        <span className="plate-readout-label">{labels.readout[seventh].label}</span>
      </p>
      <EngravedStaff
        system="treble"
        width={360}
        className="plate-staff"
        label={staffLabel}
        notes={notes}
        bars={[240]}
      />
      <div className="plate-actions">
        <PlayButton onClick={() => play('scale')} label={labels.scale} />
        <PlayButton onClick={() => play('chords')} label={labels.chords} />
      </div>
      <LessonPiano range={MIDDLE_KEYS} keyNames={names} keyClasses={classes} />
    </>
  );
}

/** A phrase's end on the grand staff, after its key signature; `current` is the step sounding. */
function SnippetStaff({
  snippetKey,
  width,
  current,
  className,
  label,
}: {
  snippetKey: SnippetKey;
  width: number;
  current: number | null;
  className: string;
  label: string;
}) {
  const { tune, bass, fifths } = useMemo(() => phraseIn(snippetKey), [snippetKey]);
  const start = bodyStart('grand', fifths) + 8;
  const unit = (width - 34 - start) / 5;
  const xs = [0, 1, 2, 3, 4.4].map((i) => start + i * unit);
  const trebleSigns = writtenSigns(tune, fifths);
  const bassSigns = writtenSigns(bass, fifths);
  const tone = (i: number): StaffNote['tone'] => (current === i ? 'accent' : 'ink');
  const notes: StaffNote[] = [
    ...tune.map((p, i): StaffNote => ({
      id: `t${i}`,
      pitch: p,
      clef: 'treble',
      x: xs[i]!,
      duration: i < 4 ? 'quarter' : 'whole',
      ...trebleSigns[i],
      tone: tone(i),
    })),
    ...bass.map((p, i): StaffNote => ({
      id: `b${i}`,
      pitch: p,
      clef: 'bass',
      x: xs[i === 0 ? 0 : 4]!,
      ...bassSigns[i],
      tone: tone(i === 0 ? 0 : 4),
    })),
  ];
  const bar = (xs[3]! + HEAD_WIDTH + xs[4]! - 14) / 2;
  return (
    <EngravedStaff
      system="grand"
      width={width}
      className={className}
      label={label}
      notes={notes}
      bars={[bar]}
      fifths={fifths}
    />
  );
}

/**
 * One key signature, two keys: a phrase in the major key, and one in its relative minor, which
 * ends on its own tonic, with it in the bass, and has the raised 7th on the way.
 */
export function TellTheKey({
  keys,
  labels,
  staffLabel,
}: {
  keys: readonly [SnippetKey, SnippetKey];
  labels: readonly [{ name: string; label: string }, { name: string; label: string }];
  staffLabel: string;
}) {
  const listen = usePlaySequence();
  const [which, setWhich] = useState<'0' | '1'>('1');
  const i = which === '0' ? 0 : 1;
  const shown = keys[i];
  return (
    <>
      <Choices
        value={which}
        onChange={(next) => {
          setWhich(next);
          listen.stop();
        }}
        options={[
          { value: '0', label: labels[0].name },
          { value: '1', label: labels[1].name },
        ]}
      />
      <p className="plate-readout is-small" aria-live="polite">
        <span className="plate-readout-label">{labels[i].label}</span>
      </p>
      <SnippetStaff
        snippetKey={shown}
        width={320}
        current={listen.at}
        className="plate-staff is-grand"
        label={staffLabel}
      />
      <div className="plate-actions">
        <PlayButton onClick={() => listen.play(phraseIn(shown).sound, 520)} />
      </div>
    </>
  );
}

/** A phrase on the grand staff, for a question about its key. */
export function SnippetCard({ snippetKey, label }: { snippetKey: SnippetKey; label: string }) {
  return (
    <SnippetStaff
      snippetKey={snippetKey}
      width={300}
      current={null}
      className="plate-staff is-card is-snippet"
      label={label}
    />
  );
}

/** A minor scale going up, after its key signature, for a question about which minor it is. */
export function MinorScaleCard({
  kind,
  tonic,
  label,
}: {
  kind: MinorKind;
  tonic: string;
  label: string;
}) {
  const run = scaleRun(kind, tonic).slice(0, 8);
  const fifths = keySignature('naturalMinor', tonic).fifths;
  const start = bodyStart('treble', fifths) + 10;
  const step = 38;
  const width = start + 8 * step + 18;
  const signs = writtenSigns(
    run.map((n) => n.pitch),
    fifths,
  );
  return (
    <EngravedStaff
      system="treble"
      width={width}
      className="plate-staff is-card is-scale"
      label={label}
      fifths={fifths}
      notes={run.map((n, i) => ({
        id: `${i}`,
        pitch: n.pitch,
        clef: 'treble',
        x: start + i * step,
        ...signs[i],
      }))}
    />
  );
}
