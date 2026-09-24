import { useId, useState, type ReactNode } from 'react';
import type { SessionRecord } from '../../core/log.ts';
import { useT, type MessageKey } from '../../i18n/index.ts';
import { useReadFormat } from '../read/format.ts';
import { useLogFormat } from './format.ts';

export const SESSIONS_PER_PAGE = 20;

const COLUMNS: readonly MessageKey[] = [
  'progress.session.when',
  'progress.session.kind',
  'progress.session.level',
  'progress.session.duration',
  'progress.session.cards',
  'progress.session.accuracy',
  'progress.session.median',
];

/** Most recent first, `SESSIONS_PER_PAGE` at a time. */
export function SessionList({ sessions }: { sessions: readonly SessionRecord[] }) {
  const t = useT();
  const id = useId();
  const [shown, setShown] = useState(SESSIONS_PER_PAGE);
  const visible = sessions.slice(0, shown);

  return (
    <section className="sessions" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{t('progress.sessions')}</h2>
      <div className="session-table">
        <div className="session-head" aria-hidden="true">
          {COLUMNS.map((key) => (
            <span key={key}>{t(key)}</span>
          ))}
        </div>
        <ol className="session-list">
          {visible.map((session) => (
            <SessionRow key={session.id} session={session} />
          ))}
        </ol>
      </div>
      {sessions.length > SESSIONS_PER_PAGE && (
        <div className="session-more">
          <p className="muted">
            {t('progress.shown', { shown: visible.length, total: sessions.length })}
          </p>
          {shown < sessions.length && (
            <button
              type="button"
              className="button"
              onClick={() => setShown((n) => n + SESSIONS_PER_PAGE)}
            >
              {t('progress.showMore')}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function SessionRow({ session }: { session: SessionRecord }) {
  const t = useT();
  const log = useLogFormat();
  const read = useReadFormat();
  const none = t('read.none');
  const isRead = session.kind === 'read';

  const cells: [MessageKey, ReactNode][] = [
    [
      'progress.session.when',
      <time dateTime={new Date(session.startedAt).toISOString()}>
        {log.dateTime(session.startedAt)}
      </time>,
    ],
    ['progress.session.kind', t(isRead ? 'progress.kind.read' : 'progress.kind.free')],
    [
      'progress.session.level',
      isRead ? <abbr title={t(`read.level.${session.level}`)}>{session.level}</abbr> : none,
    ],
    ['progress.session.duration', log.duration(session.activeMs)],
    [
      isRead ? 'progress.session.cards' : 'progress.session.played',
      isRead
        ? session.cards < session.length
          ? `${session.cards}/${session.length}`
          : session.cards
        : t('progress.session.notes', { n: session.notes }),
    ],
    ['progress.session.accuracy', isRead ? read.percent(session.accuracy) : none],
    ['progress.session.median', isRead ? read.seconds(session.medianMs) : none],
  ];

  return (
    <li className={`session is-${session.kind}`}>
      <dl>
        {cells.map(([label, value]) => (
          <div key={label}>
            <dt>{t(label)}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </li>
  );
}
