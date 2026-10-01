// Addresses the app links to.

export const REPO_URL = 'https://github.com/ya-luotao/dacapo';

/** The account service's privacy policy; only a build with a sync service has one. */
export const PRIVACY_URL: string | null = import.meta.env.VITE_SYNC_ENDPOINT
  ? `${import.meta.env.VITE_SYNC_ENDPOINT.replace(/\/+$/, '')}/privacy`
  : null;

/** Where the app is published. */
export const PUBLIC_URL = 'https://playdacapo.com/';

/**
 * The address a link into the app is made with, up to its `#`: the page's own while it is served
 * over the web (so a fork's or a local build's links open that build), the published one
 * otherwise: in the Apple app the page's address is `dacapo://app/`, which opens nowhere else.
 */
export function appUrl(
  location: Pick<Location, 'protocol' | 'origin' | 'pathname'> | undefined = globalThis.location,
): string {
  return location && /^https?:$/.test(location.protocol)
    ? `${location.origin}${location.pathname}`
    : PUBLIC_URL;
}
