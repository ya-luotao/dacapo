import { useSyncExternalStore } from 'react';
import {
  FULL_KEYS,
  isFullKeys,
  readKeyRange,
  sameKeys,
  type KeyRange,
} from '../core/instrument.ts';
import { readPref, writePref } from '../lib/localPrefs.ts';

// The instrument's keys as the browser keeps them (docs/PERSONAL.md, "The instrument's keys"):
// the lowest and the highest key of the keyboard in front of this device. Per device, neither
// synced nor exported; 88 keys keep nothing, as before the keyboard could be chosen.

export const INSTRUMENT_RANGE_PREF = 'dacapo.instrument.range';

let current: KeyRange | null = null;
const listeners = new Set<() => void>();

/** The keyboard chosen; 88 keys when none was, or when what was kept cannot be read. */
export function readInstrumentKeys(): KeyRange {
  if (current) return current;
  let kept: unknown = null;
  try {
    kept = JSON.parse(readPref(INSTRUMENT_RANGE_PREF) ?? 'null');
  } catch {
    // Not a keyboard: 88 keys.
  }
  const keys = readKeyRange(kept);
  // One object for 88 keys, and the same object until the choice changes: what depends on the
  // keyboard is worked out once.
  current = isFullKeys(keys) ? FULL_KEYS : keys;
  return current;
}

export function writeInstrumentKeys(keys: KeyRange): void {
  const next = isFullKeys(keys) ? FULL_KEYS : { low: keys.low, high: keys.high };
  writePref(INSTRUMENT_RANGE_PREF, next === FULL_KEYS ? null : JSON.stringify(next));
  if (current && sameKeys(current, next)) return;
  current = next;
  for (const listener of [...listeners]) listener();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => void listeners.delete(onChange);
}

/** The instrument's keys, followed as Settings changes them. */
export function useInstrumentKeys(): KeyRange {
  return useSyncExternalStore(subscribe, readInstrumentKeys);
}

/** For tests: what was read is forgotten, so the next read is of the preference again. */
export function forgetInstrumentKeys(): void {
  current = null;
}
