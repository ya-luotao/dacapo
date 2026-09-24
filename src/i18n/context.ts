import { createContext, useContext } from 'react';
import type { MessageKey } from './en.ts';
import type { Locale } from './locale.ts';

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

export interface I18nContextValue {
  /** The locale in effect. */
  locale: Locale;
  /** The user's explicit choice, or null when following the browser language. */
  override: Locale | null;
  setOverride: (locale: Locale | null) => void;
  t: Translate;
}

export const I18nContext = createContext<I18nContextValue | null>(null);

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside <I18nProvider>');
  return value;
}

export function useT(): Translate {
  return useI18n().t;
}
