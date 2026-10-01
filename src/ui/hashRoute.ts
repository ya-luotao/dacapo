import type { BaseLocationHook } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';

// The app's routes live in the fragment (`#/pieces/<id>`), and a route may carry settings after a
// `?` inside it: `#/pieces/<id>?bars=5-8&hands=left` opens the piece with those bars and that hand
// (ui/startParams.ts). wouter's own hash hook would hand `<id>?bars=5-8` to the route as the id,
// and on a navigation move the settings out of the fragment into the address's query, where they
// would stay for every page after. This one keeps them in the fragment: the route is what comes
// before the `?`, the settings what comes after.

/** A location as wouter's hash hook gives it, split at its first `?`. */
export function splitRoute(location: string): { path: string; search: string } {
  const at = location.indexOf('?');
  return at < 0
    ? { path: location, search: '' }
    : { path: location.slice(0, at), search: location.slice(at + 1) };
}

/** Goes to a route, its settings (if any) staying in the fragment. */
export function navigate(
  to: string,
  { state = null, replace = false }: { state?: unknown; replace?: boolean } = {},
): void {
  const oldURL = location.href;
  const url = new URL(oldURL);
  url.hash = `/${to.replace(/^#?\/?/, '')}`;
  const newURL = url.href;
  history[replace ? 'replaceState' : 'pushState'](state, '', newURL);
  // wouter's hash hook listens for this, as after its own navigation.
  dispatchEvent(new HashChangeEvent('hashchange', { oldURL, newURL }));
}

/** The settings after the route's `?`, as written (wouter's `useSearch` reads them too). */
export function useRouteSearch(): string {
  const [location] = useHashLocation();
  return splitRoute(location).search;
}

/** The router's location hook: the route without its settings. */
export const useHashRoute: BaseLocationHook = () => {
  const [location] = useHashLocation();
  return [splitRoute(location).path, navigate];
};
useHashRoute.searchHook = useRouteSearch;
useHashRoute.hrefs = (href: string) => `#${href}`;
