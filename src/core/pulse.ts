// The metronome's timeline: when every beat and subdivision falls, which are accented, muted or
// silent, and where between two beats a given moment lies.
//
// Time is a line of segments, each with one integer tempo. A click's time is computed from its
// segment's start alone, `at + (k × 60000) / (bpm × subdivision)`: the numerator is an exact
// integer and there is one division, so the error never grows with the number of beats (adding up
// intervals would). A tempo change, a trainer step or a new meter starts a new segment on a beat,
// at the time the old segment gives that beat, so nothing jumps.

export const MIN_BPM = 20;
export const MAX_BPM = 300;

export type BeatAccent = 'accent' | 'normal' | 'mute';
export type Subdivision = 1 | 2 | 3 | 4;
export const SUBDIVISIONS: readonly Subdivision[] = [1, 2, 3, 4];

/**
 * Ramp: from the tempo it starts at towards `to`, `step` BPM every `every` bars. Gap: `play` bars
 * heard, then `mute` bars silent, round and round.
 */
export type Trainer =
  | { kind: 'off' }
  | { kind: 'ramp'; to: number; step: number; every: number }
  | { kind: 'gap'; play: number; mute: number };

export interface PulseConfig {
  /** Beats per minute; a whole number. */
  bpm: number;
  /** Beats per bar. */
  beats: number;
  subdivision: Subdivision;
  /** One per beat of the bar; a missing entry is `normal`. */
  accents: readonly BeatAccent[];
  trainer: Trainer;
}

/** `mute`: a muted beat, its subdivisions, or anything in a silent bar of the gap trainer. */
export type ClickLevel = 'accent' | 'normal' | 'sub' | 'mute';

export interface PulseClick {
  at: number;
  /** Beats from the start (0 is the first downbeat). */
  beat: number;
  /** Bars from the start. */
  bar: number;
  /** 0-based beat of the bar. */
  inBar: number;
  /** 0 on the beat, then 1 … subdivision − 1. */
  sub: number;
  level: ClickLevel;
}

export interface PulsePosition {
  beat: number;
  bar: number;
  inBar: number;
  beats: number;
  /** 0 on the beat, rising to 1 at the next one. */
  phase: number;
  /** The time of this beat and of the next. */
  from: number;
  to: number;
  bpm: number;
  subdivision: Subdivision;
  accent: BeatAccent;
  /** A silent bar of the gap trainer. */
  silent: boolean;
}

export interface Pulse {
  /** Every click (muted ones included) with `from ≤ at < to`, in order. */
  clicks: (from: number, to: number) => PulseClick[];
  /** Null before the first beat. */
  position: (at: number) => PulsePosition | null;
  /** The tempo in force at `at`. */
  bpmAt: (at: number) => number;
  /**
   * Changes the settings from the first beat later than `after`, and returns that beat's time:
   * the interval running now keeps its length. A new `bpm` also restarts a ramp from it; without
   * one the tempo reached so far is kept. A new number of beats starts a bar there.
   */
  update: (patch: Partial<PulseConfig>, after: number) => number;
  origin: number;
}

interface Segment {
  /** Its first beat and that beat's time. */
  beat: number;
  at: number;
  bpm: number;
  config: PulseConfig;
  /** A downbeat of this segment's bar grid, and the bar it starts. */
  barBeat: number;
  bar0: number;
  /** Where the ramp counts from, or null without one. */
  ramp: { bar: number; bpm: number } | null;
}

export function clampBpm(bpm: number): number {
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
}

/** The ramp's tempo in `bar`: towards the target in whole steps, never past it. */
export function rampTempo(
  base: { bar: number; bpm: number },
  bar: number,
  trainer: { to: number; step: number; every: number },
): number {
  const steps = Math.max(0, Math.floor((bar - base.bar) / trainer.every));
  if (trainer.to >= base.bpm) return Math.min(trainer.to, base.bpm + steps * trainer.step);
  return Math.max(trainer.to, base.bpm - steps * trainer.step);
}

export function isSilentBar(trainer: Trainer, bar: number): boolean {
  if (trainer.kind !== 'gap') return false;
  const cycle = trainer.play + trainer.mute;
  return ((bar % cycle) + cycle) % cycle >= trainer.play;
}

function time(seg: Segment, beat: number, sub = 0): number {
  const s = seg.config.subdivision;
  return seg.at + (((beat - seg.beat) * s + sub) * 60_000) / (seg.bpm * s);
}

function barOf(seg: Segment, beat: number): { bar: number; inBar: number } {
  const { beats } = seg.config;
  const rel = beat - seg.barBeat;
  const inBar = ((rel % beats) + beats) % beats;
  return { bar: seg.bar0 + (rel - inBar) / beats, inBar };
}

function levelOf(seg: Segment, bar: number, inBar: number, sub: number): ClickLevel {
  const accent = seg.config.accents[inBar] ?? 'normal';
  if (accent === 'mute' || isSilentBar(seg.config.trainer, bar)) return 'mute';
  if (sub > 0) return 'sub';
  return accent;
}

