import { useEffect, useMemo, useRef, useState } from 'react';
import {
  midiToPitch,
  MIDDLE_C,
  pitchAtPosition,
  pitchToMidi,
  type Clef,
  type Pitch,
} from '../../core/note.ts';
import {
  EngravedStaff,
  type StaffLabel,
  type StaffMark,
  type StaffNote,
} from '../engraving/EngravedStaff.tsx';
import { useHubState } from '../input/context.ts';
import { ExerciseFrame } from './exercises.tsx';
import { LessonPiano } from './LessonPiano.tsx';
import { pitch } from './notes.ts';
import { Choices } from './kit.tsx';
import { keyName, useCopy, useExercise, useNoteOn, usePlayKey, useStaticPage } from './lesson.ts';

// The lessons' staves: the lines and spaces, a clef that names them, the grand staff joined to
// the keyboard, and flashcards answered on it.

/** The keys under the staves: from C2 to C6, enough for every note the figures draw. */
const STAFF_KEYS: readonly [number, number] = [36, 84];

function nameOf(p: Pitch): string {
  return `${p.letter}${p.accidental === 1 ? '♯' : p.accidental === -1 ? '♭' : ''}${p.octave}`;
}

// Figures.

export type LineView = 'lines' | 'spaces';

/** A bare staff: its lines and spaces numbered from the bottom, one set picked out at a time. */
export function LinesAndSpaces({
  labels,
  staffLabel,
}: {
  labels: Record<LineView, string>;
  staffLabel: string;
}) {
  const copy = useCopy();
  const [view, setView] = useState<LineView>('lines');
  const [hover, setHover] = useState<number | null>(null);
  const positions = view === 'lines' ? [0, 2, 4, 6, 8] : [1, 3, 5, 7];
  const marks: StaffMark[] = positions.map((position) => ({
    clef: 'treble',
    position,
    tone: hover === position ? 'accent' : 'faint',
  }));
  const numbers: StaffLabel[] = positions.map((position, i) => ({
    clef: 'treble',
    position,
    x: 13,
    text: String(i + 1),
  }));
  const name =
    hover === null
      ? ' '
      : hover % 2 === 0
        ? copy('line', { n: hover / 2 + 1 })
        : copy('space', { n: (hover + 1) / 2 });

  return (
    <>
      <Choices
        value={view}
        onChange={setView}
        options={[
          { value: 'lines', label: labels.lines },
          { value: 'spaces', label: labels.spaces },
        ]}
      />
      <p className="plate-readout is-small" aria-live="polite">
        <span className="plate-readout-name">{name}</span>
      </p>
      <EngravedStaff
        system="plain"
        width={300}
        className="plate-staff"
        label={staffLabel}
        marks={marks}
        labels={numbers}
        reach={{ treble: [0, 8] }}
        onHover={(at) => setHover(at && positions.includes(at.position) ? at.position : null)}
        onPick={(at) => setHover(positions.includes(at.position) ? at.position : null)}
      />
    </>
  );
}

