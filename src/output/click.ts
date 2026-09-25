// The metronome's click: a short Web Audio blip, the one sound dacapo makes itself (the MP11SE has
// no drum sound over MIDI and cannot start its own metronome). Clicks are scheduled on the
// AudioContext's clock a short lookahead ahead by a timer ("A tale of two clocks"), so a late
// timer never makes a late click, and a stop cancels everything not yet heard.

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
    frequency: { value: number };
    connect: (node: never) => unknown;
    start: (when: number) => void;
    stop: (when?: number) => void;
    disconnect: () => void;
  };
  createGain: () => {
    gain: {
      setValueAtTime: (value: number, when: number) => unknown;
      linearRampToValueAtTime: (value: number, when: number) => unknown;
      exponentialRampToValueAtTime: (value: number, when: number) => unknown;
    };
    connect: (node: never) => unknown;
    disconnect: () => void;
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
  const sounding = new Set<{ stop: (when?: number) => void; disconnect: () => void }>();

  function schedule(click: ClickEvent) {
    const now = context.currentTime;
    let when = audio.toContext(click.time);
    if (when < now) {
      if ((now - when) * 1000 > LATE_MS) return;
      when = now;
    }
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.frequency.value = click.accent ? 1760 : 1320;
    const peak = Math.max(0.0001, volume * (click.accent ? 1 : 0.6));
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(peak, when + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + CLICK_SECONDS);
    osc.connect(gain as never);
    gain.connect(context.destination as never);
    osc.start(when);
    osc.stop(when + CLICK_SECONDS + 0.005);
    const node = {
      stop: (at?: number) => osc.stop(at),
      disconnect: () => {
        osc.disconnect();
        gain.disconnect();
      },
    };
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
