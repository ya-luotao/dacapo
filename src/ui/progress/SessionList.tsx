import { useId, useState, type ReactNode } from 'react';
import type { PieceSessionRecord, SessionRecord } from '../../core/log.ts';
import { useT, type MessageKey } from '../../i18n/index.ts';
import { isBuiltInId } from '../../pieces/library/index.ts';
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

  const when: [MessageKey, ReactNode] = [
    'progress.session.when',
    <time dateTime={new Date(session.startedAt).toISOString()}>
      {log.dateTime(session.startedAt)}
    </time>,
  ];
  const duration: [MessageKey, ReactNode] = [
    'progress.session.duration',
    log.duration(session.activeMs),
  ];
  let cells: [MessageKey, ReactNode][];
  switch (session.kind) {
    case 'read':
      cells = [
        when,
        ['progress.session.kind', t('progress.kind.read')],
        [
          'progress.session.level',
          <abbr title={t(`read.level.${session.level}`)}>{session.level}</abbr>,
        ],
        duration,
        [
          'progress.session.cards',
          session.cards < session.length ? `${session.cards}/${session.length}` : session.cards,
        ],
        ['progress.session.accuracy', read.percent(session.accuracy)],
        ['progress.session.median', read.seconds(session.medianMs)],
      ];
      break;
    case 'free':
      cells = [
        when,
        ['progress.session.kind', t('progress.kind.free')],
        ['progress.session.level', none],
        duration,
        ['progress.session.played', t('progress.session.notes', { n: session.notes })],
        ['progress.session.accuracy', none],
        ['progress.session.median', none],
      ];
      break;
    case 'piece':
      cells = [
        when,
        ['progress.session.kind', t('progress.kind.piece')],
        ['progress.session.piece', <PieceTitle session={session} />],
        duration,
        [
          'progress.session.bars',
          session.loop
            ? session.loop.fromLabel === session.loop.toLabel
              ? t('progress.session.bar', { bar: session.loop.fromLabel })
              : t('progress.session.barRange', {
                  from: session.loop.fromLabel,
                  to: session.loop.toLabel,
                })
            : t('progress.session.wholePiece'),
        ],
        ['progress.session.wrong', t('progress.session.wrongNotes', { n: session.wrong })],
        ['progress.session.hands', t(`progress.session.hands.${session.hands}`)],
      ];
      break;
  }

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

/** Built-in pieces by their name in the current language; imported ones as they were called. */
function PieceTitle({ session }: { session: PieceSessionRecord }) {
  const t = useT();
  const title = isBuiltInId(session.pieceId)
    ? t(`library.${session.pieceId}.title`)
    : session.title || t('pieces.untitled');
  return <span className="session-piece">{title}</span>;
}
