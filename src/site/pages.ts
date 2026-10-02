// The pages of the site as data (docs/SITE.md): every address, its language, the same page in the
// other languages, its title and its description. Made from the app's own lists (the lessons, the
// library, the languages), so a lesson or a piece added to the app has its pages without anyone
// adding them here. The pages themselves are drawn from this list (`render.tsx`), and so is the
// sitemap.

import { LOCALES, type Locale } from '../i18n/locale.ts';
import { EXTRAS, LESSON_LANGUAGES, LESSONS, type LessonInfo } from '../learn/lessons.ts';
import { BUILT_IN, isBuiltInId } from '../pieces/library/index.ts';
import {
  homePath,
  lessonPath,
  lessonsPath,
  localePrefix,
  piecePath,
  piecesPath,
} from './addresses.ts';
import { translator } from './words.ts';

export type PageKind = 'home' | 'lessons' | 'lesson' | 'pieces' | 'piece';

/** The same page in another language: `hreflang` is the language's code, or `x-default`. */
export interface Alternate {
  hreflang: string;
  path: string;
}

export interface SitePage {
  kind: PageKind;
  /** Its address below the site's root: `learn/staff`, `zh-cn/pieces/`, `ja/`. */
  path: string;
  locale: Locale;
  /** The lesson's slug or the piece's id; null for a list and a home page. */
  id: string | null;
  title: string;
  description: string;
  /** The page in every language it exists in, itself among them, and `x-default` (the English). */
  alternates: readonly Alternate[];
}

/** The app itself: the home page in English, and the one address of the site that is no page here. */
export const APP_PATH = '';

/** The lessons that can be opened, in their order, then the pages beside them. */
export function siteLessons(): readonly LessonInfo[] {
  return [...LESSONS, ...EXTRAS].filter((lesson) => lesson.ready);
}

/** The file a page is written to: `learn/` is `learn/index.html`, `learn/staff` is `learn/staff.html`. */
export function pageFile(path: string): string {
  return path === '' || path.endsWith('/') ? `${path}index.html` : `${path}.html`;
}

/** A page in each of `locales`, and `x-default` on the English one. */
function alternates(locales: readonly Locale[], path: (locale: Locale) => string): Alternate[] {
  return [
    ...locales.map((locale) => ({ hreflang: locale, path: path(locale) })),
    { hreflang: 'x-default', path: path('en') },
  ];
}

/** The home page in every language: `/` (the app) gives these as its own alternates too. */
export function homeAlternates(): Alternate[] {
  return alternates(LOCALES, homePath);
}

/** Every page the build writes. The app's own page (`/`) is not one of them. */
export function sitePages(): SitePage[] {
  const pages: SitePage[] = [];

  for (const locale of LOCALES) {
    if (locale === 'en') continue;
    const t = translator(locale);
    pages.push({
      kind: 'home',
      path: homePath(locale),
      locale,
      id: null,
      title: `${t('app.name')} — ${t('home.eyebrow')}`,
      description: t('home.lede'),
      alternates: homeAlternates(),
    });
  }

  for (const language of LESSON_LANGUAGES) {
    const t = translator(language);
    pages.push({
      kind: 'lessons',
      path: lessonsPath(language),
      locale: language,
      id: null,
      title: t('site.title.lessons'),
      description: t('learn.intro'),
      alternates: alternates(LESSON_LANGUAGES, lessonsPath),
    });
    for (const lesson of siteLessons()) {
      pages.push({
        kind: 'lesson',
        path: lessonPath(language, lesson.slug),
        locale: language,
        id: lesson.slug,
        title: t('site.title.lesson', { title: lesson.title[language] }),
        description: lesson.summary[language],
        alternates: alternates(LESSON_LANGUAGES, (l) => lessonPath(l, lesson.slug)),
      });
    }
  }

  for (const locale of LOCALES) {
    const t = translator(locale);
    pages.push({
      kind: 'pieces',
      path: piecesPath(locale),
      locale,
      id: null,
      title: t('site.title.pieces'),
      description: t('site.pieces.lede', { n: BUILT_IN.length }),
      alternates: alternates(LOCALES, piecesPath),
    });
    for (const piece of BUILT_IN) {
      pages.push({
        kind: 'piece',
        path: piecePath(locale, piece.id),
        locale,
        id: piece.id,
        title: t('site.title.piece', {
          title: t(`library.${piece.id}.title`),
          composer: t(`library.${piece.id}.composer`),
        }),
        description: t(`library.${piece.id}.note`),
        alternates: alternates(LOCALES, (l) => piecePath(l, piece.id)),
      });
    }
  }

  return pages;
}

/**
 * The page that stands for one of the app's routes in a language, when there is one: a link to
 * `/learn/staff` or `/pieces` inside a page leads to the page, not into the app.
 */
export function pageForRoute(locale: Locale, route: string): string | null {
  if (route === '/') return locale === 'en' ? null : homePath(locale);
  if (route === '/learn') return lessonsPath(locale);
  if (route === '/pieces') return piecesPath(locale);
  const [, section, name, ...rest] = route.split('/');
  if (name === undefined || rest.length > 0) return null;
  if (section === 'learn' && siteLessons().some((lesson) => lesson.slug === name)) {
    return lessonPath(locale, name);
  }
  if (section === 'pieces' && isBuiltInId(name)) return piecePath(locale, name);
  return null;
}

/** The language a path is in, by its prefix. */
export function localeOfPath(path: string): Locale {
  return LOCALES.find((locale) => locale !== 'en' && path.startsWith(localePrefix(locale))) ?? 'en';
}

const xml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * `sitemap.xml`: the app's page and every page of the list, each with its alternates. No dates:
 * the file is the same whenever the build is made. `url` makes a path the whole address.
 */
export function sitemap(pages: readonly SitePage[], url: (path: string) => string): string {
  const entry = (path: string, others: readonly Alternate[]) =>
    [
      '  <url>',
      `    <loc>${xml(url(path))}</loc>`,
      ...others.map(
        (a) =>
          `    <xhtml:link rel="alternate" hreflang="${xml(a.hreflang)}" href="${xml(url(a.path))}" />`,
      ),
      '  </url>',
    ].join('\n');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    entry(APP_PATH, homeAlternates()),
    ...pages.map((page) => entry(page.path, page.alternates)),
    '</urlset>',
    '',
  ].join('\n');
}
