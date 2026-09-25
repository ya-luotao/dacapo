import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider } from './i18n/index.ts';
import { openRepository } from './storage/repository.ts';
import { App } from './ui/App.tsx';
import { InputProvider } from './ui/input/InputProvider.tsx';
import { PracticeProvider } from './ui/practice/PracticeProvider.tsx';
import { broadcastChannel, createPracticeStore } from './ui/practice/store.ts';
import { applyTheme, readStoredTheme } from './ui/theme.ts';
import './ui/fonts/fonts.css';
import './ui/styles.css';

applyTheme(readStoredTheme());

// Created outside React so StrictMode cannot open the database twice.
const practice = createPracticeStore({
  open: openRepository,
  channel: broadcastChannel,
  storage: typeof navigator.storage?.persist === 'function' ? navigator.storage : null,
});
practice.start();

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <I18nProvider>
      <InputProvider>
        <PracticeProvider store={practice}>
          <App />
        </PracticeProvider>
      </InputProvider>
    </I18nProvider>
  </StrictMode>,
);