/** Notes climbing the treble staff a step at a time; higher on the page is higher in sound. */
export function StepsUp({ label }: { label: string }) {
  const staticPage = useStaticPage();
  const copy = useCopy();
  const play = usePlayKey();
  const steps = useMemo(() => ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'].map(pitch), []);
  const [at, setAt] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const listen = () => {
    clearTimeout(timer.current);
    const next = (i: number) => {
      if (i >= steps.length) {
        setAt(null);
        return;
      }
      setAt(i);
      play(pitchToMidi(steps[i]!), 420);
      timer.current = setTimeout(() => next(i + 1), 480);
    };
    next(0);
  };

  const notes: StaffNote[] = steps.map((p, i) => ({
    id: `${i}`,
    pitch: p,
    clef: 'treble',
    x: 68 + i * 26,
    tone: at === i ? 'accent' : 'ink',
  }));

  return (
    <>
      <EngravedStaff
        system="treble"
        width={300}
        className="plate-staff"
        label={label}
        notes={notes}
        onPick={(pick) => play(pitchToMidi(pitchAtPosition('treble', pick.position)))}
      />
      {!staticPage && (
        <div className="plate-actions">
          <button type="button" className="button is-compact" onClick={listen}>
            <svg className="button-glyph" viewBox="0 0 10 12" aria-hidden="true">
              <path d="M1 1l8 5-8 5z" />
            </svg>
            {copy('listen')}
          </button>
        </div>
      )}
    </>
  );
}

export type ClefView = 'clef' | 'lines' | 'spaces';

/**
 * One clef, and what it does: the line it names, then every line and every space by letter.
 * Point at the staff to see the note there and hear it; the key lights below.
 */
export function ClefExplorer({
  clef,
  labels,
  staffLabel,
}: {
  clef: Clef;
  labels: Record<ClefView, string>;
  staffLabel: string;
}) {
  const play = usePlayKey();
  const [view, setView] = useState<ClefView>('clef');
  const [hover, setHover] = useState<number | null>(null);
  const home = clef === 'treble' ? 2 : 6;

  const positions = view === 'lines' ? [0, 2, 4, 6, 8] : view === 'spaces' ? [1, 3, 5, 7] : [home];
  const notes: StaffNote[] = positions.map((position, i) => ({
    id: `${view}${position}`,
    pitch: pitchAtPosition(clef, position),
    clef,
    x: view === 'clef' ? 150 : 76 + i * 44,
    tone: view === 'clef' ? 'accent' : 'ink',
  }));
  const letters: StaffLabel[] = positions.map((position, i) => ({
    clef,
    position,
    x: (view === 'clef' ? 150 : 76 + i * 44) + 27,
    text: pitchAtPosition(clef, position).letter,
  }));
  if (hover !== null && !positions.includes(hover)) {
    notes.push({
      id: 'hover',
      pitch: pitchAtPosition(clef, hover),
      clef,
      x: 262 - 30,
      tone: 'faint',
    });
  }
  const shown = hover !== null ? pitchAtPosition(clef, hover) : null;

  return (
    <>
      <Choices
        value={view}
        onChange={setView}
        options={[
          { value: 'clef', label: labels.clef },
          { value: 'lines', label: labels.lines },
          { value: 'spaces', label: labels.spaces },
        ]}
      />
      <p className="plate-readout is-small" aria-live="polite">
        <span className="plate-readout-name">{shown ? nameOf(shown) : ' '}</span>
      </p>
      <EngravedStaff
        system={clef}
        width={300}
        className="plate-staff"
        label={staffLabel}
        notes={notes}
        labels={letters}
        clefAccent={view === 'clef'}
        marks={view === 'clef' ? [{ clef, position: home }] : []}
        onHover={(at) => setHover(at ? at.position : null)}
        onPick={(at) => {
          setHover(at.position);
          play(pitchToMidi(pitchAtPosition(clef, at.position)));
        }}
      />
      <LessonPiano range={STAFF_KEYS} />
    </>
  );
}

/**
 * The grand staff over the keyboard: every key held shows on the staff it belongs to, from middle
 * C up on the treble and below it on the bass. "Middle C" shows the one key in both places.
 */
export function GrandStaffLink({
  labels,
}: {
  labels: { play: string; middle: string; staff: string };
}) {
  const { held } = useHubState();
  const [view, setView] = useState<'play' | 'middle'>('play');

  const notes: StaffNote[] =
    view === 'middle'
      ? [
          { id: 't', pitch: midiToPitch(MIDDLE_C), clef: 'treble', x: 110, tone: 'accent' },
          { id: 'b', pitch: midiToPitch(MIDDLE_C), clef: 'bass', x: 190, tone: 'accent' },
        ]
      : [...held.keys()]
          .filter((midi) => midi >= STAFF_KEYS[0] && midi <= STAFF_KEYS[1])
          .sort((a, b) => a - b)
          .map((midi) => ({
            id: `k${midi}`,
            pitch: midiToPitch(midi, 'sharp'),
            clef: midi >= MIDDLE_C ? 'treble' : 'bass',
            x: 160,
            tone: 'accent',
          }));
  const marked = useMemo(
    () => (view === 'middle' ? new Set([MIDDLE_C]) : new Set<number>()),
    [view],
  );
  const heldNames = [...held.keys()].sort((a, b) => a - b).map(keyName);

  return (
    <>
      <Choices
        value={view}
        onChange={setView}
        options={[
          { value: 'play', label: labels.play },
          { value: 'middle', label: labels.middle },
        ]}
      />
      <p className="plate-readout is-small" aria-live="polite">
        <span className="plate-readout-name">
          {view === 'middle' ? 'C4' : heldNames.join(' ') || ' '}
        </span>
      </p>
      <EngravedStaff
        system="grand"
        width={300}
        className="plate-staff is-grand"
        label={labels.staff}
        notes={notes}
      />
      <LessonPiano range={STAFF_KEYS} marked={marked} />
    </>
  );
}

// Exercise.

export interface Card {
  pitch: string;
  clef: Clef;
  /** A key signature on the card, whose sharps or flats the note takes. */
  fifths?: number;
}

/** Flashcards: a note on its staff, answered on the keyboard in the right octave. */
export function StaffQuiz({
  cards,
  ask,
  onComplete,
}: {
  cards: readonly Card[];
  ask: string;
  onComplete?: () => void;
}) {
  const copy = useCopy();
  const exercise = useExercise();
  const [at, setAt] = useState(0);
  const [firstTime, setFirstTime] = useState(0);
  const [missed, setMissed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const done = at >= cards.length;
  const card = cards[Math.min(at, cards.length - 1)]!;
  const target = pitchToMidi(pitch(card.pitch));

  useNoteOn((midi) => {
    if (!exercise.active || done) return;
    if (midi !== target) {
      setMissed(true);
      setMessage(copy('wrong', { played: keyName(midi), answer: keyName(target) }));
      return;
    }
    const right = firstTime + (missed ? 0 : 1);
    setFirstTime(right);
    setMissed(false);
    setAt(at + 1);
    if (at + 1 >= cards.length) {
      setMessage(copy('done', { right, total: cards.length }));
      exercise.stop();
      onComplete?.();
    } else {
      setMessage(copy('right', { name: keyName(midi) }));
    }
  });

  const restart = () => {
    setAt(0);
    setFirstTime(0);
    setMissed(false);
    setMessage(null);
    exercise.start();
  };

  const marked = useMemo(
    () => (missed && !done ? new Set([target]) : new Set<number>()),
    [missed, done, target],
  );

  return (
    <ExerciseFrame
      active={exercise.active}
      prompt={ask}
      progress={copy('progress', { n: Math.min(at + 1, cards.length), total: cards.length })}
      message={message ?? (exercise.active ? copy('listening') : copy('ready'))}
      action={
        exercise.active
          ? null
          : {
              label: done ? copy('again') : copy('start'),
              onClick: done ? restart : exercise.start,
            }
      }
    >
      <div className="exercise-card">
        <EngravedStaff
          system={card.clef}
          width={200}
          className="plate-staff is-card"
          label={ask}
          fifths={card.fifths}
          notes={
            exercise.active || done
              ? [
                  {
                    id: 'card',
                    pitch: pitch(card.pitch),
                    clef: card.clef,
                    x: card.fifths ? 130 : 120,
                    tone: missed ? 'bad' : 'ink',
                  },
                ]
              : []
          }
        />
      </div>
      <LessonPiano range={STAFF_KEYS} marked={marked} />
    </ExerciseFrame>
  );
}
