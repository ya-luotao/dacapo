import { describe, expect, it } from 'vitest';
import { dictionaryPreloadScript } from '../i18n/dictionaryPreload.ts';
import { pageBelongs, pathBelow, route, type RequestFacts } from './route.ts';

const ROOT = 'https://playdacapo.com/';
const SUB = 'https://example.org/dacapo/';

const LIST = new Set([
  '',
  'assets/index-AAAA.js',
  'assets/index-BBBB.css',
  'assets/verovio-module-CCCC.mjs',
  'assets/ja-DDDD.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'piano/A4-mf.mp3',
  'learn/two-hands.webp',
]);
const listed = (path: string) => LIST.has(path);

function get(url: string, facts: Partial<RequestFacts> = {}) {
  return route({ url, method: 'GET', mode: 'cors', range: false, ...facts }, ROOT, listed);
}

function getSub(url: string, facts: Partial<RequestFacts> = {}) {
  return route({ url, method: 'GET', mode: 'cors', range: false, ...facts }, SUB, listed);
}

const PASS = { kind: 'pass' };

describe('route: what is not the app’s is not answered', () => {
  it.each([
    'https://api.playdacapo.com/v1/sync',
    'https://static.cloudflareinsights.com/beacon.min.js',
    'http://playdacapo.com/assets/index-AAAA.js',
    'https://playdacapo.com:8443/assets/index-AAAA.js',
  ])('another origin: %s', (url) => {
    expect(get(url)).toEqual(PASS);
  });

  it.each(['POST', 'HEAD', 'PUT', 'DELETE', 'OPTIONS'])('a %s request', (method) => {
    expect(get(`${ROOT}assets/index-AAAA.js`, { method })).toEqual(PASS);
    expect(get(ROOT, { method, mode: 'navigate' })).toEqual(PASS);
  });

  it.each([
    'privacy',
    'u/someone',
    'u/someone/2026',
    'licenses/verovio/COPYING',
    'robots.txt',
    'sw.js',
    'assets/index-AAAA.js',
    'piano/A4-mf.mp3',
  ])('a navigation to another path: /%s', (path) => {
    expect(get(`${ROOT}${path}`, { mode: 'navigate' })).toEqual(PASS);
  });

  it.each(['robots.txt', 'sitemap.xml', 'social-card.png', '_headers', 'sw.js', 'privacy'])(
    'a file the list does not have: /%s',
    (path) => {
      expect(get(`${ROOT}${path}`)).toEqual(PASS);
    },
  );

  it('the scope’s root asked for as a file, not as a page', () => {
    expect(get(ROOT)).toEqual(PASS);
    expect(get(`${ROOT}index.html`)).toEqual(PASS);
  });

  it('an address that is not one', () => {
    expect(get('not a url')).toEqual(PASS);
    expect(get('')).toEqual(PASS);
  });
});

describe('route: the page', () => {
  it('is a navigation to the scope’s root', () => {
    expect(get(ROOT, { mode: 'navigate' })).toEqual({ kind: 'page' });
    expect(get(`${ROOT}index.html`, { mode: 'navigate' })).toEqual({ kind: 'page' });
  });

  it('whatever its query or fragment', () => {
    expect(get(`${ROOT}?utm_source=x`, { mode: 'navigate' })).toEqual({ kind: 'page' });
    expect(get(`${ROOT}#/read`, { mode: 'navigate' })).toEqual({ kind: 'page' });
    expect(get(`${ROOT}?a=1#/pieces/x`, { mode: 'navigate' })).toEqual({ kind: 'page' });
  });
});

describe('route: files under assets/', () => {
  it('one in the list is answered from the store and kept', () => {
    expect(get(`${ROOT}assets/index-AAAA.js`)).toEqual({
      kind: 'asset',
      path: 'assets/index-AAAA.js',
      keep: true,
    });
    expect(get(`${ROOT}assets/verovio-module-CCCC.mjs`, { mode: 'cors' })).toEqual({
      kind: 'asset',
      path: 'assets/verovio-module-CCCC.mjs',
      keep: true,
    });
    expect(get(`${ROOT}assets/index-BBBB.css`, { mode: 'no-cors' })).toMatchObject({ keep: true });
  });

  it('one not in the list (another release’s) is looked for in the stores, and not kept', () => {
    expect(get(`${ROOT}assets/ProgressPage-OLD0.js`)).toEqual({
      kind: 'asset',
      path: 'assets/ProgressPage-OLD0.js',
      keep: false,
    });
  });

  it('with a query is left to the network', () => {
    expect(get(`${ROOT}assets/index-AAAA.js?v=2`)).toEqual(PASS);
    expect(get(`${ROOT}assets/index-AAAA.js?`)).toMatchObject({ kind: 'asset' });
  });

  it('a part of one is left to the network', () => {
    expect(get(`${ROOT}assets/index-AAAA.js`, { range: true })).toEqual(PASS);
  });

  it('dot segments are resolved before the address is looked up', () => {
    expect(get(`${ROOT}assets/../privacy`)).toEqual(PASS);
    expect(get(`${ROOT}x/../assets/index-AAAA.js`)).toMatchObject({ kind: 'asset', keep: true });
  });
});

