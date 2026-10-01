import { Link } from 'wouter';
import { useI18n } from '../../i18n/index.ts';
import { EXTRAS, lessonLanguage, LESSONS } from '../../learn/lessons.ts';
import { useStorageStatus } from '../practice/context.ts';
import { useLessonsDone } from './progress.ts';

function Arrow() {
  return (
    <svg className="arrow" viewBox="0 0 16 10" aria-hidden="true" focusable="false">
      <path d="M1 5h13M10 1l4 4-4 4" />
    </svg>
  );
}

/** The basics: the lessons in order, as a contents page; the ones not written yet are listed too. */
export function LearnPage() {
  const { t, locale } = useI18n();
  const language = lessonLanguage(locale);
  const { loaded } = useStorageStatus();
  const done = useLessonsDone();
  // Until the records are read a lesson's line holds its place, saying neither.
  const meta = (slug: string, minutes: number) =>
    !loaded
      ? '\u00a0'
      : done.has(slug)
        ? `✓ ${t('learn.done')}`
        : t('learn.minutes', { n: minutes });

  return (
    <section className="learn">
      <h1>{t('learn.title')}</h1>
      <p className="learn-lede">{t('learn.intro')}</p>
      {language === 'en' && locale !== 'en' && <p className="help">{t('learn.language')}</p>}

      <ol className="contents lessons">
        {LESSONS.map((lesson, i) => {
          const body = (
            <>
              <span className="contents-numeral" aria-hidden="true">
                {i + 1}
              </span>
              <span className="contents-body">
                <span className="contents-title">{lesson.title[language]}</span>
                <span className="contents-text">{lesson.summary[language]}</span>
              </span>
              <span className="contents-meta">
                {lesson.ready ? meta(lesson.slug, lesson.minutes) : t('learn.planned')}
              </span>
            </>
          );
          return (
            <li key={lesson.slug}>
              {lesson.ready ? (
                <Link href={`/learn/${lesson.slug}`} className="contents-row">
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
