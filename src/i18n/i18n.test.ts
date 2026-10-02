import { describe, expect, it } from 'vitest';
import {
  fillNoteNames,
  isNotePlaceholder,
  WORD_JOINER,
  type NoteNaming,
} from '../core/noteNames.ts';
import { BUILT_IN_IDS } from '../pieces/library/index.ts';
import { en, type Dictionary, type MessageKey } from './en.ts';
import { ja } from './ja.ts';
import { ko } from './ko.ts';
import {
  createLocaleLoader,
  detectLocale,
  formatMessage,
  loadLocale,
  LOCALE_NAMES,
  LOCALES,
  type DictionaryLoaders,
  type Locale,
} from './locale.ts';
import { zhCN } from './zh-CN.ts';
import { zhTW } from './zh-TW.ts';

const DICTIONARIES: Record<Locale, Dictionary> = { en, 'zh-CN': zhCN, 'zh-TW': zhTW, ja, ko };
const TRANSLATIONS = LOCALES.filter((l) => l !== 'en');

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('dictionaries', () => {
  // tsc already rejects missing/extra keys; this guards against casts or `any` slipping through.
  it.each(TRANSLATIONS)('%s has exactly the same keys as en, in the same order', (locale) => {
    expect(Object.keys(DICTIONARIES[locale])).toEqual(Object.keys(en));
  });

  it.each(LOCALES)('%s has no empty strings', (locale) => {
    for (const [key, value] of Object.entries(DICTIONARIES[locale])) {
      expect(value.trim(), key).not.toBe('');
    }
  });

  it.each(TRANSLATIONS)('%s uses the same placeholders as en for every key', (locale) => {
    for (const [key, value] of Object.entries(en)) {
      expect(placeholders(DICTIONARIES[locale][key as MessageKey]), key).toEqual(
        placeholders(value),
      );
    }
  });

  it.each(LOCALES)('%s names, describes and credits every built-in piece', (locale) => {
    for (const id of BUILT_IN_IDS) {
      for (const field of ['title', 'composer', 'note', 'style'] as const) {
        const key = `library.${id}.${field}` as MessageKey;
        expect(DICTIONARIES[locale][key], key).toBeTruthy();
      }
    }
  });

  it.each(['zh-TW', 'ja'] as const)('%s quotes with 「」', (locale) => {
    for (const [key, value] of Object.entries(DICTIONARIES[locale])) {
      expect(value, key).not.toMatch(/[“”]/);
    }
  });

  it('zh-TW has no Simplified-only characters', () => {
    const simplified =
      /[们这设说时见对开关页机录键识谱乐数网络导览显练习节弹钢从择载处该让传响还]/u;
    for (const [key, value] of Object.entries(zhTW)) {
      expect(value, key).not.toMatch(simplified);
    }
  });

  it('shows every language by its own name', () => {
    expect(LOCALE_NAMES).toEqual({
      en: 'English',
      'zh-CN': '简体中文',
      'zh-TW': '繁體中文',
      ja: '日本語',
      ko: '한국어',
    });
  });
});

describe('detectLocale', () => {
  it.each([
    ['zh', 'zh-CN'],
    ['zh-CN', 'zh-CN'],
    ['zh-SG', 'zh-CN'],
    ['zh-Hans', 'zh-CN'],
    ['zh-Hans-CN', 'zh-CN'],
    ['zh-Hans-HK', 'zh-CN'],
    ['ZH-cn', 'zh-CN'],
    ['zh-TW', 'zh-TW'],
    ['zh-tw', 'zh-TW'],
    ['zh-HK', 'zh-TW'],
    ['zh-MO', 'zh-TW'],
    ['zh-Hant', 'zh-TW'],
    ['zh-Hant-TW', 'zh-TW'],
    ['zh-Hant-HK', 'zh-TW'],
    ['zh_TW', 'zh-TW'],
    ['ja', 'ja'],
    ['ja-JP', 'ja'],
    ['ko', 'ko'],
    ['ko-KR', 'ko'],
    ['en-US', 'en'],
    ['de-DE', 'en'],
    ['za', 'en'],
    ['jam', 'en'],
    ['', 'en'],
    [undefined, 'en'],
  ] as const)('%s -> %s', (input, expected) => {
    expect(detectLocale(input)).toBe(expected);
  });
});

