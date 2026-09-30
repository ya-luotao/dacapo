import { useMemo, useState, type ComponentProps, type PointerEvent, type ReactNode } from 'react';
import { useKeyboardFallback } from '../input/useKeyboardFallback.ts';
import { LessonPiano } from './LessonPiano.tsx';
import {
  keyName,
  useCopy,
  useExercise,
  useFlash,
  useNoteOn,
  usePlaySequence,
  useStartOnPress,
} from './lesson.ts';

// The lessons' exercises, which all look alike: what to do and how far along, the figure, what
// happened, and Start or Again. Those played on the keyboard listen only while they are the active
// exercise (lesson.ts).

interface FrameProps {
  active: boolean;
  prompt: ReactNode;
  /** The prompt is the question itself ("Play D4"), set large. */
  ask?: boolean;
  progress: string;
  message: string;
  /** Start, Again, or nothing while the exercise runs. */
  action: { label: string; onClick: () => void } | null;
  /** Played on the keyboard: say how to play without one. */
  keys?: boolean;
  onPointerDownCapture?: (e: PointerEvent) => void;
  children: ReactNode;
}

export function ExerciseFrame({
  active,
  prompt,
  ask = false,
  progress,
  message,
  action,
  keys = true,
  onPointerDownCapture,
  children,
}: FrameProps) {
  const copy = useCopy();
  const fallback = useKeyboardFallback();
  return (
    <div
      className={active ? 'exercise is-active' : 'exercise'}
      onPointerDownCapture={onPointerDownCapture}
    >
      <div className="exercise-head">
        <p className={ask ? 'exercise-prompt exercise-ask' : 'exercise-prompt'} aria-live="polite">
          {prompt}
        </p>
        <p className="exercise-progress">{progress}</p>
      </div>
      {children}
      <div className="exercise-foot">
        <p className="exercise-message" aria-live="polite">
          {message}
        </p>
        {action && (
          <button
            type="button"
            className="button button-primary is-compact"
            onClick={action.onClick}
          >
            {action.label}
          </button>
        )}
      </div>
      {keys && fallback && <p className="plate-note">{copy('howToPlay')}</p>}
    </div>
  );
}

type PianoProps = Omit<ComponentProps<typeof LessonPiano>, 'marked' | 'wrong'>;

/**
 * Asks for keys one at a time, each with its own question: "Play D4", "A half step above E4",
 * and a figure to answer from when it has one (a key signature). A wrong key is shown with the
 * answer marked.
 */
