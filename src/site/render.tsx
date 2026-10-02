// The site's pages, drawn once (docs/SITE.md): the lessons' own texts and figures, the Learn page
// and the home page as the app has them, and the library's entries, rendered to HTML inside
// stand-ins for what a page without scripts has no use for (the input, the practice store, the
// router). So what a page says cannot drift from what the app says.

import type { ComponentType, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Router, type BaseLocationHook } from 'wouter';
import type { PieceKey } from '../core/transpose.ts';
import { I18nContext, type Translate } from '../i18n/context.ts';
import { LOCALE_NAMES, type Locale } from '../i18n/locale.ts';
import { createInputSystem } from '../input/index.ts';
import {
  isExtra,
  lessonBySlug,
  LESSONS,
  neighbours,
  type LessonInfo,
  type LessonLanguage,
} from '../learn/lessons.ts';
import {
  BUILT_IN,
  builtInPiece,
  type BuiltInId,
  type BuiltInPiece,
} from '../pieces/library/index.ts';
import { BrandMark } from '../ui/BrandMark.tsx';
import { Footer } from '../ui/Footer.tsx';
import { HomePage } from '../ui/home/HomePage.tsx';
import { InputContext } from '../ui/input/context.ts';
import { LearnPage } from '../ui/learn/LearnPage.tsx';
import { LessonProvider } from '../ui/learn/kit.tsx';
import { createPieceFormat } from '../ui/pieces/format.ts';
import { keyName } from '../ui/pieces/keyFormat.ts';
import { PracticeContext } from '../ui/practice/context.ts';
import { createPracticeStore, type PracticeStore } from '../ui/practice/store.ts';
import {
  appPath,
  homePath,
  lessonPath,
  lessonsPath,
  piecePath,
  piecesPath,
  scorePath,
} from './addresses.ts';
import {
  absolute,
  documentOf,
  hasAddress,
  href,
  partOfSite,
  structuredData,
  type Crumb,
  type Site,
  type Thing,
} from './document.ts';
import { pageForRoute, type SitePage } from './pages.ts';
import { pageI18n, translator } from './words.ts';

// --- Stand-ins --------------------------------------------------------------------------------

/** The app's input, never started: no key is held, nothing sounds and nothing listens. */
const INPUT = createInputSystem();

/**
 * The practice store of someone who has never practised here, its records read: the Learn page
 * says which lesson comes first, and the home page is the first visit's.
 */
const STORE: PracticeStore = (() => {
  const store = createPracticeStore();
  const status = { state: 'saved', loaded: true, read: true, persisted: null } as const;
  return { ...store, getStatus: () => status };
})();

/**
 * A link as a page writes it: to the page that stands for the route in this language, when there
 * is one, else into the app at that route.
 */
function linkTo(site: Site, locale: Locale, route: string): string {
  return href(site, pageForRoute(locale, route) ?? appPath(locale, route));
}

const nowhere = () => undefined;

/** What the app's own components need around them, for one page in one language. */
function Around({
  site,
  locale,
  route,
  children,
}: {
  site: Site;
  locale: Locale;
  /** The app's route this page stands for. */
  route: string;
  children: ReactNode;
}) {
  // No address bar to follow: the route is given, and a link is written out, never followed.
  const hook: BaseLocationHook = Object.assign((): [string, () => void] => [route, nowhere], {
    searchHook: () => '',
  });
  return (
    <Router hook={hook} hrefs={(to: string) => linkTo(site, locale, to)}>
      <I18nContext value={pageI18n(locale)}>
        <InputContext value={INPUT}>
          <PracticeContext value={STORE}>{children}</PracticeContext>
        </InputContext>
      </I18nContext>
    </Router>
  );
}

// --- The frame of every page ------------------------------------------------------------------

function Arrow() {
  return (
    <svg className="arrow" viewBox="0 0 16 10" aria-hidden="true" focusable="false">
      <path d="M1 5h13M10 1l4 4-4 4" />
    </svg>
  );
}

/** The trail's names: the site, the list, the page. */
function crumbsOf(page: SitePage, t: Translate, name: string): Crumb[] {
  const home: Crumb = { name: t('app.name'), path: homePath(page.locale) };
  const lessons: Crumb = { name: t('site.lessons'), path: lessonsPath(page.locale) };
  const pieces: Crumb = { name: t('pieces.title'), path: piecesPath(page.locale) };
  const here: Crumb = { name, path: page.path };
  switch (page.kind) {
    case 'home':
      return [here];
    case 'lessons':
    case 'pieces':
      return [home, here];
    case 'lesson':
      return [home, lessons, here];
    case 'piece':
      return [home, pieces, here];
  }
}

