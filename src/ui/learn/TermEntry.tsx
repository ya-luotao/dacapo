import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { useT } from '../../i18n/index.ts';
import { lessonBySlug, type LessonInfo, type LessonLanguage } from '../../learn/lessons.ts';
import { TERM_GROUPS, termBySlug, termsOf, type TermInfo } from '../../learn/terms.ts';

// The glossary as the app and the site both draw it (docs/GLOSSARY.md): the list of terms by
// group, and a term's entry around its text.

const known = <T,>(items: readonly (T | undefined)[]): T[] => items.filter((x) => x !== undefined);

/** Every term, by group, each with its definition. */
export function TermsList({ language }: { language: LessonLanguage }) {
  return (
    <>
      {TERM_GROUPS.map((group) => (
        <section key={group.id} className="terms-group" aria-labelledby={`terms-${group.id}`}>
          <h2 id={`terms-${group.id}`}>{group.title[language]}</h2>
          <ul className="terms-list">
            {termsOf(group.id).map((term) => (
              <li key={term.slug}>
                <Link href={`/learn/terms/${term.slug}`} className="terms-row">
                  <span className="terms-name">{term.title[language]}</span>
                  <span className="terms-summary">{term.summary[language]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

/** A term: its names, its definition, its text, and the terms and lessons beside it. */
export function TermEntry({
  term,
  language,
  children,
}: {
  term: TermInfo;
  language: LessonLanguage;
  /** The term's text, from ui/learn/terms/. */
  children: ReactNode;
}) {
  const t = useT();
  const also = term.also?.[language] ?? [];
  const see = known(term.see.map(termBySlug));
  const lessons = known<LessonInfo>(term.lessons.map(lessonBySlug)).filter((l) => l.ready);
  return (
    <article className="term" lang={language}>
      <header className="term-head">
        <h1>{term.title[language]}</h1>
        {also.length > 0 && (
          <p className="term-also">
            {t('terms.also', { names: also.join(t('app.listSeparator')) })}
          </p>
        )}
        <p className="term-summary">{term.summary[language]}</p>
      </header>
      <div className="term-body">{children}</div>
      <footer className="term-links">
        {see.length > 0 && (
          <section aria-labelledby="term-see">
            <h2 id="term-see">{t('terms.see')}</h2>
            <ul>
              {see.map((other) => (
                <li key={other.slug}>
                  <Link href={`/learn/terms/${other.slug}`}>{other.title[language]}</Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        {lessons.length > 0 && (
          <section aria-labelledby="term-lessons">
            <h2 id="term-lessons">{t('terms.lessons')}</h2>
            <ul>
              {lessons.map((lesson) => (
                <li key={lesson.slug}>
                  <Link href={`/learn/${lesson.slug}`}>{lesson.title[language]}</Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </footer>
    </article>
  );
}
