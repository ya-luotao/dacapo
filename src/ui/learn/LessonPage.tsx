import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { Link } from 'wouter';
import { useI18n } from '../../i18n/index.ts';
import { isExtra, lessonBySlug, lessonLanguage, LESSONS, neighbours } from '../../learn/lessons.ts';
import { NotFoundPage } from '../pages/NotFoundPage.tsx';
import { LessonProvider } from './kit.tsx';
import { LESSON_TEXTS } from './lessons/index.ts';

// Practise it: the lesson's links are resolved against the reader's records, which takes the
// mastery rule of every practice, so they are loaded apart from the lesson (as today's plan is).
const PracticeLinks = lazy(() =>
  import('./PracticeLinks.tsx').then((m) => ({ default: m.PracticeLinks })),
);

/** A lesson whose code could not be downloaded (offline, or a new version replaced it). */
class LoadBoundary extends Component<{ fallback: ReactNode; children: ReactNode }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Tells the page when the lesson's text is on screen, so its sections can be listed. */
function Mounted({ onMount, children }: { onMount: () => void; children: ReactNode }) {
  useEffect(onMount, [onMount]);
  return children;
}

interface Heading {
  id: string;
  title: string;
}

/** The sections of the lesson on screen, and the one being read. */
function useContents(body: RefObject<HTMLDivElement | null>) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  // Called once the lesson's text is on screen.
  const collect = useCallback(() => {
    const found = body.current?.querySelectorAll<HTMLHeadingElement>('h2[id]') ?? [];
    setHeadings([...found].map((h) => ({ id: h.id, title: h.textContent ?? '' })));
  }, [body]);
  useEffect(() => {
    if (headings.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) setCurrent(visible[0]!.target.id);
      },
      { rootMargin: '-15% 0px -70% 0px' },
    );
    for (const { id } of headings) {
      const heading = document.getElementById(id);
      if (heading) observer.observe(heading);
    }
    return () => observer.disconnect();
  }, [headings]);
  return { headings, current, collect };
}

function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export function LessonPage({ slug }: { slug: string }) {
  const { t, locale } = useI18n();
  const lesson = lessonBySlug(slug);
  const language = lessonLanguage(locale);
  const body = useRef<HTMLDivElement>(null);
  const { headings, current, collect } = useContents(body);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  if (!lesson || !lesson.ready || !LESSON_TEXTS[slug]) return <NotFoundPage />;

  const Text = LESSON_TEXTS[slug][language];
  const number = LESSONS.indexOf(lesson) + 1;
  const { previous, next } = neighbours(slug);

  const goTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'start',
    });
  };

  return (
    <LessonProvider slug={slug} language={language}>
      <article className="lesson" lang={language}>
        <aside className="lesson-rail">
          <Link href="/learn" className="lesson-back">
            <svg viewBox="0 0 6 10" aria-hidden="true">
              <path d="M5 1L1 5l4 4" />
            </svg>
            {t('learn.all')}
          </Link>
          {headings.length > 0 && (
            <nav className="lesson-toc" aria-label={t('learn.contents')}>
              <p className="eyebrow">{t('learn.contents')}</p>
              <ol>
                {headings.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      className={current === h.id ? 'is-current' : undefined}
                      aria-current={current === h.id ? 'location' : undefined}
                      onClick={() => goTo(h.id)}
                    >
                      {h.title}
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
          )}
        </aside>

        <div className="lesson-main">
          <header className="lesson-head">
            <p className="eyebrow">
              {isExtra(slug) ? t('learn.extra') : t('learn.lesson', { n: number })} ·{' '}
              {t('learn.minutes', { n: lesson.minutes })}
            </p>
            <h1>{lesson.title[language]}</h1>
            <p className="lesson-lede">{lesson.summary[language]}</p>
            {language === 'en' && locale !== 'en' && (
              <p className="help" lang={locale}>
                {t('learn.language')}
              </p>
            )}
          </header>

          <div className="lesson-body" ref={body}>
            <LoadBoundary fallback={<p className="help">{t('learn.loadFailed')}</p>}>
              <Suspense fallback={null}>
                <Mounted key={language} onMount={collect}>
                  <Text />
                </Mounted>
              </Suspense>
            </LoadBoundary>
          </div>

          <footer className="lesson-end" lang={locale}>
            {/* Without them the lesson is whole: a failure to load them leaves only the pager. */}
            <LoadBoundary fallback={null}>
              <Suspense fallback={<div className="lesson-practice" />}>
                <PracticeLinks practice={lesson.practice} />
              </Suspense>
            </LoadBoundary>
            <nav className="lesson-pager" aria-label={t('learn.all')}>
              {previous ? (
                <Link href={`/learn/${previous.slug}`} className="lesson-pager-link">
                  <span className="eyebrow">{t('learn.previous')}</span>
                  <span className="lesson-pager-title">{previous.title[language]}</span>
                </Link>
              ) : (
                <span />
              )}
              {next && (
                <Link href={`/learn/${next.slug}`} className="lesson-pager-link is-next">
                  <span className="eyebrow">{t('learn.next')}</span>
                  <span className="lesson-pager-title">{next.title[language]}</span>
                </Link>
              )}
            </nav>
          </footer>
        </div>
      </article>
    </LessonProvider>
  );
}
