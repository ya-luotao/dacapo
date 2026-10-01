import { lazy, Suspense, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'wouter';
import { practiceLog, STREAK_GOAL_MS } from '../../core/streak.ts';
import { PLAN_MINUTES, type PlanMinutes } from '../../core/todayRecords.ts';
import { useI18n } from '../../i18n/index.ts';
import { usePractice, useStorageStatus } from '../practice/context.ts';
import { useLogFormat } from '../progress/format.ts';
import { useNow } from '../progress/useNow.ts';
import { Segmented } from '../Segmented.tsx';
import { keptRoom, readPlanMinutes, writePlanMinutes } from '../today/prefs.ts';

// The plan's rows: loaded apart from the start, since making a plan takes the rules of every
// practice (ui/today/).
const TodayPlan = lazy(() =>
  import('../today/TodayPlan.tsx').then((m) => ({ default: m.TodayPlan })),
);

const MINUTE_MS = 60_000;

function Arrow() {
  return (
    <svg className="arrow" viewBox="0 0 16 10" aria-hidden="true" focusable="false">
      <path d="M1 5h13M10 1l4 4-4 4" />
    </svg>
  );
}

/**
 * Today, for a returning player (docs/TODAY.md): the day, the figures of the practice log and the
 * plan for the day, then the line towards the daily goal, the plan's length and the way to
 * Progress. The heading and the figures draw at once; the plan's rows come when their rules are
 * in, in a space kept for them, so the page does not jump.
 */
export function Today() {
  const { t, locale } = useI18n();
  const format = useLogFormat();
  const { loaded } = useStorageStatus();
  const { sessions } = usePractice();
  const now = useNow();
  const log = useMemo(() => practiceLog(sessions, { now }), [sessions, now]);
  const [minutes, setMinutes] = useState(readPlanMinutes);
  const [steps, setSteps] = useState(true);
  const reached = log.todayMs >= STREAK_GOAL_MS;

  const day = useMemo(() => {
    // The day key is a calendar date: formatted in UTC so it never shifts.
    const [y, m, d] = log.today.split('-').map(Number);
    return new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(Date.UTC(y!, m! - 1, d));
  }, [log.today, locale]);

  const choose = (length: PlanMinutes) => {
    setMinutes(length);
    writePlanMinutes(length);
  };

  const room = useMemo(() => keptRoom(log.today, minutes), [log.today, minutes]);
  const waiting = (
    <div
      className="today-waiting"
      style={{ '--rows': room.rows, '--parts': room.parts } as CSSProperties}
      role="status"
    >
      <span className="visually-hidden">{t('storage.loading')}</span>
    </div>
  );
  // Until the records are read the figures hold their place without a number.
  const figure = (text: string) => (loaded ? text : ' ');

  return (
    <section className="today" aria-labelledby="today-title">
      <p className="eyebrow today-day">{day}</p>
      <h1 id="today-title">{t('progress.today')}</h1>
      <dl className="figures">
        <div>
          <dt>{t('progress.today')}</dt>
          <dd>{figure(format.minutes(log.todayMs))}</dd>
        </div>
        <div>
          <dt>{t('progress.streak')}</dt>
          <dd>{figure(format.days(log.currentStreak))}</dd>
        </div>
        <div>
          <dt>{t('progress.longest')}</dt>
          <dd>{figure(format.days(log.longestStreak))}</dd>
        </div>
      </dl>
      <Suspense fallback={waiting}>
        <TodayPlan today={log.today} minutes={minutes} waiting={waiting} onSteps={setSteps} />
      </Suspense>
      <div className="today-end">
        {/* Until the records are read the line holds its place, unseen: the row wraps the same. */}
        <span
          className={reached ? 'goal is-reached' : 'goal'}
          data-waiting={loaded ? undefined : ''}
        >
          {reached
            ? t('progress.today.reached')
            : t('progress.today.toGo', {
                n: Math.ceil((STREAK_GOAL_MS - log.todayMs) / MINUTE_MS),
              })}
        </span>
        {steps && (
          <Segmented
            className="today-length"
            legend={t('today.length')}
            name="today-length"
            options={PLAN_MINUTES.map((n) => ({
              value: n,
              label: t('progress.minutes', { n }),
            }))}
            value={minutes}
            onChange={choose}
          />
        )}
        <Link href="/progress" className="home-link">
          {t('home.welcome.link')}
          <Arrow />
        </Link>
      </div>
    </section>
  );
}
