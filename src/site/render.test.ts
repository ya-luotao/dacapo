// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { LESSONS } from '../learn/lessons.ts';
import { BUILT_IN } from '../pieces/library/index.ts';
import themeSource from '../ui/theme.ts?raw';
import { appPath, scorePath } from './addresses.ts';
import { siteOf, THEME_SCRIPT } from './document.ts';
import { renderSite, type SiteFile } from './main.ts';
import { APP_PATH, pageFile, sitemap, sitePages, type SitePage } from './pages.ts';
import { headingsOf } from './render.tsx';
import { translator } from './words.ts';

// Every page of the site, drawn as the build draws it (docs/SITE.md): whole documents that read
// without scripts and without the stylesheet, each with its head for a search engine, and the
// same bytes from the same sources.

/** The app's page as a build writes it, as far as the site reads it. */
const APP_PAGE = [
  '<!doctype html><html lang="en"><head>',
  '<meta name="color-scheme" content="light dark" />',
  '<meta name="theme-color" media="(prefers-color-scheme: light)" content="#f8f4ec" />',
  '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />',
  '<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />',
  '<link rel="manifest" href="/manifest.webmanifest" />',
  '<script type="module" crossorigin src="/assets/index-AAAA.js"></script>',
  '<link rel="stylesheet" crossorigin href="/assets/index-BBBB.css">',
  '</head><body><div id="root"></div></body></html>',
].join('\n');

const ORIGIN = 'https://playdacapo.com';
const parseXml = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');
const render = (origin: string | null) => renderSite({ appPage: APP_PAGE, origin, parseXml });

const pages = sitePages();
let files: SiteFile[] = [];
let byPath = new Map<string, string>();
const documents = new Map<string, Document>();

/** The page as a browser reads it. */
function read(page: SitePage): Document {
  let doc = documents.get(page.path);
  if (!doc) {
    doc = new DOMParser().parseFromString(byPath.get(pageFile(page.path))!, 'text/html');
    documents.set(page.path, doc);
  }
  return doc;
}

const all = <T extends Element = Element>(doc: ParentNode, selector: string) => [
  ...doc.querySelectorAll<T>(selector),
];

// The whole site is drawn and read once, which takes a few seconds on a busy machine.
vi.setConfig({ testTimeout: 60_000 });

beforeAll(async () => {
  files = await render(ORIGIN);
  byPath = new Map(files.map((file) => [file.path, file.content]));
  for (const page of pages) read(page);
}, 180_000);

describe('the site', () => {
  it('is a file for every page, a score for every piece, and the sitemap', () => {
    expect(files.map((file) => file.path).sort()).toEqual(
      [
        ...pages.map((page) => pageFile(page.path)),
        ...BUILT_IN.map((piece) => scorePath(piece.id)),
        'sitemap.xml',
      ].sort(),
    );
    expect(byPath.get('sitemap.xml')).toBe(sitemap(pages, (path) => `${ORIGIN}/${path}`));
  });

  it('is the same, byte for byte, when it is made again', async () => {
    const again = await render(ORIGIN);
    expect(again.map((file) => file.path)).toEqual(files.map((file) => file.path));
    for (const [i, file] of again.entries()) {
      expect(file.content === files[i]!.content, file.path).toBe(true);
    }
  }, 180_000);

  it('has no date and no time in it', () => {
    const year = String(new Date().getFullYear());
    for (const page of pages) {
      const html = byPath.get(pageFile(page.path))!;
      expect(html.includes(`${year}-`), page.path).toBe(false);
    }
  });

  it('follows the theme kept by the app, under the name the app keeps it by', () => {
    expect(themeSource).toContain("const STORAGE_KEY = 'dacapo.theme';");
    expect(THEME_SCRIPT).toContain('localStorage.getItem("dacapo.theme")');
  });

  it('refuses an app page that names no stylesheet', () => {
    expect(() => siteOf('<html><head></head></html>', '/', null)).toThrow(/stylesheet/);
  });
});

