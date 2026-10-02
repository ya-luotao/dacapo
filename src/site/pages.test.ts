import { describe, expect, it } from 'vitest';
import appPage from '../../index.html?raw';
import config from '../../vite.config.ts?raw';
import embed from '../../apple/scripts/embed-web.sh?raw';
import { RESERVED_USERNAMES, USERNAME_MAX, USERNAME_MIN } from '../core/profile.ts';
import { LOCALES, type Locale } from '../i18n/locale.ts';
import { EXTRAS, LESSON_LANGUAGES, LESSONS } from '../learn/lessons.ts';
import { groupOf } from '../offline/files.ts';
import { BUILT_IN } from '../pieces/library/index.ts';
import { appPath, localePrefix, scorePath } from './addresses.ts';
import {
  APP_PATH,
  homeAlternates,
  localeOfPath,
  pageFile,
  pageForRoute,
  siteLessons,
  sitemap,
  sitePages,
  type SitePage,
} from './pages.ts';

// The list of the site's pages (docs/SITE.md): made from the app's own lists, so these hold for
// whatever lesson, piece or language is added later.

const pages = sitePages();
const at = (path: string) => pages.filter((page) => page.path === path);
const byKind = (kind: SitePage['kind'], locale?: Locale) =>
  pages.filter((page) => page.kind === kind && (locale === undefined || page.locale === locale));

describe('the pages', () => {
  it('have every lesson in every language the lessons are written in, once', () => {
    const lessons = [...LESSONS, ...EXTRAS].filter((lesson) => lesson.ready);
    expect(lessons.length).toBeGreaterThanOrEqual(16);
    expect(siteLessons()).toEqual(lessons);
    for (const language of LESSON_LANGUAGES) {
      expect(at(`${localePrefix(language)}learn/`)).toHaveLength(1);
      for (const lesson of lessons) {
        const found = at(`${localePrefix(language)}learn/${lesson.slug}`);
        expect(found, `${language} ${lesson.slug}`).toHaveLength(1);
        expect(found[0]).toMatchObject({ kind: 'lesson', locale: language, id: lesson.slug });
      }
    }
    expect(byKind('lesson')).toHaveLength(lessons.length * LESSON_LANGUAGES.length);
    expect(byKind('lessons')).toHaveLength(LESSON_LANGUAGES.length);
  });

  it('have every built-in piece in each of the five languages, once', () => {
    for (const locale of LOCALES) {
      expect(at(`${localePrefix(locale)}pieces/`)).toHaveLength(1);
      for (const piece of BUILT_IN) {
        const found = at(`${localePrefix(locale)}pieces/${piece.id}`);
        expect(found, `${locale} ${piece.id}`).toHaveLength(1);
        expect(found[0]).toMatchObject({ kind: 'piece', locale, id: piece.id });
      }
    }
    expect(byKind('piece')).toHaveLength(BUILT_IN.length * LOCALES.length);
    expect(byKind('pieces')).toHaveLength(LOCALES.length);
  });

  it('have a home page in every language but English, whose home is the app', () => {
    expect(byKind('home').map((page) => page.path)).toEqual(['zh-cn/', 'zh-tw/', 'ja/', 'ko/']);
    expect(at(APP_PATH)).toEqual([]);
  });

  it('are nothing else', () => {
    expect(pages).toHaveLength(
      LOCALES.length -
        1 +
        (siteLessons().length + 1) * LESSON_LANGUAGES.length +
        (BUILT_IN.length + 1) * LOCALES.length,
    );
  });

  it('have addresses in lower case, each its own, in the language of its prefix', () => {
    const paths = pages.map((page) => page.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const page of pages) {
      expect(page.path, page.path).toMatch(/^[a-z0-9-]+(\/[a-z0-9-]+)*\/?$/);
      expect(localeOfPath(page.path), page.path).toBe(page.locale);
    }
    // English has no prefix.
    expect(at('learn/staff')[0]?.locale).toBe('en');
    expect(at('zh-tw/learn/staff')[0]?.locale).toBe('zh-TW');
  });

  it('are files that take no other page’s address', () => {
    const files = pages.map((page) => pageFile(page.path));
    expect(new Set(files).size).toBe(files.length);
    expect(pageFile('learn/')).toBe('learn/index.html');
    expect(pageFile('learn/staff')).toBe('learn/staff.html');
    expect(pageFile('ja/')).toBe('ja/index.html');
    // `x.html` and `x/index.html` are one address to the host.
    const addresses = files.map((file) => file.replace(/(\/index)?\.html$/, ''));
    expect(new Set(addresses).size).toBe(addresses.length);
    expect(files).not.toContain('index.html');
  });

  it('have alternates that name each other, and x-default on the English one', () => {
    const known = new Set([APP_PATH, ...pages.map((page) => page.path)]);
    for (const page of pages) {
      const own = page.alternates.find((a) => a.hreflang === page.locale);
      expect(own?.path, page.path).toBe(page.path);
      const fallback = page.alternates.find((a) => a.hreflang === 'x-default');
      expect(fallback?.path, page.path).toBe(
        page.alternates.find((a) => a.hreflang === 'en')?.path,
      );
      const codes = page.alternates.map((a) => a.hreflang);
      expect(new Set(codes).size, page.path).toBe(codes.length);
      for (const alternate of page.alternates) {
        expect(known.has(alternate.path), `${page.path} → ${alternate.path}`).toBe(true);
        if (alternate.path === APP_PATH) continue;
        // The page it names is of that language, and names the same pages back.
        const other = at(alternate.path)[0]!;
        expect(other.alternates, `${page.path} ↔ ${other.path}`).toEqual(page.alternates);
        if (alternate.hreflang !== 'x-default') expect(other.locale).toBe(alternate.hreflang);
      }
    }
  });

  it('exist in the languages their text does: a lesson in three, a piece and a home in five', () => {
    const codes = (page: SitePage) => page.alternates.map((a) => a.hreflang);
    expect(codes(at('learn/staff')[0]!)).toEqual(['en', 'zh-CN', 'zh-TW', 'x-default']);
    expect(codes(at('ja/pieces/bach-prelude-in-c')[0]!)).toEqual([...LOCALES, 'x-default']);
    expect(codes(at('ko/')[0]!)).toEqual([...LOCALES, 'x-default']);
    expect(homeAlternates().map((a) => a.path)).toEqual(['', 'zh-cn/', 'zh-tw/', 'ja/', 'ko/', '']);
  });

  it('have a title and a description of their own in their language, of a sensible length', () => {
    for (const locale of LOCALES) {
      const inLocale = pages.filter((page) => page.locale === locale);
      const titles = inLocale.map((page) => page.title);
      const descriptions = inLocale.map((page) => page.description);
      expect(new Set(titles).size, `${locale} titles`).toBe(titles.length);
      expect(new Set(descriptions).size, `${locale} descriptions`).toBe(descriptions.length);
      for (const page of inLocale) {
        expect(page.title.trim(), page.path).toBe(page.title);
        expect(page.title, page.path).not.toMatch(/[{}]/);
        expect(page.description, page.path).not.toMatch(/[{}]/);
        expect(page.title.length, `${page.path}: ${page.title}`).toBeGreaterThanOrEqual(12);
        expect(page.title.length, `${page.path}: ${page.title}`).toBeLessThanOrEqual(90);
        expect(page.description.length, `${page.path}: ${page.description}`).toBeGreaterThan(15);
        expect(page.description.length, `${page.path}: ${page.description}`).toBeLessThan(320);
        expect(page.title, page.path).toContain('dacapo');
      }
    }
  });
});

