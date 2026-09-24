import { readPref, writePref } from '../lib/localPrefs.ts';
import { en, type Dictionary } from './en.ts';
import { zhCN } from './zh-CN.ts';

export const LOCALES = ['en', 'zh-CN'] as const;
export type Locale = (typeof LOCALES)[number];

/** Endonyms: each language is always shown in its own script. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  'zh-CN': '简体中文',
};

export const DICTIONARIES: Record<Locale, Dictionary> = {
  en,
  'zh-CN': zhCN,
};

const STORAGE_KEY = 'dacapo.locale';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** Maps a BCP 47 tag to a supported locale. All Chinese variants use zh-CN, the only Chinese dictionary. */
export function detectLocale(language: string | undefined): Locale {
  if (language?.toLowerCase().startsWith('zh')) return 'zh-CN';
  return 'en';
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

export function formatMessage(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}
