import { Link } from 'wouter';
import { currentAssignments, type StoredAssignment } from '../../core/assignmentRecords.ts';
import { dayKey, type DayKey } from '../../core/streak.ts';
import { useT } from '../../i18n/index.ts';
import { usePractice } from '../practice/context.ts';
import { useNow } from '../progress/useNow.ts';
import { useScaleKeyWords, useTaskFormat } from './taskFormat.ts';
import { taskStartPath, useChecklist, useKnownPieces } from './useChecklist.ts';

/** Open tasks named on the home page; the rest are on the assignment's own page. */
const TASKS_SHOWN = 4;

function Arrow() {
  return (
    <svg className="arrow" viewBox="0 0 16 10" aria-hidden="true" focusable="false">
      <path d="M1 5h13M10 1l4 4-4 4" />
    </svg>
  );
}

function Current({
  record,
  today,
  more,
}: {
  record: StoredAssignment;
  today: DayKey;
  more: number;
}) {
  const t = useT();
  // Without the exercises' rules (Hanon's plates with them): the page is loaded at the start.
  const format = useTaskFormat(useScaleKeyWords());
  const pieces = useKnownPieces();
  const { assignment } = record;
  const progress = useChecklist(assignment);
  const open = progress
    ? assignment.tasks.flatMap((task, i) => {
        const done = progress[i]!;
        return task.kind === 'unknown' || done.met ? [] : [{ task, done }];
      })
    : [];
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
 * every practice.
 */
export function HomeAssignment() {
  const { assignments } = usePractice();
  const today = dayKey(useNow());
  const current = currentAssignments(assignments, today);
  const first = current[0];
  return first ? <Current record={first} today={today} more={current.length - 1} /> : null;
}
