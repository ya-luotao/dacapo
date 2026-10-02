import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import { piecesStanding } from '../../core/piecesStanding.ts';
import type { StartingPoint } from '../../core/startingPoint.ts';
import type { DayKey } from '../../core/streak.ts';
import {
  assignmentComesFirst,
  planFor,
  planProgress,
  readPlan,
  recordsBefore,
  type PlanMinutes,
  type TodayPlan as Plan,
  type TodayRecords,
} from '../../core/today.ts';
import { useT } from '../../i18n/index.ts';
import { AssignmentBlock } from '../assignments/HomeAssignment.tsx';
import { useCurrentAssignment } from '../assignments/useChecklist.ts';
import { useLessonsDone } from '../learn/progress.ts';
import { useStorageStatus } from '../practice/context.ts';
import { recordsKnown } from '../practice/store.ts';
import { readStartPref } from '../start/prefs.ts';
import { useTodayFormat } from './format.ts';
import { readKeptPlan, writeKeptPlan } from './prefs.ts';
import { useRecordsWithPlan, useTodayRecords } from './useTodayRecords.ts';
import { WeekLine } from './WeekLine.tsx';

function Arrow() {
  return (
    <svg className="arrow" viewBox="0 0 16 10" aria-hidden="true" focusable="false">
      <path d="M1 5h13M10 1l4 4-4 4" />
    </svg>
  );
}

/**
 * The plan for today: made the first time it is asked for on a day and kept in the browser, so
 * that for the rest of the day it is the plan (records arriving from another device do not
 * reshuffle it); made again when the length is changed. Null while the records are being read.
 * A plan made while the records are there and cannot be seen (a database of a later version, a
 * read that failed) is shown and not kept: it would stand for the day once a reload has them.
 *
 * A plan to be made names the next step of the plan of the piece in hand (docs/PIECES.md, "A
 * piece's plan"), which takes that piece's score and step records: they are read first, and
 * only then is the plan made, since it is kept as it is made.
 */
function usePlan(
  base: TodayRecords | null,
  today: DayKey,
  minutes: PlanMinutes,
  lessonsDone: ReadonlySet<string>,
  start: StartingPoint | null,
): Plan | null {
  const keep = recordsKnown(useStorageStatus());
  const [kept, setKept] = useState(() => readPlan(readKeptPlan()));
  // The kept plan stands: nothing is made, and no score is read.
  const stands = kept?.day === today && kept.minutes === minutes;
  // The piece in hand when the day began, as the plan will find it.
  const inHand = useMemo(
    () =>
      base && !stands
        ? (piecesStanding(recordsBefore(base, today), { today }).inHand?.id ?? null)
        : null,
    [base, stands, today],
  );
  const records = useRecordsWithPlan(base, inHand);
  const plan = useMemo(
    () => (records ? planFor(kept, records, { today, minutes, lessonsDone, start }) : null),
    [kept, records, today, minutes, lessonsDone, start],
  );
  // A plan just made is the kept one from here on: the next render finds it standing.
  if (plan !== null && plan !== kept) setKept(plan);
  useEffect(() => {
    if (plan !== null && keep) writeKeptPlan(plan);
  }, [plan, keep]);
  return plan;
}

interface TodayPlanProps {
  today: DayKey;
  minutes: PlanMinutes;
  /** What holds the rows' place while the records are being read. */
  waiting: ReactNode;
  /** A new week began today or yesterday: a line about the week that ended heads the plan. */
  week: boolean;
  /** Whether the plan's steps are shown: not while an assignment has open tasks. */
  onSteps: (shown: boolean) => void;
}

/**
 * Today's plan on the home page (docs/TODAY.md): a numbered programme, each step a link that
 * starts it, a line saying why it is there, and a tick once it is done. While the current
 * assignment has open tasks it is shown as today instead: a teacher's plan is not set beside one
 * made up here. Loaded apart from the start: making a plan takes the rules of every practice.
 */
export function TodayPlan({ today, minutes, waiting, week, onSteps }: TodayPlanProps) {
  const t = useT();
  const format = useTodayFormat();
  const records = useTodayRecords();
  // The lessons ticked: read with the records, so the plan is never made before they are in.
  const lessonsDone = useLessonsDone();
  // Where the visitor said they start from: the next plan made follows it (docs/START.md).
  const [start] = useState(readStartPref);
  const assignment = useCurrentAssignment(today);
  const plan = usePlan(records, today, minutes, lessonsDone, start);
  const done = useMemo(
    () => (plan && records ? planProgress(plan, records, { lessonsDone }) : null),
    [plan, records, lessonsDone],
  );

  const reading = plan === null || done === null || (assignment !== null && !assignment.progress);
  const assigned =
    assignment?.progress != null &&
    assignmentComesFirst(assignment.record.assignment.tasks, assignment.progress);
  const steps = !reading && !assigned;
  useEffect(() => onSteps(reading || steps), [onSteps, reading, steps]);

  if (reading) return waiting;
  const allDone = plan.steps.length > 0 && done.every(Boolean);
  return (
    <>
      {week && records && <WeekLine records={records} today={today} />}
      {assignment && <AssignmentBlock current={assignment} today={today} />}
      {steps && (
        <div className="today-plan">
          <div className="today-plan-head">
            <h2 className="eyebrow">{t('today.plan', { n: minutes })}</h2>
            {allDone && <p className="goal is-reached">{t('today.done')}</p>}
          </div>
          {plan.steps.length === 0 ? (
            <p className="today-empty">
              {t('today.empty')}
              <Link href="/play" className="home-link">
                {t('nav.play')}
                <Arrow />
              </Link>
            </p>
          ) : (
            <ol className="today-steps">
              {plan.steps.map((step, i) => {
                const href = format.start(step);
                const name = format.name(step);
                // The part is named where it begins; the rows after it are under the same name.
                const first = plan.steps[i - 1]?.part !== step.part;
                return (
                  <li key={step.id} className={done[i] ? 'today-step is-done' : 'today-step'}>
                    <span className="contents-numeral" aria-hidden="true">
                      {i + 1}
                    </span>
                    <span className={first ? 'today-step-part' : 'visually-hidden'}>
                      {format.part(step)}
                    </span>
                    <span className="today-step-body">
                      {href ? (
                        <Link href={href} className="today-step-name">
                          {name}
                        </Link>
                      ) : (
                        <span className="today-step-name">{name}</span>
                      )}
                      <span className="today-step-why">{format.line(step)}</span>
                    </span>
                    {done[i] ? (
                      <span className="today-step-tick">
                        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                          <path d="M3.5 8.5l3 3 6-7" />
                        </svg>
                        <span className="visually-hidden">{t('learn.done')}</span>
                      </span>
                    ) : (
                      <Arrow />
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </>
  );
}
