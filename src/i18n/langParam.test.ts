// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { adoptLanguage, langParam, withoutLangParam } from './langParam.ts';
import { LOCALES, preferredLocale, readLocaleOverride } from './locale.ts';

// `?lang=` (docs/SITE.md, "The way into the app"): taken as the language when none is chosen,
// ignored when one is, and gone from the address afterwards with the route kept.

const STORED = 'dacapo.locale';

/** An address bar, and the history that rewrites it. */
function bar(address: string) {
  let href = address;
  const replaced: string[] = [];
  return {
    location: {
      get href() {
        return href;
      },
      get search() {
        return new URL(href).search;
      },
    },
    history: {
      state: { kept: true } as unknown,
      replaceState(_state: unknown, _unused: string, url: string) {
        href = url;
        replaced.push(url);
      },
    },
    replaced,
  };
}

afterEach(() => localStorage.clear());

describe('langParam', () => {
  it.each(LOCALES)('names %s, in any case', (locale) => {
    expect(langParam(`?lang=${locale}`)).toBe(locale);
    expect(langParam(`?lang=${locale.toLowerCase()}`)).toBe(locale);
    expect(langParam(`?x=1&lang=${locale.toUpperCase()}`)).toBe(locale);
  });

  it('is nothing without the parameter, or with a language the app does not have', () => {
    expect(langParam('')).toBeNull();
    expect(langParam('?language=ja')).toBeNull();
    expect(langParam('?lang=')).toBeNull();
    expect(langParam('?lang=fr')).toBeNull();
    expect(langParam('?lang=zh')).toBeNull();
    expect(langParam('?lang=zh-Hant')).toBeNull();
  });
});

describe('withoutLangParam', () => {
  it('drops the parameter and keeps the route', () => {
    expect(withoutLangParam('https://playdacapo.com/?lang=zh-TW#/learn/staff')).toBe(
      'https://playdacapo.com/#/learn/staff',
    );
    expect(withoutLangParam('https://example.org/dacapo/?lang=ja')).toBe(
      'https://example.org/dacapo/',
    );
  });

  it('keeps the rest of the query, and the settings a route carries after its own "?"', () => {
    expect(withoutLangParam('http://localhost:4173/?a=1&lang=ko&b=2#/pieces')).toBe(
      'http://localhost:4173/?a=1&b=2#/pieces',
    );
    expect(
      withoutLangParam('https://playdacapo.com/?lang=ko#/pieces/x?bars=5-8&lang=en&hands=left'),
    ).toBe('https://playdacapo.com/#/pieces/x?bars=5-8&lang=en&hands=left');
  });
});

describe('adoptLanguage', () => {
  it('takes the language when none is chosen: it becomes the choice, and the address loses it', () => {
    const { location, history, replaced } = bar('https://playdacapo.com/?lang=zh-TW#/learn/staff');
    expect(adoptLanguage(location, history)).toBe('zh-TW');
    expect(localStorage.getItem(STORED)).toBe('zh-TW');
    expect(readLocaleOverride()).toBe('zh-TW');
    expect(preferredLocale()).toBe('zh-TW');
    expect(replaced).toEqual(['https://playdacapo.com/#/learn/staff']);
  });

  it('takes it in the code of the address, lower case', () => {
    const { location, history } = bar('https://playdacapo.com/?lang=zh-cn');
    expect(adoptLanguage(location, history)).toBe('zh-CN');
    expect(localStorage.getItem(STORED)).toBe('zh-CN');
  });

  it('leaves a choice already made alone, and still drops the parameter', () => {
    localStorage.setItem(STORED, 'ja');
    const { location, history, replaced } = bar('https://playdacapo.com/?lang=zh-TW#/learn/staff');
    expect(adoptLanguage(location, history)).toBeNull();
    expect(localStorage.getItem(STORED)).toBe('ja');
    expect(replaced).toEqual(['https://playdacapo.com/#/learn/staff']);
  });

  it('ignores a language the app does not have, and drops it from the address', () => {
    const { location, history, replaced } = bar('https://playdacapo.com/?lang=fr#/pieces');
    expect(adoptLanguage(location, history)).toBeNull();
    expect(localStorage.getItem(STORED)).toBeNull();
    expect(replaced).toEqual(['https://playdacapo.com/#/pieces']);
  });

  it('touches nothing when the address has no such parameter', () => {
    const { location, history, replaced } = bar('https://playdacapo.com/?x=1#/pieces/x?lang=ja');
    expect(adoptLanguage(location, history)).toBeNull();
    expect(localStorage.getItem(STORED)).toBeNull();
    expect(replaced).toEqual([]);
  });

  it('keeps the history entry’s state', () => {
    const { location, history } = bar('https://playdacapo.com/?lang=ko');
    const states: unknown[] = [];
    adoptLanguage(location, {
      state: history.state,
      replaceState: (state: unknown) => states.push(state),
    });
    expect(states).toEqual([{ kept: true }]);
  });
});
