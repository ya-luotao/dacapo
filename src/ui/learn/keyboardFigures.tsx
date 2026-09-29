import { useMemo, useState, type ReactNode } from 'react';
import {
  isBlack,
  MIDDLE_C,
  midiName,
  PIANO_HIGHEST,
  PIANO_LOWEST,
  pitchClass,
} from '../../core/note.ts';
import { ExerciseFrame } from './exercises.tsx';
import { LessonPiano } from './LessonPiano.tsx';
import { Choices } from './kit.tsx';
import { keyName, useCopy, useExercise, useFlash, useNoteOn, useStartOnPress } from './lesson.ts';

// The lessons' keyboards: the app's own piano (so every figure plays and lights like the Play
// page), coloured and labelled for what the lesson is showing, and the exercises that listen to it.

const TWO = new Set([1, 3]);
const THREE = new Set([6, 8, 10]);

function keysIn([low, high]: readonly [number, number]): number[] {
  return Array.from({ length: high - low + 1 }, (_, i) => low + i);
}

// Figures.

export type GroupView = 'two' | 'three' | 'both';

/** The black keys, their groups of two and of three picked out in two colours. */
export function BlackGroups({
  range = [36, 83],
  labels,
}: {
  range?: readonly [number, number];
  labels: Record<GroupView, string>;
}) {
  const [view, setView] = useState<GroupView>('both');
  const classes = useMemo(() => {
    const map = new Map<number, string>();
    for (const midi of keysIn(range)) {
      const pc = pitchClass(midi);
      if (TWO.has(pc) && view !== 'three') map.set(midi, 'lk-two');
      if (THREE.has(pc) && view !== 'two') map.set(midi, 'lk-three');
    }
    return map;
  }, [range, view]);

  return (
    <>
      <Choices
        value={view}
        onChange={setView}
        options={[
          { value: 'two', label: labels.two },
          { value: 'three', label: labels.three },
          { value: 'both', label: labels.both },
        ]}
      />
      <LessonPiano range={range} keyClasses={classes} />
    </>
  );
}

export type LetterView = 'c' | 'f' | 'all';

/** The white keys' letters: C beside the twos, F beside the threes, or all seven. */
export function LetterKeys({
  range = [48, 83],
  labels,
}: {
  range?: readonly [number, number];
  labels: Record<LetterView, string>;
}) {
  const [view, setView] = useState<LetterView>('c');
  const { names, classes } = useMemo(() => {
    const names = new Map<number, string>();
    const classes = new Map<number, string>();
    for (const midi of keysIn(range)) {
      const pc = pitchClass(midi);
      const letter = midiName(midi).replace(/-?\d+$/, '');
      if (isBlack(midi)) {
        if (view === 'c' && TWO.has(pc)) classes.set(midi, 'lk-two');
        if (view === 'f' && THREE.has(pc)) classes.set(midi, 'lk-three');
        continue;
      }
      if (view === 'all' || (view === 'c' && pc === 0) || (view === 'f' && pc === 5)) {
        names.set(midi, letter);
      }
      if ((view === 'c' && pc === 0) || (view === 'f' && pc === 5)) classes.set(midi, 'lk-named');
    }
    return { names, classes };
  }, [range, view]);

  return (
    <>
      <Choices
        value={view}
        onChange={setView}
        options={[
          { value: 'c', label: labels.c },
          { value: 'f', label: labels.f },
          { value: 'all', label: labels.all },
        ]}
      />
      <LessonPiano range={range} keyNames={names} keyClasses={classes} />
    </>
  );
}

/**
 * The whole keyboard with every C named by its octave. Play any key: its name, and the keys of the
 * same letter in the other octaves.
 */
export function NameAnyKey() {
  const copy = useCopy();
  const [last, setLast] = useState<number | null>(null);
  useNoteOn(setLast);
  const { names, classes } = useMemo(() => {
    const names = new Map<number, string>();
    const classes = new Map<number, string>();
    for (let midi = PIANO_LOWEST; midi <= PIANO_HIGHEST; midi++) {
      if (pitchClass(midi) === 0) names.set(midi, keyName(midi));
      if (last !== null && midi !== last && pitchClass(midi) === pitchClass(last)) {
        classes.set(midi, 'lk-same');
      }
    }
    return { names, classes };
  }, [last]);

  return (
    <>
      <p className="plate-readout" aria-live="polite">
        {last === null ? (
          <span className="plate-readout-empty">{copy('playAny')}</span>
        ) : (
          <>
            <span className="plate-readout-label">{copy('lastPlayed')}</span>
            <span className="plate-readout-name">{keyName(last)}</span>
            {last === MIDDLE_C && <span className="plate-readout-label">{copy('middleC')}</span>}
          </>
        )}
      </p>
      <LessonPiano keyNames={names} keyClasses={classes} />
    </>
  );
}

// Exercises.

/**
 * Find every key of a kind on the keyboard shown: each C, or each group of two black keys. A key
 * belongs to a group (its own name, or its octave's group); finding one key of a group finds it.
 */
export function FindKeys({
  range,
  groupOf,
  prompt,
  onComplete,
}: {
  range: readonly [number, number];
  /** The group a key belongs to, or null when it is not one to find. */
  groupOf: (midi: number) => string | null;
  prompt: ReactNode;
  onComplete?: () => void;
}) {
  const copy = useCopy();
  const exercise = useExercise();
  const [found, setFound] = useState<ReadonlySet<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [wrong, flashWrong] = useFlash();
  const groups = useMemo(() => {
    const all = new Set<string>();
    for (const midi of keysIn(range)) {
      const group = groupOf(midi);
      if (group !== null) all.add(group);
    }
    return all;
  }, [range, groupOf]);
  const done = found.size === groups.size;
  const { onPointerDownCapture, listening } = useStartOnPress(exercise, done);

  useNoteOn((midi) => {
    if (!listening() || done) return;
    const group = groupOf(midi);
    const inRange = midi >= range[0] && midi <= range[1];
    if (group === null || !inRange) {
      flashWrong(midi);
      setMessage(copy('notIt', { name: keyName(midi) }));
      return;
    }
    setMessage(copy('right', { name: keyName(midi) }));
    const next = new Set(found).add(group);
    setFound(next);
    if (next.size === groups.size) {
      setMessage(copy('allFound'));
      exercise.stop();
      onComplete?.();
    }
  });

  const classes = useMemo(() => {
    const map = new Map<number, string>();
    for (const midi of keysIn(range)) {
      const group = groupOf(midi);
      if (group !== null && found.has(group)) map.set(midi, 'lk-found');
    }
    return map;
  }, [range, groupOf, found]);

  const restart = () => {
    setFound(new Set());
    setMessage(null);
    exercise.start();
  };

  return (
    <ExerciseFrame
      active={exercise.active}
      onPointerDownCapture={onPointerDownCapture}
      prompt={prompt}
      progress={copy('found', { n: found.size, total: groups.size })}
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
      <LessonPiano range={range} keyClasses={classes} wrong={wrong} />
    </ExerciseFrame>
  );
}
