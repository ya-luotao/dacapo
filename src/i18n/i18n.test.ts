import { describe, expect, it } from 'vitest';
import { en } from './en.ts';
import { detectLocale, DICTIONARIES, formatMessage, LOCALES } from './locale.ts';
import { zhCN } from './zh-CN.ts';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('dictionaries', () => {
  // tsc already rejects missing/extra keys; this guards against casts or `any` slipping through.
  it('zh-CN has exactly the same keys as en', () => {
    expect(Object.keys(zhCN).sort()).toEqual(Object.keys(en).sort());
  });

  it.each(LOCALES)('%s has no empty strings', (locale) => {
    for (const [key, value] of Object.entries(DICTIONARIES[locale])) {
      expect(value.trim(), key).not.toBe('');
    }
  });

  it('zh-CN uses the same placeholders as en for every key', () => {
    for (const [key, value] of Object.entries(en)) {
      expect(placeholders(zhCN[key as keyof typeof en]), key).toEqual(placeholders(value));
    }
  });
});

describe('detectLocale', () => {
  it.each([
    ['zh', 'zh-CN'],
    ['zh-CN', 'zh-CN'],
    ['zh-Hans-CN', 'zh-CN'],
    ['zh-TW', 'zh-CN'],
    ['ZH-cn', 'zh-CN'],
    ['en-US', 'en'],
    ['de-DE', 'en'],
    ['', 'en'],
    [undefined, 'en'],
  ] as const)('%s -> %s', (input, expected) => {
    expect(detectLocale(input)).toBe(expected);
  });
});

describe('formatMessage', () => {
  it('substitutes known placeholders and leaves unknown ones intact', () => {
    expect(formatMessage('{n} of {total} ({x})', { n: 3, total: 20 })).toBe('3 of 20 ({x})');
  });

  it('returns the template unchanged without vars', () => {
    expect(formatMessage('Hello {name}')).toBe('Hello {name}');
  });
});
