import { STREAK_GOAL_MS, type PracticeLog } from '../../core/streak.ts';
import { useT } from '../../i18n/index.ts';
import { useLogFormat } from './format.ts';

const MINUTE_MS = 60_000;

export function PracticeFigures({ log }: { log: PracticeLog }) {
  const t = useT();
  const format = useLogFormat();
  const reached = log.todayMs >= STREAK_GOAL_MS;

  return (
    <div className="practice-figures">
      <dl className="figures">
        <div>
          <dt>{t('progress.today')}</dt>
          <dd>{format.minutes(log.todayMs)}</dd>
        </div>
        <div>
          <dt>{t('progress.streak')}</dt>
          <dd>{format.days(log.currentStreak)}</dd>
        </div>
        <div>
          <dt>{t('progress.longest')}</dt>
          <dd>{format.days(log.longestStreak)}</dd>
        </div>
      </dl>
      <p className={reached ? 'goal is-reached' : 'goal'}>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          {reached ? <path d="M3.5 8.5l3 3 6-7" /> : <circle cx="8" cy="8" r="5.5" />}
        </svg>
        {reached
          ? t('progress.today.reached')
          : t('progress.today.toGo', {
              n: Math.ceil((STREAK_GOAL_MS - log.todayMs) / MINUTE_MS),
            })}
      </p>
      <p className="help">{t('progress.goal', { n: STREAK_GOAL_MS / MINUTE_MS })}</p>
    </div>
  );
}
