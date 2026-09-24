import { useMemo } from 'react';
import { practiceLog } from '../../core/streak.ts';
import { useT } from '../../i18n/index.ts';
import { usePractice, useStorageStatus } from '../practice/context.ts';
import { DayHistory } from '../progress/DayHistory.tsx';
import { PracticeFigures } from '../progress/PracticeFigures.tsx';
import { SessionList } from '../progress/SessionList.tsx';
import { useNow } from '../progress/useNow.ts';

export function ProgressPage() {
  const t = useT();
  const { loaded } = useStorageStatus();
  const { sessions } = usePractice();
  const now = useNow();
  const log = useMemo(() => practiceLog(sessions, { now }), [sessions, now]);

  return (
    <section className="progress">
      <h1>{t('progress.title')}</h1>
      {!loaded ? (
        <p className="muted" role="status">
          {t('storage.loading')}
        </p>
      ) : sessions.length === 0 ? (
        <p className="muted">{t('progress.empty')}</p>
      ) : (
        <>
          <PracticeFigures log={log} />
          <DayHistory history={log.history} today={log.today} />
          {/* M5: the per-note weakness heatmap (F3) goes here. */}
          <SessionList sessions={sessions} />
        </>
      )}
    </section>
  );
}
