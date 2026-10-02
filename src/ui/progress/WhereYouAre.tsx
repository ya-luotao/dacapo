import { useId, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import { lessonNumber, OPENS_WITH, type Practice } from '../../core/curriculum.ts';
import type { DayKey } from '../../core/streak.ts';
import { curriculumState, type FamilyState } from '../../core/today.ts';
import { useI18n } from '../../i18n/index.ts';
import { lessonBySlug, lessonLanguage } from '../../learn/lessons.ts';
import { useLessonsDone } from '../learn/progress.ts';
import { useInstrumentKeys } from '../instrument.ts';
import { readStartPref } from '../start/prefs.ts';
import { useTodayFormat } from '../today/format.ts';
import { useTodayRecords } from '../today/useTodayRecords.ts';

/**
 * Where you are (docs/TODAY.md): one row per practice, in the order of the contents — how far
 * it has got, and its next step as a link that starts it. It is the state today's plan is made
 * from, as it is now.
 */
export function WhereYouAre({ today }: { today: DayKey }) {
  const { t, locale } = useI18n();
  const format = useTodayFormat();
  const id = useId();
  const records = useTodayRecords();
  const lessonsDone = useLessonsDone();
  // Where the visitor said they start from (docs/START.md): a player has every practice open.
  const [start] = useState(readStartPref);
  // The player's keyboard: a scale that runs beyond it is not the next one.
  const keys = useInstrumentKeys();
  const state = useMemo(
    () => (records ? curriculumState(records, { today, lessonsDone, start, keys }) : null),
    [records, today, lessonsDone, start, keys],
  );

  const lessonTitle = (slug: string) => lessonBySlug(slug)?.title[lessonLanguage(locale)] ?? slug;
  const lessonLink = (slug: string) => (
    <Link href={`/learn/${slug}`}>
      {[t('learn.lesson', { n: lessonNumber(slug) }), lessonTitle(slug)].join(' · ')}
    </Link>
  );
  /** A practice not open yet: one muted row that names the lesson which opens it. */
  const closed = (practice: Practice, name: string) => {
    const slug = OPENS_WITH[practice]!;
    return (
      <li key={practice} className="is-closed">
        <span className="where-practice">{name}</span>
        <span className="where-next">
          <Link href={`/learn/${slug}`}>
            {t('where.after', { n: lessonNumber(slug), title: lessonTitle(slug) })}
          </Link>
        </span>
      </li>
    );
  };
  const row = (key: string, name: string, figure: ReactNode, next: ReactNode) => (
    <li key={key}>
      <span className="where-practice">{name}</span>
      <span className="where-figure">{figure}</span>
      <span className="where-next">{next}</span>
    </li>
  );
  const labelled = (label: string, link: ReactNode) => (
    <span>
      <span className="where-label">{label}</span>
      {link}
    </span>
  );

  const family = (f: FamilyState) => {
    const name = format.family(f.family);
    if (!f.open) return closed(f.family, name);
    const tunes = f.family === 'tune';
    return row(
      f.family,
      name,
      t(tunes ? 'where.tunes' : 'where.levels', { mastered: f.mastered, levels: f.levels }),
      f.suggested === null ? (
        <span className="muted">{t(tunes ? 'where.tunes.learnt' : 'where.mastered')}</span>
      ) : (
        <Link href={format.levelPath(f.family, f.suggested)}>
          {format.level(f.family, f.suggested)}
        </Link>
      ),
    );
  };

  return (
    <section className="where" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{t('where.title')}</h2>
      <p className="help">{t('where.help')}</p>
      {!state ? (
        <p className="muted where-waiting" role="status">
          {t('storage.loading')}
        </p>
      ) : (
        <ul className="where-rows">
          {row(
            'learn',
            t('nav.learn'),
            t('where.lessons', { done: state.lessons.done, of: state.lessons.of }),
            state.lessons.next && lessonLink(state.lessons.next),
          )}
          {state.families.map(family)}
          {!state.scales.open
            ? closed('scales', t('nav.scales'))
            : row(
                'scales',
                t('nav.scales'),
                state.scales.played === 0
                  ? t('where.scales.none')
                  : state.scales.played === 1
                    ? t('where.scales.one')
                    : t('where.scales.other', { n: state.scales.played }),
                <>
                  {state.scales.weakest &&
                    labelled(
                      t('where.scales.weakest'),
                      <Link href={format.exercisePath(state.scales.weakest)}>
                        {format.exercise(state.scales.weakest)}
                      </Link>,
                    )}
                  {state.scales.next &&
                    labelled(
                      t('where.next'),
                      <Link href={format.exercisePath(state.scales.next)}>
                        {format.exercise(state.scales.next)}
                      </Link>,
                    )}
                </>,
              )}
          {!state.pieces.open
            ? closed('pieces', t('nav.pieces'))
            : row(
                'pieces',
                t('nav.pieces'),
                <>
                  {t('where.pieces.review', {
                    review: state.pieces.inReview,
                    due: state.pieces.due.length,
                  })}
                  <small>
                    {state.pieces.grades
                      .map((g) =>
                        t('where.pieces.grade', {
                          grade:
                            g.grade === 0
                              ? t('pieces.level.0')
                              : t('pieces.level.n', { n: g.grade }),
                          played: g.played,
                          of: g.of,
                        }),
                      )
                      .join(' · ')}
                  </small>
                </>,
                <PieceLink
                  label={t(state.pieces.inHand ? 'where.pieces.inHand' : 'where.next')}
                  id={state.pieces.inHand?.id ?? state.pieces.next}
                  title={format.pieceTitle}
                  path={format.piecePath}
                />,
              )}
        </ul>
      )}
    </section>
  );
}

/** The piece in hand or the next piece, as the link that opens it; nothing when there is none. */
function PieceLink({
  label,
  id,
  title,
  path,
}: {
  label: string;
  id: string | null;
  title: (id: string) => string | null;
  path: (id: string) => string | null;
}) {
  const href = id === null ? null : path(id);
  if (id === null || href === null) return null;
  return (
    <span>
      <span className="where-label">{label}</span>
      <Link href={href}>{title(id)}</Link>
    </span>
  );
}
