import { Suspense, useEffect, useState } from 'react';
import { Link } from 'wouter';
import { useI18n } from '../../i18n/index.ts';
import { lessonLanguage } from '../../learn/lessons.ts';
import { TERM_GROUPS, termBySlug, type TermGroup } from '../../learn/terms.ts';
import { NotFoundPage } from '../pages/NotFoundPage.tsx';
import { LessonProvider } from './kit.tsx';
import { LoadBoundary } from './LoadBoundary.tsx';
import { TermEntry, TermsList } from './TermEntry.tsx';
import { TERM_TEXTS } from './terms/index.ts';

// The glossary in the app: the list, and a term's page (docs/GLOSSARY.md). Read in the lessons'
// languages; the others read the English, as they read the lessons.

function Back({ to, label }: { to: string; label: string }) {
  return (
    <Link href={to} className="lesson-back">
      <svg viewBox="0 0 6 10" aria-hidden="true">
        <path d="M5 1L1 5l4 4" />
      </svg>
      {label}
    </Link>
  );
}

export function TermsPage() {
  const { t, locale } = useI18n();
  const language = lessonLanguage(locale);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<TermGroup | 'all'>('all');

  return (
    <section className="terms">
      <Back to="/learn" label={t('learn.all')} />
      <h1>{t('terms.title')}</h1>
      <p className="learn-lede">{t('terms.intro')}</p>
      {language === 'en' && locale !== 'en' && <p className="help">{t('learn.language')}</p>}
      <div className="library-toolbar library-filter">
        <div className="library-search">
          <input
            type="search"
            className="library-search-input"
            placeholder={t('terms.search')}
            aria-label={t('terms.searchLabel')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="filter-pills" role="group" aria-label={t('terms.title')}>
          <button
            type="button"
            className="filter-pill"
            aria-pressed={group === 'all'}
            onClick={() => setGroup('all')}
          >
            {t('terms.filterAll')}
          </button>
          {TERM_GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              className="filter-pill"
              aria-pressed={group === g.id}
              onClick={() => setGroup(g.id)}
            >
              {g.title[language]}
            </button>
          ))}
        </div>
      </div>
      <TermsList
        language={language}
        query={query}
        group={group}
        emptyMessage={t('terms.empty', { query: query.trim() })}
      />
    </section>
  );
}

export function TermPage({ slug }: { slug: string }) {
  const { t, locale } = useI18n();
  const language = lessonLanguage(locale);
  const term = termBySlug(slug);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  if (!term) return <NotFoundPage />;
  const Text = TERM_TEXTS[slug]![language];
  return (
    <div className="term-page">
      <Back to="/learn/terms" label={t('terms.all')} />
      <TermEntry term={term} language={language}>
        <LessonProvider slug={`terms/${slug}`} language={language}>
          <LoadBoundary fallback={<p className="help">{t('learn.loadFailed')}</p>}>
            <Suspense fallback={null}>
              <Text />
            </Suspense>
          </LoadBoundary>
        </LessonProvider>
      </TermEntry>
    </div>
  );
}
