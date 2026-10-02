import { useMemo, type ReactNode } from 'react';
import { I18nContext, useI18n } from '../i18n/context.ts';

/**
 * Letter names for everything inside, whatever the setting (docs/PERSONAL.md, "Note names"): a
 * lesson teaches the letters, and its figures keep them too, down to what their keyboard says to
 * a screen reader.
 */
export function LetterNames({ children }: { children: ReactNode }) {
  const i18n = useI18n();
  const value = useMemo(
    () => ({ ...i18n, noteNaming: 'letters' as const, t: i18n.translate('letters') }),
    [i18n],
  );
  return <I18nContext value={value}>{children}</I18nContext>;
}
