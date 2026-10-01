// What must hold of a build's list before a worker is shipped with it (docs/OFFLINE.md,
// "Releases"). The plugin in vite.config.ts fails the build on any of these: a worker with a list
// that cannot be installed leaves every browser with the worker it had.

import { PAGE, type OfflineList } from './files.ts';
import { pageBelongs } from './route.ts';

/**
 * The reasons this list must not ship, none when it is sound.
 * @param page the built `index.html`
 * @param base the build's base path, ending in `/`
 */
export function listProblems(list: OfflineList, page: string, base: string): string[] {
  const problems: string[] = [];
  const paths = new Set(list.files.map(([path]) => path));
  if (!/^[0-9a-f]{12}$/.test(list.version)) problems.push('the list has no version');
  if (paths.size !== list.files.length) problems.push('a file is listed twice');
  if (list.files.find(([path]) => path === PAGE)?.[1] !== 'app') {
    problems.push('the page is not in the list as one of the app’s files');
  }
  for (const path of paths) {
    // Stored by its address: `x.html` is answered with a redirect, the worker stores no worker.
    if (path.endsWith('.html')) problems.push(`${path}: a page other than the app’s is listed`);
    if (path === 'sw.js') problems.push('sw.js is listed');
  }
  // The same test the worker makes before it stores a page: one that fails it here would never
  // be stored, and no install would finish.
  const scope = new URL(base, 'https://build.invalid').href;
  if (!pageBelongs(page, scope, (path) => paths.has(path))) {
    problems.push('the page names a file under assets/ that the list does not have, or none');
  }
  return problems;
}
