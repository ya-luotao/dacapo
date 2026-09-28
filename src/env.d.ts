/** package.json version, set by Vite (vite.config.ts). */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /**
   * The sync service (docs/SYNC.md), e.g. https://api.playdacapo.com. Set by the official builds
   * only; unset, the app has no account and makes no request.
   */
  readonly VITE_SYNC_ENDPOINT?: string;
}
