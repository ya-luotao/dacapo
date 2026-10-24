import { lazy, Suspense, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'wouter';
import { dayOfWeek, practiceLog } from '../../core/streak.ts';
import { PLAN_MINUTES, WEEK_LINE_DAYS, type PlanMinutes } from '../../core/todayRecords.ts';
import { FIRST_DAY, useI18n } from '../../i18n/index.ts';
import { usePractice, useStorageStatus } from '../practice/context.ts';
import { useGoal } from '../progress/goal.ts';
import { useNow } from '../progress/useNow.ts';
import { Segmented } from '../Segmented.tsx';
import { HomeKeys, type NextStep } from './HomeKeys.tsx';
import { keptRoom, readPlanMinutes, writePlanMinutes } from '../today/prefs.ts';

// The plan's rows: loaded apart from the start, since making a plan takes the rules of every
// practice (ui/today/).
const TodayPlan = lazy(() =>
  import('../today/TodayPlan.tsx').then((m) => ({ default: m.TodayPlan })),
);

const MINUTE_MS = 60_000;

/**
 * Today, for a returning player (docs/TODAY.md): the day in one line with the streak and what is
 * left of the daily goal, the minutes played against the plan's length as a readout, then the
 * plan, its length and the way to Progress; under it all the keyboard, any key of which starts
 * the next step. The heading and the readout draw at once; the plan's rows come when their rules
 * are in, in a space kept for them, so the page does not jump.
 */
export function Today() {
  const { t, locale } = useI18n();
  const { loaded } = useStorageStatus();
  const { sessions } = usePractice();
  const now = useNow();
  // Each day by the goal it had: a goal changed in Settings does not rewrite the streak.
  const goal = useGoal();
  const log = useMemo(() => practiceLog(sessions, { now, goal }), [sessions, now, goal]);
  const [minutes, setMinutes] = useState(readPlanMinutes);
  const [steps, setSteps] = useState(true);
  const [next, setNext] = useState<NextStep | null>(null);
  const reached = log.todayMs >= log.goalMs;
  const played = Math.floor(log.todayMs / MINUTE_MS);

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
  // On the first days of a week the plan is headed by a line about the week that ended
  // (docs/PERSONAL.md): its words come with the plan's rules, its room is kept from the start.
  const week = dayOfWeek(log.today, FIRST_DAY[locale]) < WEEK_LINE_DAYS;
  const waiting = (
    <div
      className="today-waiting"
      style={
        { '--rows': room.rows, '--parts': room.parts, '--week': week ? 1 : 0 } as CSSProperties
      }
      role="status"
    >
      <span className="visually-hidden">{t('storage.loading')}</span>
    </div>
  );

  // The day, then (once the records are in) the streak and what is left of the goal.
  const line = [day];
  if (loaded && log.currentStreak > 0) {
    line.push(
      log.currentStreak === 1
        ? t('today.streak.one')
        : t('today.streak.other', { n: log.currentStreak }),
    );
  }
  if (loaded && !reached) {
    line.push(t('progress.today.toGo', { n: Math.ceil((log.goalMs - log.todayMs) / MINUTE_MS) }));
  }

  return (
    <>
      <section className="today" aria-labelledby="today-title">
        <div className="today-head">
          <div>
            <h1 id="today-title">{t('progress.today')}</h1>
            <p className="today-line">{line.join(' · ')}</p>
          </div>
          {/* Until the records are read the readout holds its place without a number. */}
          <p className="today-readout" data-waiting={loaded ? undefined : ''}>
            <span className="visually-hidden">
              {t('today.readout', { done: played, plan: minutes })}
            </span>
            <span className="today-figure" aria-hidden="true">
              {played}
              <span className="today-of">/{minutes}</span>
              <span className="today-unit">{t('today.unit')}</span>
            </span>
            <span className="today-meter" aria-hidden="true">
              <span style={{ '--done': Math.min(1, played / minutes) } as CSSProperties} />
            </span>
          </p>
        </div>
        <Suspense fallback={waiting}>
          <TodayPlan
            today={log.today}
            minutes={minutes}
            waiting={waiting}
            week={week}
            onSteps={setSteps}
            onNext={setNext}
          />
        </Suspense>
        <div className="today-end">
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
          <Link href="/progress" className="today-progress">
            {t('home.welcome.link')}
          </Link>
        </div>
      </section>
      {next && <HomeKeys next={next} />}
    </>
  );
}
