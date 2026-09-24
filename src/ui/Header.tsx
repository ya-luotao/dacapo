import { Link, useLocation } from 'wouter';
import { useT } from '../i18n/index.ts';
import { NAV_ITEMS } from './routes.ts';

export function Header() {
  const t = useT();
  const [location] = useLocation();

  return (
    <header className="header">
      <Link href="/" className="brand">
        <svg className="brand-mark" viewBox="0 0 24 24" aria-hidden="true">
          <ellipse cx="12" cy="12" rx="7.5" ry="5" transform="rotate(-20 12 12)" />
        </svg>
        <span>{t('app.name')}</span>
      </Link>
      <nav aria-label={t('nav.label')}>
        <ul className="nav">
          {NAV_ITEMS.map(({ path, label }) => {
            const active = location === path;
            return (
              <li key={path}>
                <Link
                  href={path}
                  className={active ? 'nav-link is-active' : 'nav-link'}
                  aria-current={active ? 'page' : undefined}
                >
                  {t(label)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
