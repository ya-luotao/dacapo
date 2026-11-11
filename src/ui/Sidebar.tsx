import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useLocation } from 'wouter';
import { useT } from '../i18n/index.ts';
import { BrandMark } from './BrandMark.tsx';
import { useFocusActive } from './focus/focus.ts';
import { MetronomeChip } from './metronome/MetronomeChip.tsx';
import { opensEverything } from '../core/startingPoint.ts';
import { readPref, writePref } from '../lib/localPrefs.ts';
import { NAV_ITEMS, NEWCOMER_PATHS } from './routes.ts';
import { readStartPref } from './start/prefs.ts';
import { readReturning } from './today/prefs.ts';

// Whether "All practice" is open, `1` or `0`: kept per device, so it stays as it was left.
const ALL_KEY = 'dacapo.nav.all';

/**
 * Open or folded, as it was left. The first time, whoever has practised here before (known at
 * once from what the browser keeps, docs/TODAY.md) finds every page listed as it always was; a
 * first visitor finds it folded, and it stays folded once they have practised.
 */
function readAll(): boolean {
  const kept = readPref(ALL_KEY);
  if (kept !== null) return kept === '1';
  const open = readReturning();
  writePref(ALL_KEY, open ? '1' : '0');
  return open;
}

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
 * A newcomer's list is Today, Pieces and Progress, with the other pages folded under "All
 * practice"; someone who said they play already (docs/START.md) gets every page listed.
 */
export function Sidebar() {
  return useFocusActive() ? null : <Navigation />;
}

function Navigation() {
  const t = useT();
  const [location] = useLocation();
  const drawer = useRef<HTMLDialogElement>(null);
  const wide = useSyncExternalStore(subscribeWide, isWide);
  // Read on every render: the answer is given on the start page and changed in Settings, and
  // the next page opened shows it.
  const everything = opensEverything(readStartPref());
  const [all, setAll] = useState(readAll);

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
    const foot = (
      <ul className="side-list side-foot">
        {NAV_ITEMS.filter((item) => item.group === 'foot').map(({ path, label }) =>
          link(path, t(label)),
        )}
      </ul>
    );
    if (everything) {
      return (
        <>
          <ul className="side-list">{link('/', t('nav.today'))}</ul>
          <h2 className="side-heading">{t('nav.group.practice')}</h2>
          <ul className="side-list">{group('practice')}</ul>
          <h2 className="side-heading">{t('nav.group.record')}</h2>
          <ul className="side-list">{group('record')}</ul>
          {foot}
        </>
      );
    }
    const pages = NAV_ITEMS.filter((item) => item.group !== 'foot');
    const folded = pages.filter((item) => !NEWCOMER_PATHS.includes(item.path));
    // A folded page that is open shows where it is, whatever was last chosen.
    const open = all || folded.some((item) => isActive(location, item.path));
    const id = inDrawer ? 'drawer-all' : 'side-all';
    return (
      <>
        <ul className="side-list">
          {link('/', t('nav.today'))}
          {pages
            .filter((item) => NEWCOMER_PATHS.includes(item.path))
            .map(({ path, label }) => link(path, t(label)))}
        </ul>
        <button
          type="button"
          className="side-link side-toggle"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => {
            setAll(!open);
            writePref(ALL_KEY, open ? '0' : '1');
          }}
        >
          {t('nav.all')}
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M4.5 2.5 8 6 4.5 9.5" />
          </svg>
        </button>
        <ul className="side-list side-folded" id={id} hidden={!open}>
          {folded.map(({ path, label }) => link(path, t(label)))}
        </ul>
        {foot}
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
