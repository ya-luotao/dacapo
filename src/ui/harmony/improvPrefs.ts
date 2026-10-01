import {
  BACKING_IDS,
  BACKINGS,
  DEFAULT_IMPROV_BPM,
  isBackingId,
  isFeel,
  isImprovPattern,
  isImprovScale,
  isImprovTempo,
  type BackingId,
  type Feel,
  type ImprovPattern,
  type ImprovScale,
  type ImprovSpec,
} from '../../core/improv.ts';
import { readPref, writePref } from '../../lib/localPrefs.ts';

// Improvise's choices, remembered in this browser (docs/HARMONY.md, "Clarifications (decided
// during H6)"): the backing chosen last, and for each backing its key, scale, left hand and feel;
// the tempo, the click, call and response, and the backing's MIDI channel for all of them.

export const IMPROV_PREFS_KEY = 'dacapo.harmony.improv';

/** A backing's own choices. */
export interface BackingChoice {
  key: string;
  scale: ImprovScale;
  pattern: ImprovPattern;
  feel: Feel;
}

export interface ImprovPrefs {
  backing: BackingId;
  choices: Record<BackingId, BackingChoice>;
  bpm: number;
  click: boolean;
  call: boolean;
  /** The MIDI channel the backing is sent on (0–15, shown 1–16); the built-in piano ignores it. */
  channel: number;
}

const defaultChoice = (id: BackingId): BackingChoice => {
  const b = BACKINGS[id];
  return { key: b.keys[0]!, scale: b.scales[0]!, pattern: b.patterns[0]!, feel: b.feel };
};

export const DEFAULT_IMPROV_PREFS: ImprovPrefs = {
  backing: 'blues',
  choices: Object.fromEntries(BACKING_IDS.map((id) => [id, defaultChoice(id)])) as Record<
    BackingId,
    BackingChoice
  >,
  bpm: DEFAULT_IMPROV_BPM,
  click: false,
  call: false,
  channel: 0,
};

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** A backing's stored choices, each one its backing cannot take falling back to its default. */
function parseChoice(id: BackingId, value: unknown): BackingChoice {
  const d = defaultChoice(id);
  if (!isObject(value)) return d;
  const b = BACKINGS[id];
  return {
    key: typeof value.key === 'string' && b.keys.includes(value.key) ? value.key : d.key,
    scale: isImprovScale(value.scale) && b.scales.includes(value.scale) ? value.scale : d.scale,
    pattern:
      isImprovPattern(value.pattern) && b.patterns.includes(value.pattern)
        ? value.pattern
        : d.pattern,
    feel: isFeel(value.feel) ? value.feel : d.feel,
  };
}

export function parseImprovPrefs(text: string | null): ImprovPrefs {
  let s: unknown;
  try {
    s = text === null ? null : JSON.parse(text);
  } catch {
    s = null;
  }
  const d = DEFAULT_IMPROV_PREFS;
  if (!isObject(s)) return d;
  const choices = isObject(s.choices) ? s.choices : {};
  return {
    backing: isBackingId(s.backing) ? s.backing : d.backing,
    choices: Object.fromEntries(
      BACKING_IDS.map((id) => [id, parseChoice(id, choices[id])]),
    ) as Record<BackingId, BackingChoice>,
    bpm: isImprovTempo(s.bpm) ? s.bpm : d.bpm,
    click: typeof s.click === 'boolean' ? s.click : d.click,
    call: typeof s.call === 'boolean' ? s.call : d.call,
    channel:
      Number.isInteger(s.channel) && (s.channel as number) >= 0 && (s.channel as number) <= 15
        ? (s.channel as number)
        : d.channel,
  };
}

export const readImprovPrefs = (): ImprovPrefs => parseImprovPrefs(readPref(IMPROV_PREFS_KEY));

export function writeImprovPrefs(prefs: ImprovPrefs): void {
  writePref(IMPROV_PREFS_KEY, JSON.stringify(prefs));
}

/** The loop the prefs describe, all but its calls' seed. */
export function prefsSpec(prefs: ImprovPrefs): Omit<ImprovSpec, 'seed'> {
  return {
    backing: prefs.backing,
    ...prefs.choices[prefs.backing],
    bpm: prefs.bpm,
    call: prefs.call,
  };
}
