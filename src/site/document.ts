// A page of the site as one HTML document (docs/SITE.md, "For a search engine"): its head, with
// the title, the description, the canonical address, the alternates, the Open Graph tags and the
// structured data; the app's stylesheet and icons, by the names the build gave them; one small
// script for the stored theme; and the body, drawn in `render.tsx`.

import type { Locale } from '../i18n/locale.ts';
import { APP_PATH, type SitePage } from './pages.ts';
import css from './site.css?inline';

/** Where the site is, for the addresses in its pages. */
export interface Site {
  /**
   * `https://playdacapo.com` for the official build. Null for a build that was given no address
   * of its own: its links are relative to the host, and what must be a whole address (the
   * canonical, the alternates, the structured data, the sitemap) is left out.
   */
  origin: string | null;
  /** The base path, ending in `/`. */
  base: string;
  /** The app's stylesheets, icons and theme colours: its page's own tags, as built. */
  headTags: readonly string[];
}

/** The tags of the app's built page that a page of the site shares: one look, the same icons. */
const SHARED_TAG =
  /<link\b[^>]*\brel="(?:stylesheet|icon|apple-touch-icon)"[^>]*>|<meta\b[^>]*\bname="(?:color-scheme|theme-color)"[^>]*>/g;

/**
 * The site, read from the app's page as the build wrote it (`index.html`): the stylesheet's name
 * has its content's hash in it, so it is taken from there, never guessed. A page without the
 * app's stylesheet would be bare, so that is refused.
 */
export function siteOf(appPage: string, base: string, origin: string | null): Site {
  const headTags = appPage.match(SHARED_TAG) ?? [];
  if (!headTags.some((tag) => tag.includes('rel="stylesheet"'))) {
    throw new Error('The app’s page names no stylesheet for the site’s pages to share.');
  }
  return { origin, base, headTags };
}

/** A path of the site as a link: below the base path, on the same host. */
export const href = (site: Site, path: string): string => `${site.base}${path}`;

/** A path of the site as a whole address; only where the site has one. */
export const absolute = (site: Site & { origin: string }, path: string): string =>
  `${site.origin}${site.base}${path}`;

export const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Open Graph's name for each language, as the app's page gives them. */
const OG_LOCALE: Readonly<Record<Locale, string>> = {
  en: 'en_GB',
  'zh-CN': 'zh_CN',
  'zh-TW': 'zh_TW',
  ja: 'ja_JP',
  ko: 'ko_KR',
};

/**
 * Follows the theme chosen in the app, kept as `dacapo.theme` (ui/theme.ts): `data-theme` on the
 * root forces it, and without it the stylesheet follows the system. Before the stylesheet, so the
 * page is never drawn in the other theme first.
 */
export const THEME_SCRIPT =
  '(function(){try{var t=localStorage.getItem("dacapo.theme");' +
  'if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}})()';

/** A crumb of the page's trail: its name and its path. */
export interface Crumb {
  name: string;
  path: string;
}

/** What the structured data says of the page itself, beside its trail. */
export type Thing = Readonly<Record<string, unknown>>;

/**
 * The structured data of a page (schema.org, JSON-LD): the thing itself and its trail as a
 * `BreadcrumbList`, every address whole.
 */
export function structuredData(
  site: Site & { origin: string },
  thing: Thing,
  crumbs: readonly Crumb[],
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      thing,
      {
        '@type': 'BreadcrumbList',
        itemListElement: crumbs.map((crumb, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: crumb.name,
          item: absolute(site, crumb.path),
        })),
      },
    ],
  };
}

/** The site every page is part of, for a page's structured data. */
export const partOfSite = (site: Site & { origin: string }): Thing => ({
  '@type': 'WebSite',
  name: 'dacapo',
  url: absolute(site, APP_PATH),
});

export const hasAddress = (site: Site): site is Site & { origin: string } => site.origin !== null;

/**
 * The whole document. `data` is the page's structured data, made only where the site has an
 * address; `body` is what `render.tsx` drew.
 */
export function documentOf(
  page: SitePage,
  site: Site,
  body: string,
  data: Record<string, unknown> | null,
): string {
  const title = escapeHtml(page.title);
  const description = escapeHtml(page.description);
  const head: string[] = [
    '<meta charset="UTF-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />',
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
  ];
  if (hasAddress(site)) {
    head.push(`<link rel="canonical" href="${escapeHtml(absolute(site, page.path))}" />`);
    for (const alternate of page.alternates) {
      head.push(
        `<link rel="alternate" hreflang="${escapeHtml(alternate.hreflang)}" href="${escapeHtml(
          absolute(site, alternate.path),
        )}" />`,
      );
    }
  }
  head.push('<meta name="robots" content="index, follow, max-image-preview:large" />');
  head.push(
    `<meta property="og:type" content="${page.kind === 'lesson' || page.kind === 'piece' ? 'article' : 'website'}" />`,
    '<meta property="og:site_name" content="dacapo" />',
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:locale" content="${OG_LOCALE[page.locale]}" />`,
  );
  for (const alternate of page.alternates) {
    if (alternate.hreflang === 'x-default' || alternate.hreflang === page.locale) continue;
    head.push(
      `<meta property="og:locale:alternate" content="${OG_LOCALE[alternate.hreflang as Locale]}" />`,
    );
  }
  if (hasAddress(site)) {
    head.push(
      `<meta property="og:url" content="${escapeHtml(absolute(site, page.path))}" />`,
      `<meta property="og:image" content="${escapeHtml(absolute(site, 'social-card.png'))}" />`,
      '<meta property="og:image:width" content="1200" />',
      '<meta property="og:image:height" content="630" />',
    );
  }
  head.push('<meta name="twitter:card" content="summary_large_image" />');
  head.push(`<script>${THEME_SCRIPT}</script>`);
  head.push(...site.headTags);
  head.push(`<style>${css}</style>`);
  if (data) {
    // "<" never as itself: nothing in a title or a note can end the script.
    const json = JSON.stringify(data).replace(/</g, '\\u003c');
    head.push(`<script type="application/ld+json">${json}</script>`);
  }
  return [
    '<!doctype html>',
    `<html lang="${page.locale}">`,
    '<head>',
    ...head,
    '</head>',
    '<body>',
    body,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}
