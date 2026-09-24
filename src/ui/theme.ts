import { readPref, writePref } from '../lib/localPrefs.ts';
import { isThemePreference, type ThemePreference } from '../lib/themePreference.ts';

export { THEME_PREFERENCES, type ThemePreference } from '../lib/themePreference.ts';

const STORAGE_KEY = 'dacapo.theme';

export function readStoredTheme(): ThemePreference {
  const stored = readPref(STORAGE_KEY);
  return isThemePreference(stored) ? stored : 'system';
}

/** `data-theme` on <html> forces a theme; without it CSS follows prefers-color-scheme. */
export function applyTheme(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === 'system') delete root.dataset.theme;
  else root.dataset.theme = preference;
}

/** The DOM is the source of truth after startup, so this stays right even if storage is unavailable. */
export function currentTheme(): ThemePreference {
  const value = document.documentElement.dataset.theme;
  return isThemePreference(value) ? value : 'system';
}

export function setTheme(preference: ThemePreference): void {
  applyTheme(preference);
  writePref(STORAGE_KEY, preference === 'system' ? null : preference);
}
