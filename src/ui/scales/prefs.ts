import {
  CLICK_MAX_BPM,
  CLICK_MIN_BPM,
  isClickTempo,
  isNotesPerBeat,
  type ClickSettings,
  type NotesPerBeat,
} from '../../core/scaleClick.ts';
import { exerciseKey, parseExerciseKey } from '../../core/scales.ts';
import type { ScaleExercise } from '../../core/scaleTypes.ts';
import { readPref, writePref } from '../../lib/localPrefs.ts';

export const EXERCISE_PREF = 'dacapo.scales.exercise';
export const CLICK_PREF = 'dacapo.scales.click';

export const DEFAULT_EXERCISE: ScaleExercise = {
  type: 'major',
  tonic: 'C',
  octaves: 2,
  hands: 'right',
};

/** The last exercise chosen in this browser. */
export function readExercise(): ScaleExercise {
  const stored = parseExerciseKey(readPref(EXERCISE_PREF) ?? '');
  return stored ?? DEFAULT_EXERCISE;
}

export function writeExercise(e: ScaleExercise): void {
  writePref(EXERCISE_PREF, exerciseKey(e));
}

/** Free tempo or with the click, and the click's settings (kept while the click is off). */
export interface ClickPrefs extends Omit<ClickSettings, 'perBeat'> {
  on: boolean;
  /** The notes to the beat chosen (an exercise with a rhythm of its own keeps it). */
  perBeat: NotesPerBeat;
}

/** Sixteenths at ♩ = 60: four notes a second, a scale's usual first tempo with a click. */
export const DEFAULT_CLICK: ClickPrefs = { on: false, bpm: 60, perBeat: 4 };

export function clampTempo(bpm: number): number {
  return Math.min(CLICK_MAX_BPM, Math.max(CLICK_MIN_BPM, Math.round(bpm)));
}

export function parseClickPrefs(text: string | null): ClickPrefs {
  try {
    const value: unknown = JSON.parse(text ?? 'null');
    if (typeof value !== 'object' || value === null) return DEFAULT_CLICK;
    const { on, bpm, perBeat } = value as Record<string, unknown>;
    return {
      on: on === true,
      bpm: isClickTempo(bpm) ? bpm : DEFAULT_CLICK.bpm,
      perBeat: isNotesPerBeat(perBeat) ? perBeat : DEFAULT_CLICK.perBeat,
    };
  } catch {
    return DEFAULT_CLICK;
  }
}

/** The last choice of tempo in this browser. */
export function readClickPrefs(): ClickPrefs {
  return parseClickPrefs(readPref(CLICK_PREF));
}

export function writeClickPrefs(prefs: ClickPrefs): void {
  const { on, bpm, perBeat } = prefs;
  const isDefault =
    on === DEFAULT_CLICK.on && bpm === DEFAULT_CLICK.bpm && perBeat === DEFAULT_CLICK.perBeat;
  writePref(CLICK_PREF, isDefault ? null : JSON.stringify({ on, bpm, perBeat }));
}