describe('the sitemap', () => {
  const url = (path: string) => `https://playdacapo.com/${path}`;
  const text = sitemap(pages, url);
  const locs = [...text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]!);

  it('lists the app’s page and exactly the pages, each once', () => {
    expect(locs).toEqual([url(APP_PATH), ...pages.map((page) => url(page.path))]);
    expect(new Set(locs).size).toBe(locs.length);
  });

  it('is a sitemap by the protocol’s rules: whole addresses, escaped, under the limits', () => {
    expect(text.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset ')).toBe(true);
    expect(text).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(text).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(text.trimEnd().endsWith('</urlset>')).toBe(true);
    expect(locs.length).toBeLessThanOrEqual(50_000);
    expect(new TextEncoder().encode(text).length).toBeLessThan(50 * 1024 * 1024);
    for (const loc of locs) {
      expect(loc).toMatch(/^https:\/\/playdacapo\.com\/[a-z0-9/-]*$/);
      expect(loc.length).toBeLessThan(2048);
    }
    // Every element is closed, and nothing is outside the protocol and the alternates.
    expect(text.match(/<url>/g)).toHaveLength(locs.length);
    expect(text.match(/<\/url>/g)).toHaveLength(locs.length);
    const elements = new Set([...text.matchAll(/<([a-z:]+)[ >]/g)].map((match) => match[1]));
    expect([...elements].sort()).toEqual(['loc', 'url', 'urlset', 'xhtml:link']);
  });

  it('gives each page its alternates, and no date', () => {
    const entry = text
      .split('<url>')
      .find((part) => part.includes('<loc>https://playdacapo.com/learn/staff</loc>'))!;
    expect(
      [...entry.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]]),
    ).toEqual([
      ['en', 'https://playdacapo.com/learn/staff'],
      ['zh-CN', 'https://playdacapo.com/zh-cn/learn/staff'],
      ['zh-TW', 'https://playdacapo.com/zh-tw/learn/staff'],
      ['x-default', 'https://playdacapo.com/learn/staff'],
    ]);
    expect(text).not.toMatch(/lastmod|changefreq|priority|\d{4}-\d{2}-\d{2}/);
  });

  it('escapes what an address may hold', () => {
    expect(sitemap([], () => 'https://example.org/?a=1&b="2"')).toContain(
      '<loc>https://example.org/?a=1&amp;b=&quot;2&quot;</loc>',
    );
  });
});

