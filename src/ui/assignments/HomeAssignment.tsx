import { Link } from 'wouter';
import { openTasks } from '../../core/assignments.ts';
import { dayKey, type DayKey } from '../../core/streak.ts';
import { useT } from '../../i18n/index.ts';
import { useNow } from '../progress/useNow.ts';
import { useScaleKeyWords, useTaskFormat } from './taskFormat.ts';
import {
  taskStartPath,
  useCurrentAssignment,
  useKnownPieces,
  type CurrentAssignment,
} from './useChecklist.ts';

/** Open tasks named on the home page; the rest are on the assignment's own page. */
const TASKS_SHOWN = 4;

function Arrow() {
  return (
    <svg className="arrow" viewBox="0 0 16 10" aria-hidden="true" focusable="false">
      <path d="M1 5h13M10 1l4 4-4 4" />
    </svg>
  );
}

/** The current assignment on the home page: its open tasks, each a way to start it. */
export function AssignmentBlock({
  current: { record, more, progress },
  today,
}: {
  current: CurrentAssignment;
  today: DayKey;
}) {
  const t = useT();
  // Without the exercises' rules (Hanon's plates with them): the page is loaded at the start.
  const format = useTaskFormat(useScaleKeyWords());
  const pieces = useKnownPieces();
  const { assignment } = record;
  const open = progress ? openTasks(assignment.tasks, progress) : [];
  return (
    <section className="home-assignment" aria-labelledby="home-assignment">
      <h2 id="home-assignment" className="eyebrow">
        {t('home.assignment')}
      </h2>
      <p className="home-review-title">
        <span className="home-assignment-name">
          <strong>{assignment.title}</strong>
          <span className="muted">{format.due(assignment, today)}</span>
        </span>
        <Link href={`/assignments/${record.id}`} className="home-link">
          {t('home.assignment.link')}
          <Arrow />
        </Link>
      </p>
      {progress && open.length === 0 && (
        <p className="goal is-reached">{t('home.assignment.done')}</p>
      )}
      {open.length > 0 && (
        <ul className="home-tasks">
          {open.slice(0, TASKS_SHOWN).map(({ task, done }) => {
            const start = taskStartPath(task, pieces);
            return (
              <li key={task.id}>
                {start ? <Link href={start}>{format.title(task)}</Link> : format.title(task)}
                <span className="muted">{format.figure(task, done)}</span>
              </li>
            );
          })}
        </ul>
      )}
      {(open.length > TASKS_SHOWN || more > 0) && (
        <p className="muted home-assignment-more">
          {[
            open.length > TASKS_SHOWN &&
              t('home.assignment.moreTasks', { n: open.length - TASKS_SHOWN }),
            more === 1 && t('home.assignment.more.one'),
            more > 1 && t('home.assignment.more.other', { n: more }),
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
    </section>
  );
}

/**
 * The home page's assignment (docs/ASSIGNMENTS.md): the open tasks of the current one, each a
 * way to start it. Loaded only when there is one: working a checklist out takes the rules of
 * every practice. A returning player's is shown by today's plan (ui/today/TodayPlan.tsx), which
 * gives way to it.
 */
export function HomeAssignment() {
  const today = dayKey(useNow());
  const current = useCurrentAssignment(today);
  return current ? <AssignmentBlock current={current} today={today} /> : null;
}
