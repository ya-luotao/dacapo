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
import { keySignature, MAJOR_TONICS } from '../../core/scales.ts';
import { EngravedStaff, type StaffLabel, type StaffNote } from '../engraving/EngravedStaff.tsx';
import { bodyStart } from '../engraving/geometry.ts';
import { Choices, Picture } from './kit.tsx';
import { LessonPiano } from './LessonPiano.tsx';
import { keyName, useCopy, useNoteOn, usePlayKey, usePlaySequence } from './lesson.ts';
import { majorScale, pitch, pitchName, tonicName } from './notes.ts';

// Figures for the lessons after the staff: landmarks and intervals, half and whole steps and
// accidentals, the major scale and key signatures, and the hands and their fingers.

const STAFF_KEYS: readonly [number, number] = [36, 84]; // C2–C6
const MIDDLE_KEYS: readonly [number, number] = [48, 83]; // C3–B5

function PlayButton({ onClick, label }: { onClick: () => void; label?: string }) {
  const copy = useCopy();
  return (
    <button type="button" className="button is-compact" onClick={onClick}>
      <svg className="button-glyph" viewBox="0 0 10 12" aria-hidden="true">
        <path d="M1 1l8 5-8 5z" />
      </svg>
      {label ?? copy('listen')}
    </button>
  );
}

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
        <button
          type="button"
          className="button is-compact"
          onClick={() => setStart((start + 1) % STARTS.length)}
        >
          {copy('another')}
        </button>
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
