import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider } from './i18n/index.ts';
import { App } from './ui/App.tsx';
import { InputProvider } from './ui/input/InputProvider.tsx';
import { PracticeProvider } from './ui/practice/PracticeProvider.tsx';
import { applyTheme, readStoredTheme } from './ui/theme.ts';
import './ui/styles.css';

applyTheme(readStoredTheme());

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <I18nProvider>
      <InputProvider>
        <PracticeProvider>
          <App />
        </PracticeProvider>
      </InputProvider>
    </I18nProvider>
  </StrictMode>,
);