/**
 * The page around its content: the brand as the way home, the lessons and the pieces, the trail,
 * the page in its other languages, and the app's own footer.
 */
function Frame({
  page,
  site,
  crumbs,
  children,
}: {
  page: SitePage;
  site: Site;
  crumbs: readonly Crumb[];
  children: ReactNode;
}) {
  const t = translator(page.locale);
  const nav: readonly { path: string; label: string; active: boolean }[] = [
    {
      path: lessonsPath(page.locale),
      label: t('site.lessons'),
      active: page.kind === 'lesson' || page.kind === 'lessons',
    },
    {
      path: piecesPath(page.locale),
      label: t('pieces.title'),
      active: page.kind === 'piece' || page.kind === 'pieces',
    },
  ];
  return (
    <div id="root">
      <header className="header">
        <div className="header-inner">
          <a href={linkTo(site, page.locale, '/')} className="brand">
            <BrandMark className="brand-mark" />
            <span className="visually-hidden">{t('app.name')}</span>
          </a>
          <nav aria-label={t('nav.label')}>
            <ul className="nav">
              {nav.map((item) => (
                <li key={item.path}>
                  <a
                    href={href(site, item.path)}
                    className={item.active ? 'nav-link is-active' : 'nav-link'}
                    aria-current={page.path === item.path ? 'page' : undefined}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main className="main" id="main">
        {crumbs.length > 1 && (
          <nav className="site-crumbs" aria-label={t('site.breadcrumb')}>
            <ol>
              {crumbs.map((crumb, i) => (
                <li key={crumb.path} aria-current={i === crumbs.length - 1 ? 'page' : undefined}>
                  {i === crumbs.length - 1 ? (
                    crumb.name
                  ) : (
                    <a href={href(site, crumb.path)}>{crumb.name}</a>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}
        {children}
        <nav className="site-languages" aria-label={t('site.languages')}>
          <ul>
            {page.alternates
              .filter((alternate) => alternate.hreflang !== 'x-default')
              .map((alternate) => {
                const locale = alternate.hreflang as Locale;
                return (
                  <li key={locale}>
                    {locale === page.locale ? (
                      <span lang={locale} aria-current="page">
                        {LOCALE_NAMES[locale]}
                      </span>
                    ) : (
                      <a
                        // The app's own page follows the visitor's language: asked for by name
                        // here, English is said.
                        href={href(site, alternate.path === '' ? '?lang=en' : alternate.path)}
                        hrefLang={locale}
                        lang={locale}
                      >
                        {LOCALE_NAMES[locale]}
                      </a>
                    )}
                  </li>
                );
              })}
          </ul>
        </nav>
      </main>
      <Footer />
    </div>
  );
}

/** The whole document of a page: its frame and content drawn, its head written. */
function finish(
  page: SitePage,
  site: Site,
  route: string,
  crumbs: readonly Crumb[],
  thing: (site: Site & { origin: string }) => Thing,
  content: ReactNode,
): string {
  const body = renderToStaticMarkup(
    <Around site={site} locale={page.locale} route={route}>
      <Frame page={page} site={site} crumbs={crumbs}>
        {content}
      </Frame>
    </Around>,
  );
  const data = hasAddress(site) ? structuredData(site, thing(site), crumbs) : null;
  return documentOf(page, site, body, data);
}

// --- The home page and the lessons ------------------------------------------------------------

function renderHome(page: SitePage, site: Site): string {
  const t = translator(page.locale);
  return finish(
    page,
    site,
    '/',
    crumbsOf(page, t, t('app.name')),
    (at) => ({
      '@type': 'WebSite',
      name: t('app.name'),
      url: absolute(at, page.path),
      description: page.description,
      inLanguage: page.locale,
    }),
    <HomePage />,
  );
}

function renderLessons(page: SitePage, site: Site): string {
  const t = translator(page.locale);
  return finish(
    page,
    site,
    '/learn',
    crumbsOf(page, t, t('site.lessons')),
    (at) => ({
      '@type': 'CollectionPage',
      name: t('learn.title'),
      url: absolute(at, page.path),
      description: page.description,
      inLanguage: page.locale,
      isPartOf: partOfSite(at),
    }),
    <LearnPage />,
  );
}

/** Each lesson's text, per language: the modules the app loads when a lesson is opened. */
const TEXTS = import.meta.glob<{ default: ComponentType }>('../ui/learn/lessons/*.tsx', {
  eager: true,
});

/** The component of a lesson's text; a lesson in the list without one is a mistake in the build. */
export function lessonText(slug: string, language: LessonLanguage): ComponentType {
  const text = TEXTS[`../ui/learn/lessons/${slug}.${language}.tsx`]?.default;
  if (!text) throw new Error(`The lesson ${slug} has no text in ${language}.`);
  return text;
}

const ENTITIES: Readonly<Record<string, string>> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#x27;': "'",
};

/** The sections of a lesson as drawn: the `h2` of each `Section`, its id and its words. */
export function headingsOf(html: string): { id: string; title: string }[] {
  return [...html.matchAll(/<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g)].map((match) => ({
    id: match[1]!,
    title: match[2]!
      .replace(/<[^>]+>/g, '')
      .replace(/&(?:amp|lt|gt|quot|#x27);/g, (entity) => ENTITIES[entity]!),
  }));
}

/**
 * A lesson as the app shows it when it opens: its text and its figures, drawn once without their
 * controls, a line in place of each exercise.
 */
export function lessonBody(site: Site, slug: string, language: LessonLanguage): string {
  const Text = lessonText(slug, language);
  return renderToStaticMarkup(
    <Around site={site} locale={language} route={`/learn/${slug}`}>
      <LessonProvider slug={slug} language={language} staticPage>
        <Text />
      </LessonProvider>
    </Around>,
  );
}

function OpenInApp({
  site,
  locale,
  route,
  label,
  note,
  large = false,
}: {
  site: Site;
  locale: Locale;
  route: string;
  label: string;
  note?: string;
  large?: boolean;
}) {
  return (
    <div className="site-open">
      <a
        href={href(site, appPath(locale, route))}
        className={large ? 'button button-primary button-large' : 'button button-primary'}
      >
        {label}
        <Arrow />
      </a>
      {note && <p className="help">{note}</p>}
    </div>
  );
}

function renderLesson(page: SitePage, site: Site, lesson: LessonInfo): string {
  const language = page.locale as LessonLanguage;
  const t = translator(language);
  const body = lessonBody(site, lesson.slug, language);
  const headings = headingsOf(body);
  const number = LESSONS.indexOf(lesson) + 1;
  const { previous, next } = neighbours(lesson.slug);
  const title = lesson.title[language];
  const lessonLink = (to: LessonInfo) => href(site, lessonPath(language, to.slug));
  const open = (
    <OpenInApp
      site={site}
      locale={language}
      route={`/learn/${lesson.slug}`}
      label={t('site.lesson.open')}
    />
  );
  return finish(
    page,
    site,
    `/learn/${lesson.slug}`,
    crumbsOf(page, t, title),
    (at) => ({
      '@type': 'LearningResource',
      name: title,
      description: lesson.summary[language],
      url: absolute(at, page.path),
      inLanguage: language,
      learningResourceType: 'lesson',
      educationalLevel: 'beginner',
      timeRequired: `PT${lesson.minutes}M`,
      isAccessibleForFree: true,
      isPartOf: partOfSite(at),
    }),
    <article className="lesson" lang={language}>
      <aside className="lesson-rail">
        <a href={href(site, lessonsPath(language))} className="lesson-back">
          <svg viewBox="0 0 6 10" aria-hidden="true">
            <path d="M5 1L1 5l4 4" />
          </svg>
          {t('learn.all')}
        </a>
        {headings.length > 0 && (
          <nav className="lesson-toc" aria-label={t('learn.contents')}>
            <p className="eyebrow">{t('learn.contents')}</p>
            <ol>
              {headings.map((heading) => (
                <li key={heading.id}>
                  <a href={`#${heading.id}`}>{heading.title}</a>
                </li>
              ))}
            </ol>
          </nav>
        )}
      </aside>

      <div className="lesson-main">
        <header className="lesson-head">
          <p className="eyebrow">
            {isExtra(lesson.slug) ? t('learn.extra') : t('learn.lesson', { n: number })} ·{' '}
            {t('learn.minutes', { n: lesson.minutes })}
          </p>
          <h1>{title}</h1>
          <p className="lesson-lede">{lesson.summary[language]}</p>
          <OpenInApp
            site={site}
            locale={language}
            route={`/learn/${lesson.slug}`}
            label={t('site.lesson.open')}
            note={t('site.lesson.note')}
          />
        </header>

        <div className="lesson-body" dangerouslySetInnerHTML={{ __html: body }} />

        <footer className="lesson-end">
          {open}
          <nav className="lesson-pager" aria-label={t('learn.all')}>
            {previous ? (
              <a href={lessonLink(previous)} className="lesson-pager-link">
                <span className="eyebrow">{t('learn.previous')}</span>
                <span className="lesson-pager-title">{previous.title[language]}</span>
              </a>
            ) : (
              <span />
            )}
            {next && (
              <a href={lessonLink(next)} className="lesson-pager-link is-next">
                <span className="eyebrow">{t('learn.next')}</span>
                <span className="lesson-pager-title">{next.title[language]}</span>
              </a>
            )}
          </nav>
        </footer>
      </div>
    </article>,
  );
}

// --- The pieces -------------------------------------------------------------------------------

/** What a piece's page says of its score, read from the file when the site is built. */
export interface PieceSheet {
  /** Written bars. */
  bars: number;
  key: PieceKey;
  /** Its time signatures in the order they first appear: `3/4`. */
  times: readonly string[];
  /** The file carries its edition's fingering. */
  fingering: boolean;
  /** The engraved score's size in CSS pixels. */
  image: { width: number; height: number };
}

export type PieceSheets = ReadonlyMap<BuiltInId, PieceSheet>;

function sheetOf(sheets: PieceSheets, id: BuiltInId): PieceSheet {
  const sheet = sheets.get(id);
  if (!sheet) throw new Error(`The piece ${id} has no score to show.`);
  return sheet;
}

function renderPieces(page: SitePage, site: Site): string {
  const t = translator(page.locale);
  const level = createPieceFormat(t, page.locale, []).level;
  const pieces = BUILT_IN.filter((piece) => !piece.leadSheet);
  const leadSheets = BUILT_IN.filter((piece) => piece.leadSheet).sort((a, b) => a.level - b.level);
  const levels = [...new Set(pieces.map((piece) => piece.level))].sort((a, b) => a - b);
  // The library's own list (ui/pieces/Library.tsx), each piece leading to its page.
  const group = (
    id: string,
    label: string,
    list: readonly BuiltInPiece[],
    help: string | null,
    eachLevel: boolean,
  ) => (
    <section key={id} className="library-level" aria-labelledby={id}>
      <h2 id={id} className="library-level-name">
        {label}
      </h2>
      <div>
        {help && <p className="library-level-help">{help}</p>}
        <ul className="library-list">
          {list.map((piece) => (
            <li key={piece.id}>
              <a href={href(site, piecePath(page.locale, piece.id))} className="library-piece">
                <span className="library-piece-title">{t(`library.${piece.id}.title`)}</span>{' '}
                <span className="library-piece-composer">{t(`library.${piece.id}.composer`)}</span>{' '}
                <span className="library-piece-style">
                  {eachLevel && `${level(piece.level)} · `}
                  {t(`library.${piece.id}.style`)}
                </span>{' '}
                <span className="library-piece-note">{t(`library.${piece.id}.note`)}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
  return finish(
    page,
    site,
    '/pieces',
    crumbsOf(page, t, t('pieces.title')),
    (at) => ({
      '@type': 'CollectionPage',
      name: t('pieces.title'),
      url: absolute(at, page.path),
      description: page.description,
      inLanguage: page.locale,
      isPartOf: partOfSite(at),
    }),
    <section className="site-pieces">
      <h1>{t('pieces.title')}</h1>
      <p className="learn-lede">{page.description}</p>
      <div className="library">
        {levels.map((n) =>
          group(
            `level-${n}`,
            level(n),
            pieces.filter((piece) => piece.level === n),
            null,
            false,
          ),
        )}
        {leadSheets.length > 0 &&
          group(
            'lead-sheets',
            t('pieces.leadSheets'),
            leadSheets,
            t('pieces.leadSheets.help'),
            true,
          )}
        <p className="help library-help">{t('pieces.levels.help')}</p>
      </div>
    </section>,
  );
}

function renderPiece(page: SitePage, site: Site, piece: BuiltInPiece, sheet: PieceSheet): string {
  const t = translator(page.locale);
  const title = t(`library.${piece.id}.title`);
  const composer = t(`library.${piece.id}.composer`);
  const style = t(`library.${piece.id}.style`);
  const level = createPieceFormat(t, page.locale, []).level(piece.level);
  const key = keyName(t, sheet.key);
  const time = sheet.times.join(t('app.listSeparator'));
  const image = href(site, scorePath(piece.id));
  const route = `/pieces/${piece.id}`;
  // A fact of the piece: its name, and what it is. `lang` where the words are the edition's own.
  const fact = (name: string, value: ReactNode, lang?: string) => (
    <div>
      <dt>{name}</dt>
      <dd lang={lang}>{value}</dd>
    </div>
  );
  return finish(
    page,
    site,
    route,
    crumbsOf(page, t, title),
    (at) => ({
      '@type': 'MusicComposition',
      name: title,
      description: page.description,
      url: absolute(at, page.path),
      // A tune handed down has no composer to name.
      ...(piece.composer.startsWith('Traditional')
        ? {}
        : { composer: { '@type': 'Person', name: composer } }),
      musicalKey: key,
      image: absolute(at, scorePath(piece.id)),
      isAccessibleForFree: true,
      isPartOf: partOfSite(at),
    }),
    <article className="site-piece">
      <header>
        <p className="eyebrow">{level}</p>
        <h1>{title}</h1>
        <p className="site-piece-composer">{composer}</p>
        <p className="lesson-lede">{t(`library.${piece.id}.note`)}</p>
        {piece.leadSheet && <p className="site-piece-lead">{t('site.piece.leadSheet')}</p>}
        <OpenInApp
          site={site}
          locale={page.locale}
          route={route}
          label={t('site.piece.practise')}
          note={t('site.piece.note')}
          large
        />
      </header>

      <section aria-labelledby="score">
        <h2 id="score">{t('site.piece.score')}</h2>
        <figure className="site-score">
          <div className="site-score-sheet">
            <img
              src={image}
              alt={t('site.piece.score.alt', { title, bars: sheet.bars, key, time })}
              width={sheet.image.width}
              height={sheet.image.height}
            />
          </div>
          <figcaption>
            <a href={image}>{t('site.piece.score.open')}</a>
          </figcaption>
        </figure>
      </section>

      <section aria-labelledby="origin">
        <h2 id="origin">{t('site.piece.origin')}</h2>
        <dl className="site-facts">
          {fact(t('site.piece.composer'), composer)}
          {fact(t('site.piece.work'), piece.work, 'en')}
          {fact(t('site.piece.grade'), level)}
          {fact(t('site.piece.style'), style)}
          {fact(t('site.piece.bars'), sheet.bars)}
          {fact(t('pieces.key'), key)}
          {fact(t('metronome.meter'), time)}
          {fact(
            t('site.piece.fingering'),
            sheet.fingering ? t('site.piece.fingering.printed') : t('site.piece.fingering.none'),
          )}
          {fact(t('site.piece.source'), <a href={piece.sourceUrl}>{piece.source}</a>, 'en')}
          {fact(t('site.piece.encoder'), piece.encoder, 'en')}
          {fact(t('site.piece.licence'), piece.licence, 'en')}
        </dl>
      </section>

      <OpenInApp site={site} locale={page.locale} route={route} label={t('site.piece.practise')} />
    </article>,
  );
}

// --- Every page -------------------------------------------------------------------------------

/** The document of one page of the list. Throws when it cannot be drawn: no page is left out. */
export function renderPage(page: SitePage, site: Site, sheets: PieceSheets): string {
  switch (page.kind) {
    case 'home':
      return renderHome(page, site);
    case 'lessons':
      return renderLessons(page, site);
    case 'lesson': {
      const lesson = lessonBySlug(page.id ?? '');
      if (!lesson) throw new Error(`No lesson for the page ${page.path}.`);
      return renderLesson(page, site, lesson);
    }
    case 'pieces':
      return renderPieces(page, site);
    case 'piece': {
      const piece = builtInPiece(page.id ?? '');
      if (!piece) throw new Error(`No piece for the page ${page.path}.`);
      return renderPiece(page, site, piece, sheetOf(sheets, piece.id));
    }
  }
}
