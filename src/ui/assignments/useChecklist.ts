import { useEffect, useMemo, useReducer, useState } from 'react';
import {
  currentAssignments,
  type Assignment,
  type PieceTask,
  type StoredAssignment,
  type Task,
  type TaskProgress,
} from '../../core/assignmentRecords.ts';
import {
  assignmentProgress,
  pageOfFamily,
  taskPiece,
  taskPieceIds,
  type KnownPiece,
} from '../../core/assignments.ts';
import { pieceFacts, type PieceStep } from '../../core/pieceRecords.ts';
import type { DayKey } from '../../core/streak.ts';
import { BUILT_IN } from '../../pieces/library/index.ts';
import { readScore } from '../../pieces/load.ts';
import { readDone } from '../learn/progress.ts';
import { usePractice, usePracticeStore, useStorageStatus } from '../practice/context.ts';
import { levelStartPath, pieceStartPath, scaleStartPath } from '../startParams.ts';

/**
 * The pieces on this device with the checksum of their notes: the built-in ones, and the imported
 * ones (a piece imported before its facts were kept is read here to find it).
 */
export function useKnownPieces(): KnownPiece[] {
  const { pieces } = usePractice();
  return useMemo(() => {
    const imported = pieces.map((piece): KnownPiece => {
      if (piece.facts) return { id: piece.id, checksum: piece.facts.checksum };
      try {
        return { id: piece.id, checksum: pieceFacts(readScore(piece.xml, piece.hands)).checksum };
      } catch {
        return { id: piece.id, checksum: null };
      }
    });
    return [...BUILT_IN.map((p) => ({ id: p.id, checksum: p.facts.checksum })), ...imported];
  }, [pieces]);
}

/**
 * The checklist of an assignment from the records here: every task's progress in its order, or
 * null while the records are being read. The step records of the pieces its tasks name are read
 * when it is first asked for, and stay in the store's cache.
 */
export function useChecklist(
  assignment: Pick<Assignment, 'start' | 'due' | 'tasks'> | null,
): TaskProgress[] | null {
  const store = usePracticeStore();
  const { loaded } = useStorageStatus();
  const { sessions, attempts, answers } = usePractice();
  const pieces = useKnownPieces();
  // The lessons ticked on this device, as they are when the page opens.
  const [lessonsDone] = useState(readDone);
  // The step cache tells when a piece's records are in.
  const [stepsVersion, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => store.subscribePieceSteps(bump), [store]);

  const pieceIds = useMemo(() => {
    const tasks = (assignment?.tasks ?? []).filter((t): t is PieceTask => t.kind === 'piece');
    return [...new Set(tasks.flatMap((task) => taskPieceIds(task, pieces)))].sort();
  }, [assignment, pieces]);
  useEffect(() => {
    for (const id of pieceIds) store.loadPieceSteps(id);
  }, [pieceIds, store]);

  return useMemo(() => {
    void stepsVersion;
    if (!assignment || !loaded) return null;
    const steps = new Map<string, readonly PieceStep[]>();
    for (const id of pieceIds) {
      const loadedSteps = store.getPieceSteps(id);
      if (loadedSteps === null) return null;
      steps.set(id, loadedSteps);
    }
    return assignmentProgress(assignment, {
      sessions,
      attempts,
      answers,
      steps,
      pieces,
      lessonsDone,
    });
  }, [
    assignment,
    loaded,
    sessions,
    attempts,
    answers,
    pieces,
    pieceIds,
    lessonsDone,
    store,
    stepsVersion,
  ]);
}

/** The current assignment with its checklist. */
export interface CurrentAssignment {
  record: StoredAssignment;
  /** The other assignments today falls in. */
  more: number;
  /** Every task's progress in its order; null while the records are being read. */
  progress: TaskProgress[] | null;
}

/**
 * The current assignment (of those for me that today falls in, the one due soonest) and how far
 * its tasks are; null when there is none.
 */
export function useCurrentAssignment(today: DayKey): CurrentAssignment | null {
  const { assignments } = usePractice();
  const current = currentAssignments(assignments, today);
  const first = current[0] ?? null;
  const progress = useChecklist(first?.assignment ?? null);
  return first && { record: first, more: current.length - 1, progress };
}

/**
 * Where a task's button goes: the page that practises it, opened with its settings; null for a
 * task that is not started anywhere (minutes, one this version does not know) or whose piece is
 * not on this device.
 */
export function taskStartPath(task: Task, pieces: readonly KnownPiece[]): string | null {
  switch (task.kind) {
    case 'piece': {
      const piece = taskPiece(task, pieces);
      return piece ? pieceStartPath(piece.id, task) : null;
    }
    case 'scale':
      return scaleStartPath(task);
    case 'level':
      return levelStartPath(pageOfFamily(task.family), task);
    case 'lesson':
      return `/learn/${task.slug}`;
    default:
      return null;
  }
}