export function KeyQuiz({
  range,
  items,
  anyOctave = false,
  onComplete,
  piano,
}: {
  range: readonly [number, number];
  items: readonly { key: number; ask: string; figure?: ReactNode }[];
  /** A note is asked for, not a key: the same letter in any octave answers it. */
  anyOctave?: boolean;
  onComplete?: () => void;
  piano?: PianoProps;
}) {
  const copy = useCopy();
  const exercise = useExercise();
  const [at, setAt] = useState(0);
  const [firstTime, setFirstTime] = useState(0);
  const [missed, setMissed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [wrong, flashWrong] = useFlash();
  const done = at >= items.length;
  const target = items[at]?.key;
  const { onPointerDownCapture, listening } = useStartOnPress(exercise, done);

  useNoteOn((midi) => {
    if (!listening() || done || target === undefined) return;
    if (anyOctave ? (midi - target) % 12 !== 0 : midi !== target) {
      flashWrong(midi);
      setMissed(true);
      setMessage(copy('wrong', { played: keyName(midi), answer: keyName(target) }));
      return;
    }
    const right = firstTime + (missed ? 0 : 1);
    setFirstTime(right);
    setMissed(false);
    setAt(at + 1);
    if (at + 1 >= items.length) {
      setMessage(copy('done', { right, total: items.length }));
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
    () => (missed && target !== undefined ? new Set([target]) : new Set<number>()),
    [missed, target],
  );
  const figure = items[Math.min(at, items.length - 1)]?.figure;

  return (
    <ExerciseFrame
      active={exercise.active}
      onPointerDownCapture={onPointerDownCapture}
      ask
      prompt={done || !exercise.active ? ' ' : items[at]!.ask}
      progress={copy('progress', { n: Math.min(at + 1, items.length), total: items.length })}
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
      {figure && <div className="exercise-card">{figure}</div>}
      <LessonPiano range={range} {...piano} wrong={wrong} marked={marked} />
    </ExerciseFrame>
  );
}

/**
 * Plays a line of keys in order, a scale or a five-finger pattern: the next key is marked (with its
 * finger, when there is one), and a wrong key flashes without losing the place.
 */
export function SequenceExercise({
  range,
  keys,
  fingers,
  prompt,
  onComplete,
}: {
  range: readonly [number, number];
  keys: readonly number[];
  /** The finger for each step, 1 (thumb) to 5. */
  fingers?: readonly number[];
  prompt: ReactNode;
  onComplete?: () => void;
}) {
  const copy = useCopy();
  const exercise = useExercise();
  const listen = usePlaySequence();
  const [at, setAt] = useState(0);
  const [slips, setSlips] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [wrong, flashWrong] = useFlash();
  const done = at >= keys.length;
  const target = keys[at];
  const { onPointerDownCapture, listening } = useStartOnPress(exercise, done);

  useNoteOn((midi) => {
    if (!listening() || done || target === undefined) return;
    if (midi !== target) {
      flashWrong(midi);
      setSlips(slips + 1);
      setMessage(copy('notIt', { name: keyName(midi) }));
      return;
    }
    setAt(at + 1);
    if (at + 1 >= keys.length) {
      setMessage(copy('sequenceDone', { total: keys.length, slips }));
      exercise.stop();
      onComplete?.();
    } else {
      setMessage(copy('next', { name: keyName(keys[at + 1]!) }));
    }
  });

  const restart = () => {
    setAt(0);
    setSlips(0);
    setMessage(null);
    exercise.start();
  };
  const shown = listen.at !== null ? keys[listen.at] : target;
  const marked = useMemo(
    () =>
      shown !== undefined && (exercise.active || listen.at !== null)
        ? new Set([shown])
        : new Set<number>(),
    [shown, exercise.active, listen.at],
  );
  const fingerMap = useMemo(() => {
    const step = listen.at ?? at;
    return fingers && shown !== undefined && fingers[step] !== undefined
      ? new Map([[shown, fingers[step]]])
      : undefined;
  }, [fingers, shown, at, listen.at]);

  return (
    <ExerciseFrame
      active={exercise.active}
      onPointerDownCapture={onPointerDownCapture}
      prompt={prompt}
      progress={copy('progress', { n: Math.min(at + 1, keys.length), total: keys.length })}
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
      <div className="plate-actions is-top">
        <button type="button" className="button is-compact" onClick={() => listen.play(keys, 360)}>
          <svg className="button-glyph" viewBox="0 0 10 12" aria-hidden="true">
            <path d="M1 1l8 5-8 5z" />
          </svg>
          {copy('listen')}
        </button>
      </div>
      <LessonPiano range={range} wrong={wrong} marked={marked} fingers={fingerMap} />
    </ExerciseFrame>
  );
}

export interface ChoiceQuestion {
  id: string;
  /** What the question shows: a staff, a rhythm, a key signature; or the question in words. */
  figure: ReactNode;
  /** The question in words, over the figure. */
  question?: string;
  options: readonly string[];
  answer: number;
  /** Keys to hear, one step after another (a chord when a step holds several). */
  sound?: readonly (number | readonly number[])[];
}

/** Questions answered by choosing: step or skip, how many beats, which key. */
export function ChoiceQuiz({
  prompt,
  questions,
  onComplete,
}: {
  prompt: ReactNode;
  questions: readonly ChoiceQuestion[];
  onComplete?: () => void;
}) {
  const copy = useCopy();
  const listen = usePlaySequence();
  const [at, setAt] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [firstTime, setFirstTime] = useState(0);
  const done = at >= questions.length;
  const question = questions[Math.min(at, questions.length - 1)]!;
  const answered = chosen !== null;
  const right = chosen === question.answer;
  // Answers in sentences go one under another.
  const long = question.options.some((o) => o.length > 14);

  const choose = (i: number) => {
    if (answered || done) return;
    setChosen(i);
    if (i === question.answer) setFirstTime(firstTime + 1);
    if (question.sound) listen.play(question.sound);
  };
  const next = () => {
    setChosen(null);
    setAt(at + 1);
    if (at + 1 >= questions.length) onComplete?.();
  };
  const restart = () => {
    setChosen(null);
    setFirstTime(0);
    setAt(0);
  };

  const message = done
    ? copy('done', { right: firstTime, total: questions.length })
    : !answered
      ? ' '
      : right
        ? copy('choiceRight')
        : copy('choiceWrong', { answer: question.options[question.answer]! });

  return (
    <ExerciseFrame
      active={false}
      keys={false}
      prompt={prompt}
      progress={copy('progress', {
        n: Math.min(at + 1, questions.length),
        total: questions.length,
      })}
      message={message}
      action={
        done
          ? { label: copy('again'), onClick: restart }
          : answered
            ? { label: copy('nextQuestion'), onClick: next }
            : null
      }
    >
      {question.question && <p className="choice-question">{question.question}</p>}
      {question.figure && <div className="choice-figure">{question.figure}</div>}
      <div
        className={long ? 'choice-options is-long' : 'choice-options'}
        role="group"
        aria-label={typeof prompt === 'string' ? prompt : undefined}
      >
        {question.options.map((option, i) => (
          <button
            key={option}
            type="button"
            className={
              'button choice' +
              (answered && i === question.answer ? ' is-right' : '') +
              (answered && i === chosen && !right ? ' is-wrong' : '')
            }
            aria-pressed={chosen === i}
            disabled={done}
            onClick={() => choose(i)}
          >
            {option}
          </button>
        ))}
        {question.sound && (
          <button
            type="button"
            className="button is-compact choice-listen"
            onClick={() => listen.play(question.sound!)}
          >
            <svg className="button-glyph" viewBox="0 0 10 12" aria-hidden="true">
              <path d="M1 1l8 5-8 5z" />
            </svg>
            {copy('listen')}
          </button>
        )}
      </div>
    </ExerciseFrame>
  );
}
