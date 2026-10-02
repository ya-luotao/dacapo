import { useMemo } from 'react';
import type { LevelFamily } from '../../core/assignmentRecords.ts';
import { pageOfFamily } from '../../core/assignments.ts';
import type { PlanStep, PlanWhy } from '../../core/todayRecords.ts';
import { useI18n, type MessageKey } from '../../i18n/index.ts';
import { isBuiltInId } from '../../pieces/library/index.ts';
import { familyKey, levelKey, useScaleKeyWords, useTaskFormat } from '../assignments/taskFormat.ts';
import { taskStartPath } from '../assignments/useChecklist.ts';
import { usePlanWords } from '../pieces/planWords.ts';
import { usePractice } from '../practice/context.ts';
import { levelStartPath, pieceStartPath, scaleStartPath } from '../startParams.ts';

/**
 * Today's plan and "Where you are" in words (docs/TODAY.md): what a step is, why it is there,
 * and where it starts. Tasks are named and started as the home page's assignment names and
 * starts them; a scale by its exercise key alone, without the exercises' rules.
 */
export function useTodayFormat() {
  const { t } = useI18n();
  const scale = useScaleKeyWords();
  const tasks = useTaskFormat(scale);
  const { pieces } = usePractice();
  // A step of a piece's plan, named by the printed numbers of its bars (the score is not here).
  const plan = usePlanWords();

  return useMemo(() => {
    const days = (n: number, one: MessageKey, other: MessageKey) =>
      n === 1 ? t(one) : t(other, { n });

    /** A piece by the name it has here; null when it is no longer on this device. */
    const pieceTitle = (id: string): string | null => {
      if (isBuiltInId(id)) return t(`library.${id}.title`);
      const stored = pieces.find((piece) => piece.id === id);
      return stored ? stored.title || t('pieces.untitled') : null;
    };

    const piecePath = (id: string): string | null =>
      pieceTitle(id) === null ? null : `/pieces/${encodeURIComponent(id)}`;

    /** "Read · Notes": a family with its page. */
    const family = (f: LevelFamily) => [t(`nav.${pageOfFamily(f)}`), t(familyKey(f))].join(' · ');

    /** A level by its name: "L3 · Bass: middle C position"; a tune by its title. */
    const level = (f: LevelFamily, id: string) =>
      f === 'tune' ? t(levelKey(f, id)) : `${id} · ${t(levelKey(f, id))}`;

    /** A scale by its exercise key: "D major, 2 oct. · Both hands". */
    const exercise = (key: string) =>
      scale.name({ kind: 'scale', id: '', exercise: key, click: null, runs: 1 });

    /**
     * What a step is: the scale, the piece, the lesson; for a level its practice ("Read · Key
     * signatures": a level's id says nothing to a learner, and its name is the line under this
     * one), for a tune the practice and its title.
     */
    const name = (step: PlanStep): string => {
      if (step.kind === 'piece') return pieceTitle(step.piece) ?? t('pieces.untitled');
      const { task } = step;
      if (task.kind !== 'level') return tasks.title(task);
      return task.family === 'tune'
        ? [family(task.family), t(levelKey(task.family, task.level))].join(' · ')
        : family(task.family);
    };

    /**
     * Where a step starts; null for a piece that is no longer here. The piece in hand opens on
     * the step of its plan the day's plan keeps (docs/PIECES.md, "A piece's plan").
     */
    const start = (step: PlanStep): string | null => {
      if (step.kind !== 'piece') return taskStartPath(step.task, []);
      const path = piecePath(step.piece);
      return path !== null && step.step ? pieceStartPath(step.piece, step.step) : path;
    };

    /** Why a step is in the plan: one line, from the figures its rule used. */
    const why = (reason: PlanWhy): string => {
      switch (reason.kind) {
        case 'weakest':
          return t('today.why.weakest');
        case 'nextScale':
          return t('today.why.nextScale');
        case 'inHand':
          return days(reason.days, 'today.why.inHand.one', 'today.why.inHand.other');
        case 'newPiece':
          return t('today.why.newPiece');
        case 'level':
          return reason.days === null
            ? t('today.why.level.never')
            : days(reason.days, 'today.why.level.one', 'today.why.level.other');
        case 'lesson':
          return t('today.why.lesson', { n: reason.n, of: reason.of });
        case 'due':
          return reason.days <= 0
            ? t('today.why.due.today')
            : days(reason.days, 'today.why.due.one', 'today.why.due.other');
      }
    };

    /**
     * The line under a step's name: why it is there, and for a level its own name first ("Major
     * keys to two sharps or flats · Not practised yet"), for the piece in hand the step of its
     * plan ("Bars 5–8, left hand · Last played 2 days ago"). A tune's title is in its name
     * already.
     */
    const line = (step: PlanStep): string => {
      if (step.kind === 'piece')
        return step.step ? [plan.title(step.step), why(step.why)].join(' · ') : why(step.why);
      return step.task.kind === 'level' && step.task.family !== 'tune'
        ? [t(levelKey(step.task.family, step.task.level)), why(step.why)].join(' · ')
        : why(step.why);
    };

    return {
      name,
      start,
      line,
      part: (step: PlanStep) => t(`today.part.${step.part}`),
      family,
      level,
      levelPath: (f: LevelFamily, id: string) =>
        levelStartPath(pageOfFamily(f), { family: f, level: id }),
      exercise,
      exercisePath: (key: string) => scaleStartPath({ exercise: key, click: null }),
      pieceTitle,
      piecePath,
    };
  }, [t, scale, tasks, pieces, plan]);
}
