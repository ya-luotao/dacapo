// Where the site's pages are (docs/SITE.md): the lessons, the built-in pieces and a home page per
// language, as addresses below the build's base path. Plain rules, no dictionary: the app's footer
// and About use them too, and `pages.ts` makes the whole list from them.

import type { Locale } from '../i18n/locale.ts';
import { lessonLanguage } from '../learn/lessons.ts';

/** English has no prefix; the other languages are under their code in lower case. */
export const localePrefix = (locale: Locale): string =>
  locale === 'en' ? '' : `${locale.toLowerCase()}/`;

/** The home page in a language; in English it is the app itself. */
export const homePath = (locale: Locale): string => localePrefix(locale);

/**
 * The lessons as `locale` reads them: where they are not written (Japanese, Korean) the English
 * ones, not a page that repeats the English under another address.
 */
export const lessonsPath = (locale: Locale): string =>
  `${localePrefix(lessonLanguage(locale))}learn/`;

export const lessonPath = (locale: Locale, slug: string): string => `${lessonsPath(locale)}${slug}`;

export const piecesPath = (locale: Locale): string => `${localePrefix(locale)}pieces/`;

export const piecePath = (locale: Locale, id: string): string => `${piecesPath(locale)}${id}`;

/** A piece's score, engraved when the site is built: one image for its page in every language. */
export const scorePath = (id: string): string => `pieces/${id}.svg`;

/**
 * A link into the app, below the base path: the route after `#`, and `?lang=` for a page that is
 * not English, which the app takes as the visitor's language unless they have chosen one
 * (`i18n/langParam.ts`). An English page leaves it out: it is also what Japanese and Korean
 * readers are sent to, and the app then opens in the language of their browser, as `/` does.
 */
export const appPath = (locale: Locale, route = '/'): string =>
  `${locale === 'en' ? '' : `?lang=${locale}`}${route === '/' ? '' : `#${route}`}`;
