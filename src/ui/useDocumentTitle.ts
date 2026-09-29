import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useT } from '../i18n/index.ts';
import { pageLabel } from './routes.ts';

/**
 * The window title follows the page and the language: "Read · dacapo", and at home what dacapo is
 * (the title search engines show, so it says it in words people search for).
 */
export function useDocumentTitle(): void {
  const t = useT();
  const [location] = useLocation();
  const label = pageLabel(location);
  const title = label
    ? `${t(label)} · ${t('app.name')}`
    : `${t('app.name')} — ${t('home.eyebrow')}`;
  useEffect(() => {
    document.title = title;
  }, [title]);
}
