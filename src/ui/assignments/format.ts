import { useMemo } from 'react';
import type { ScaleTask } from '../../core/assignmentRecords.ts';
import type { ShareError } from '../../core/assignmentShare.ts';
import { parseExerciseKey } from '../../core/scales.ts';
import { takesPerBeat } from '../../core/scaleXml.ts';
import { useT, type MessageKey } from '../../i18n/index.ts';
import { useExerciseLabel } from '../scales/format.ts';
import { useTaskFormat, type ScaleWords } from './taskFormat.ts';

export { familyKey, levelKey, timingOf, type AssignmentFormat, type Timing } from './taskFormat.ts';

/** Why a link or a file could not be opened, in words. */
export const SHARE_ERRORS: Record<ShareError, MessageKey> = {
  malformed: 'assignments.open.error.malformed',
  'too-large': 'assignments.open.error.tooLarge',
  newer: 'assignments.open.error.newer',
  invalid: 'assignments.open.error.invalid',
};

/** A scale task in words by the exercises' rules: its label as every list has it, and its click. */
function useScaleWords(): ScaleWords {
  const t = useT();
  const exerciseLabel = useExerciseLabel();
  return useMemo(
    () => ({
      name: (task: ScaleTask) => {
        const exercise = parseExerciseKey(task.exercise);
        return exercise
          ? `${exerciseLabel(exercise)} · ${t(`progress.session.hands.${exercise.hands}`)}`
          : task.exercise;
      },
      tempo: (task: ScaleTask) => {
        if (!task.click) return t('assignments.task.free');
        const exercise = parseExerciseKey(task.exercise);
        return exercise && !takesPerBeat(exercise.type)
          ? t('assignments.task.click.own', { bpm: task.click.bpm })
          : t('assignments.task.click', { bpm: task.click.bpm, perBeat: task.click.perBeat });
      },
    }),
    [t, exerciseLabel],
  );
}

/**
 * Assignments and their tasks in words (`useTaskFormat`), with the exercises' rules for a scale
 * task: for the Assignments pages. The home page's block loads without the rules (taskFormat.ts).
 */
export function useAssignmentFormat() {
  return useTaskFormat(useScaleWords());
}
