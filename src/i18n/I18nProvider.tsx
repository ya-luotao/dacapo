import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { I18nContext, type I18nContextValue, type Translate } from './context.ts';
import {
  formatMessage,
  loadLocale,
  preferredLocale,
  readLocaleOverride,
  writeLocaleOverride,
  type LoadedLocale,
  type Locale,
} from './locale.ts';

interface Current extends LoadedLocale {
  /** The locale this state was loaded for; `locale` differs only when loading it failed. */
  requested: Locale;
}

/** `initial` is loaded before the first render, so the app never flashes English. */
export function I18nProvider({
  initial,
  children,
}: {
  initial: LoadedLocale;
  children: ReactNode;
}) {
  const [override, setOverrideState] = useState<Locale | null>(readLocaleOverride);
  const requested = preferredLocale(override);
  const [current, setCurrent] = useState<Current>(() => ({ ...initial, requested }));

  const setOverride = useCallback((next: Locale | null) => {
    setOverrideState(next);
    writeLocaleOverride(next);
  }, []);

  // A newly chosen language shows once its dictionary is here; until then the old one stays.
  useEffect(() => {
    if (current.requested === requested) return;
    let cancelled = false;
    void loadLocale(requested).then((loaded) => {
      if (!cancelled) setCurrent({ ...loaded, requested });
    });
    return () => {
      cancelled = true;
    };
  }, [requested, current.requested]);

  const { locale, dictionary } = current;

  useLayoutEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => {
    const t: Translate = (key, vars) => formatMessage(dictionary[key], vars);
    return { locale, override, setOverride, t };
  }, [locale, dictionary, override, setOverride]);

  return <I18nContext value={value}>{children}</I18nContext>;
}
