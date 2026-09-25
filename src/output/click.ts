// The clicks of rhythm mode and the metronome: short Web Audio sounds, the only sounds dacapo makes
// itself (the MP11SE has no drum sound over MIDI and cannot start its own metronome). Clicks are
// scheduled on the
// AudioContext's clock a short lookahead ahead by a timer ("A tale of two clocks"), so a late
// timer never makes a late click, and a stop cancels everything not yet heard.

import type { ClickSound } from '../core/metronomeSettings.ts';
import { createAudioClock, type AudioClockSource } from './audioClock.ts';
import type { Clock } from './scheduler.ts';

export const CLICK_LOOKAHEAD_MS = 100;
export const CLICK_TICK_MS = 25;
/** A click found later than this is skipped: a late click misleads more than a missing one. */
const LATE_MS = 20;
/** How long to wait for a new context's output timestamps before trusting the estimate. */
const READY_WAIT_MS = 150;
const CLICK_SECONDS = 0.035;

/** The parts of an AudioContext the click uses (a fake one in tests). */
export interface ClickContext extends AudioClockSource {
  readonly destination: unknown;
  createOscillator: () => {
    type: OscillatorType;
    frequency: {
      value: number;
      setValueAtTime: (value: number, when: number) => unknown;
      exponentialRampToValueAtTime: (value: number, when: number) => unknown;
    };
    connect: (node: never) => unknown;
    start: (when: number) => void;
    stop: (when?: number) => void;
    disconnect: () => void;
  };
  createGain: () => {
    gain: {
      value: number;
      setValueAtTime: (value: number, when: number) => unknown;
      linearRampToValueAtTime: (value: number, when: number) => unknown;
      exponentialRampToValueAtTime: (value: number, when: number) => unknown;
      setTargetAtTime: (value: number, when: number, constant: number) => unknown;
    };
    connect: (node: never) => unknown;
    disconnect: () => void;
  };
}

export type ClickLevel = 'accent' | 'normal' | 'sub';

/** Peak level of each kind of click, times the volume. */
const LEVEL_GAIN: Record<ClickLevel, number> = { accent: 1, normal: 0.6, sub: 0.32 };

/** A click on its way: `stop(0)` before it starts means it never sounds. */
export interface SoundingClick {
  stop: (when?: number) => void;
  disconnect: () => void;
}

/**
 * One click, synthesized (no audio files): `click` is rhythm mode's short blip; `wood` a dry,
 * woody tock (a falling sine with an inharmonic overtone, as a wood block rings); `beep` a soft
 * sine with a gentler attack. Accents are higher and louder, subdivisions lower and quieter.
 */
export function playClick(
  context: ClickContext,
  destination: unknown,
  when: number,
  sound: ClickSound,
  level: ClickLevel,
  volume: number,
): SoundingClick {
  const peak = Math.max(0.0001, volume * LEVEL_GAIN[level]);
  const gain = context.createGain();
  gain.connect(destination as never);
  const oscs: ReturnType<ClickContext['createOscillator']>[] = [];
  const extra: { disconnect: () => void }[] = [];
  const tone = (frequency: number) => {
    const osc = context.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    oscs.push(osc);
    return osc;
  };
  let end: number;
  if (sound === 'wood') {
    const f = level === 'accent' ? 1180 : 880;
    end = when + 0.07;
    const body = tone(f);
    body.frequency.setValueAtTime(f * 1.12, when);
    body.frequency.exponentialRampToValueAtTime(f, when + 0.018);
    body.connect(gain as never);
    const ring = context.createGain();
    ring.gain.setValueAtTime(0.35, when);
    ring.gain.exponentialRampToValueAtTime(0.0001, when + 0.03);
    tone(f * 2.71).connect(ring as never);
    ring.connect(gain as never);
    extra.push(ring);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(peak, when + 0.0015);
  } else if (sound === 'beep') {
    tone(level === 'accent' ? 1046.5 : level === 'normal' ? 784 : 659.25).connect(gain as never);
    end = when + 0.12;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(peak * 0.8, when + 0.006);
  } else {
    tone(level === 'accent' ? 1760 : level === 'normal' ? 1320 : 990).connect(gain as never);
    end = when + CLICK_SECONDS;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(peak, when + 0.001);
  }
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  for (const osc of oscs) {
    osc.start(when);
    osc.stop(end + 0.005);
  }
  return {
    stop: (at) => {
      for (const osc of oscs) osc.stop(at);
    },
    disconnect: () => {
      for (const osc of oscs) osc.disconnect();
      for (const node of extra) node.disconnect();
      gain.disconnect();
    },
  };
}

export interface ClickEvent {
  /** performance.now() ms at which it should be heard. */
  time: number;
  accent: boolean;
}

/** The clicks heard in [from, to), in order. */
export type ClickSource = (from: number, to: number) => ClickEvent[];

export interface ClickTrack {
  start: (source: ClickSource) => void;
  stop: () => void;
  /** 0–1. */
  setVolume: (volume: number) => void;
}

export interface ClickTrackOptions {
  lookahead?: number;
  interval?: number;
  /** Every click scheduled: its time, the context time it was given, and the accent. */
  onScheduled?: (click: ClickEvent, contextTime: number) => void;
}

export function createClickTrack(
  context: ClickContext,
  clock: Clock,
  options: ClickTrackOptions = {},
): ClickTrack {
  const lookahead = options.lookahead ?? CLICK_LOOKAHEAD_MS;
  const audio = createAudioClock(context);
  let volume = 0.7;
  let source: ClickSource | null = null;
  let until = 0;
  let startedAt = 0;
  let stopTimer: (() => void) | null = null;
  const sounding = new Set<SoundingClick>();

  function schedule(click: ClickEvent) {
    const now = context.currentTime;
    let when = audio.toContext(click.time);
    if (when < now) {
      if ((now - when) * 1000 > LATE_MS) return;
      when = now;
    }
    const node = playClick(
      context,
      context.destination,
      when,
      'click',
      click.accent ? 'accent' : 'normal',
      volume,
    );
    sounding.add(node);
    // Forget it once it has sounded.
    setTimeout(() => sounding.delete(node), (when - now + CLICK_SECONDS) * 1000 + 200);
    options.onScheduled?.(click, when);
  }

  function tick() {
    if (!source) return;
    const now = clock.now();
    audio.sample(now);
    if (!audio.ready() && now - startedAt < READY_WAIT_MS) return;
    const horizon = now + lookahead;
    for (const click of source(until, horizon)) schedule(click);
    until = Math.max(until, horizon);
  }

  function stop() {
    stopTimer?.();
    stopTimer = null;
    source = null;
    for (const node of sounding) {
      try {
        node.stop(0);
      } catch {
        // Already stopped.
      }
      node.disconnect();
    }
    sounding.clear();
  }

  return {
    start(next) {
      stop();
      source = next;
      startedAt = clock.now();
      until = startedAt - LATE_MS;
      audio.sample(clock.now());
      tick();
      stopTimer = clock.every(options.interval ?? CLICK_TICK_MS, tick);
    },
    stop,
    setVolume(next) {
      volume = Math.min(1, Math.max(0, next));
    },
  };
}
