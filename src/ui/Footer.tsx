import { Link } from 'wouter';
import { useT } from '../i18n/index.ts';
import { PRIVACY_URL, REPO_URL } from '../lib/links.ts';
import { currentShell } from '../lib/shell.ts';
import { BrandMark } from './BrandMark.tsx';
import { useFocusActive } from './focus/focus.ts';

/**
 * The colophon at the foot of every page of the web app: what dacapo is, in one line, and where
 * its licence, source and privacy policy are. Not in the Apple app, which has its own About menu,
 * nor in focus mode; pages that fill the screen hide it in CSS.
 */
export function Footer() {
  const t = useT();
  const focus = useFocusActive();
  if (focus || currentShell() !== 'web') return null;
  return (
    <footer className="footer">
      <div className="footer-inner">
        <p className="footer-brand">
          <BrandMark className="footer-mark" />
          <span className="visually-hidden">{t('app.name')}</span>
          <span className="footer-tagline">{t('footer.tagline')}</span>
        </p>
        <ul className="footer-links">
          <li>
            <Link href="/about">{t('footer.about')}</Link>
          </li>
          <li>
            <a href={REPO_URL}>{t('settings.about.source')}</a>
          </li>
          {PRIVACY_URL && (
            <li>
              <a href={PRIVACY_URL}>{t('footer.privacy')}</a>
            </li>
          )}
          <li className="footer-version">{t('footer.version', { version: __APP_VERSION__ })}</li>
        </ul>
      </div>
    </footer>
  );
}
