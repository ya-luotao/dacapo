import { LOCALES, readLocaleOverride, writeLocaleOverride, type Locale } from './locale.ts';

// `?lang=` (docs/SITE.md, "The way into the app"): a page of the site that is written in one
// language opens the app with it, `/?lang=zh-TW#/learn/staff`. The app takes it as the visitor's
// language when they have not chosen one, and it becomes their choice, as picking it in Settings
// would; with a choice kept it changes nothing. Either way the parameter then leaves the address.

/** The language a `lang` parameter names, in any case (`zh-tw`); null for none, or one the app does not have. */
export function langParam(search: string): Locale | null {
  const value = new URLSearchParams(search).get('lang')?.toLowerCase();
  if (value === undefined) return null;
  return LOCALES.find((locale) => locale.toLowerCase() === value) ?? null;
}

/** The address without `lang`: the rest of its query and the route after its `#` stay as they are. */
export function withoutLangParam(address: string): string {
  const url = new URL(address);
  url.searchParams.delete('lang');
  return url.href;
}

/**
 * Takes the language the address asks for, before the app starts. Returns it when it was taken
 * (none was chosen before), so that it holds for this visit even where nothing can be kept; null
 * otherwise. The address loses the parameter without a reload, and keeps its route.
 */
export function adoptLanguage(
  location: Pick<Location, 'href' | 'search'> | undefined = globalThis.location,
  history: Pick<History, 'replaceState' | 'state'> | undefined = globalThis.history,
): Locale | null {
  if (!location || !new URLSearchParams(location.search).has('lang')) return null;
  const asked = langParam(location.search);
  const taken = asked !== null && readLocaleOverride() === null ? asked : null;
  if (taken !== null) writeLocaleOverride(taken);
  history?.replaceState(history.state, '', withoutLangParam(location.href));
  return taken;
}