describe('loading dictionaries', () => {
  it.each(TRANSLATIONS)('loads %s on demand', async (locale) => {
    expect(await loadLocale(locale)).toEqual({ locale, dictionary: DICTIONARIES[locale] });
  });

  it('has English without loading anything', async () => {
    const load = createLocaleLoader(failing());
    expect(await load('en')).toEqual({ locale: 'en', dictionary: en });
  });

  it('falls back to English when a dictionary cannot be loaded, and retries next time', async () => {
    let fail = true;
    const loaders = {
      ...failing(),
      ja: () => (fail ? Promise.reject(new Error('offline')) : Promise.resolve(ja)),
    };
    const load = createLocaleLoader(loaders);
    expect(await load('ja')).toEqual({ locale: 'en', dictionary: en });
    fail = false;
    expect(await load('ja')).toEqual({ locale: 'ja', dictionary: ja });
  });

  it('loads each dictionary once', async () => {
    let calls = 0;
    const load = createLocaleLoader({
      ...failing(),
      ko: () => {
        calls++;
        return Promise.resolve(ko);
      },
    });
    await load('ko');
    await load('ko');
    expect(calls).toBe(1);
  });
});

function failing(): DictionaryLoaders {
  const fail = () => Promise.reject(new Error('not loadable'));
  return { 'zh-CN': fail, 'zh-TW': fail, ja: fail, ko: fail };
}

describe('formatMessage', () => {
  it('substitutes known placeholders and leaves unknown ones intact', () => {
    expect(formatMessage('{n} of {total} ({x})', { n: 3, total: 20 })).toBe('3 of 20 ({x})');
  });

  it('returns the template unchanged without vars', () => {
    expect(formatMessage('Hello {name}')).toBe('Hello {name}');
  });
});

// A note of the keyboard in a string is a placeholder (`{C4}`, see docs/TRANSLATING.md), named
// as the reader asked: by letter, or as do re mi in the language's script.
describe('notes named in the dictionaries', () => {
  const noteKeys = (dictionary: Dictionary) =>
    Object.entries(dictionary)
      .filter(([, value]) => placeholders(value).some((name) => isNotePlaceholder(name!)))
      .map(([key]) => key);

  it('are in the strings that name a note or a key, and in no other', () => {
    expect(noteKeys(en)).toEqual([
      'home.read.text',
      'piano.label',
      'piano.key.middleC',
      'read.level.L1',
      'read.level.L2',
      'read.level.L3',
      'read.level.L4',
      'rhythm.keys.hands',
      'sight.level.F1',
      'sight.level.F2',
    ]);
    // The same strings in every language: the placeholders are the same for every key.
    for (const locale of TRANSLATIONS) expect(noteKeys(DICTIONARIES[locale])).toEqual(noteKeys(en));
  });

  it.each(LOCALES)('%s reads them in letters as it always did, and in do re mi', (locale) => {
    const dictionary = DICTIONARIES[locale];
    const read = (key: MessageKey, naming: NoteNaming) =>
      fillNoteNames(dictionary[key], naming, locale).replaceAll(WORD_JOINER, '');
    for (const key of noteKeys(dictionary) as MessageKey[]) {
      expect(read(key, 'letters'), key).not.toMatch(/\{[A-G]/);
      expect(read(key, 'solfege'), key).not.toMatch(/\{[A-G]/);
      expect(read(key, 'solfege'), key).not.toBe(read(key, 'letters'));
    }
    const range = {
      en: 'C4 to C5',
      'zh-CN': 'C4 到 C5',
      'zh-TW': 'C4 到 C5',
      ja: 'C4〜C5',
      ko: 'C4–C5',
    };
    const inDoReMi = {
      en: 'Do4 to Do5',
      'zh-CN': 'Do4 到 Do5',
      'zh-TW': 'Do4 到 Do5',
      ja: 'ド4〜ド5',
      ko: '도4–도5',
    };
    expect(read('read.level.L2', 'letters')).toContain(range[locale]);
    expect(read('read.level.L2', 'solfege')).toContain(inDoReMi[locale]);
  });

  it('name the setting’s two choices by what they write, whatever the naming', () => {
    for (const locale of LOCALES) {
      expect(DICTIONARIES[locale]['settings.noteNames.letters']).toBe('C D E');
    }
    expect(en['settings.noteNames.solfege']).toBe('Do Re Mi');
    expect(zhCN['settings.noteNames.solfege']).toBe('Do Re Mi');
    expect(zhTW['settings.noteNames.solfege']).toBe('Do Re Mi');
    expect(ja['settings.noteNames.solfege']).toBe('ド レ ミ');
    expect(ko['settings.noteNames.solfege']).toBe('도 레 미');
  });
});
