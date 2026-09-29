import { readPref, writePref } from '../../lib/localPrefs.ts';

// Which lessons this browser has finished (their last exercise done): a tick on the lessons'
// contents, nothing more. Kept on the device like the other preferences, not synced.

const KEY = 'dacapo.learn.done';

export function readDone(): ReadonlySet<string> {
  return new Set((readPref(KEY) ?? '').split(',').filter(Boolean));
}

export function markDone(slug: string): void {
  const done = new Set(readDone()).add(slug);
  writePref(KEY, [...done].join(','));
}
