// The app's metronome: one for the whole page, like the input system. It clicks on the
// AudioContext's own clock, the one the speakers follow, so the spacing of the clicks is exact to
// the sample: every click time comes from the timeline in core/pulse.ts, in context milliseconds.
// Only the animation needs performance.now(); `position` maps the time on screen to the time heard
// (output timestamps, plus the calibrated delay the context cannot see).
//
// A background tab keeps ticking: a metronome that stops when you glance at another tab is no use.
// Browsers slow timers in hidden tabs: to once a second, and Chrome to once a minute after five
// minutes of a hidden tab that has made no sound for 30 s (the gap trainer's silent bars can be that
// long). So while hidden the clicks are scheduled a minute and more ahead; nothing can change them
// meanwhile, and anything changed on return cancels what is no longer wanted. `pagehide` stops it.

import {
  pulseConfig,
  resizeAccents,
  meterBeats,
  type MetronomeSettings,
} from '../core/metronomeSettings.ts';
import {
  clampBpm,
  createPulse,
  type Pulse,
  type PulseClick,
  type PulseConfig,
  type PulsePosition,
} from '../core/pulse.ts';
import { createTapTempo } from '../core/tapTempo.ts';
import { createAudioClock, type AudioClock } from './audioClock.ts';
import { playClick, type ClickContext, type SoundingClick } from './click.ts';
import type { Clock } from './scheduler.ts';

export const METRONOME_LOOKAHEAD_MS = 120;
/** Outlasts timers slowed to once a minute, with room for one that comes late. */
export const METRONOME_HIDDEN_LOOKAHEAD_MS = 65_000;
export const METRONOME_TICK_MS = 25;
/** From Start to the first beat, so the first click is not late. */
export const METRONOME_LEAD_MS = 120;
/** A change never touches a click due sooner than this: it may be on its way to the speakers. */
export const METRONOME_GUARD_MS = 30;
/** A click found later than this is skipped rather than played late. */
const LATE_MS = 20;
/** The volume follows the slider this smoothly (seconds). */
const VOLUME_SMOOTHING = 0.015;

export interface MetronomeContext extends ClickContext {
  state?: AudioContextState | 'interrupted';
  resume?: () => Promise<void>;
}

export type MetronomeStatus = 'stopped' | 'running' | 'paused';
/** What takes the click away from the metronome: a rhythm run or a calibration. */
export type PauseReason = 'rhythm' | 'calibration';

export interface MetronomeSnapshot {
  status: MetronomeStatus;
  /** Why it was paused (it does not start again by itself). */
  pausedBy: PauseReason | null;
  /** While set, it cannot start. */
  blockedBy: PauseReason | null;
  settings: MetronomeSettings;
  /** The tempo heard now (a ramp moves it), or the tempo set. */
  bpm: number;
  /** The tempo from the next beat on: what a change has asked for, before it is heard. */
  target: number;
  /** The bar heard now, counted from Start; null when not running. */
  bar: number | null;
  /** A silent bar of the gap trainer is being heard (or rather, not heard). */
  silentBar: boolean;
  /** False once a start found no Web Audio: the animation runs alone. */
  audio: boolean;
}

export interface MetronomePage {
  document: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>;
  window: Pick<Window, 'addEventListener' | 'removeEventListener'>;
}

export interface MetronomeOptions {
  clock: Clock;
  /** The page's AudioContext, made or resumed; called from a user gesture. Null without Web Audio. */
  context: () => MetronomeContext | null;
  settings: MetronomeSettings;
  save?: (settings: MetronomeSettings) => void;
  /**
   * How much later than the context says a click reaches the ear (ms): the part of the path it
   * cannot see (the calibration's measure of it). The animation is drawn this much later. Read at
   * each start (a calibration pauses the metronome, so it cannot change while it runs).
   */
  delay?: () => number;
  page?: MetronomePage | null;
  interval?: number;
  /** Every click handed to the context, with the context time it was given. */
  onScheduled?: (click: PulseClick, when: number) => void;
}

export interface Metronome {
  getSnapshot: () => MetronomeSnapshot;
  subscribe: (onChange: () => void) => () => void;
  /** From a user gesture (it may create the AudioContext). Ignored while blocked. */
  start: () => void;
  stop: () => void;
  toggle: () => void;
  update: (patch: Partial<MetronomeSettings>) => void;
  /** Sets the tempo (clamped to 20–300), from the next beat when running. */
  setBpm: (bpm: number) => void;
  /** Moves the tempo heard now by `delta`. */
  nudge: (delta: number) => void;
  /** A tap at `time` (ms); sets the tempo once there are two. Returns the tempo tapped, or null. */
  tap: (time: number) => number | null;
  /** Pauses it (if running) and keeps it from starting until the returned function is called. */
  block: (reason: PauseReason) => () => void;
  /** Where the beat is for what is heard at performance.now() time `now`; null when not running. */
  position: (now: number) => PulsePosition | null;
  /** Clicks handed to the context and not yet forgotten. */
  pending: () => number;
  dispose: () => void;
}

