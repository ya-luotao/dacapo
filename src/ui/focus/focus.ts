import { useLayoutEffect, useSyncExternalStore } from 'react';
import { readPref, writePref } from '../../lib/localPrefs.ts';

// Focus mode: on a practice page that offers it (a piece, the scales), the header and everything
// but the score, the keyboard and what to play next make way, and the settings fold into one row
// that opens on demand. The choice, the size of the notes and whether the keyboard is drawn are
// remembered in this browser.

const FOCUS_PREF = 'dacapo.focus';
const ZOOM_PREF = 'dacapo.focus.zoom';
const KEYBOARD_PREF = 'dacapo.focus.keyboard';

/** Sizes of the notes in focus mode, relative to the page's own. */
export const ZOOMS = [0.85, 1, 1.15, 1.3, 1.5, 1.75, 2] as const;

export interface FocusState {
  /** Focus mode is chosen (it shows only on a page that offers it). */
  on: boolean;
  /** Focus bars shown now (a page shows one while `on`). */
  surfaces: number;
  /** One of ZOOMS. */
  zoom: number;
  /** The on-screen keyboard is drawn. */
  keyboard: boolean;
}

/** The size in ZOOMS closest to `value`; 1 for anything unreadable. */
export function parseZoom(value: string | null): number {
  const n = Number(value);
  if (value === null || !Number.isFinite(n)) return 1;
  return ZOOMS.reduce((best, z) => (Math.abs(z - n) < Math.abs(best - n) ? z : best), 1);
}

/** The next size up (+1) or down (−1), or null at either end. */
export function stepZoom(zoom: number, direction: 1 | -1): number | null {
  const i = ZOOMS.indexOf(parseZoom(String(zoom)) as (typeof ZOOMS)[number]);
  return ZOOMS[i + direction] ?? null;
}

let state: FocusState = {
  on: readPref(FOCUS_PREF) === '1',
  surfaces: 0,
  zoom: parseZoom(readPref(ZOOM_PREF)),
  keyboard: readPref(KEYBOARD_PREF) !== '0',
};
const listeners = new Set<() => void>();

function update(next: Partial<FocusState>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const snapshot = () => state;

export function setFocus(on: boolean): void {
  writePref(FOCUS_PREF, on ? '1' : null);
  update({ on });
}

export function setFocusZoom(zoom: number): void {
  const next = parseZoom(String(zoom));
  writePref(ZOOM_PREF, next === 1 ? null : String(next));
  update({ zoom: next });
}

export function setFocusKeyboard(keyboard: boolean): void {
  writePref(KEYBOARD_PREF, keyboard ? null : '0');
  update({ keyboard });
}

export function useFocusState(): FocusState {
  return useSyncExternalStore(subscribe, snapshot);
}

/** Whether the page open now shows its focus bar (the header hides then). */
export function useFocusActive(): boolean {
  const { on, surfaces } = useFocusState();
  return on && surfaces > 0;
}

/**
 * Counts a focus bar as shown while it is mounted (before the first paint, so the header does not
 * flash): the header hides exactly while a page shows its bar. Only FocusBar calls this.
 */
export function useFocusSurface(): void {
  useLayoutEffect(() => {
    update({ surfaces: state.surfaces + 1 });
    return () => update({ surfaces: state.surfaces - 1 });
  }, []);
}
