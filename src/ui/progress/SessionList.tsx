import { useContext, useId, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Link } from 'wouter';
import type { PieceSessionRecord, SessionRecord } from '../../core/log.ts';
import { parseProgressionPieceId } from '../../core/progressions.ts';
import { runFigures } from '../../core/scaleProgress.ts';
import { parseExerciseKey } from '../../core/scales.ts';
import { median } from '../../core/session.ts';
import { firstTimeRun } from '../../core/sightRead.ts';
import type { StoredPiece } from '../../core/storedPiece.ts';
import { WHOLE_TUNE } from '../../core/tuneList.ts';
import { useT, type MessageKey } from '../../i18n/index.ts';
import { isBuiltInId } from '../../pieces/library/index.ts';
import { useEarFormat } from '../ear/format.ts';
import { useHarmonyFormat } from '../harmony/format.ts';
import { backingTitle } from '../harmony/improvFormat.ts';
import { progressionPath, progressionPieceTitle } from '../harmony/progressionFormat.ts';
import { PracticeContext } from '../practice/context.ts';
import { useReadFormat } from '../read/format.ts';
import { useRhythmFormat } from '../read/rhythmFormat.ts';
import { useSightFormat } from '../read/sightFormat.ts';
import { useTheoryFormat } from '../read/theoryFormat.ts';
import { useExerciseLabel } from '../scales/format.ts';
import { levelStartPath, pieceStartPath, scaleStartPath } from '../startParams.ts';
import { useLogFormat } from './format.ts';

export const SESSIONS_PER_PAGE = 20;

type KindFilter = 'all' | 'piece' | 'scale' | 'read' | 'ear' | 'harmony';

const KIND_FILTERS: readonly [KindFilter, MessageKey][] = [
  ['all', 'pieces.filter.all'],
  ['piece', 'nav.pieces'],
  ['scale', 'nav.scales'],
  ['read', 'nav.read'],
  ['ear', 'nav.ear'],
  ['harmony', 'nav.harmony'],
];

const EMPTY_PIECES: readonly StoredPiece[] = [];
const noopSubscribe = () => () => undefined;

function useStoredPieces(): readonly StoredPiece[] {
  const store = useContext(PracticeContext);
  return useSyncExternalStore(
    store ? store.subscribe : noopSubscribe,
    store ? () => store.getSnapshot().pieces : () => EMPTY_PIECES,
    () => EMPTY_PIECES,
  );
}

