// The list of a build's files that the offline worker may store (docs/OFFLINE.md): each with the
// group it is in. vite.config.ts writes the list from the build's own output and puts it in
// sw.js; nothing here knows a file's name in advance.

/**
 * `app` is stored when the worker is installed. The others are large or not always needed: stored
 * when first fetched, and all at once with Settings' "Store everything".
 */
export const OFFLINE_GROUPS = [
  'app',
  'engraver',
  'piano',
  'pictures',
  'languages',
  'licences',
] as const;
export type OfflineGroup = (typeof OFFLINE_GROUPS)[number];

/** The page's address in the list: the scope itself. `index.html` is never asked for by name. */
export const PAGE = '';

/** A file's address below the scope, its group, and its size in bytes. */
export type OfflineFile = readonly [path: string, group: OfflineGroup, bytes: number];

export interface OfflineList {
  /** The hash of `files`. */
  version: string;
  files: readonly OfflineFile[];
}

const VEROVIO = /[\\/]node_modules[\\/]verovio[\\/]/;
const DICTIONARY = /[\\/]src[\\/]i18n[\\/][^\\/]+\.ts$/;

/**
 * The group of a file of the build, or null when the worker leaves it alone. `from` is what the
 * build made it from: an asset's source files, or the module a chunk loaded on demand stands for.
 */
export function groupOf(path: string, from: readonly string[] = []): OfflineGroup | null {
  if (path === 'index.html') return 'app';
  // No other page, wherever it is: Cloudflare answers `x.html` with a redirect to `x`, which can
  // never be stored, and one such file among the app's would fail every install.
  if (path.endsWith('.html')) return null;
  if (path.startsWith('assets/')) {
    if (path.endsWith('.map')) return null;
    // Verovio's two files, shipped as they are (ui/notation/verovio.ts).
    if (from.length > 0 && from.every((source) => VEROVIO.test(source))) return 'engraver';
    // A dictionary other than English (i18n/locale.ts): its own chunk, loaded when it is chosen.
    if (from.length === 1 && DICTIONARY.test(from[0]!)) return 'languages';
    return 'app';
  }
  if (path === 'manifest.webmanifest' || path === 'favicon.svg') return 'app';
  if (path.startsWith('icons/')) return 'app';
  if (path.startsWith('piano/')) return 'piano';
  if (path.startsWith('learn/')) return 'pictures';
  if (path.startsWith('licenses/')) return 'licences';
  // _headers, robots.txt, the sitemap, the social card, sw.js itself, and whatever is added to
  // public/ later: not the app's to keep.
  return null;
}