export function createMetronome(options: MetronomeOptions): Metronome {
  const { clock } = options;
  let settings = options.settings;
  let status: MetronomeStatus = 'stopped';
  let pausedBy: PauseReason | null = null;
  const blocks = new Map<number, PauseReason>();
  let lastBlock = 0;
  let audioAvailable = true;

  let context: MetronomeContext | null = null;
  let audioClock: AudioClock | null = null;
  let master: ReturnType<ClickContext['createGain']> | null = null;
  let pulse: Pulse | null = null;
  /** The tempo the next start begins with, when it resumes after a pause. */
  let resumeBpm: number | null = null;
  let startBpm = settings.bpm;
  let until = 0;
  let stopTimer: (() => void) | null = null;
  let hidden = false;
  let listening = false;
  let delay = 0;
  const pending: { at: number; node: SoundingClick }[] = [];
  const tapper = createTapTempo();
  const listeners = new Set<() => void>();
  let snapshot = makeSnapshot(null);

  /** What the next start begins with: where a pause left off, a ramp's own start, or the tempo set. */
  function nextStartBpm(): number {
    return resumeBpm ?? (settings.trainer.kind === 'ramp' ? settings.trainer.from : settings.bpm);
  }

  function makeSnapshot(position: PulsePosition | null): MetronomeSnapshot {
    const blockedBy = [...blocks.values()].at(-1) ?? null;
    const bpm = position?.bpm ?? (status === 'running' ? startBpm : nextStartBpm());
    let target = bpm;
    if (status === 'running' && pulse) {
      const next = pulse.position(timelineNow() + METRONOME_GUARD_MS);
      target = next ? pulse.bpmAt(next.to) : pulse.bpmAt(pulse.origin);
    }
    return {
      status,
      pausedBy,
      blockedBy,
      settings,
      bpm,
      target,
      bar: position?.bar ?? null,
      silentBar: position?.silent ?? false,
      audio: audioAvailable,
    };
  }

  function publish(force = false) {
    const next = makeSnapshot(status === 'running' ? position(clock.now()) : null);
    const same =
      !force &&
      next.status === snapshot.status &&
      next.pausedBy === snapshot.pausedBy &&
      next.blockedBy === snapshot.blockedBy &&
      next.settings === snapshot.settings &&
      next.bpm === snapshot.bpm &&
      next.target === snapshot.target &&
      next.bar === snapshot.bar &&
      next.silentBar === snapshot.silentBar &&
      next.audio === snapshot.audio;
    if (same) return;
    snapshot = next;
    for (const listener of [...listeners]) listener();
  }

  /** Now on the timeline's clock: the context's, or performance.now() without one. */
  function timelineNow(): number {
    return context ? context.currentTime * 1000 : clock.now();
  }

  function running(): boolean {
    return !context || context.state === undefined || context.state === 'running';
  }

  function lookahead(): number {
    return hidden ? METRONOME_HIDDEN_LOOKAHEAD_MS : METRONOME_LOOKAHEAD_MS;
  }

  function schedule(click: PulseClick, now: number) {
    if (!context || !master || click.level === 'mute') return;
    let at = click.at;
    if (at < now) {
      if (now - at > LATE_MS) return;
      at = now;
    }
    const node = playClick(context, master, at / 1000, settings.sound, click.level, 1);
    pending.push({ at: click.at, node });
    options.onScheduled?.(click, at / 1000);
  }

  /** Cancels every click due at or after `from` (timeline ms) and forgets those long gone. */
  function cancelFrom(from: number) {
    const now = timelineNow();
    for (let i = pending.length - 1; i >= 0; i--) {
      const { at, node } = pending[i]!;
      if (at >= from) {
        try {
          node.stop(0);
        } catch {
          // Already stopped.
        }
        node.disconnect();
        pending.splice(i, 1);
      } else if (at < now - 1000) {
        pending.splice(i, 1);
      }
    }
  }

  function tick() {
    if (status !== 'running') return;
    const now = clock.now();
    audioClock?.sample(now);
    if (!running()) {
      void context?.resume?.().catch(() => {});
      if (!pulse) return;
    }
    const t = timelineNow();
    if (!pulse) {
      pulse = createPulse(pulseConfig(settings, startBpm), t + METRONOME_LEAD_MS);
      until = pulse.origin;
    }
    const horizon = t + lookahead();
    if (horizon > until) {
      if (!settings.silent) for (const click of pulse.clicks(until, horizon)) schedule(click, t);
      until = horizon;
    }
    // Forget the clicks that have sounded (pending is in time order).
    let done = 0;
    while (done < pending.length && pending[done]!.at < t - 1000) done++;
    if (done > 0) pending.splice(0, done);
    publish();
  }

  function onVisibility() {
    hidden = options.page?.document.visibilityState === 'hidden';
    if (!hidden && context && !running()) void context.resume?.().catch(() => {});
    tick();
  }

  function listen(on: boolean) {
    const page = options.page;
    if (!page || on === listening) return;
    listening = on;
    if (on) {
      page.document.addEventListener('visibilitychange', onVisibility);
      page.window.addEventListener('pagehide', stop);
      hidden = page.document.visibilityState === 'hidden';
    } else {
      page.document.removeEventListener('visibilitychange', onVisibility);
      page.window.removeEventListener('pagehide', stop);
    }
  }

  function halt() {
    stopTimer?.();
    stopTimer = null;
    // A click already sounding rings out.
    cancelFrom(timelineNow());
    pending.length = 0;
    pulse = null;
    listen(false);
  }

  function start() {
    if (status === 'running' || blocks.size > 0) return;
    const next = options.context();
    audioAvailable = next !== null;
    if (next !== context) {
      context = next;
      audioClock = next && createAudioClock(next);
      master = null;
      if (next) {
        master = next.createGain();
        master.gain.value = settings.volume / 100;
        master.connect(next.destination as never);
      }
    }
    startBpm = nextStartBpm();
    resumeBpm = null;
    delay = options.delay?.() ?? 0;
    status = 'running';
    pausedBy = null;
    listen(true);
    audioClock?.sample(clock.now());
    tick();
    stopTimer = clock.every(options.interval ?? METRONOME_TICK_MS, tick);
    publish(true);
  }

  function stop() {
    if (status === 'stopped') return;
    halt();
    status = 'stopped';
    pausedBy = null;
    resumeBpm = null;
    publish(true);
  }

  function pause(reason: PauseReason) {
    if (status !== 'running') return;
    resumeBpm = snapshot.bpm;
    halt();
    status = 'paused';
    pausedBy = reason;
  }

  function position(now: number): PulsePosition | null {
    if (status !== 'running' || !pulse) return null;
    const heard = now - delay;
    if (!context || !audioClock) return pulse.position(heard);
    audioClock.sample(clock.now());
    return pulse.position(audioClock.toContext(heard) * 1000);
  }

  function update(patch: Partial<MetronomeSettings>) {
    const next: MetronomeSettings = { ...settings, ...patch };
    if (patch.bpm !== undefined) next.bpm = clampBpm(patch.bpm);
    if (patch.meter && !patch.accents)
      next.accents = resizeAccents(settings.accents, meterBeats(patch.meter).beats);
    const previous = settings;
    settings = next;
    options.save?.(settings);
    // A tempo or trainer chosen while paused is what the next start begins with.
    if (patch.bpm !== undefined || patch.trainer) resumeBpm = null;
    if (master && context && next.volume !== previous.volume)
      master.gain.setTargetAtTime(next.volume / 100, context.currentTime, VOLUME_SMOOTHING);
    if (status === 'running' && pulse) {
      const now = timelineNow();
      const after = now + METRONOME_GUARD_MS;
      const config = pulseConfig(next, pulse.bpmAt(after));
      const old = pulseConfig(previous, pulse.bpmAt(after));
      const change: Partial<PulseConfig> = {};
      if (patch.bpm !== undefined) change.bpm = next.bpm;
      // A ramp switched on (or given a new start) begins where it says, as it does on Start.
      const ramp = next.trainer.kind === 'ramp';
      if (ramp && (previous.trainer.kind !== 'ramp' || previous.trainer.from !== next.trainer.from))
        change.bpm = next.trainer.from;
      if (config.beats !== old.beats) change.beats = config.beats;
      if (config.subdivision !== old.subdivision) change.subdivision = config.subdivision;
      if (config.accents.join() !== old.accents.join()) change.accents = config.accents;
      if (JSON.stringify(config.trainer) !== JSON.stringify(old.trainer))
        change.trainer = config.trainer;
      let from: number | null = null;
      if (Object.keys(change).length > 0) from = pulse.update(change, after);
      else if (next.sound !== previous.sound || next.silent !== previous.silent) from = after;
      if (from !== null) {
        cancelFrom(from);
        until = Math.min(until, from);
      }
      tick();
    }
    publish();
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(onChange) {
      listeners.add(onChange);
      return () => void listeners.delete(onChange);
    },
    start,
    stop,
    toggle: () => (status === 'running' ? stop() : start()),
    update,
    setBpm: (bpm) => update({ bpm }),
    nudge: (delta) => update({ bpm: snapshot.target + delta }),
    tap(time) {
      const bpm = tapper.tap(time);
      if (bpm !== null) update({ bpm });
      return bpm;
    },
    block(reason) {
      const id = ++lastBlock;
      blocks.set(id, reason);
      pause(reason);
      publish(true);
      return () => {
        if (!blocks.delete(id)) return;
        publish(true);
      };
    },
    position,
    pending: () => pending.length,
    dispose() {
      halt();
      status = 'stopped';
      listeners.clear();
    },
  };
}
