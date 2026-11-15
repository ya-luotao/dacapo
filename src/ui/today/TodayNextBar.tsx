import { useMemo } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { dayKey } from '../../core/streak.ts';
import { planProgress, readPlan } from '../../core/today.ts';
import { useT } from '../../i18n/index.ts';
import { splitRoute } from '../hashRoute.ts';
import { useLessonsDone } from '../learn/progress.ts';
import { useNow } from '../progress/useNow.ts';
import { withTodayOrigin } from '../startParams.ts';
import { useTodayFormat } from './format.ts';
import { readKeptPlan } from './prefs.ts';
import { useTodayRecords } from './useTodayRecords.ts';

function decodePath(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

/** Normalize query parameters while ignoring the `from=today` origin marker. */
function canonicalSearch(search: string): string {
  const next = new URLSearchParams();
  for (const [key, value] of new URLSearchParams(search)) {
    if (key === 'from' && value === 'today') continue;
    next.append(key, value);
  }
  next.sort();
  return next.toString();
}

/** Whether the active route matches a plan step's start href, ignoring `?from=today`. */
function routeMatches(activePath: string, activeSearch: string, targetHref: string): boolean {
  const { path, search } = splitRoute(targetHref);
  return (
    decodePath(activePath) === decodePath(path) &&
    canonicalSearch(activeSearch) === canonicalSearch(search)
  );
}

/**
 * Pick the next incomplete startable step, searching forward from `currentIndex` first and
 * wrapping around to earlier steps while never suggesting `currentIndex` itself.
 */
function findNextStepIndex(
  done: readonly boolean[],
  hrefs: readonly (string | null)[],
  currentIndex: number,
): number {
  const total = done.length;
  const start = currentIndex < 0 ? 0 : currentIndex + 1;
  const count = currentIndex < 0 ? total : total - 1;
  for (let offset = 0; offset < count; offset++) {
    const index = (start + offset) % total;
    if (!done[index] && hrefs[index] !== null) return index;
  }
  return -1;
}

/**
 * Guided continuation bar rendered at the end of a practice run or lesson reached from Today.
 * Shows live progress through today's kept plan and links directly to the next incomplete step.
 */
export default function TodayNextBar() {
  const t = useT();
  const [location] = useLocation();
  const search = useSearch();
  const today = dayKey(useNow());
  const format = useTodayFormat();
  const records = useTodayRecords();
  const lessonsDone = useLessonsDone();

  const kept = readPlan(readKeptPlan());
  const plan = kept && kept.day === today && kept.steps.length > 0 ? kept : null;

  const done = useMemo(
    () => (plan && records ? planProgress(plan, records, { lessonsDone }) : null),
    [plan, records, lessonsDone],
  );

  if (!plan || !done) return null;

  const hrefs = plan.steps.map((step) => format.start(step));
  const currentIndex = hrefs.findIndex(
    (href) => href !== null && routeMatches(location, search, href),
  );
  const doneCount = done.filter(Boolean).length;
  const total = plan.steps.length;
  const allDone = total > 0 && doneCount >= total;
  const nextIndex = allDone ? -1 : findNextStepIndex(done, hrefs, currentIndex);
  const nextStep = nextIndex < 0 ? null : plan.steps[nextIndex]!;
  const nextHref = nextIndex < 0 ? null : hrefs[nextIndex]!;

  return (
    <aside className="today-flow" aria-label={t('today.flow.label')}>
      <div className="today-flow-head">
        <span className="today-flow-progress">
          {t('today.flow.progress', { done: doneCount, total })}
        </span>
        <div className="today-flow-pips" aria-hidden="true">
          {plan.steps.map((step, i) => (
            <span
              key={i}
              title={format.name(step)}
              className={[
                'today-flow-pip',
                done[i] && 'is-done',
                i === currentIndex && 'is-current',
              ]
                .filter(Boolean)
                .join(' ')}
            />
          ))}
        </div>
      </div>
      <div className="today-flow-actions">
        {allDone ? (
          <>
            <p className="today-flow-done">{t('today.flow.allDone')}</p>
            <Link href="/" className="button button-primary is-compact">
              {t('today.flow.back')}
            </Link>
          </>
        ) : nextStep && nextHref ? (
          <>
            <Link href={withTodayOrigin(nextHref)} className="button button-primary is-compact">
              {t('today.flow.next', { step: format.name(nextStep) })}
            </Link>
            <Link href="/" className="today-flow-home">
              {t('today.flow.back')}
            </Link>
          </>
        ) : (
          <Link href="/" className="button button-primary is-compact">
            {t('today.flow.back')}
          </Link>
        )}
      </div>
    </aside>
  );
}
