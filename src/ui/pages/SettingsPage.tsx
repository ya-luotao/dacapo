import { useId, useState } from 'react';
import { Link } from 'wouter';
import { NOTE_NAMINGS } from '../../core/noteNames.ts';
import { isLocale, LOCALE_NAMES, LOCALES, useI18n } from '../../i18n/index.ts';
import type { Preferences } from '../../storage/exchange.ts';
import { AccountSection } from '../settings/AccountSection.tsx';
import { DataSection } from '../settings/DataSection.tsx';
import { SoundSection } from '../settings/SoundSection.tsx';
import { StartSection } from '../settings/StartSection.tsx';
import { currentTheme, setTheme, THEME_PREFERENCES, type ThemePreference } from '../theme.ts';
import { REPO_URL } from '../../lib/links.ts';

const SYSTEM = 'system';

export function SettingsPage() {
  const { t, override, setOverride, noteNaming, setNoteNaming } = useI18n();
  const [theme, setThemeState] = useState<ThemePreference>(currentTheme);
  const languageId = useId();
  const noteNamesId = useId();
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
    // A file from before the note names has none: letters, as the app named notes then.
    setNoteNaming(preferences.noteNames ?? 'letters');
  }

  return (
    <section className="page settings">
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

      <fieldset className="field" aria-describedby={`${noteNamesId}-help`}>
        <legend>{t('settings.noteNames')}</legend>
        <div className="segmented">
          {NOTE_NAMINGS.map((naming) => (
            <label key={naming}>
              <input
                type="radio"
                name={noteNamesId}
                value={naming}
                checked={noteNaming === naming}
                onChange={() => setNoteNaming(naming)}
              />
              <span>{t(`settings.noteNames.${naming}`)}</span>
            </label>
          ))}
        </div>
        <p id={`${noteNamesId}-help`} className="help">
          {t('settings.noteNames.help')}
        </p>
      </fieldset>

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

      <StartSection />

      <SoundSection />

      <AccountSection />

      <DataSection
        preferences={{ locale: override, theme, noteNames: noteNaming }}
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
            <Link href="/about">{t('settings.about.notices')}</Link>
          </li>
        </ul>
      </section>
    </section>
  );
}