describe('route: the other files of the list', () => {
  it.each([
    'manifest.webmanifest',
    'icons/icon-192.png',
    'piano/A4-mf.mp3',
    'learn/two-hands.webp',
  ])('%s is answered from the store and renewed', (path) => {
    expect(get(`${ROOT}${path}`, { mode: 'no-cors' })).toEqual({ kind: 'file', path });
  });

  it('a part of one (a sample asked for by range) is left to the network', () => {
    expect(get(`${ROOT}piano/A4-mf.mp3`, { range: true })).toEqual(PASS);
  });

  it('with a query is left to the network', () => {
    expect(get(`${ROOT}piano/A4-mf.mp3?x=1`)).toEqual(PASS);
  });

  it('a file beside a listed one is not answered', () => {
    expect(get(`${ROOT}piano/A9-mf.mp3`)).toEqual(PASS);
    expect(get(`${ROOT}piano/`)).toEqual(PASS);
  });
});

describe('route: a build below a sub-path', () => {
  it('answers below its scope', () => {
    expect(getSub(SUB, { mode: 'navigate' })).toEqual({ kind: 'page' });
    expect(getSub(`${SUB}?x=1`, { mode: 'navigate' })).toEqual({ kind: 'page' });
    expect(getSub(`${SUB}assets/index-AAAA.js`)).toEqual({
      kind: 'asset',
      path: 'assets/index-AAAA.js',
      keep: true,
    });
    expect(getSub(`${SUB}piano/A4-mf.mp3`)).toEqual({ kind: 'file', path: 'piano/A4-mf.mp3' });
  });

  it('and nothing outside it', () => {
    expect(getSub('https://example.org/', { mode: 'navigate' })).toEqual(PASS);
    expect(getSub('https://example.org/dacapo', { mode: 'navigate' })).toEqual(PASS);
    expect(getSub('https://example.org/dacapo-two/', { mode: 'navigate' })).toEqual(PASS);
    expect(getSub('https://example.org/assets/index-AAAA.js')).toEqual(PASS);
    expect(getSub('https://example.org/other/assets/index-AAAA.js')).toEqual(PASS);
    expect(getSub(`${SUB}privacy`, { mode: 'navigate' })).toEqual(PASS);
  });
});

describe('pathBelow', () => {
  it('gives the address below the scope', () => {
    expect(pathBelow(new URL(`${ROOT}assets/a.js`), ROOT)).toBe('assets/a.js');
    expect(pathBelow(new URL(ROOT), ROOT)).toBe('');
    expect(pathBelow(new URL(`${SUB}piano/x.mp3`), SUB)).toBe('piano/x.mp3');
    expect(pathBelow(new URL('https://example.org/other'), SUB)).toBeNull();
    expect(pathBelow(new URL('https://example.com/dacapo/'), SUB)).toBeNull();
  });
});

describe('pageBelongs', () => {
  const page = (...tags: string[]) => `<!doctype html><html><head>${tags.join('')}</head></html>`;

  it('a page whose files are all in the list is this build’s', () => {
    const html = page(
      '<link rel="icon" href="/favicon.svg" />',
      '<link rel="canonical" href="https://playdacapo.com/" />',
      '<script type="module" crossorigin src="/assets/index-AAAA.js"></script>',
      '<link rel="stylesheet" crossorigin href="/assets/index-BBBB.css">',
    );
    expect(pageBelongs(html, ROOT, listed)).toBe(true);
  });

  it('a page that names a file the list does not have is another build’s', () => {
    const html = page(
      '<script type="module" crossorigin src="/assets/index-NEW0.js"></script>',
      '<link rel="stylesheet" crossorigin href="/assets/index-BBBB.css">',
    );
    expect(pageBelongs(html, ROOT, listed)).toBe(false);
  });

  // The page's script for the reader's dictionary (i18n/dictionaryPreload.ts) names each
  // dictionary in a tag it may add: those are files the page names like any other.
  it('holds the dictionaries the page’s script names to the list too', () => {
    const app = '<script type="module" crossorigin src="/assets/index-AAAA.js"></script>';
    const script = (addresses: Record<string, string>) =>
      `<script>${dictionaryPreloadScript(addresses)!}</script>`;
    expect(pageBelongs(page(script({ ja: '/assets/ja-DDDD.js' }), app), ROOT, listed)).toBe(true);
    // A dictionary of another build: the page is not this build's, whatever its other files.
    expect(pageBelongs(page(script({ ja: '/assets/ja-NEW0.js' }), app), ROOT, listed)).toBe(false);
    expect(
      pageBelongs(
        page(script({ ja: '/assets/ja-DDDD.js', ko: '/assets/ko-NEW0.js' }), app),
        ROOT,
        listed,
      ),
    ).toBe(false);
    // Below a sub-path, as the build writes them there.
    const sub = page(
      script({ ja: '/dacapo/assets/ja-DDDD.js' }),
      '<script type="module" crossorigin src="/dacapo/assets/index-AAAA.js"></script>',
    );
    expect(pageBelongs(sub, SUB, listed)).toBe(true);
    expect(pageBelongs(sub.replace('ja-DDDD', 'ja-NEW0'), SUB, listed)).toBe(false);
  });

  it('a page that names no file of the app is not the app', () => {
    expect(pageBelongs(page('<title>Sign in to the network</title>'), ROOT, listed)).toBe(false);
    expect(pageBelongs('', ROOT, listed)).toBe(false);
  });

  it('reads addresses below a sub-path, absolute or relative', () => {
    const absolute = page('<script type="module" src="/dacapo/assets/index-AAAA.js"></script>');
    const relative = page("<script type='module' src='./assets/index-AAAA.js'></script>");
    const outside = page('<script type="module" src="/assets/index-AAAA.js"></script>');
    expect(pageBelongs(absolute, SUB, listed)).toBe(true);
    expect(pageBelongs(relative, SUB, listed)).toBe(true);
    // Not below the scope: no file of the app is named.
    expect(pageBelongs(outside, SUB, listed)).toBe(false);
  });
});
