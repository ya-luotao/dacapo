// Addresses the app links to.

export const REPO_URL = 'https://github.com/ya-luotao/dacapo';

/** The account service's privacy policy; only a build with a sync service has one. */
export const PRIVACY_URL: string | null = import.meta.env.VITE_SYNC_ENDPOINT
  ? `${import.meta.env.VITE_SYNC_ENDPOINT.replace(/\/+$/, '')}/privacy`
  : null;
