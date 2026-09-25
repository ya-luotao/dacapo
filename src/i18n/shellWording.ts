import type { Shell } from '../lib/shell.ts';
import type { Dictionary, MessageKey } from './en.ts';

/** Keys ending in this are the Apple app's wording for the key without it. */
export const APP_SUFFIX = '.app';

/**
 * The message for `key`: in the Apple app its `.app` variant when the dictionary has one (the app
 * has no browser, tabs, site data or downloads to speak of), otherwise the key itself.
 */
export function messageFor(dictionary: Dictionary, key: MessageKey, shell: Shell): string {
  if (shell === 'apple') {
    const app = (dictionary as Readonly<Record<string, string>>)[`${key}${APP_SUFFIX}`];
    if (app !== undefined) return app;
  }
  return dictionary[key];
}
