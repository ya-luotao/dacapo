import { readPref, writePref } from '../lib/localPrefs.ts';

export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

const STORAGE_KEY = 'dacapo.theme';

function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (THEME_PREFERENCES as readonly string[]).includes(value);
}

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
