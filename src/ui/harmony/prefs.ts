import {
  isPatternId,
  isProgressionId,
  PROGRESSIONS,
  progressionKeys,
  type PatternId,
  type ProgressionId,
  type ProgressionKey,
} from '../../core/progressions.ts';
import { DEFAULT_PROGRESSION_BPM } from '../../core/progressionXml.ts';
import { readPref, writePref } from '../../lib/localPrefs.ts';
import { HARMONY_PRACTICES, type HarmonyPractice } from './practices.ts';

// The Harmony page's choices, remembered in this browser: the practice shown, the progression,
// key, pattern and tempo chosen last, and the tempo each progression was last opened at (the
// tempo is written into the score, not into its id: docs/HARMONY.md, "Clarifications (decided
// during H2)").

export const HARMONY_PREFS_KEY = 'dacapo.harmony';
const TEMPOS_KEY = 'dacapo.harmony.tempos';

/** Quarter notes a minute to choose from. */
export const PROGRESSION_TEMPOS = [60, 72, 80, 96, 112] as const;

export interface HarmonyPrefs {
  practice: HarmonyPractice;
  progression: ProgressionId;
  /** The key chosen last for each mode: a minor progression keeps its own. */
  majorKey: ProgressionKey;
  minorKey: ProgressionKey;
  pattern: PatternId;
  bpm: number;
}

export const DEFAULT_HARMONY_PREFS: HarmonyPrefs = {
  practice: 'chords',
  progression: 'I-IV-V-I',
  majorKey: 'C',
  minorKey: 'Am',
  pattern: 'block',
  bpm: DEFAULT_PROGRESSION_BPM,
};

const isTempo = (v: unknown): v is number => (PROGRESSION_TEMPOS as readonly unknown[]).includes(v);

function parseObject(text: string | null): Record<string, unknown> {
  try {
    const value: unknown = text === null ? null : JSON.parse(text);
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** The stored choices; each one missing or unknown falls back to its default. */
export function parseHarmonyPrefs(text: string | null): HarmonyPrefs {
  const s = parseObject(text);
  const d = DEFAULT_HARMONY_PREFS;
  return {
    practice: (HARMONY_PRACTICES as readonly unknown[]).includes(s.practice)
      ? (s.practice as HarmonyPractice)
      : d.practice,
    progression: isProgressionId(s.progression) ? s.progression : d.progression,
    majorKey: progressionKeys('major').includes(s.majorKey as string)
      ? (s.majorKey as string)
      : d.majorKey,
    minorKey: progressionKeys('minor').includes(s.minorKey as string)
      ? (s.minorKey as string)
      : d.minorKey,
    pattern: isPatternId(s.pattern) ? s.pattern : d.pattern,
    bpm: isTempo(s.bpm) ? s.bpm : d.bpm,
  };
}

export const readHarmonyPrefs = (): HarmonyPrefs => parseHarmonyPrefs(readPref(HARMONY_PREFS_KEY));

export function writeHarmonyPrefs(prefs: HarmonyPrefs): void {
  writePref(HARMONY_PREFS_KEY, JSON.stringify(prefs));
}

/** The key of the chosen progression's mode. */
export const prefsKey = (prefs: HarmonyPrefs): ProgressionKey =>
  PROGRESSIONS[prefs.progression].mode === 'major' ? prefs.majorKey : prefs.minorKey;

/** The tempo a progression (by piece id) was last opened at, or the default. */
export function readProgressionTempo(pieceId: string): number {
  const tempo = parseObject(readPref(TEMPOS_KEY))[pieceId];
  return isTempo(tempo) ? tempo : DEFAULT_PROGRESSION_BPM;
}

export function writeProgressionTempo(pieceId: string, bpm: number): void {
  const all = parseObject(readPref(TEMPOS_KEY));
  all[pieceId] = bpm;
  writePref(TEMPOS_KEY, JSON.stringify(all));
}
