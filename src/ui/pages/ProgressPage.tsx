import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { dailyTotals, practiceLog } from '../../core/streak.ts';
import { useT } from '../../i18n/index.ts';
import { EmptyState } from '../EmptyState.tsx';
import { usePractice, useStorageStatus } from '../practice/context.ts';
import { DayHistory } from '../progress/DayHistory.tsx';
import { FamilyProgress } from '../progress/families/FamilyProgress.tsx';
import { useGoal } from '../progress/goal.ts';
import { WeaknessHeatmap } from '../progress/heatmap/WeaknessHeatmap.tsx';
import { PracticeFigures } from '../progress/PracticeFigures.tsx';
import { SessionList } from '../progress/SessionList.tsx';
import { Trends } from '../progress/trends/Trends.tsx';
import { useNow } from '../progress/useNow.ts';
import { WeekRecap } from '../progress/WeekRecap.tsx';
import { WhereYouAre } from '../progress/WhereYouAre.tsx';
import { readStartPref } from '../start/prefs.ts';

export function ProgressPage() {
  const t = useT();
  const { loaded } = useStorageStatus();
  const { sessions, stats, answers, attempts, lessons } = usePractice();
  // A lesson ticked is practice too: with ticks alone the page has where the player is. So it
  // has for whoever said on the start page where they start from (docs/START.md).
  const [answered] = useState(() => readStartPref() !== null);
  const begun = lessons.length > 0 || answered;
  const now = useNow();
  // Each day by the goal it had (docs/PERSONAL.md): the streak, the chart's line and the grid.
  const goal = useGoal();
  const log = useMemo(() => practiceLog(sessions, { now, goal }), [sessions, now, goal]);
  const piecesToday = useMemo(() => {
    const pieces = sessions.filter((s) => s.kind === 'piece');
    return pieces.length === 0 ? null : (dailyTotals(pieces).get(log.today) ?? 0);
  }, [sessions, log.today]);

  return (
    <section className="progress">
      <h1>{t('progress.title')}</h1>
      <p className="progress-assignments">
        <Link href="/assignments">{t('progress.assignments')}</Link>
      </p>
      {!loaded ? (
        <p className="muted" role="status">
          {t('storage.loading')}
        </p>
      ) : sessions.length === 0 && !begun ? (
        <EmptyState action={{ href: '/read', label: t('progress.empty.action') }}>
          {t('progress.empty')}
        </EmptyState>
      ) : (
        <>
          <PracticeFigures log={log} piecesToday={piecesToday} />
          <WhereYouAre today={log.today} />
          {sessions.length > 0 && (
            <>
              <DayHistory history={log.history} totals={log.totals} today={log.today} goal={goal} />
              <WeaknessHeatmap stats={stats} />
              <FamilyProgress answers={answers} />
            </>
          )}
          {/* What the weeks came to, then how the practices are going (docs/PERSONAL.md). */}
          <WeekRecap today={log.today} />
          {sessions.length > 0 && (
            <>
              <Trends sessions={sessions} attempts={attempts} answers={answers} today={log.today} />
              <SessionList sessions={sessions} />
            </>
          )}
        </>
      )}
    </section>
  );
}
