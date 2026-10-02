import { describe, expect, it } from 'vitest';
import config from '../../vite.config.ts?raw';
import { dictionaryLink, dictionaryPreloadScript } from './dictionaryPreload.ts';
import { langParam } from './langParam.ts';
import { detectLocale, isLocale, LOCALES, type Locale } from './locale.ts';

const ADDRESSES = Object.fromEntries(
  LOCALES.map((locale) => [locale, `/assets/${locale}-AbC_123-.js`]),
) as Record<Locale, string>;

/** Where the browser gives no storage: reading it throws. */
const NO_STORAGE = Symbol('no storage');

interface Visitor {
  /** What `dacapo.locale` holds. */
  stored?: string | null | typeof NO_STORAGE;
  search?: string;
  language?: string | undefined;
}

/** The page's script, as it is shipped, with what it reads of the browser handed in. */
function shipped(script: string): (...globals: unknown[]) => void {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- the script, as it is shipped
  return new Function('localStorage', 'location', 'navigator', 'document', script) as (
    ...globals: unknown[]
  ) => void;
}

/** Runs the page's script as a browser would, and returns what it added to the head. */
function run(
  script: string,
  { stored = null, search = '', language = 'en-US' }: Visitor,
): string[] {
  const added: string[] = [];
  const localStorage = {
    getItem(key: string) {
      if (stored === NO_STORAGE) throw new Error('SecurityError');
      return key === 'dacapo.locale' ? stored : null;
    },
  };
  const document = {
    head: {
      insertAdjacentHTML(where: string, html: string) {
        expect(where).toBe('beforeend');
        added.push(html);
      },
    },
  };
  shipped(script)(localStorage, { search }, { language }, document);
  return added;
}

/** What the app decides for the same visitor: `adoptLanguage` and `preferredLocale`. */
function appLocale({ stored = null, search = '', language = 'en-US' }: Visitor): Locale {
  const kept = isLocale(stored) ? stored : null;
  return kept ?? langParam(search) ?? detectLocale(language);
}

const SCRIPT = dictionaryPreloadScript(ADDRESSES)!;

const LANGUAGES = [
  // Every language of the app by its own tag and by its first part: a language added to
  // `detectLocale` and not to the script is found here.
  ...LOCALES,
  ...LOCALES.map((locale) => locale.split('-')[0]),
  'en',
  'en-US',
  'en-GB',
  'de-DE',
  'fr',
  'za',
  'jam',
  'kok',
  '',
  undefined,
  'ja',
  'ja-JP',
  'JA',
  'ko',
  'ko-KR',
  'zh',
  'zh-CN',
  'zh-SG',
  'ZH-cn',
  'zh-Hans',
  'zh-Hans-CN',
  'zh-Hans-HK',
  'zh-Hans-TW',
  'zh-TW',
  'zh-tw',
  'zh_TW',
  'zh-HK',
  'zh-MO',
  'zh-Hant',
  'zh-Hant-TW',
  'zh-Hant-HK',
  'zh-Hant-CN',
];

describe('the page’s script for the reader’s dictionary', () => {
  it('names one dictionary: the one of the language the app will start in', () => {
    const stored: Visitor['stored'][] = [
      null,
      NO_STORAGE,
      '',
      'fr',
      'EN',
      'zh-cn',
      'toString',
      ...LOCALES,
    ];
    const searches = [
      '',
      '?lang=ja',
      '?lang=zh-tw',
      '?lang=ZH-CN',
      '?lang=fr',
      '?lang=',
      '?x=1&lang=ko',
      '?lang=ja&lang=ko',
      '?language=ja',
      '?lang=toString',
    ];
    let checked = 0;
    for (const kept of stored) {
      for (const search of searches) {
        for (const language of LANGUAGES) {
          const visitor: Visitor = { stored: kept, search, language };
          expect(run(SCRIPT, visitor), `${String(kept)} ${search} ${String(language)}`).toEqual([
            dictionaryLink(ADDRESSES[appLocale(visitor)]),
          ]);
          checked++;
        }
      }
    }
    expect(checked).toBe(stored.length * searches.length * LANGUAGES.length);
  });

  it('a choice kept comes before the address, the address before the browser', () => {
    const link = (locale: Locale) => [dictionaryLink(ADDRESSES[locale])];
    expect(run(SCRIPT, { language: 'ja-JP' })).toEqual(link('ja'));
    expect(run(SCRIPT, { language: 'ja-JP', search: '?lang=ko' })).toEqual(link('ko'));
    expect(run(SCRIPT, { language: 'ja-JP', search: '?lang=ko', stored: 'zh-TW' })).toEqual(
      link('zh-TW'),
    );
    expect(run(SCRIPT, { language: 'ja-JP', stored: 'en' })).toEqual(link('en'));
    // Where the browser gives no storage, the rest still decides.
    expect(run(SCRIPT, { language: 'zh-HK', stored: NO_STORAGE })).toEqual(link('zh-TW'));
  });

  it('writes each tag as Vite writes its own, whole, for the offline worker to read', () => {
    for (const locale of LOCALES) {
      expect(SCRIPT).toContain(
        `'<link rel="modulepreload" crossorigin href="${ADDRESSES[locale]}">'`,
      );
    }
    // Nothing that would end the script or the page's markup around it.
    expect(SCRIPT).not.toMatch(/<\/|<!--|\n/);
  });

  it('adds nothing, and breaks nothing, where the browser has none of what it reads', () => {
    expect(() => shipped(SCRIPT)()).not.toThrow();
    expect(() =>
      shipped(SCRIPT)({ getItem: () => null }, { search: '' }, { language: 'en' }, {}),
    ).not.toThrow();
  });

  // Without it nothing breaks, and English readers wait one request longer for the first page
  // (measured: CHANGELOG.md, "A lighter start"): so the build is held to it here.
  it('is still written into the built page, before the app’s script', () => {
    expect(config).toMatch(/plugins: \[[^\]]*\bdictionaryPreload\(\)/);
    expect(config).toContain('dictionaryPreloadScript(addresses)');
    expect(config).toContain('The build made no chunk of the English dictionary.');
  });

  it('is not written when a language has no address, or one that would need escaping', () => {
    expect(dictionaryPreloadScript({})).toBeNull();
    expect(dictionaryPreloadScript({ ...ADDRESSES, ja: '/assets/j"a.js' })).toBeNull();
    expect(dictionaryPreloadScript({ ...ADDRESSES, ja: "/assets/j'a.js" })).toBeNull();
    expect(dictionaryPreloadScript({ ...ADDRESSES, ja: '/assets/</script>.js' })).toBeNull();
    expect(dictionaryPreloadScript({ ...ADDRESSES, ja: '' })).toBeNull();
    // A base path, a whole address and a relative one are all plain.
    for (const base of ['/dacapo/', 'https://cdn.example.org/x/', './']) {
      expect(dictionaryPreloadScript({ en: `${base}assets/en-1.js` })).toContain(
        `href="${base}assets/en-1.js"`,
      );
    }
  });
});
