import { useMemo } from 'react';
import { dailyTotals, practiceLog } from '../../core/streak.ts';
import { useT } from '../../i18n/index.ts';
import { EmptyState } from '../EmptyState.tsx';
import { usePractice, useStorageStatus } from '../practice/context.ts';
import { DayHistory } from '../progress/DayHistory.tsx';
import { WeaknessHeatmap } from '../progress/heatmap/WeaknessHeatmap.tsx';
import { PracticeFigures } from '../progress/PracticeFigures.tsx';
import { SessionList } from '../progress/SessionList.tsx';
import { useNow } from '../progress/useNow.ts';

export function ProgressPage() {
  const t = useT();
  const { loaded } = useStorageStatus();
  const { sessions, stats } = usePractice();
  const now = useNow();
  const log = useMemo(() => practiceLog(sessions, { now }), [sessions, now]);
  const piecesToday = useMemo(() => {
    const pieces = sessions.filter((s) => s.kind === 'piece');
    return pieces.length === 0 ? null : (dailyTotals(pieces).get(log.today) ?? 0);
  }, [sessions, log.today]);

  return (
    <section className="progress">
      <h1>{t('progress.title')}</h1>
      {!loaded ? (
        <p className="muted" role="status">
          {t('storage.loading')}
        </p>
      ) : sessions.length === 0 ? (
        <EmptyState action={{ href: '/read', label: t('progress.empty.action') }}>
          {t('progress.empty')}
        </EmptyState>
      ) : (
        <>
          <PracticeFigures log={log} piecesToday={piecesToday} />
          <DayHistory history={log.history} today={log.today} />
          <WeaknessHeatmap stats={stats} />
          <SessionList sessions={sessions} />
        </>
      )}
    </section>
  );
}
