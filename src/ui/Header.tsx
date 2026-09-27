import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { useI18n, useT } from '../i18n/index.ts';
import { BrandMark } from './BrandMark.tsx';
import { MetronomeChip } from './metronome/MetronomeChip.tsx';
import { fitNav, type NavFit } from './navFit.ts';
import { NAV_ITEMS } from './routes.ts';

const ALL: NavFit = { shown: NAV_ITEMS.map((_, i) => i), more: [] };

/** A piece's page belongs to Pieces. */
function isActive(location: string, path: string): boolean {
  return location === path || (path !== '/' && location.startsWith(`${path}/`));
}

export function Header() {
  const t = useT();
  const { locale } = useI18n();
  const [location] = useLocation();
  const nav = useRef<HTMLElement>(null);
  const ruler = useRef<HTMLUListElement>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<NavFit>(ALL);
  // The page the menu was opened on: it is open only there, so leaving the page closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);

  // What fits: the items are measured once per language in a hidden copy of the bar, and the bar
  // is fitted to the width the header leaves it, again whenever that width changes.
  useLayoutEffect(() => {
    const bar = nav.current;
    const copy = ruler.current;
    if (!bar || !copy) return;
    const measure = () => {
      const items = [...copy.children] as HTMLElement[];
      const widths = items.slice(0, NAV_ITEMS.length).map((el) => el.offsetWidth);
      const moreWidth = items.at(-1)!.offsetWidth;
      const gap = parseFloat(getComputedStyle(copy).columnGap) || 0;
      const next = fitNav(
        widths,
        NAV_ITEMS.map((item) => item.priority),
        bar.clientWidth,
        gap,
        moreWidth,
      );
      setFit((current) =>
        current.more.join() === next.more.join() && current.shown.join() === next.shown.join()
          ? current
          : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    // The text fonts may arrive after the first measure.
    let live = true;
    void document.fonts?.ready.then(() => live && measure());
    return () => {
      live = false;
      observer.disconnect();
    };
  }, [locale]);

  // The menu closes on leaving the page, on a click elsewhere and when More is no longer needed.
  const open = openOn === location && fit.more.length > 0;
  const setOpen = (next: boolean) => setOpenOn(next ? location : null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!menu.current?.contains(target) && !moreButton.current?.contains(target)) setOpenOn(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  // Escape closes it from the button or from inside it.
  const onMenuKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || !open) return;
    e.stopPropagation();
    setOpen(false);
    moreButton.current?.focus();
  };

  const moreActive = fit.more.some((i) => isActive(location, NAV_ITEMS[i]!.path));
  const link = (i: number, className: string, inMenu = false) => {
    const { path, label } = NAV_ITEMS[i]!;
    const active = isActive(location, path);
    return (
      <Link
        href={path}
        className={active ? `${className} is-active` : className}
        aria-current={active ? 'page' : undefined}
        // Choosing the page already open changes no location: the menu closes all the same.
        onClick={inMenu ? () => setOpenOn(null) : undefined}
      >
        {t(label)}
      </Link>
    );
  };

  return (
    <header className="header">
      <Link href="/" className="brand">
        <BrandMark className="brand-mark" />
        <span className="visually-hidden">{t('app.name')}</span>
      </Link>
      <nav aria-label={t('nav.label')} ref={nav}>
        <ul className="nav">
          {fit.shown.map((i) => (
            <li key={NAV_ITEMS[i]!.path}>{link(i, 'nav-link')}</li>
          ))}
          {fit.more.length > 0 && (
            <li className="nav-more" onKeyDown={onMenuKey}>
              <button
                type="button"
                ref={moreButton}
                className={
                  moreActive ? 'nav-link nav-more-button is-active' : 'nav-link nav-more-button'
                }
                aria-expanded={open}
                aria-controls="nav-more-menu"
                onClick={() => setOpen(!open)}
              >
                {t('nav.more')}
                <svg className="nav-more-chevron" viewBox="0 0 10 6" aria-hidden="true">
                  <path d="M1 1l4 4 4-4" />
                </svg>
              </button>
              <div id="nav-more-menu" className="nav-more-menu" ref={menu} hidden={!open}>
                <ul>
                  {fit.more.map((i) => (
                    <li key={NAV_ITEMS[i]!.path}>{link(i, 'nav-more-link', true)}</li>
                  ))}
                </ul>
              </div>
            </li>
          )}
        </ul>
        {/* Every item and More, as the bar draws them: measured, never seen. */}
        <div className="nav-ruler-box" aria-hidden="true">
          <ul className="nav nav-ruler" ref={ruler}>
            {NAV_ITEMS.map(({ path, label }) => (
              <li key={path} className="nav-link">
                {t(label)}
              </li>
            ))}
            <li className="nav-link nav-more-button">
              {t('nav.more')}
              <svg className="nav-more-chevron" viewBox="0 0 10 6">
                <path d="M1 1l4 4 4-4" />
              </svg>
            </li>
          </ul>
        </div>
      </nav>
      <MetronomeChip />
    </header>
  );
}