describe('every page', () => {
  it('is a whole document in its language, with one title, one h1 and the app’s stylesheet', () => {
    for (const page of pages) {
      const html = byPath.get(pageFile(page.path))!;
      expect(html.startsWith('<!doctype html>\n<html lang="'), page.path).toBe(true);
      const doc = read(page);
      expect(doc.documentElement.lang, page.path).toBe(page.locale);
      expect(doc.querySelector('meta[charset]')?.getAttribute('charset')).toBe('UTF-8');
      expect(doc.querySelector('meta[name="viewport"]')?.getAttribute('content')).toContain(
        'width=device-width',
      );
      expect(all(doc, 'title'), page.path).toHaveLength(1);
      expect(doc.title, page.path).toBe(page.title);
      expect(all(doc, 'h1'), page.path).toHaveLength(1);
      expect(all(doc, 'h1')[0]!.textContent.trim().length, page.path).toBeGreaterThan(0);
      expect(
        all(doc, 'link[rel="stylesheet"]').map((link) => link.getAttribute('href')),
        page.path,
      ).toEqual(['/assets/index-BBBB.css']);
      expect(doc.querySelector('link[rel="icon"]')?.getAttribute('href')).toBe('/favicon.svg');
      expect(doc.querySelector('main#main'), page.path).not.toBeNull();
      expect(doc.querySelector('header .brand'), page.path).not.toBeNull();
      expect(doc.querySelector('footer.footer'), page.path).not.toBeNull();
    }
  });

  it('says what it is to a search engine: description, canonical, alternates, Open Graph', () => {
    for (const page of pages) {
      const doc = read(page);
      const meta = (selector: string) => doc.querySelector(selector)?.getAttribute('content');
      expect(meta('meta[name="description"]'), page.path).toBe(page.description);
      expect(all(doc, 'link[rel="canonical"]'), page.path).toHaveLength(1);
      expect(doc.querySelector('link[rel="canonical"]')?.getAttribute('href'), page.path).toBe(
        `${ORIGIN}/${page.path}`,
      );
      expect(
        all(doc, 'link[rel="alternate"]').map((link) => [
          link.getAttribute('hreflang'),
          link.getAttribute('href'),
        ]),
        page.path,
      ).toEqual(page.alternates.map((a) => [a.hreflang, `${ORIGIN}/${a.path}`]));
      expect(meta('meta[name="robots"]'), page.path).toContain('index');
      expect(meta('meta[property="og:title"]'), page.path).toBe(page.title);
      expect(meta('meta[property="og:description"]'), page.path).toBe(page.description);
      expect(meta('meta[property="og:url"]'), page.path).toBe(`${ORIGIN}/${page.path}`);
      expect(meta('meta[property="og:site_name"]'), page.path).toBe('dacapo');
      expect(meta('meta[property="og:locale"]'), page.path).toMatch(/^[a-z]{2}_[A-Z]{2}$/);
      expect(meta('meta[property="og:image"]'), page.path).toBe(`${ORIGIN}/social-card.png`);
      expect(meta('meta[name="twitter:card"]'), page.path).toBe('summary_large_image');
    }
  });

  it('carries structured data that parses: the thing itself, and its trail', () => {
    const KIND = {
      home: 'WebSite',
      lessons: 'CollectionPage',
      lesson: 'LearningResource',
      pieces: 'CollectionPage',
      piece: 'MusicComposition',
    } as const;
    for (const page of pages) {
      const scripts = all(read(page), 'script[type="application/ld+json"]');
      expect(scripts, page.path).toHaveLength(1);
      const data = JSON.parse(scripts[0]!.textContent) as {
        '@context': string;
        '@graph': Record<string, unknown>[];
      };
      expect(data['@context']).toBe('https://schema.org');
      const [thing, trail] = data['@graph'] as [Record<string, unknown>, Record<string, unknown>];
      expect(data['@graph']).toHaveLength(2);
      expect(thing['@type'], page.path).toBe(KIND[page.kind]);
      expect(thing.url, page.path).toBe(`${ORIGIN}/${page.path}`);
      expect(typeof thing.name === 'string' && thing.name.length > 0, page.path).toBe(true);
      expect(thing.description, page.path).toBe(page.description);
      if (page.kind === 'lesson') {
        expect(thing.inLanguage).toBe(page.locale);
        expect(thing.timeRequired, page.path).toMatch(/^PT\d+M$/);
        expect(thing.isAccessibleForFree).toBe(true);
      }
      if (page.kind === 'piece') {
        expect(thing.image, page.path).toBe(`${ORIGIN}/${scorePath(page.id!)}`);
        expect(typeof thing.musicalKey, page.path).toBe('string');
        const composer = thing.composer as { '@type': string; name: string } | undefined;
        if (page.id!.startsWith('trad-')) expect(composer, page.path).toBeUndefined();
        else expect(composer?.name.length, page.path).toBeGreaterThan(0);
      }
      expect(trail['@type']).toBe('BreadcrumbList');
      const items = trail.itemListElement as {
        '@type': string;
        position: number;
        name: string;
        item: string;
      }[];
      expect(
        items.map((item) => item.position),
        page.path,
      ).toEqual(items.map((_, i) => i + 1));
      expect(items.at(-1)!.item, page.path).toBe(`${ORIGIN}/${page.path}`);
      for (const item of items) {
        expect(item['@type']).toBe('ListItem');
        expect(item.name.length, page.path).toBeGreaterThan(0);
        expect(item.item.startsWith(`${ORIGIN}/`), page.path).toBe(true);
      }
      expect(items.length, page.path).toBe(
        page.kind === 'home' ? 1 : page.kind === 'lesson' || page.kind === 'piece' ? 3 : 2,
      );
    }
  });

  it('has no script but the one for the theme, and nothing that needs one', () => {
    for (const page of pages) {
      const doc = read(page);
      const scripts = all(doc, 'script:not([type="application/ld+json"])');
      expect(scripts, page.path).toHaveLength(1);
      expect(scripts[0]!.textContent, page.path).toBe(THEME_SCRIPT);
      expect(scripts[0]!.hasAttribute('src'), page.path).toBe(false);
      const controls = all(
        doc,
        'button, select, input, textarea, form, label, [role="radiogroup"], [role="button"], ' +
          '[contenteditable], [tabindex], [aria-pressed], [data-midi], [onclick]',
      );
      expect(
        controls.map((el) => el.outerHTML.slice(0, 120)),
        page.path,
      ).toEqual([]);
    }
  });

  it('reads without the stylesheet: headings in order, pictures and links with their words', () => {
    for (const page of pages) {
      const doc = read(page);
      const levels = all(doc, 'h1, h2, h3, h4, h5, h6').map((h) => Number(h.tagName[1]));
      expect(levels[0], page.path).toBe(1);
      for (let i = 1; i < levels.length; i++) {
        expect(levels[i]! - levels[i - 1]!, `${page.path}: heading ${i}`).toBeLessThanOrEqual(1);
      }
      for (const img of all<HTMLImageElement>(doc, 'img')) {
        expect(img.getAttribute('alt')?.trim().length, `${page.path} ${img.src}`).toBeGreaterThan(
          0,
        );
        expect(Number(img.getAttribute('width')), `${page.path} ${img.src}`).toBeGreaterThan(0);
        expect(Number(img.getAttribute('height')), `${page.path} ${img.src}`).toBeGreaterThan(0);
        expect(img.getAttribute('src'), page.path).toMatch(/^\/(learn|pieces)\/[a-z0-9-]+\./);
      }
      for (const link of all<HTMLAnchorElement>(doc, 'a')) {
        expect(link.hasAttribute('href'), page.path).toBe(true);
        expect(link.textContent.trim().length, `${page.path} ${link.outerHTML}`).toBeGreaterThan(0);
      }
      const ids = all(doc, '[id]').map((el) => el.id);
      expect(new Set(ids).size, `${page.path}: ${ids.join(' ')}`).toBe(ids.length);
      // What a list holds are its items.
      for (const list of all(doc, 'ul, ol')) {
        expect(
          [...list.children].every((child) => child.tagName === 'LI'),
          `${page.path} ${list.className}`,
        ).toBe(true);
      }
    }
  });

  it('links only to what is there: a page, a file of the build, a place on the page, the app', () => {
    const there = new Set(files.map((file) => file.path));
    // The app's own files that a page may name.
    const ofTheApp = /^(assets\/|favicon\.svg$|icons\/|learn\/[a-z-]+\.webp$)/;
    for (const page of pages) {
      const doc = read(page);
      const ids = new Set(all(doc, '[id]').map((el) => el.id));
      const targets = [
        ...all(doc, 'a[href]').map((a) => a.getAttribute('href')!),
        ...all(doc, 'img[src]').map((img) => img.getAttribute('src')!),
        ...all(doc, 'link[rel="stylesheet"], link[rel="icon"], link[rel="apple-touch-icon"]').map(
          (link) => link.getAttribute('href')!,
        ),
      ];
      for (const target of targets) {
        if (/^https?:\/\//.test(target)) continue;
        if (target.startsWith('#')) {
          expect(ids.has(target.slice(1)), `${page.path} → ${target}`).toBe(true);
          continue;
        }
        expect(target.startsWith('/'), `${page.path} → ${target}`).toBe(true);
        const path = target.slice(1).replace(/[?#].*$/, '');
        // The app itself, at a route or in a language.
        if (path === APP_PATH) continue;
        const file = /\.[a-z0-9]+$/.test(path) ? path : pageFile(path);
        expect(there.has(file) || ofTheApp.test(file), `${page.path} → ${target}`).toBe(true);
      }
    }
  });

  it('leads home by its brand, and to itself in its other languages', () => {
    for (const page of pages) {
      const doc = read(page);
      const home = page.locale === 'en' ? '/' : `/${page.locale.toLowerCase()}/`;
      expect(doc.querySelector('.brand')?.getAttribute('href'), page.path).toBe(home);
      const languages = all(doc, '.site-languages li');
      expect(languages, page.path).toHaveLength(page.alternates.length - 1);
      expect(
        all(doc, '.site-languages a').map((a) => [
          a.getAttribute('hreflang'),
          a.getAttribute('href'),
        ]),
        page.path,
      ).toEqual(
        page.alternates
          .filter((a) => a.hreflang !== 'x-default' && a.hreflang !== page.locale)
          // The app's own page, asked for by name, is asked for in English.
          .map((a) => [a.hreflang, a.path === APP_PATH ? '/?lang=en' : `/${a.path}`]),
      );
      expect(doc.querySelector('.site-languages [aria-current="page"]')?.getAttribute('lang')).toBe(
        page.locale,
      );
    }
  });
});

describe('a lesson’s page', () => {
  const lessons = pages.filter((page) => page.kind === 'lesson');

  it('begins and ends with the way into the app, at that lesson, in that language', () => {
    for (const page of lessons) {
      const t = translator(page.locale);
      const open = all(read(page), '.site-open a');
      expect(
        open.map((a) => a.textContent),
        page.path,
      ).toEqual([t('site.lesson.open'), t('site.lesson.open')]);
      for (const a of open) {
        expect(a.getAttribute('href'), page.path).toBe(
          `/${appPath(page.locale, `/learn/${page.id!}`)}`,
        );
      }
      expect(read(page).querySelector('.site-open .help')?.textContent).toBe(t('site.lesson.note'));
    }
    expect(
      read(lessons.find((page) => page.path === 'zh-tw/learn/staff')!)
        .querySelector('.site-open a')
        ?.getAttribute('href'),
    ).toBe('/?lang=zh-TW#/learn/staff');
    expect(
      read(lessons.find((page) => page.path === 'learn/staff')!)
        .querySelector('.site-open a')
        ?.getAttribute('href'),
    ).toBe('/#/learn/staff');
  });

  it('has the lesson’s whole text: every section, listed in its contents', () => {
    for (const page of lessons) {
      const doc = read(page);
      const sections = all(doc, '.lesson-body h2[id]');
      expect(sections.length, page.path).toBeGreaterThan(1);
      expect(
        all(doc, '.lesson-toc a').map((a) => [a.getAttribute('href'), a.textContent]),
        page.path,
      ).toEqual(sections.map((h) => [`#${h.id}`, h.textContent]));
      // Chinese says as much in a third of the characters.
      expect(doc.querySelector('.lesson-body')!.textContent.length, page.path).toBeGreaterThan(500);
      expect(all(doc, '.lesson-body .plate').length, page.path).toBeGreaterThan(0);
    }
  });

  it('says one line in place of each exercise, and draws no control', () => {
    for (const page of lessons) {
      const doc = read(page);
      const lines = all(doc, '.exercise-line');
      for (const line of lines) {
        expect(line.textContent, page.path).toBe(translator(page.locale)('site.exercise'));
      }
      // Every numbered lesson ends with an exercise.
      if (LESSONS.some((lesson) => lesson.slug === page.id)) {
        expect(lines.length, page.path).toBeGreaterThan(0);
      }
      expect(all(doc, '.exercise, .segmented, .button-glyph'), page.path).toEqual([]);
      // A keyboard is a picture with its name, and its keys are no buttons.
      for (const piano of all(doc, '.piano')) {
        expect(piano.getAttribute('role'), page.path).toBe('img');
        expect(piano.getAttribute('aria-label')?.length, page.path).toBeGreaterThan(0);
        expect(all(piano, 'span.key').length, page.path).toBeGreaterThan(6);
      }
    }
    expect(read(lessons[0]!).querySelector('.exercise-line')?.textContent).toBe(
      'This exercise is played in the app.',
    );
  });

  it('draws its figures as they first appear: staves, keyboards, and a piece’s form from its score', () => {
    const staff = read(lessons.find((page) => page.path === 'learn/staff')!);
    expect(all(staff, '.lesson-body svg').length).toBeGreaterThan(3);
    expect(all(staff, '.piano').length).toBeGreaterThan(1);
    // The form of the Ode to Joy is read from the library's own file, which no effect loads here.
    const styles = read(lessons.find((page) => page.path === 'learn/styles')!);
    expect(all(styles, '.form-row .form-part').length).toBeGreaterThan(2);
    expect(styles.querySelector('.form-part-still b')?.textContent).toBe('a');
    // Inside the piano: every part with what it does.
    const inside = read(lessons.find((page) => page.path === 'learn/inside')!);
    expect(all(inside, '.inside-parts-list dt').length).toBeGreaterThan(8);
  });

  it('links to the lessons either side, and back to the list', () => {
    const staff = read(lessons.find((page) => page.path === 'zh-cn/learn/staff')!);
    expect(all(staff, '.lesson-pager a').map((a) => a.getAttribute('href'))).toEqual([
      '/zh-cn/learn/keyboard',
      '/zh-cn/learn/landmarks',
    ]);
    expect(staff.querySelector('.lesson-back')?.getAttribute('href')).toBe('/zh-cn/learn/');
    expect(all(staff, '.site-crumbs a').map((a) => a.getAttribute('href'))).toEqual([
      '/zh-cn/',
      '/zh-cn/learn/',
    ]);
  });

  it('finds the sections of a text as it is drawn', () => {
    expect(
      headingsOf('<p>x</p><h2 id="a-b">Lines &amp; <em>spaces</em></h2><h2>none</h2>'),
    ).toEqual([{ id: 'a-b', title: 'Lines & spaces' }]);
  });
});

describe('the lists and the home pages', () => {
  it('list every lesson with its summary, each leading to its page', () => {
    for (const page of pages.filter((p) => p.kind === 'lessons')) {
      const links = all(read(page), '.contents a').map((a) => a.getAttribute('href'));
      expect(links, page.path).toEqual(
        pages
          .filter((p) => p.kind === 'lesson' && p.locale === page.locale)
          .map((p) => `/${p.path}`),
      );
      expect(read(page).querySelector('.contents-meta')?.textContent, page.path).toMatch(/\d/);
    }
  });

  it('list every piece by grade, the lead sheets after, each leading to its page', () => {
    for (const page of pages.filter((p) => p.kind === 'pieces')) {
      const links = all(read(page), '.library-piece').map((a) => a.getAttribute('href'));
      expect([...links].sort(), page.path).toEqual(
        pages
          .filter((p) => p.kind === 'piece' && p.locale === page.locale)
          .map((p) => `/${p.path}`)
          .sort(),
      );
      const sheets = BUILT_IN.filter((piece) => piece.leadSheet).length;
      expect(all(read(page), '#lead-sheets + div .library-piece'), page.path).toHaveLength(sheets);
      expect(read(page).querySelector('.library-level:last-of-type h2')?.id).toBe('lead-sheets');
    }
  });

  it('are the first visit’s home page, with Start going to the app in that language', () => {
    for (const page of pages.filter((p) => p.kind === 'home')) {
      const doc = read(page);
      const t = translator(page.locale);
      const start = doc.querySelector('.home-actions a')!;
      expect(start.textContent, page.path).toBe(t('home.start'));
      expect(start.getAttribute('href'), page.path).toBe(`/?lang=${page.locale}#/start`);
      expect(doc.querySelector('.home-lede')?.textContent, page.path).toBe(t('home.lede'));
      expect(all(doc, '.contents-row'), page.path).toHaveLength(8);
      expect(all(doc, '.home-principles dt').length, page.path).toBe(4);
      expect(all(doc, '.home-faq details').length, page.path).toBe(4);
      const rows = all(doc, '.contents-row').map((a) => a.getAttribute('href'));
      // The lessons and the pieces are pages; the practices are the app's.
      expect(rows[1], page.path).toBe(`/?lang=${page.locale}#/read`);
      expect(rows[5], page.path).toBe(`/${page.locale.toLowerCase()}/pieces/`);
    }
    const first = (path: string) =>
      read(pages.find((p) => p.path === path)!)
        .querySelector('.contents-row')
        ?.getAttribute('href');
    expect(first('zh-tw/')).toBe('/zh-tw/learn/');
    // Japanese and Korean readers get the English lessons.
    expect(first('ja/')).toBe('/learn/');
    expect(first('ko/')).toBe('/learn/');
  });
});

describe('a piece’s page', () => {
  const pieces = pages.filter((page) => page.kind === 'piece');

  it('names the piece as the library does, with its note, its facts and its source', () => {
    for (const page of pieces) {
      const doc = read(page);
      const t = translator(page.locale);
      const piece = BUILT_IN.find((p) => p.id === page.id)!;
      expect(doc.querySelector('h1')?.textContent, page.path).toBe(t(`library.${piece.id}.title`));
      expect(doc.querySelector('.site-piece-composer')?.textContent, page.path).toBe(
        t(`library.${piece.id}.composer`),
      );
      expect(doc.querySelector('.lesson-lede')?.textContent, page.path).toBe(
        t(`library.${piece.id}.note`),
      );
      const facts = new Map(
        all(doc, '.site-facts > div').map((row) => [
          row.querySelector('dt')!.textContent,
          row.querySelector('dd')!,
        ]),
      );
      expect(facts.size, page.path).toBe(11);
      expect(facts.get(t('site.piece.style'))?.textContent).toBe(t(`library.${piece.id}.style`));
      expect(facts.get(t('site.piece.source'))?.querySelector('a')?.getAttribute('href')).toBe(
        piece.sourceUrl,
      );
      expect(facts.get(t('site.piece.source'))?.textContent).toBe(piece.source);
      expect(facts.get(t('site.piece.encoder'))?.textContent).toBe(piece.encoder);
      expect(facts.get(t('site.piece.licence'))?.textContent).toBe(piece.licence);
      expect(facts.get(t('site.piece.bars'))?.textContent, page.path).toMatch(/^\d+$/);
      expect(facts.get(t('metronome.meter'))?.textContent, page.path).toMatch(/^\d+\/\d+/);
      expect(doc.querySelector('.site-piece-lead') !== null, page.path).toBe(
        piece.leadSheet === true,
      );
    }
  });

  it('shows the score engraved for it, one image for every language, and opens the piece', () => {
    for (const page of pieces) {
      const doc = read(page);
      const img = doc.querySelector<HTMLImageElement>('.site-score img')!;
      expect(img.getAttribute('src'), page.path).toBe(`/${scorePath(page.id!)}`);
      expect(img.alt, page.path).toContain(doc.querySelector('h1')!.textContent);
      const open = all(doc, '.site-open a');
      expect(open, page.path).toHaveLength(2);
      for (const a of open) {
        expect(a.getAttribute('href')).toBe(`/${appPath(page.locale, `/pieces/${page.id!}`)}`);
        expect(a.textContent).toBe(translator(page.locale)('site.piece.practise'));
      }
    }
  });

  it('says which pieces carry their edition’s fingering, and what key each is in', () => {
    const fact = (path: string, name: string) =>
      all(read(pieces.find((page) => page.path === path)!), '.site-facts > div')
        .find((row) => row.querySelector('dt')!.textContent === name)
        ?.querySelector('dd')?.textContent;
    expect(fact('pieces/turk-aller-anfang', 'Fingering')).toBe('As the source edition prints it');
    expect(fact('pieces/beethoven-fur-elise', 'Fingering')).toBe('None');
    expect(fact('pieces/beethoven-fur-elise', 'Key')).toBe('A minor');
    expect(fact('pieces/beethoven-fur-elise', 'Time signature')).toBe('3/8');
    expect(fact('pieces/petzold-minuet-in-g', 'Bars')).toBe('32');
  });
});

describe('a score', () => {
  it('is one image in black on nothing, named, with nothing for a script in it', () => {
    for (const piece of BUILT_IN) {
      const svg = byPath.get(scorePath(piece.id))!;
      expect(svg.startsWith('<svg viewBox="0 0 '), piece.id).toBe(true);
      expect(svg, piece.id).toMatch(/^<svg [^>]*>\n<title>[^<]+<\/title>/);
      expect(svg, piece.id).not.toMatch(/data-id=|data-class=|<script|\bon[a-z]+=/);
      expect(svg, piece.id).toContain('color="black"');
      const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
      expect(doc.querySelector('parsererror'), piece.id).toBeNull();
      expect(doc.documentElement.localName).toBe('svg');
      // A page's worth of music at least, and no more than a browser takes in at once.
      expect(svg.length, piece.id).toBeGreaterThan(10_000);
      expect(svg.length, piece.id).toBeLessThan(600_000);
    }
  });
});

describe('a build without an address of its own', () => {
  let bare = new Map<string, string>();
  beforeAll(async () => {
    bare = new Map((await render(null)).map((file) => [file.path, file.content]));
  }, 180_000);

  it('writes the same pages with relative links, and no sitemap', () => {
    expect(bare.has('sitemap.xml')).toBe(false);
    expect([...bare.keys()].sort()).toEqual(
      files
        .map((file) => file.path)
        .filter((path) => path !== 'sitemap.xml')
        .sort(),
    );
  });

  it('leaves out what must be a whole address: the canonical, the alternates, the structured data', () => {
    for (const page of pages) {
      const html = bare.get(pageFile(page.path))!;
      expect(html, page.path).not.toMatch(
        /rel="canonical"|rel="alternate"|application\/ld\+json|og:url|og:image|playdacapo\.com/,
      );
      // Everything else is as it was.
      const whole = byPath.get(pageFile(page.path))!;
      expect(html.slice(html.indexOf('<body>')), page.path).toBe(
        whole.slice(whole.indexOf('<body>')),
      );
      expect(html.slice(0, html.indexOf('<meta name="description"'))).toBe(
        whole.slice(0, whole.indexOf('<meta name="description"')),
      );
    }
  });
});
