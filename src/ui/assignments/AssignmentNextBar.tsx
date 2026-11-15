import { useMemo } from 'react';
import { Link, useLocation } from 'wouter';
import { storedAssignments, type TaskProgress } from '../../core/assignmentRecords.ts';
import { tasksMet } from '../../core/assignments.ts';
import { useT } from '../../i18n/index.ts';
import { splitRoute, useRouteSearch } from '../hashRoute.ts';
import { usePractice } from '../practice/context.ts';
import { withAssignmentOrigin } from '../startParams.ts';
import { useScaleKeyWords, useTaskFormat } from './taskFormat.ts';
import { taskStartPath, useChecklist, useKnownPieces } from './useChecklist.ts';

function decodePath(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

/** Normalize query parameters while ignoring origin markers (`assignment` and `from=today`). */
function canonicalSearch(search: string): string {
  const next = new URLSearchParams();
  for (const [key, value] of new URLSearchParams(search)) {
    if (key === 'assignment' || (key === 'from' && value === 'today')) continue;
    next.append(key, value);
  }
  next.sort();
  return next.toString();
}

/** Whether the active route matches a task's start href, ignoring origin query parameters. */
function routeMatches(activePath: string, activeSearch: string, targetHref: string): boolean {
  const { path, search } = splitRoute(targetHref);
  return (
    decodePath(activePath) === decodePath(path) &&
    canonicalSearch(activeSearch) === canonicalSearch(search)
  );
}

/**
 * Pick the next open startable task, searching forward from `currentIndex` first and wrapping
 * around to earlier tasks while never suggesting `currentIndex` itself.
 */
function findNextTaskIndex(
  progress: readonly TaskProgress[],
  hrefs: readonly (string | null)[],
  currentIndex: number,
): number {
  const total = progress.length;
  const start = currentIndex < 0 ? 0 : currentIndex + 1;
  const count = currentIndex < 0 ? total : total - 1;
  for (let offset = 0; offset < count; offset++) {
    const index = (start + offset) % total;
    if (!progress[index]?.met && hrefs[index] !== null) return index;
  }
  return -1;
}

/**
 * Guided continuation bar rendered at the end of a practice run or lesson opened from an
 * assignment (`?assignment=<id>`). Shows live checklist progress and links to the next open task.
 */
export default function AssignmentNextBar({ assignmentId }: { assignmentId: string }) {
  const t = useT();
  const [location] = useLocation();
  const search = useRouteSearch();
  const { assignments } = usePractice();
  const pieces = useKnownPieces();
  const format = useTaskFormat(useScaleKeyWords());

  const record = useMemo(
    () => storedAssignments(assignments).find((r) => r.id === assignmentId) ?? null,
    [assignments, assignmentId],
  );
  const progress = useChecklist(record?.following ? record.assignment : null);
  const hrefs = useMemo(
    () => (record ? record.assignment.tasks.map((task) => taskStartPath(task, pieces)) : []),
    [record, pieces],
  );

  if (!record || !record.following || !progress) return null;

  const { tasks } = record.assignment;
  const { met: doneCount, of: totalCount } = tasksMet(progress);
  if (totalCount === 0) return null;

  const currentIndex = hrefs.findIndex(
    (href) => href !== null && routeMatches(location, search, href),
  );
  const allDone = doneCount >= totalCount;
  const nextIndex = allDone ? -1 : findNextTaskIndex(progress, hrefs, currentIndex);
  const nextTask = nextIndex < 0 ? null : tasks[nextIndex]!;
  const nextHref = nextIndex < 0 ? null : hrefs[nextIndex]!;
  const backHref = `/assignments/${encodeURIComponent(assignmentId)}`;

  return (
    <aside className="today-flow assignment-next-bar" aria-label={t('assignment.flow.region')}>
      <div className="today-flow-head">
        <span className="today-flow-progress">
          {t('assignment.flow.progress', { done: doneCount, total: totalCount })}
        </span>
        <div className="today-flow-pips" aria-hidden="true">
          {tasks.map((task, i) =>
            task.kind === 'unknown' ? null : (
              <span
                key={task.id}
                title={format.title(task)}
                className={[
                  'today-flow-pip',
                  progress[i]?.met && 'is-done',
                  i === currentIndex && 'is-current',
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
            ),
          )}
        </div>
      </div>
      <div className="today-flow-actions">
        {allDone ? (
          <>
            <p className="today-flow-done">{t('assignment.flow.allDone')}</p>
            <Link href={backHref} className="button button-primary is-compact">
              {t('assignment.flow.finish')}
            </Link>
          </>
        ) : nextTask && nextHref ? (
          <>
            <Link
              href={withAssignmentOrigin(nextHref, assignmentId)}
              className="button button-primary is-compact"
            >
              {t('assignment.flow.next', { task: format.title(nextTask) })}
            </Link>
            <Link href={backHref} className="today-flow-home">
              {t('assignment.flow.back')}
            </Link>
          </>
        ) : (
          <Link href={backHref} className="button button-primary is-compact">
            {t('assignment.flow.finish')}
          </Link>
        )}
      </div>
    </aside>
  );
}