function matchesKind(session: SessionRecord, filter: KindFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'piece':
      return session.kind === 'piece';
    case 'scale':
      return session.kind === 'scale';
    case 'read':
      return (
        session.kind === 'read' ||
        session.kind === 'theory' ||
        session.kind === 'rhythm' ||
        session.kind === 'sight'
      );
    case 'ear':
      return session.kind === 'ear';
    case 'harmony':
      return session.kind === 'harmony' || session.kind === 'improv';
  }
}

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
  const [filter, setFilter] = useState<KindFilter>('all');
  const [shown, setShown] = useState(SESSIONS_PER_PAGE);
  const pieces = useStoredPieces();
  const existingPieceIds = useMemo(() => new Set(pieces.map((p) => p.id)), [pieces]);
  const filtered = useMemo(
    () => (filter === 'all' ? sessions : sessions.filter((s) => matchesKind(s, filter))),
    [sessions, filter],
  );
  const visible = filtered.slice(0, shown);

  return (
    <section className="sessions" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{t('progress.sessions')}</h2>
      <div className="session-filter filter-pills">
        {KIND_FILTERS.map(([value, labelKey]) => (
          <button
            key={value}
            type="button"
            className="filter-pill"
            aria-pressed={filter === value}
            onClick={() => {
              setFilter(value);
              setShown(SESSIONS_PER_PAGE);
            }}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>
      <div className="session-table">
        {filtered.length > 0 && (
          <div className="session-head" aria-hidden="true">
            {COLUMNS.map((key) => (
              <span key={key}>{t(key)}</span>
            ))}
          </div>
        )}
        <ol className="session-list">
          {visible.map((session) => (
            <SessionRow key={session.id} session={session} existingPieceIds={existingPieceIds} />
          ))}
        </ol>
      </div>
      {filtered.length > SESSIONS_PER_PAGE && (
        <div className="session-more">
          <p className="muted">
            {t('progress.shown', { shown: visible.length, total: filtered.length })}
          </p>
          {shown < filtered.length && (
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

function sessionTarget(href: string | null, content: ReactNode, className?: string): ReactNode {
  if (!href) {
    return (
      <span className={className ? `session-what ${className}` : 'session-what'}>{content}</span>
    );
  }
  return (
    <Link
      href={href}
      className={className ? `session-what session-link ${className}` : 'session-what session-link'}
    >
      {content}
    </Link>
  );
}

function pieceHref(
  session: PieceSessionRecord,
  existingPieceIds: ReadonlySet<string>,
): string | null {
  const prog = parseProgressionPieceId(session.pieceId);
  if (prog) return progressionPath(prog);
  if (!isBuiltInId(session.pieceId) && !existingPieceIds.has(session.pieceId)) return null;
  return pieceStartPath(session.pieceId, {
    bars: session.loop ? { from: session.loop.from, to: session.loop.to } : null,
    hands: session.hands,
    mode: session.mode ?? 'wait',
    tempo: session.tempo,
  });
}

function SessionRow({
  session,
  existingPieceIds,
}: {
  session: SessionRecord;
  existingPieceIds: ReadonlySet<string>;
}) {
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
          sessionTarget(
            levelStartPath('read', { family: 'notes', level: session.level }),
            <abbr title={t(`read.level.${session.level}`)}>{session.level}</abbr>,
          ),
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
          t(
            session.mode === 'rhythm'
              ? 'progress.kind.pieceRhythm'
              : session.mode === 'memory'
                ? 'progress.kind.pieceMemory'
                : 'progress.kind.piece',
          ),
        ],
        [
          'progress.session.piece',
          <PieceTitle session={session} href={pieceHref(session, existingPieceIds)} />,
        ],
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
      // Rhythm dictation: its bars, and how far off the beat they were tapped (or how long a
      // bar took to choose).
      if (session.family === 'rhythmEar') {
        cells = [
          when,
          ['progress.session.kind', t('progress.kind.rhythmEar')],
          [
            'progress.session.level',
            sessionTarget(
              levelStartPath('ear', { family: 'rhythmEar', level: session.level }),
              <abbr title={rhythm.levelName(session.level)}>{session.level}</abbr>,
            ),
          ],
          duration,
          [
            'ear.rhythm.summary.bars',
            session.questions < session.length
              ? `${session.questions}/${session.length}`
              : session.questions,
          ],
          ['progress.session.accuracy', read.percent(session.accuracy)],
          session.by === 'play'
            ? ['rhythm.summary.median', rhythm.ms(session.medianDeviation)]
            : ['ear.summary.median', read.seconds(session.medianMs)],
        ];
        break;
      }
      // A tune played by ear: which, in which key, how many of its phrases, and the whole tune
      // (asked once every phrase was); how long a phrase took to play says nothing. The table's
      // columns are headed for cards and reaction times, so there a figure says what it is.
      if (session.family === 'tune') {
        const byWidth = (table: ReactNode, list: ReactNode) => (
          <>
            <span className="session-table-only">{table}</span>
            <span className="session-list-only">{list}</span>
          </>
        );
        const phrases = session.length - 1;
        const whole = session.items >= session.length;
        const wholeMissed = session.missed.some((m) => m.item.endsWith(`:${WHOLE_TUNE}`));
        cells = [
          when,
          ['progress.session.kind', t('progress.kind.tune')],
          [
            'ear.tune',
            sessionTarget(
              levelStartPath('ear', { family: 'tune', level: session.level }),
              session.key
                ? t('ear.tune.inKey', {
                    tune: ear.levelName(session.level),
                    key: ear.key(session.key.tonic, session.key.scale),
                  })
                : ear.levelName(session.level),
              'session-piece',
            ),
          ],
          duration,
          [
            'ear.summary.phrases',
            whole
              ? byWidth(t('ear.level.phrases', { n: phrases }), phrases)
              : `${session.items}/${phrases}`,
          ],
          ['progress.session.accuracy', read.percent(session.accuracy)],
          [
            'ear.summary.whole',
            whole
              ? byWidth(
                  t(wholeMissed ? 'progress.session.tune.wrong' : 'progress.session.tune.right'),
                  t(wholeMissed ? 'ear.summary.whole.wrong' : 'ear.summary.whole.right'),
                )
              : none,
          ],
        ];
        break;
      }
      cells = [
        when,
        ['progress.session.kind', t('progress.kind.ear')],
        [
          'progress.session.level',
          sessionTarget(
            levelStartPath('ear', { family: session.family, level: session.level }),
            <abbr title={ear.levelName(session.level)}>{session.level}</abbr>,
          ),
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
          sessionTarget(
            levelStartPath('read', { family: session.family, level: session.level }),
            <abbr title={theory.levelName(session.level)}>{session.level}</abbr>,
          ),
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
          sessionTarget(
            levelStartPath('read', { family: 'rhythm', level: session.level }),
            <abbr title={rhythm.levelName(session.level)}>{session.level}</abbr>,
          ),
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
          sessionTarget(
            levelStartPath('harmony', { family: session.family, level: session.level }),
            <abbr title={harmony.levelName(session.level)}>{session.level}</abbr>,
          ),
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
          sessionTarget(
            levelStartPath('read', { family: 'sight', level: session.level }),
            <abbr title={sight.levelName(session.level)}>{session.level}</abbr>,
          ),
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
    case 'improv': {
      const { figures } = session;
      cells = [
        when,
        ['progress.session.kind', t('progress.kind.improv')],
        [
          'progress.session.backing',
          sessionTarget('/harmony', backingTitle(t, session.backing, session.key), 'session-piece'),
        ],
        duration,
        ['progress.session.played', t('progress.session.notes', { n: figures.notes })],
        [
          'progress.session.strongChord',
          read.percent(figures.strong === 0 ? null : figures.strongChord / figures.strong),
        ],
        ['progress.session.median', none],
      ];
      break;
    }
    case 'scale': {
      const exercises = [...new Set(session.runs.map((r) => r.exercise))].map(parseExerciseKey);
      const only = exercises.length === 1 ? exercises[0] : null;
      const latest = session.runs[session.runs.length - 1];
      const href =
        only && latest
          ? scaleStartPath({ exercise: latest.exercise, click: latest.click ?? null })
          : '/scales';
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
          sessionTarget(
            href,
            only ? exerciseLabel(only) : t('progress.session.scaleCount', { n: exercises.length }),
          ),
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
function PieceTitle({ session, href }: { session: PieceSessionRecord; href: string | null }) {
  const t = useT();
  const title = isBuiltInId(session.pieceId)
    ? t(`library.${session.pieceId}.title`)
    : (progressionPieceTitle(t, session.pieceId) ?? (session.title || t('pieces.untitled')));
  return sessionTarget(href, title, 'session-piece');
}
