import type { ReactNode } from 'react';
import { Link } from 'wouter';
import type { Task, TaskProgress } from '../../core/assignmentRecords.ts';
import type { KnownPiece } from '../../core/assignments.ts';
import { useT } from '../../i18n/index.ts';
import { useAssignmentFormat } from './format.ts';
import { taskStartPath } from './useChecklist.ts';

/** Met: a tick; open: an empty box, as on a paper checklist. */
function Tick({ met }: { met: boolean }) {
  const t = useT();
  return (
    <span className={met ? 'task-tick is-met' : 'task-tick'}>
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        {met && <path d="M3.5 8.5l3 3 6-7" />}
      </svg>
      <span className="visually-hidden">
        {t(met ? 'assignments.figure.met' : 'assignments.figure.open')}
      </span>
    </span>
  );
}

interface TaskListProps {
  tasks: readonly Task[];
  /**
   * The checklist: each task's progress, in order. Absent: the tasks alone, as their maker sees
   * them or as a link shows them before it is added.
   */
  progress?: readonly TaskProgress[];
  /** With them, each task has the button that starts it with its settings. */
  pieces?: readonly KnownPiece[];
  /** What follows a task's words: the editor's buttons. */
  actions?: (task: Task, index: number) => ReactNode;
}

/** The tasks of an assignment, each in words; with `progress`, as a checklist. */
export function TaskList({ tasks, progress, pieces, actions }: TaskListProps) {
  const t = useT();
  const format = useAssignmentFormat();
  return (
    <ol className={progress ? 'tasks is-checklist' : 'tasks'}>
      {tasks.map((task, i) => {
        const done = progress?.[i];
        const details = format.details(task);
        const goal = format.goal(task);
        const runs = done ? format.runs(task, done) : null;
        const start = pieces ? taskStartPath(task, pieces) : null;
        const composer = task.kind === 'piece' ? format.pieceComposer(task) : '';
        return (
          <li key={task.id} className={done?.met ? 'task is-met' : 'task'}>
            {done && <Tick met={done.met} />}
            <div className="task-body">
              <p className="task-title">
                {format.title(task)}
                {composer && <span className="task-composer">{composer}</span>}
              </p>
              {details && <p className="task-details">{details}</p>}
              {goal && <p className="task-goal">{goal}</p>}
              {pieces && task.kind === 'piece' && !start && (
                <p className="task-missing">{t('assignments.task.noPiece')}</p>
              )}
            </div>
            {done && task.kind !== 'unknown' && (
              <p className="task-figure">
                <strong>{format.figure(task, done)}</strong>
                {runs && <span>{runs}</span>}
              </p>
            )}
            {start && (
              <Link
                href={start}
                className={done?.met ? 'button task-start' : 'button button-primary task-start'}
              >
                {t(done?.met ? 'assignments.task.again' : 'assignments.task.start')}
              </Link>
            )}
            {actions?.(task, i)}
          </li>
        );
      })}
    </ol>
  );
}
