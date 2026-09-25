import { readPref, writePref } from '../../lib/localPrefs.ts';
import type { ClickMode } from '../../output/rhythm.ts';

// Rhythm mode's settings, kept in this browser: the click and the latency found by calibration
// (it belongs to this computer's audio and MIDI path, so it is not exported).

const CLICK_PREF = 'dacapo.click';
const VOLUME_PREF = 'dacapo.click.volume';
const LATENCY_PREF = 'dacapo.latency';

export const CLICK_MODES: readonly ClickMode[] = ['on', 'countIn', 'off'];
export const DEFAULT_VOLUME = 70;

export function readClickMode(): ClickMode {
  const value = readPref(CLICK_PREF);
  return CLICK_MODES.includes(value as ClickMode) ? (value as ClickMode) : 'on';
}

export function writeClickMode(mode: ClickMode): void {
  writePref(CLICK_PREF, mode === 'on' ? null : mode);
}

/** 0–100. */
export function readClickVolume(): number {
  const value = Number(readPref(VOLUME_PREF) ?? DEFAULT_VOLUME);
  return Number.isInteger(value) && value >= 0 && value <= 100 ? value : DEFAULT_VOLUME;
}

export function writeClickVolume(volume: number): void {
  writePref(VOLUME_PREF, volume === DEFAULT_VOLUME ? null : String(Math.round(volume)));
}

export interface Latency {
  /** How much later than the click the player's notes arrive, in ms. */
  offset: number;
  /** When it was measured (epoch ms). */
  at: number;
}

/** Offsets beyond this are not a latency but a mistake. */
const MAX_OFFSET_MS = 500;

export function parseLatency(text: string | null): Latency | null {
  try {
    const value: unknown = JSON.parse(text ?? 'null');
    if (typeof value !== 'object' || value === null) return null;
    const { offset, at } = value as Record<string, unknown>;
    if (typeof offset !== 'number' || !Number.isFinite(offset) || Math.abs(offset) > MAX_OFFSET_MS)
      return null;
    if (typeof at !== 'number' || !Number.isFinite(at)) return null;
    return { offset, at };
  } catch {
    return null;
  }
}

/** Null until the player has calibrated in this browser. */
export function readLatency(): Latency | null {
  return parseLatency(readPref(LATENCY_PREF));
}

export function writeLatency(latency: Latency | null): void {
  writePref(LATENCY_PREF, latency && JSON.stringify(latency));
}
