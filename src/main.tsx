import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider, loadLocale, preferredLocale } from './i18n/index.ts';
import { adoptLanguage } from './i18n/langParam.ts';
import { readLocaleOverride } from './i18n/locale.ts';
import { registerOffline } from './offline/client.ts';
import { openRepository } from './storage/repository.ts';
import { createAppSync } from './sync/app.ts';
import { App } from './ui/App.tsx';
import { InputProvider } from './ui/input/InputProvider.tsx';
import { readLegacyLessons } from './ui/learn/progress.ts';
import { MetronomeProvider } from './ui/metronome/MetronomeProvider.tsx';
import { createAppMetronome } from './ui/metronome/prefs.ts';
import { PracticeProvider } from './ui/practice/PracticeProvider.tsx';
import { broadcastChannel, createPracticeStore } from './ui/practice/store.ts';
import { SyncProvider } from './ui/sync/SyncProvider.tsx';
import { applyTheme, readStoredTheme } from './ui/theme.ts';
import './ui/fonts/fonts.css';
import './ui/styles.css';

applyTheme(readStoredTheme());

// Created outside React so StrictMode cannot open the database twice.
const practice = createPracticeStore({
  open: openRepository,
  channel: broadcastChannel,
  storage: typeof navigator.storage?.persist === 'function' ? navigator.storage : null,
  legacyLessons: readLegacyLessons,
});
practice.start();

// Only in a build with a sync service; without one there is no account and no request.
const sync = createAppSync(practice);
sync?.start();

// One metronome for the page; it makes no sound (and no AudioContext) until it is started.
const metronome = createAppMetronome();

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

// A page of the site opens the app in its own language (`?lang=`, docs/SITE.md): taken when
// none was chosen, and gone from the address before anything reads it.
const chosen = adoptLanguage() ?? readLocaleOverride();

// The dictionary is resolved before the first render, so a non-English UI never flashes English.
void loadLocale(preferredLocale(chosen)).then((initial) => {
  document.documentElement.lang = initial.locale;
  createRoot(root).render(
    <StrictMode>
      <I18nProvider initial={initial} chosen={chosen}>
        <InputProvider>
          <PracticeProvider store={practice}>
            <SyncProvider client={sync}>
              <MetronomeProvider handle={metronome}>
                <App />
              </MetronomeProvider>
            </SyncProvider>
          </PracticeProvider>
        </InputProvider>
      </I18nProvider>
    </StrictMode>,
  );
  // The offline worker (docs/OFFLINE.md), after the first render: the web app's production build
  // only, and never in the way of the page.
  registerOffline();
});
