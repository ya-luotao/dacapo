import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { useT } from '../../i18n/index.ts';
import { lessonBySlug, type LessonInfo, type LessonLanguage } from '../../learn/lessons.ts';
import {
  TERM_GROUPS,
  termBySlug,
  termsOf,
  type TermGroup,
  type TermInfo,
} from '../../learn/terms.ts';

// The glossary as the app and the site both draw it (docs/GLOSSARY.md): the list of terms by
// group, and a term's entry around its text.

const known = <T,>(items: readonly (T | undefined)[]): T[] => items.filter((x) => x !== undefined);

export interface TermsListProps {
  language: LessonLanguage;
  query?: string;
  group?: TermGroup | 'all';
  emptyMessage?: string;
}

function termMatchesQuery(term: TermInfo, language: LessonLanguage, q: string): boolean {
  if (!q) return true;
  const candidates = [
    term.title[language],
    term.summary[language],
    term.slug,
    ...(term.also?.[language] ?? []),
  ];
  return candidates.some((text) => text.toLowerCase().includes(q));
}

/** Every term, by group, each with its definition; filters cleanly without client providers. */
export function TermsList({ language, query, group = 'all', emptyMessage }: TermsListProps) {
  const q = (query ?? '').trim().toLowerCase();
  const filtered = q !== '' || group !== 'all';
  const visibleGroups = group === 'all' ? TERM_GROUPS : TERM_GROUPS.filter((g) => g.id === group);
  const sections = visibleGroups
    .map((g) => ({
      group: g,
      terms: termsOf(g.id).filter((term) => termMatchesQuery(term, language, q)),
    }))
    .filter((section) => !filtered || section.terms.length > 0);

  if (filtered && sections.length === 0) {
    return <p className="muted library-empty">{emptyMessage ?? ''}</p>;
  }

  return (
    <>
      {sections.map(({ group: g, terms }) => (
        <section key={g.id} className="terms-group" aria-labelledby={`terms-${g.id}`}>
          <h2 id={`terms-${g.id}`}>{g.title[language]}</h2>
          <ul className="terms-list">
            {terms.map((term) => (
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
