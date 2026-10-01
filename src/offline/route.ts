// How the offline worker answers a request (docs/OFFLINE.md, "How a request is answered"): a pure
// decision from the request's address and kind. The worker (worker.ts) carries it out.

import { PAGE } from './files.ts';

/** What the decision needs of a request. */
export interface RequestFacts {
  url: string;
  method: string;
  /** `Request.mode`: `navigate` for the page itself. */
  mode: string;
  /** Whether it asks for a part of the file (a `Range` header). */
  range: boolean;
}

export type Answer =
  /** Not answered: the browser does as it would without a worker. */
  | { kind: 'pass' }
  /** The page: from the network, else from the copy stored. */
  | { kind: 'page' }
  /** A file under assets/: from a store, else from the network; kept when the list has it. */
  | { kind: 'asset'; path: string; keep: boolean }
  /** Another file of the list: from the store, and fetched again in the background. */
  | { kind: 'file'; path: string };

const PASS: Answer = { kind: 'pass' };

/**
 * A URL's address below the scope (`assets/a.js`, or `''` for the scope itself), or null when it
 * is another origin's or outside the scope. `scope` is absolute and ends in `/`.
 */
export function pathBelow(url: URL, scope: string): string | null {
  const root = new URL(scope);
  if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname)) return null;
  return url.pathname.slice(root.pathname.length);
}

/**
 * @param scope the worker's scope: absolute, ending in `/`
 * @param listed whether the build's list has a file at this address below the scope
 */
export function route(
  request: RequestFacts,
  scope: string,
  listed: (path: string) => boolean,
): Answer {
  if (request.method !== 'GET') return PASS;
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return PASS;
  }
  const path = pathBelow(url, scope);
  if (path === null) return PASS;
  // The page is the scope's root, whatever its query; any other page on the origin (the privacy
  // policy, a profile) is not the app's.
  if (request.mode === 'navigate') {
    return path === PAGE || path === 'index.html' ? { kind: 'page' } : PASS;
  }
  // A stored copy is the whole file under its own address: a part of one, or an address with a
  // query, is left to the network.
  if (request.range || url.search !== '') return PASS;
  // Named by its content, so a copy never goes stale. One the list does not have may be a file
  // of the release before, which a tab still open on it finds in that release's store.
  if (path.startsWith('assets/')) return { kind: 'asset', path, keep: listed(path) };
  if (path !== PAGE && listed(path)) return { kind: 'file', path };
  return PASS;
}

/**
 * Whether a page is this build's: every file under assets/ that it names is in the list (and it
 * names one). A newer release's page is not: stored beside this build's files, it would open
 * without a network and find none of its own.
 */
export function pageBelongs(
  html: string,
  scope: string,
  listed: (path: string) => boolean,
): boolean {
  let named = 0;
  for (const [, address] of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)) {
    let url: URL;
    try {
      url = new URL(address!, scope);
    } catch {
      continue;
    }
    const path = pathBelow(url, scope);
    if (path === null || !path.startsWith('assets/')) continue;
    if (!listed(path)) return false;
    named++;
  }
  return named > 0;
}