describe('the app’s side', () => {
  it('names the home pages as its alternates, as the list has them', () => {
    const named = [
      ...appPage.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)" \/>/g),
    ];
    expect(named.map((match) => [match[1], match[2]])).toEqual(
      homeAlternates().map((a) => [a.hreflang, `https://playdacapo.com/${a.path}`]),
    );
  });

  it('opens from a page in the page’s language, and from an English one in the visitor’s', () => {
    expect(appPath('zh-TW', '/learn/staff')).toBe('?lang=zh-TW#/learn/staff');
    expect(appPath('ja', '/start')).toBe('?lang=ja#/start');
    expect(appPath('ko')).toBe('?lang=ko');
    expect(appPath('en', '/pieces/bach-prelude-in-c')).toBe('#/pieces/bach-prelude-in-c');
    expect(appPath('en')).toBe('');
  });

  it('has a page for the routes the site covers, in the reader’s language', () => {
    expect(pageForRoute('en', '/learn')).toBe('learn/');
    expect(pageForRoute('zh-CN', '/learn/staff')).toBe('zh-cn/learn/staff');
    expect(pageForRoute('zh-TW', '/pieces/bach-prelude-in-c')).toBe(
      'zh-tw/pieces/bach-prelude-in-c',
    );
    // Japanese and Korean read the English lessons, and their own pieces.
    expect(pageForRoute('ja', '/learn')).toBe('learn/');
    expect(pageForRoute('ko', '/learn/inside')).toBe('learn/inside');
    expect(pageForRoute('ja', '/pieces')).toBe('ja/pieces/');
    expect(pageForRoute('ja', '/')).toBe('ja/');
    // The rest is the app's.
    expect(pageForRoute('en', '/')).toBeNull();
    expect(pageForRoute('en', '/read')).toBeNull();
    expect(pageForRoute('en', '/learn/no-such-lesson')).toBeNull();
    expect(pageForRoute('en', '/pieces/imported-piece')).toBeNull();
    expect(pageForRoute('en', '/pieces/bach-prelude-in-c/more')).toBeNull();
  });
});

describe('what the pages must not disturb', () => {
  const files = [
    ...pages.map((page) => pageFile(page.path)),
    ...BUILT_IN.map((piece) => scorePath(piece.id)),
    'sitemap.xml',
  ];

  it('the offline worker: none of the site’s files is in its list (docs/OFFLINE.md)', () => {
    for (const file of files) expect(groupOf(file), file).toBeNull();
    // The lessons' pictures live beside the lessons' pages, and stay the worker's.
    expect(groupOf('learn/two-hands.webp')).toBe('pictures');
  });

  it('the offline worker: the pages are written before its list is taken', () => {
    // `writeBundle` comes before `closeBundle`, where the worker's list is made.
    expect(config).toMatch(/plugins: \[[^\]]*\bsitePages\(\), offlineWorker\(\)/);
    expect(config).toMatch(/name: 'dacapo:site-pages',[\s\S]*?async writeBundle\(/);
    expect(config).toMatch(/name: 'dacapo:offline-worker',[\s\S]*?async closeBundle\(/);
  });

  it('usernames: nobody can take a name the site has an address at (docs/PROFILE.md)', () => {
    const first = new Set(files.map((file) => file.split('/')[0]!.replace(/\.[a-z]+$/, '')));
    expect([...first].sort()).toEqual(['ja', 'ko', 'learn', 'pieces', 'sitemap', 'zh-cn', 'zh-tw']);
    for (const name of first) {
      // Shorter than a username can be, or kept from everyone.
      const possible = name.length >= USERNAME_MIN && name.length <= USERNAME_MAX;
      if (possible) expect(RESERVED_USERNAMES.has(name), name).toBe(true);
    }
  });

  it('the Apple app: its bundle leaves every file of the site out, and keeps the pictures', () => {
    const line = embed.split('\n').find((l) => l.startsWith('rsync '))!;
    const rules = [...line.matchAll(/--(include|exclude) (?:'([^']+)'|(\S+))/g)].map((match) => ({
      keep: match[1] === 'include',
      pattern: (match[2] ?? match[3])!,
    }));
    // rsync's first matching rule decides; a pattern with a leading "/" is anchored at the root,
    // one ending in "/" is a directory with all that is in it, "*" stops at a "/".
    const matches = (pattern: string, file: string) => {
      const anchored = pattern.startsWith('/');
      const body = pattern.replace(/^\//, '');
      if (body.endsWith('/')) return anchored && file.startsWith(body);
      const expr = body.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
      return new RegExp(anchored ? `^${expr}$` : `(^|/)${expr}$`).test(file);
    };
    const kept = (file: string) => rules.find((rule) => matches(rule.pattern, file))?.keep ?? true;
    for (const file of files) expect(kept(file), file).toBe(false);
    for (const file of [
      'index.html',
      'learn/two-hands.webp',
      'assets/index-AAAA.js',
      'robots.txt',
    ]) {
      expect(kept(file), file).toBe(true);
    }
    expect(kept('sw.js')).toBe(false);
    expect(kept('_headers')).toBe(false);
  });
});
