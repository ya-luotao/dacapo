import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { fillNoteNames, type NoteNaming } from '../core/noteNames.ts';
import { currentShell } from '../lib/shell.ts';
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
import { readNoteNaming, writeNoteNaming } from './noteNaming.ts';
import { messageFor } from './shellWording.ts';

interface Current extends LoadedLocale {
  /** The locale this state was loaded for; `locale` differs only when loading it failed. */
  requested: Locale;
}

/**
 * `initial` is loaded before the first render, so the app never flashes English. `chosen` is a
 * language taken from the address as the app started (`langParam.ts`): the choice for this visit
 * even where the browser keeps nothing.
 */
export function I18nProvider({
  initial,
  chosen = null,
  children,
}: {
  initial: LoadedLocale;
  chosen?: Locale | null;
  children: ReactNode;
}) {
  const [override, setOverrideState] = useState<Locale | null>(
    () => chosen ?? readLocaleOverride(),
  );
  const requested = preferredLocale(override);
  const [current, setCurrent] = useState<Current>(() => ({ ...initial, requested }));
  const [noteNaming, setNoteNamingState] = useState<NoteNaming>(readNoteNaming);

  const setOverride = useCallback((next: Locale | null) => {
    setOverrideState(next);
    writeLocaleOverride(next);
  }, []);

  const setNoteNaming = useCallback((next: NoteNaming) => {
    setNoteNamingState(next);
    writeNoteNaming(next);
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

  // One `t` per naming, each the same function from render to render: a lesson takes the
  // letters' whatever the setting (ui/LetterNames.tsx).
  const translators = useMemo(() => {
    const translator =
      (naming: NoteNaming): Translate =>
      (key, vars) =>
        formatMessage(
          fillNoteNames(messageFor(dictionary, key, currentShell()), naming, locale),
          vars,
        );
    return { letters: translator('letters'), solfege: translator('solfege') };
  }, [locale, dictionary]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      override,
      setOverride,
      noteNaming,
      setNoteNaming,
      t: translators[noteNaming],
      translate: (naming) => translators[naming],
    }),
    [locale, override, setOverride, noteNaming, setNoteNaming, translators],
  );

  return <I18nContext value={value}>{children}</I18nContext>;
}
