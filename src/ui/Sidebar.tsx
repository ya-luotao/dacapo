import { useEffect, useRef, useSyncExternalStore } from 'react';
import { Link, useLocation } from 'wouter';
import { useT } from '../i18n/index.ts';
import { BrandMark } from './BrandMark.tsx';
import { useFocusActive } from './focus/focus.ts';
import { MetronomeChip } from './metronome/MetronomeChip.tsx';
import { NAV_ITEMS } from './routes.ts';

/** A piece's page belongs to Pieces; Today is the home page alone. */
function isActive(location: string, path: string): boolean {
  if (path === '/') return location === '/';
  return location === path || location.startsWith(`${path}/`);
}

/** Wide enough for the sidebar beside the page; narrower screens get the bar and its drawer. */
const WIDE = '(min-width: 60rem)';

function subscribeWide(onChange: () => void) {
  const query = globalThis.matchMedia?.(WIDE);
  query?.addEventListener('change', onChange);
  return () => query?.removeEventListener('change', onChange);
}

const isWide = () => globalThis.matchMedia?.(WIDE).matches ?? true;

/**
 * The navigation, as a native app keeps it: a sidebar on a wide screen; on a narrow one a bar
 * with a menu button that opens the same list in a drawer. Neither shows in focus mode, and the
 * sidebar makes way while a session runs (styles.css), so practising has the whole screen.
 */
export function Sidebar() {
  return useFocusActive() ? null : <Navigation />;
}

function Navigation() {
  const t = useT();
  const [location] = useLocation();
  const drawer = useRef<HTMLDialogElement>(null);
  const wide = useSyncExternalStore(subscribeWide, isWide);

  // Choosing a page closes the drawer, the page already open included.
  useEffect(() => {
    drawer.current?.close();
  }, [location]);

  const list = (inDrawer: boolean) => {
    const link = (path: string, label: string) => {
      const active = isActive(location, path);
      return (
        <li key={path}>
          <Link
            href={path}
            className={active ? 'side-link is-active' : 'side-link'}
            aria-current={active ? 'page' : undefined}
            onClick={inDrawer ? () => drawer.current?.close() : undefined}
          >
            {label}
          </Link>
        </li>
      );
    };
    const group = (name: 'practice' | 'record') =>
      NAV_ITEMS.filter((item) => item.group === name).map(({ path, label }) =>
        link(path, t(label)),
      );
    return (
      <>
        <ul className="side-list">{link('/', t('nav.today'))}</ul>
        <h2 className="side-heading">{t('nav.group.practice')}</h2>
        <ul className="side-list">{group('practice')}</ul>
        <h2 className="side-heading">{t('nav.group.record')}</h2>
        <ul className="side-list">{group('record')}</ul>
        <ul className="side-list side-foot">
          {NAV_ITEMS.filter((item) => item.group === 'foot').map(({ path, label }) =>
            link(path, t(label)),
          )}
        </ul>
      </>
    );
  };

  const brand = (
    <Link href="/" className="brand">
      <BrandMark className="brand-mark" />
      <span className="visually-hidden">{t('app.name')}</span>
    </Link>
  );

  if (wide) {
    return (
      <aside className="sidebar">
        {brand}
        <nav aria-label={t('nav.label')} className="side-nav">
          {list(false)}
        </nav>
        <div className="side-end">
          <MetronomeChip />
        </div>
      </aside>
    );
  }

  return (
    <>
      <header className="topbar">
        <button
          type="button"
          className="topbar-menu"
          aria-haspopup="dialog"
          onClick={() => drawer.current?.showModal()}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M3 5.5h14M3 10h14M3 14.5h14" />
          </svg>
          <span className="visually-hidden">{t('nav.menu')}</span>
        </button>
        {brand}
        <div className="topbar-end">
          <MetronomeChip />
        </div>
      </header>

      <dialog
        ref={drawer}
        className="drawer"
        aria-label={t('nav.label')}
        // A click on the backdrop lands on the dialog itself, outside its panel.
        onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
      >
        <div className="drawer-panel">
          <div className="drawer-head">
            {brand}
            <button type="button" className="drawer-close" onClick={() => drawer.current?.close()}>
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
              <span className="visually-hidden">{t('nav.close')}</span>
            </button>
          </div>
          <nav aria-label={t('nav.label')} className="side-nav">
            {list(true)}
          </nav>
        </div>
      </dialog>
    </>
  );
}
