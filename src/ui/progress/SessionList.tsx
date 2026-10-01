import { useId, useState, type ReactNode } from 'react';
import type { PieceSessionRecord, SessionRecord } from '../../core/log.ts';
import { useT, type MessageKey } from '../../i18n/index.ts';
import { isBuiltInId } from '../../pieces/library/index.ts';
import { progressionPieceTitle } from '../harmony/progressionFormat.ts';
import { runFigures } from '../../core/scaleProgress.ts';
import { parseExerciseKey } from '../../core/scales.ts';
import { median } from '../../core/session.ts';
import { useEarFormat } from '../ear/format.ts';
import { useHarmonyFormat } from '../harmony/format.ts';
import { useReadFormat } from '../read/format.ts';
import { useRhythmFormat } from '../read/rhythmFormat.ts';
import { useSightFormat } from '../read/sightFormat.ts';
import { firstTimeRun } from '../../core/sightRead.ts';
import { useTheoryFormat } from '../read/theoryFormat.ts';
import { useExerciseLabel } from '../scales/format.ts';
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
  const ear = useEarFormat();
  const theory = useTheoryFormat();
  const rhythm = useRhythmFormat();
  const harmony = useHarmonyFormat();
  const exerciseLabel = useExerciseLabel();
  const sight = useSightFormat();
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
        [
          'progress.session.kind',
          t(session.mode === 'rhythm' ? 'progress.kind.pieceRhythm' : 'progress.kind.piece'),
        ],
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
        session.rhythm
          ? [
              'progress.session.timing',
              t('progress.session.inTime', {
                percent: Math.round(
                  session.rhythm.notes === 0
                    ? 0
                    : (100 * session.rhythm.inTime) / session.rhythm.notes,
                ),
              }),
            ]
          : ['progress.session.wrong', t('progress.session.wrongNotes', { n: session.wrong })],
        ['progress.session.hands', t(`progress.session.hands.${session.hands}`)],
      ];
      break;
    case 'ear':
      cells = [
        when,
        ['progress.session.kind', t('progress.kind.ear')],
        [
          'progress.session.level',
          <abbr title={ear.levelName(session.level)}>{session.level}</abbr>,
        ],
        duration,
        [
          session.family === 'echo' ? 'ear.summary.melodies' : 'ear.summary.questions',
          session.items < session.length ? `${session.items}/${session.length}` : session.items,
        ],
        ['progress.session.accuracy', read.percent(session.accuracy)],
        ['ear.summary.median', read.seconds(session.medianMs)],
      ];
      break;
    case 'theory':
      cells = [
        when,
        ['progress.session.kind', t(`progress.kind.${session.family}`)],
        [
          'progress.session.level',
          <abbr title={theory.levelName(session.level)}>{session.level}</abbr>,
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
    case 'rhythm':
      cells = [
        when,
        ['progress.session.kind', t('progress.kind.rhythm')],
        [
          'progress.session.level',
          <abbr title={rhythm.levelName(session.level)}>{session.level}</abbr>,
        ],
        duration,
        [
          'progress.session.exercises',
          session.exercises < session.length
            ? `${session.exercises}/${session.length}`
            : session.exercises,
        ],
        ['progress.session.accuracy', read.percent(session.accuracy)],
        ['rhythm.summary.median', rhythm.ms(session.medianDeviation)],
      ];
      break;
    case 'harmony':
      cells = [
        when,
        ['progress.session.kind', t(`progress.kind.${session.family}`)],
        [
          'progress.session.level',
          <abbr title={harmony.levelName(session.level)}>{session.level}</abbr>,
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
    case 'sight': {
      const firsts = session.fragments.flatMap((f) => {
        const run = firstTimeRun(f);
        return run ? [run] : [];
      });
      const notes = firsts.reduce((n, r) => n + r.notes, 0);
      cells = [
        when,
        ['progress.session.kind', t('progress.kind.sight')],
        [
          'progress.session.level',
          <abbr title={sight.levelName(session.level)}>{session.level}</abbr>,
        ],
        duration,
        [
          'sight.summary.fragments',
          session.fragments.length < session.length
            ? `${session.fragments.length}/${session.length}`
            : session.fragments.length,
        ],
        [
          'sight.result.inTime',
          read.percent(notes === 0 ? null : firsts.reduce((n, r) => n + r.inTime, 0) / notes),
        ],
        [
          'rhythm.summary.median',
          rhythm.ms(
            median(firsts.flatMap((r) => (r.medianDeviation === null ? [] : [r.medianDeviation]))),
          ),
        ],
      ];
      break;
    }
    case 'scale': {
      const exercises = [...new Set(session.runs.map((r) => r.exercise))].map(parseExerciseKey);
      const only = exercises.length === 1 ? exercises[0] : null;
      // The figures of this analysis only, the weaker hand's, as everywhere else (scaleProgress).
      const spreads = session.runs.flatMap((r) => {
        const spread = runFigures(r.headline)?.spread;
        return spread === null || spread === undefined ? [] : [spread];
      });
      const spread = median(spreads);
      cells = [
        when,
        ['progress.session.kind', t('progress.kind.scales')],
        [
          'progress.session.scale',
          only ? exerciseLabel(only) : t('progress.session.scaleCount', { n: exercises.length }),
        ],
        duration,
        [
          'progress.session.runs',
          session.runs.length === 1
            ? t('progress.session.runs.one')
            : t('progress.session.runs.other', { n: session.runs.length }),
        ],
        [
          'scales.result.spread',
          spread === null ? none : t('scales.result.ms', { ms: Math.round(spread) }),
        ],
        ['progress.session.hands', only ? t(`progress.session.hands.${only.hands}`) : none],
      ];
      break;
    }
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

/**
 * Built-in pieces and progressions by their name in the current language; imported ones as they
 * were called.
 */
function PieceTitle({ session }: { session: PieceSessionRecord }) {
  const t = useT();
  const title = isBuiltInId(session.pieceId)
    ? t(`library.${session.pieceId}.title`)
    : (progressionPieceTitle(t, session.pieceId) ?? (session.title || t('pieces.untitled')));
  return <span className="session-piece">{title}</span>;
}
