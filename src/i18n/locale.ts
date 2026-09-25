import { readPref, writePref } from '../lib/localPrefs.ts';
import { en, type Dictionary } from './en.ts';

export const LOCALES = ['en', 'zh-CN', 'zh-TW', 'ja', 'ko'] as const;
export type Locale = (typeof LOCALES)[number];

/** Endonyms: each language is always shown in its own script. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  ja: '日本語',
  ko: '한국어',
};

/** What joins two sentences: Chinese and Japanese run them on, English and Korean use a space. */
export const SENTENCE_GAP: Record<Locale, string> = {
  en: ' ',
  'zh-CN': '',
  'zh-TW': '',
  ja: '',
  ko: ' ',
};

export type DictionaryLoaders = Record<Exclude<Locale, 'en'>, () => Promise<Dictionary>>;

// English is bundled as the fallback; every other dictionary is its own chunk, loaded on demand.
const LOADERS: DictionaryLoaders = {
  'zh-CN': () => import('./zh-CN.ts').then((m) => m.zhCN),
  'zh-TW': () => import('./zh-TW.ts').then((m) => m.zhTW),
  ja: () => import('./ja.ts').then((m) => m.ja),
  ko: () => import('./ko.ts').then((m) => m.ko),
};

export interface LoadedLocale {
  /** The locale in effect: the one asked for, or `en` when its dictionary could not be loaded. */
  locale: Locale;
  dictionary: Dictionary;
}

/** A loader that caches what it loaded. It never rejects: a failed load falls back to English and is retried next time. */
export function createLocaleLoader(loaders: DictionaryLoaders) {
  const loaded = new Map<Locale, Dictionary>();
  return async (locale: Locale): Promise<LoadedLocale> => {
    if (locale === 'en') return { locale, dictionary: en };
    const cached = loaded.get(locale);
    if (cached) return { locale, dictionary: cached };
    try {
      const dictionary = await loaders[locale]();
      loaded.set(locale, dictionary);
      return { locale, dictionary };
    } catch {
      return { locale: 'en', dictionary: en };
    }
  };
}

export const loadLocale = createLocaleLoader(LOADERS);

const STORAGE_KEY = 'dacapo.locale';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

const TRADITIONAL_REGIONS = new Set(['tw', 'hk', 'mo']);

/**
 * Maps a BCP 47 tag to a supported locale. Chinese goes by script when the tag names one
 * (`zh-Hant-*` → zh-TW, `zh-Hans-*` → zh-CN), else by region (Taiwan, Hong Kong and Macau → zh-TW).
 */
export function detectLocale(language: string | undefined): Locale {
  const [lang, ...subtags] = (language ?? '').toLowerCase().split(/[-_]/);
  if (lang === 'ja') return 'ja';
  if (lang === 'ko') return 'ko';
  if (lang !== 'zh') return 'en';
  if (subtags.includes('hant')) return 'zh-TW';
  if (subtags.includes('hans')) return 'zh-CN';
  return subtags.some((s) => TRADITIONAL_REGIONS.has(s)) ? 'zh-TW' : 'zh-CN';
}

export function browserLanguage(): string | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.language;
}

/** The locale the user picked explicitly, or null to follow the browser. */
export function readLocaleOverride(): Locale | null {
  const stored = readPref(STORAGE_KEY);
  return isLocale(stored) ? stored : null;
}

export function writeLocaleOverride(locale: Locale | null): void {
  writePref(STORAGE_KEY, locale);
}

/** The explicit choice, else the browser language. */
export function preferredLocale(override = readLocaleOverride()): Locale {
  return override ?? detectLocale(browserLanguage());
}

export function formatMessage(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}
