import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { I18nContext, type I18nContextValue, type Translate } from './context.ts';
import {
  browserLanguage,
  detectLocale,
  DICTIONARIES,
  formatMessage,
  readLocaleOverride,
  writeLocaleOverride,
  type Locale,
} from './locale.ts';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [override, setOverrideState] = useState<Locale | null>(readLocaleOverride);
  const locale = override ?? detectLocale(browserLanguage());

  const setOverride = useCallback((next: Locale | null) => {
    setOverrideState(next);
    writeLocaleOverride(next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => {
    const dictionary = DICTIONARIES[locale];
    const t: Translate = (key, vars) => formatMessage(dictionary[key], vars);
    return { locale, override, setOverride, t };
  }, [locale, override, setOverride]);

  return <I18nContext value={value}>{children}</I18nContext>;
}
