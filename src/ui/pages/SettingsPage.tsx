import { useId, useState } from 'react';
import { isLocale, LOCALE_NAMES, LOCALES, useI18n } from '../../i18n/index.ts';
import type { Preferences } from '../../storage/exchange.ts';
import { DataSection } from '../settings/DataSection.tsx';
import { currentTheme, setTheme, THEME_PREFERENCES, type ThemePreference } from '../theme.ts';

const SYSTEM = 'system';
const REPO_URL = 'https://github.com/ya-luotao/dacapo';

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

  function onApplyPreferences(preferences: Preferences) {
    setOverride(preferences.locale);
    onThemeChange(preferences.theme);
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

      <DataSection
        preferences={{ locale: override, theme }}
        onApplyPreferences={onApplyPreferences}
      />

      <section className="field data about" aria-labelledby={`${themeId}-about`}>
        <h2 id={`${themeId}-about`}>{t('settings.about')}</h2>
        <p className="help">{t('settings.about.text', { version: __APP_VERSION__ })}</p>
        <ul className="about-links">
          <li>
            <a href={REPO_URL}>{t('settings.about.source')}</a>
          </li>
          <li>
            <a href={`${REPO_URL}/blob/main/THIRD_PARTY_NOTICES.md`}>
              {t('settings.about.notices')}
            </a>
          </li>
        </ul>
      </section>
    </section>
  );
}
