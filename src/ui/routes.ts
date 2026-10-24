import type { MessageKey } from '../i18n/index.ts';

/**
 * The navigation, in order, as the sidebar lists it under its group's heading; Today, the home
 * page, comes first and Settings sits at the sidebar's foot. `practice`: a page where you play,
 * where the metronome chip is always shown.
 */
export const NAV_ITEMS: readonly {
  path: string;
  label: MessageKey;
  group: 'practice' | 'record' | 'foot';
  practice?: boolean;
}[] = [
  { path: '/learn', label: 'nav.learn', group: 'practice' },
  { path: '/play', label: 'nav.play', group: 'practice', practice: true },
  { path: '/read', label: 'nav.read', group: 'practice', practice: true },
  { path: '/ear', label: 'nav.ear', group: 'practice', practice: true },
  { path: '/harmony', label: 'nav.harmony', group: 'practice', practice: true },
  { path: '/scales', label: 'nav.scales', group: 'practice', practice: true },
  { path: '/pieces', label: 'nav.pieces', group: 'practice', practice: true },
  { path: '/metronome', label: 'nav.metronome', group: 'practice' },
  { path: '/progress', label: 'nav.progress', group: 'record' },
  { path: '/assignments', label: 'nav.assignments', group: 'record' },
  { path: '/settings', label: 'nav.settings', group: 'foot' },
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
  // The start page is reached from the first visit's page alone (docs/START.md).
  if (location === '/start') return 'start.title';
  const item = NAV_ITEMS.find(({ path }) => location === path || location.startsWith(`${path}/`));
  return item ? item.label : 'notFound.title';
}