export function createPulse(config: PulseConfig, origin: number): Pulse {
  const start: Segment = {
    beat: 0,
    at: origin,
    bpm: config.bpm,
    config,
    barBeat: 0,
    bar0: 0,
    ramp: config.trainer.kind === 'ramp' ? { bar: 0, bpm: config.bpm } : null,
  };
  const segments: Segment[] = [start];
  const first = () => segments[0]!;
  const last = () => segments[segments.length - 1]!;

  /** Adds the ramp's steps up to beat `until`. */
  function extend(until: number) {
    for (;;) {
      const seg = last();
      const { trainer, beats } = seg.config;
      if (!seg.ramp || trainer.kind !== 'ramp') return;
      const { bar } = barOf(seg, seg.beat);
      const next =
        seg.ramp.bar + (Math.floor((bar - seg.ramp.bar) / trainer.every) + 1) * trainer.every;
      const bpm = rampTempo(seg.ramp, next, trainer);
      if (bpm === seg.bpm) return;
      const beat = seg.barBeat + (next - seg.bar0) * beats;
      if (beat > until) return;
      segments.push({ ...seg, beat, at: time(seg, beat), bpm });
    }
  }

  function segmentOfBeat(beat: number): Segment {
    extend(beat);
    for (let i = segments.length - 1; i > 0; i--)
      if (segments[i]!.beat <= beat) return segments[i]!;
    return first();
  }

  /** The beat at or before `at` (−1 before the start) and its segment. */
  function locate(at: number): { beat: number; seg: Segment } {
    if (at < origin) return { beat: -1, seg: first() };
    for (;;) {
      const seg = last();
      const guess = seg.beat + Math.max(0, Math.floor(((at - seg.at) * seg.bpm) / 60_000));
      const count = segments.length;
      extend(guess);
      if (segments.length === count) break;
    }
    let seg = first();
    for (let i = segments.length - 1; i >= 0; i--) {
      if (segments[i]!.at <= at) {
        seg = segments[i]!;
        break;
      }
    }
    let beat = seg.beat + Math.max(0, Math.floor(((at - seg.at) * seg.bpm) / 60_000));
    // The division can land a hair either side of a beat.
    while (beat > seg.beat && time(seg, beat) > at) beat--;
    while (time(seg, beat + 1) <= at) beat++;
    return { beat, seg: segmentOfBeat(beat) };
  }

  return {
    origin,
    clicks(from, to) {
      const out: PulseClick[] = [];
      if (to <= from) return out;
      for (let beat = Math.max(0, locate(from).beat); ; beat++) {
        const seg = segmentOfBeat(beat);
        if (time(seg, beat) >= to) return out;
        const { bar, inBar } = barOf(seg, beat);
        for (let sub = 0; sub < seg.config.subdivision; sub++) {
          const at = time(seg, beat, sub);
          if (at >= to) return out;
          if (at >= from)
            out.push({ at, beat, bar, inBar, sub, level: levelOf(seg, bar, inBar, sub) });
        }
      }
    },
    position(at) {
      const { beat, seg } = locate(at);
      if (beat < 0) return null;
      const from = time(seg, beat);
      const to = time(seg, beat + 1);
      const { bar, inBar } = barOf(seg, beat);
      return {
        beat,
        bar,
        inBar,
        beats: seg.config.beats,
        phase: Math.min(1, Math.max(0, (at - from) / (to - from))),
        from,
        to,
        bpm: seg.bpm,
        subdivision: seg.config.subdivision,
        accent: seg.config.accents[inBar] ?? 'normal',
        silent: isSilentBar(seg.config.trainer, bar),
      };
    },
    bpmAt: (at) => locate(at).seg.bpm,
    update(patch, after) {
      const { beat: before } = locate(after);
      const beat = before + 1;
      const prev = segmentOfBeat(beat - 1);
      // Steps of the old settings from this beat on are replaced.
      while (segments.length > 1 && last().beat >= beat) segments.pop();
      const at = beat === 0 ? origin : time(prev, beat);
      const config: PulseConfig = { ...prev.config, ...patch };
      const { bar, inBar } = barOf(prev, beat);
      const newBar = config.beats !== prev.config.beats;
      const barBeat = newBar ? beat : prev.barBeat;
      const bar0 = newBar ? (inBar === 0 ? bar : bar + 1) : prev.bar0;
      const bpm = patch.bpm ?? prev.bpm;
      const startBar = newBar ? bar0 : bar;
      const ramp =
        config.trainer.kind !== 'ramp'
          ? null
          : patch.bpm !== undefined || !prev.ramp || patch.trainer
            ? { bar: startBar, bpm }
            : prev.ramp;
      const seg: Segment = { beat, at, bpm, config, barBeat, bar0, ramp };
      if (beat === 0) segments.length = 0;
      segments.push(seg);
      return at;
    },
  };
}
