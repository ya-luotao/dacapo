import { useMemo } from 'react';
import type {
  Assignment,
  LevelFamily,
  LevelTask,
  PieceRunFigures,
  PieceTask,
  ScaleRunFigures,
  ScaleTask,
  SessionFigures,
  Task,
  TaskProgress,
} from '../../core/assignmentRecords.ts';
import { pageOfFamily } from '../../core/assignments.ts';
import { exerciseKeyParts, SCALE_TYPES } from '../../core/scaleTypes.ts';
import type { DayKey } from '../../core/streak.ts';
import { useI18n, type MessageKey } from '../../i18n/index.ts';
import { lessonBySlug, lessonLanguage } from '../../learn/lessons.ts';
import { isBuiltInId } from '../../pieces/library/index.ts';
import { useLogFormat } from '../progress/format.ts';
import { useExerciseName } from '../scales/exerciseName.ts';

/** Where a family's levels are named: Read's cards, rhythm, sight-reading, Ear's and Harmony's. */
export function levelKey(family: LevelFamily, level: string): MessageKey {
  const prefix =
    family === 'notes'
      ? 'read'
      : family === 'rhythm' || family === 'rhythmEar'
        ? 'rhythm'
        : family === 'sight'
          ? 'sight'
          : family === 'chordSymbol'
            ? 'harmony'
            : pageOfFamily(family) === 'ear'
              ? 'ear'
              : 'theory';
  return `${prefix}.level.${level}` as MessageKey;
}

/** A family by the name its page gives it. */
export function familyKey(family: LevelFamily): MessageKey {
  if (family === 'chordSymbol') return 'progress.kind.chordSymbol';
  return `${pageOfFamily(family) === 'ear' ? 'ear.family' : 'read.what'}.${family}` as MessageKey;
}

/** Where an assignment stands in time today. */
export type Timing = 'upcoming' | 'current' | 'past';

export function timingOf(a: Pick<Assignment, 'start' | 'due'>, today: DayKey): Timing {
  return today < a.start ? 'upcoming' : today > a.due ? 'past' : 'current';
}

const join = (parts: readonly (string | null)[]) => parts.filter(Boolean).join(' · ');

/**
 * A scale task in words: the exercise's name, and how its click is set. The exercises' rules
 * (core/scales.ts, with Hanon's plates) say both in full, on the Assignments pages
 * (`useAssignmentFormat` in format.ts); the home page loads without them and names the exercise
 * from its key (`useScaleKeyWords`).
 */
export interface ScaleWords {
  name: (task: ScaleTask) => string;
  /** Absent where the rules are not loaded: the task's details then leave the click out. */
  tempo?: (task: ScaleTask) => string;
}

const KEY_HANDS = ['right', 'left', 'both', 'contrary'] as const;

/**
 * A scale task named from its exercise key alone (`major:D:2:both`: type, tonic, octaves, hands,
 * and a form), without the exercises' rules: "D major, 2 oct. · Both hands". A scale or an
 * arpeggio has its octaves in its name, as everywhere; a technique exercise is named without
 * them (most have one length: only the rules know which have more).
 */
export function useScaleKeyWords(): ScaleWords {
  const { t } = useI18n();
  const exerciseName = useExerciseName();
  return useMemo(
    () => ({
      name: (task) => {
        const parts = exerciseKeyParts(task.exercise);
        if (!parts) return task.exercise;
        const [, , octaves = '', hands] = task.exercise.split(':');
        try {
          const scale = exerciseName(parts);
          const withOctaves =
            (SCALE_TYPES as readonly string[]).includes(parts.type) && /^[1-9]$/.test(octaves);
          const hand = KEY_HANDS.find((h) => h === hands);
          return join([
            withOctaves
              ? t('progress.session.scaleOne', { scale, octaves: Number(octaves) })
              : scale,
            hand ? t(`progress.session.hands.${hand}`) : null,
          ]);
        } catch {
          // A form the name cannot read: a key from before the rules it passed were changed.
          return task.exercise;
        }
      },
    }),
    [t, exerciseName],
  );
}

