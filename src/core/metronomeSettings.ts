// The metronome's settings: what the player chooses, how it is checked when read back, and how
// a time signature becomes beats to click.

import { isCompound } from './metronome.ts';
import {
  clampBpm,
  MAX_BPM,
  MIN_BPM,
  SUBDIVISIONS,
  type BeatAccent,
  type PulseConfig,
  type Subdivision,
  type Trainer,
} from './pulse.ts';

export type ClickSound = 'wood' | 'click' | 'beep' | 'mechanical';
export const CLICK_SOUNDS: readonly ClickSound[] = ['wood', 'click', 'beep', 'mechanical'];

export interface Meter {
  numerator: number;
  denominator: number;
}

/** The time signatures offered, as `n/d`. */
export const METERS: readonly string[] = [
  '2/4',
  '3/4',
  '4/4',
  '5/4',
  '6/4',
  '2/2',
  '3/8',
  '5/8',
  '6/8',
  '7/8',
  '9/8',
  '12/8',
];

export type TrainerKind = Trainer['kind'];
export const TRAINER_KINDS: readonly TrainerKind[] = ['off', 'ramp', 'gap'];

/** Every trainer field is kept, so switching between kinds does not lose the other's values. */
export interface TrainerSettings {
  kind: TrainerKind;
  /** Ramp: the tempo it starts from, the target, `step` BPM every `every` bars. */
  from: number;
  to: number;
  step: number;
  every: number;
  /** Gap: bars heard, then bars silent. */
  play: number;
  mute: number;
}

export interface MetronomeSettings {
  bpm: number;
  meter: Meter;
  /** One per beat of the bar. */
  accents: BeatAccent[];
  subdivision: Subdivision;
  sound: ClickSound;
  /** 0–100. */
  volume: number;
  /** Visual only: the animation runs, nothing sounds. */
  silent: boolean;
  trainer: TrainerSettings;
}

export const TRAINER_LIMITS = {
  step: [1, 20],
  every: [1, 16],
  play: [1, 8],
  mute: [1, 8],
} as const;

export const DEFAULT_SETTINGS: MetronomeSettings = {
  bpm: 80,
  meter: { numerator: 4, denominator: 4 },
  accents: defaultAccents(4),
  subdivision: 1,
  sound: 'wood',
  volume: 70,
  silent: false,
  trainer: { kind: 'off', from: 60, to: 100, step: 4, every: 4, play: 3, mute: 1 },
};

export function defaultAccents(beats: number): BeatAccent[] {
  return Array.from({ length: beats }, (_, i) => (i === 0 && beats > 1 ? 'accent' : 'normal'));
}

/** Keeps the pattern of the beats that remain; new beats are plain. */
export function resizeAccents(accents: readonly BeatAccent[], beats: number): BeatAccent[] {
  if (accents.length === 0) return defaultAccents(beats);
  return Array.from({ length: beats }, (_, i) => accents[i] ?? 'normal');
}

/** Normal → accent → mute → normal. */
export function nextAccent(accent: BeatAccent): BeatAccent {
  return accent === 'normal' ? 'accent' : accent === 'accent' ? 'mute' : 'normal';
}

export function parseMeter(text: string): Meter | null {
  const match = /^(\d{1,2})\/(2|4|8)$/.exec(text);
  if (!match) return null;
  const numerator = Number(match[1]);
  return numerator >= 1 && numerator <= 12 ? { numerator, denominator: Number(match[2]) } : null;
}

export const meterText = (m: Meter) => `${m.numerator}/${m.denominator}`;

/**
 * The beats clicked in a bar and the note value of one, in quarter notes. Compound meters click
 * the dotted beat (6/8 is two ♩. beats), as rhythm mode does.
 */
export function meterBeats(m: Meter): { beats: number; unit: number } {
  const compound = isCompound({ beats: m.numerator, beatType: m.denominator });
  const unit = (4 / m.denominator) * (compound ? 3 : 1);
  return { beats: compound ? m.numerator / 3 : m.numerator, unit };
}

/** What the timeline needs from the settings. */
export function pulseConfig(settings: MetronomeSettings, bpm = settings.bpm): PulseConfig {
  const { beats } = meterBeats(settings.meter);
  const t = settings.trainer;
  const trainer: Trainer =
    t.kind === 'ramp'
      ? { kind: 'ramp', to: t.to, step: t.step, every: t.every }
      : t.kind === 'gap'
        ? { kind: 'gap', play: t.play, mute: t.mute }
        : { kind: 'off' };
  return {
    bpm,
    beats,
    subdivision: settings.subdivision,
    accents: resizeAccents(settings.accents, beats),
    trainer,
  };
}

/**
 * A piece's tempo for the metronome: `quarterBpm` (♩ = …, as the score's tempo marks give it) in
 * the beat of `meter`, so 6/8 at ♩ = 120 clicks ♩. = 80.
 */
export function tempoForMeter(quarterBpm: number, meter: Meter): number {
  return clampBpm(quarterBpm / meterBeats(meter).unit);
}

function int(value: unknown, low: number, high: number, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= low && value <= high
    ? value
    : fallback;
}

/** Settings read back from storage: anything missing or out of range takes its default. */
export function parseSettings(text: string | null): MetronomeSettings {
  let raw: unknown;
  try {
    raw = JSON.parse(text ?? 'null');
  } catch {
    raw = null;
  }
  const d = DEFAULT_SETTINGS;
  if (typeof raw !== 'object' || raw === null) return { ...d, accents: [...d.accents] };
  const r = raw as Record<string, unknown>;
  const meterRaw = r.meter as Partial<Meter> | undefined;
  const meter =
    (meterRaw && parseMeter(`${meterRaw.numerator}/${meterRaw.denominator}`)) ?? d.meter;
  const { beats } = meterBeats(meter);
  const accents = Array.isArray(r.accents)
    ? resizeAccents(
        (r.accents as unknown[]).map((a): BeatAccent =>
          a === 'accent' || a === 'mute' ? a : 'normal',
        ),
        beats,
      )
    : defaultAccents(beats);
  const tr = (typeof r.trainer === 'object' && r.trainer !== null ? r.trainer : {}) as Record<
    string,
    unknown
  >;
  const L = TRAINER_LIMITS;
  return {
    bpm: int(r.bpm, MIN_BPM, MAX_BPM, d.bpm),
    meter,
    accents,
    subdivision: SUBDIVISIONS.includes(r.subdivision as Subdivision)
      ? (r.subdivision as Subdivision)
      : d.subdivision,
    sound: CLICK_SOUNDS.includes(r.sound as ClickSound) ? (r.sound as ClickSound) : d.sound,
    volume: int(r.volume, 0, 100, d.volume),
    silent: r.silent === true,
    trainer: {
      kind: TRAINER_KINDS.includes(tr.kind as TrainerKind) ? (tr.kind as TrainerKind) : 'off',
      from: int(tr.from, MIN_BPM, MAX_BPM, d.trainer.from),
      to: int(tr.to, MIN_BPM, MAX_BPM, d.trainer.to),
      step: int(tr.step, L.step[0], L.step[1], d.trainer.step),
      every: int(tr.every, L.every[0], L.every[1], d.trainer.every),
      play: int(tr.play, L.play[0], L.play[1], d.trainer.play),
      mute: int(tr.mute, L.mute[0], L.mute[1], d.trainer.mute),
    },
  };
}
