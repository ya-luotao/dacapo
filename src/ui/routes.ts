import type { MessageKey } from '../i18n/index.ts';

/**
 * The navigation, in order; the home page is the brand's link. `priority`: when the header is too
 * narrow, the lowest moves into the More menu first; Play and Read always stay. `practice`: a page where you play, where the header
 * always shows the metronome chip.
 */
export const NAV_ITEMS: readonly {
  path: string;
  label: MessageKey;
  priority: number;
  practice?: boolean;
}[] = [
  { path: '/learn', label: 'nav.learn', priority: 4 },
  { path: '/play', label: 'nav.play', priority: Infinity, practice: true },
  { path: '/read', label: 'nav.read', priority: Infinity, practice: true },
  { path: '/ear', label: 'nav.ear', priority: 4.5, practice: true },
  { path: '/harmony', label: 'nav.harmony', priority: 2.5, practice: true },
  { path: '/scales', label: 'nav.scales', priority: 5, practice: true },
  { path: '/pieces', label: 'nav.pieces', priority: 6, practice: true },
  { path: '/metronome', label: 'nav.metronome', priority: 2 },
  { path: '/progress', label: 'nav.progress', priority: 3 },
  // The first to give way: it is reached from Progress too.
  { path: '/assignments', label: 'nav.assignments', priority: 0.5 },
  { path: '/settings', label: 'nav.settings', priority: 1 },
];

/** Whether `location` is a practice page or one of its subpages (a piece belongs to Pieces). */
export function isPracticePage(location: string): boolean {
  return NAV_ITEMS.some(
    ({ path, practice }) => practice && (location === path || location.startsWith(`${path}/`)),
  );
}

/** The page's name for the window title: its navigation label, or null for the home page. */
export function pageLabel(location: string): MessageKey | null {
  if (location === '/') return null;
  if (location === '/about') return 'settings.about';
  const item = NAV_ITEMS.find(({ path }) => location === path || location.startsWith(`${path}/`));
  return item ? item.label : 'notFound.title';
}