/**
 * Assignments and their tasks in words: what each task asks for, and how far it is. One place, so
 * the editor, the checklist, a link's preview, the home page and a report all say the same.
 */
export function useTaskFormat(scale: ScaleWords) {
  const { t, locale } = useI18n();
  const log = useLogFormat();
  return useMemo(() => {
    const percentFormat = new Intl.NumberFormat(locale, {
      style: 'percent',
      maximumFractionDigits: 0,
    });
    const percent = (value: number) => percentFormat.format(value);
    const count = (
      n: number,
      one: MessageKey,
      other: MessageKey,
      values: Record<string, string | number> = {},
    ) => t(n === 1 ? one : other, { ...values, n });

    /** A piece by the name it has here: a built-in piece's in this language, else as it came. */
    const pieceTitle = (task: PieceTask) =>
      isBuiltInId(task.piece.id)
        ? t(`library.${task.piece.id}.title`)
        : task.piece.title || t('pieces.untitled');
    const pieceComposer = (task: PieceTask) =>
      isBuiltInId(task.piece.id) ? t(`library.${task.piece.id}.composer`) : task.piece.composer;

    const bars = (task: PieceTask) =>
      task.bars === null
        ? t('progress.session.wholePiece')
        : task.bars.fromLabel === task.bars.toLabel
          ? t('progress.session.bar', { bar: task.bars.fromLabel })
          : t('progress.session.barRange', { from: task.bars.fromLabel, to: task.bars.toLabel });

    const levelTitle = (task: LevelTask) =>
      join([t(`nav.${pageOfFamily(task.family)}`), t(familyKey(task.family)), task.level]);

    /** What the task is: a piece, a scale, a level, a lesson, minutes. */
    const title = (task: Task): string => {
      switch (task.kind) {
        case 'piece':
          return pieceTitle(task);
        case 'scale':
          return scale.name(task);
        case 'level':
          return levelTitle(task);
        case 'lesson': {
          const lesson = lessonBySlug(task.slug);
          return t('assignments.task.lesson', {
            title: lesson ? lesson.title[lessonLanguage(locale)] : task.slug,
          });
        }
        case 'minutes':
          return t('assignments.task.minutes');
        default:
          return t('assignments.task.unknown');
      }
    };

    /** How it is to be practised: bars, hands, mode and tempo; the click; the level's name. */
    const details = (task: Task): string | null => {
      switch (task.kind) {
        case 'piece':
          return join([
            bars(task),
            t(`progress.session.hands.${task.hands}`),
            t(`assignments.task.mode.${task.mode}`),
            t('assignments.task.tempo', { percent: percent(task.tempo / 100) }),
          ]);
        case 'scale':
          return scale.tempo?.(task) ?? null;
        case 'level':
          return t(levelKey(task.family, task.level));
        case 'unknown':
          return t('assignments.task.unknown.help');
        default:
          return null;
      }
    };

    /** What meets it. */
    const goal = (task: Task): string | null => {
      switch (task.kind) {
        case 'piece': {
          if (!task.goal)
            return count(task.runs, 'assignments.goal.runs.one', 'assignments.goal.runs.other');
          const share = percent(task.goal.percent / 100);
          return task.goal.measure === 'inTime'
            ? count(task.runs, 'assignments.goal.inTime.one', 'assignments.goal.inTime.other', {
                percent: share,
              })
            : count(task.runs, 'assignments.goal.right.one', 'assignments.goal.right.other', {
                percent: share,
              });
        }
        case 'scale':
          return count(task.runs, 'assignments.goal.runs.one', 'assignments.goal.runs.other');
        case 'level':
          return task.goal === 'mastery'
            ? t('assignments.goal.mastery')
            : count(task.goal, 'assignments.goal.sessions.one', 'assignments.goal.sessions.other');
        case 'lesson':
          return t('assignments.goal.lesson');
        case 'minutes':
          return count(
            task.days,
            'assignments.goal.minutes.one',
            'assignments.goal.minutes.other',
            {
              minutes: task.minutes,
            },
          );
        default:
          return null;
      }
    };

    const share = (value: number | null) => (value === null ? t('read.none') : percent(value));
    const pieceRun = (run: PieceRunFigures, task: PieceTask) =>
      task.mode === 'rhythm' && task.goal?.measure !== 'right'
        ? t('assignments.figure.inTime', { percent: share(run.inTime) })
        : t('assignments.figure.right', { percent: share(run.right) });
    const scaleRun = (run: ScaleRunFigures) =>
      run.spread === null
        ? t('read.none')
        : t('scales.result.ms', { ms: Math.round(run.spread * 10) / 10 });
    const session = (figures: SessionFigures) =>
      t('assignments.figure.right', { percent: share(figures.accuracy) });

    /** How far it is: "2 of 3 runs", "Mastered", "Not read yet". Never more than was asked. */
    const figure = (task: Task, progress: TaskProgress): string => {
      const done = { done: Math.min(progress.done, progress.target) };
      const of = (one: MessageKey, other: MessageKey) => count(progress.target, one, other, done);
      switch (progress.kind) {
        case 'piece':
        case 'scale':
          return of('assignments.figure.runs.one', 'assignments.figure.runs');
        case 'level':
          if (task.kind === 'level' && task.goal === 'mastery') {
            if (progress.met) return t('assignments.figure.mastered');
            const m = progress.mastery;
            return m && m.counted > 0
              ? t('assignments.figure.mastery', {
                  counted: m.counted,
                  window: m.window,
                  percent: share(m.accuracy),
                })
              : t('assignments.figure.mastery.none');
          }
          return of('assignments.figure.sessions.one', 'assignments.figure.sessions');
        case 'lesson':
          return t(
            progress.met ? 'assignments.figure.lesson.done' : 'assignments.figure.lesson.open',
          );
        case 'minutes':
          return of('assignments.figure.days.one', 'assignments.figure.days');
        default:
          return t('read.none');
      }
    };

    /** The best and the last run's figures, where the task has runs; null before the first. */
    const runs = (task: Task, progress: TaskProgress): string | null => {
      if (progress.kind === 'piece' && task.kind === 'piece') {
        if (!progress.best || !progress.last) return null;
        return join([
          t('assignments.figure.bestLast', {
            best: pieceRun(progress.best, task),
            last: pieceRun(progress.last, task),
          }),
          task.goal && progress.played > progress.done
            ? count(
                progress.played,
                'assignments.figure.played.one',
                'assignments.figure.played.other',
              )
            : null,
        ]);
      }
      if (progress.kind === 'scale') {
        if (!progress.best || !progress.last) return null;
        return t('assignments.figure.evenLast', {
          best: scaleRun(progress.best),
          last: scaleRun(progress.last),
        });
      }
      if (progress.kind === 'level') {
        if (!progress.best || !progress.last) return null;
        return t('assignments.figure.bestLast', {
          best: session(progress.best),
          last: session(progress.last),
        });
      }
      return null;
    };

    /** "5 – 11 Oct": the days that count. */
    const dates = (a: Pick<Assignment, 'start' | 'due'>) =>
      a.start === a.due
        ? log.longDay(a.start)
        : t('assignments.dates', { start: log.shortDay(a.start), due: log.shortDay(a.due) });

    /** "Due Sun, 11 Oct", "Starts …", "Was due …". */
    const due = (a: Pick<Assignment, 'start' | 'due'>, today: DayKey) => {
      const timing = timingOf(a, today);
      if (timing === 'upcoming') return t('assignments.starts', { date: log.longDay(a.start) });
      if (timing === 'past') return t('assignments.due.past', { date: log.longDay(a.due) });
      return a.due === today
        ? t('assignments.due.today')
        : t('assignments.due', { date: log.longDay(a.due) });
    };

    return { title, details, goal, figure, runs, dates, due, pieceTitle, pieceComposer, percent };
  }, [t, locale, log, scale]);
}

export type AssignmentFormat = ReturnType<typeof useTaskFormat>;
