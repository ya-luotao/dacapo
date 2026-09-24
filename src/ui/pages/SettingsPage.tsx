import { useId, useState } from 'react';
import { isLocale, LOCALE_NAMES, LOCALES, useI18n } from '../../i18n/index.ts';
import { currentTheme, setTheme, THEME_PREFERENCES, type ThemePreference } from '../theme.ts';

const SYSTEM = 'system';

export function SettingsPage() {
  const { t, override, setOverride } = useI18n();
  const [theme, setThemeState] = useState<ThemePreference>(currentTheme);
  const languageId = useId();
  const themeId = useId();

  function onLanguageChange(value: string) {
    setOverride(isLocale(value) ? value : null);
  }

  function onThemeChange(value: ThemePreference) {
    setThemeState(value);
    setTheme(value);
  }

  return (
    <section className="page">
      <h1>{t('settings.title')}</h1>

      <div className="field">
        <label htmlFor={languageId}>{t('settings.language')}</label>
        <select
          id={languageId}
          value={override ?? SYSTEM}
          onChange={(e) => onLanguageChange(e.target.value)}
          aria-describedby={`${languageId}-help`}
        >
          <option value={SYSTEM}>{t('settings.language.system')}</option>
          {LOCALES.map((locale) => (
            <option key={locale} value={locale} lang={locale}>
              {LOCALE_NAMES[locale]}
            </option>
          ))}
        </select>
        <p id={`${languageId}-help`} className="help">
          {t('settings.language.help')}
        </p>
      </div>

      <fieldset className="field" aria-describedby={`${themeId}-help`}>
        <legend>{t('settings.theme')}</legend>
        <div className="segmented">
          {THEME_PREFERENCES.map((pref) => (
            <label key={pref}>
              <input
                type="radio"
                name={themeId}
                value={pref}
                checked={theme === pref}
                onChange={() => onThemeChange(pref)}
              />
              <span>{t(`settings.theme.${pref}`)}</span>
            </label>
          ))}
        </div>
        <p id={`${themeId}-help`} className="help">
          {t('settings.theme.help')}
        </p>
      </fieldset>
    </section>
  );
}
