import { Link } from 'wouter';
import { CURRICULUM_LESSONS, lessonNumber, nextLesson } from '../../core/curriculum.ts';
import { useI18n } from '../../i18n/index.ts';
import { EXTRAS, lessonBySlug, lessonLanguage, LESSONS } from '../../learn/lessons.ts';
import { useStorageStatus } from '../practice/context.ts';
import { useLessonsDone } from './progress.ts';

function Arrow() {
  return (
    <svg className="arrow" viewBox="0 0 16 10" aria-hidden="true" focusable="false">
      <path d="M1 5h13M10 1l4 4-4 4" />
    </svg>
  );
}

/**
 * The basics: the lessons in order, as a contents page; the ones not written yet are listed too.
 * The first lesson not ticked is marked Next, and the page opens with a way to it.
 */
export function LearnPage() {
  const { t, locale } = useI18n();
  const language = lessonLanguage(locale);
  const { loaded } = useStorageStatus();
  const done = useLessonsDone();
  // The way on: the first lesson not ticked; none once all are, and none until the ticks are read.
  const next = loaded ? nextLesson(done) : null;
  const nextInfo = next === null ? undefined : lessonBySlug(next);
  const begun = CURRICULUM_LESSONS.some((slug) => done.has(slug));
  // Until the records are read a lesson's line holds its place, saying neither.
  const meta = (slug: string, minutes: number) =>
    !loaded ? ' ' : done.has(slug) ? `✓ ${t('learn.done')}` : t('learn.minutes', { n: minutes });

  return (
    <section className="learn">
      <h1>{t('learn.title')}</h1>
      <p className="learn-lede">{t('learn.intro')}</p>
      {language === 'en' && locale !== 'en' && <p className="help">{t('learn.language')}</p>}
      {/* Its place is kept while the ticks are read; it goes once every lesson is ticked. */}
      {(!loaded || nextInfo) && (
        <p className="learn-continue">
          {nextInfo && (
            <Link href={`/learn/${nextInfo.slug}`} className="home-link">
              {t(begun ? 'learn.continue' : 'learn.begin', {
                n: lessonNumber(nextInfo.slug),
                title: nextInfo.title[language],
              })}
              <Arrow />
            </Link>
          )}
        </p>
      )}

      <ol className="contents lessons">
        {LESSONS.map((lesson, i) => {
          const isNext = lesson.slug === next;
          const body = (
            <>
              <span className="contents-numeral" aria-hidden="true">
                {i + 1}
              </span>
              <span className="contents-body">
                <span className="contents-title">{lesson.title[language]}</span>
                <span className="contents-text">{lesson.summary[language]}</span>
              </span>
              <span className={isNext ? 'contents-meta is-next' : 'contents-meta'}>
                {!lesson.ready
                  ? t('learn.planned')
                  : isNext
                    ? `${t('learn.upNext')} · ${meta(lesson.slug, lesson.minutes)}`
                    : meta(lesson.slug, lesson.minutes)}
              </span>
            </>
          );
          return (
            <li key={lesson.slug}>
              {lesson.ready ? (
                <Link
                  href={`/learn/${lesson.slug}`}
                  className="contents-row"
                  aria-current={isNext ? 'step' : undefined}
                >
                  {body}
                  <Arrow />
                </Link>
              ) : (
                <div className="contents-row is-planned">
                  {body}
                  <span />
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <h2 className="eyebrow learn-extras">{t('learn.extra')}</h2>
      <ul className="contents lessons">
        {EXTRAS.map((extra) => (
          <li key={extra.slug}>
            <Link href={`/learn/${extra.slug}`} className="contents-row">
              <span className="contents-numeral" aria-hidden="true">
                ✦
              </span>
              <span className="contents-body">
                <span className="contents-title">{extra.title[language]}</span>
                <span className="contents-text">{extra.summary[language]}</span>
              </span>
              <span className="contents-meta">{meta(extra.slug, extra.minutes)}</span>
              <Arrow />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
