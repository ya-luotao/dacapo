// Improvise's backing in time (docs/HARMONY.md, "Improvise (H6)"): a bar of count-in clicks,
// then the loop on the instrument, bar after bar for as long as it runs, each bar queued a second
// before it starts (the scheduler hands it to the port only a lookahead ahead, so a stop still
// cancels it), and the click on the AudioContext if wanted. A bar is generated as it is queued, so
// the calls of call and response, which differ from phrase to phrase, come with it. Played back,
// it carries a take's notes as well, and stops after them.

import { backingBar, barStart, IMPROV_BEATS, type ImprovPlan } from '../core/improv.ts';
import type { ClickEvent, ClickSource, ClickTrack } from './click.ts';
import type { MidiOutput } from './output.ts';
import type { Clock, NoteSpec, Scheduler } from './scheduler.ts';

export type BackingState = 'stopped' | 'counting' | 'playing';
/** Stopped by the player, cut from outside (the route changed, the page was hidden), or over. */
export type BackingEnd = 'stopped' | 'interrupted' | 'done';

/** From Start to the first count-in click. */
export const BACKING_LEAD_MS = 200;
/** Queue each bar (and a take's notes) this long before they start. */
export const BACKING_QUEUE_AHEAD_MS = 1000;
/** How often the run looks at the time. */
const CHECK_MS = 25;
/** Played back, the run ends this long after the last note's end, so it rings. */
const PLAYBACK_TAIL_MS = 1200;

/** A note of a take to play with the backing: ms from time 0. */
export interface ExtraNote {
  midi: number;
  velocity: number;
  on: number;
  off: number;
}

export interface BackingRunOptions {
  plan: ImprovPlan;
  /** The accompaniment level (Settings): the backing's bass is played at it. */
  level: number;
  /** The MIDI channel of the backing (0–15). */
  channel: number;
  scheduler: Scheduler;
  clock: Clock;
  /** Null without Web Audio: no click. */
  clicks: ClickTrack | null;
  /** The click through the loop; the count-in clicks whatever this says. */
  click: boolean;
  /** A bar of count-in before time 0 (a take played back starts at once). */
  countIn: boolean;
  onInterrupt?: MidiOutput['onInterrupt'];
  /** Played back: the take's notes, on channel 0, and the run ends after the last of them. */
  extra?: readonly ExtraNote[];
  /** Played back: where the take ends (ms from time 0); the backing stops there. */
  until?: number;
  onEnd: (reason: BackingEnd) => void;
}

export interface BackingRun {
  /** Starts the count-in (or the loop); returns time 0's performance.now(). */
  start: () => number;
  stop: () => void;
  getState: () => BackingState;
  /** ms from time 0 (negative in the count-in), or null when stopped. */
  position: () => number | null;
  /** The beat heard now, counted from time 0 (negative in the count-in), or null. */
  beat: () => number | null;
  subscribe: (onChange: () => void) => () => void;
}

/** The clicks of a run whose time 0 is `origin`: the count-in's bar, then every beat if `loop`. */
export function backingClicks(
  plan: ImprovPlan,
  origin: number,
  countIn: boolean,
  loop: boolean,
): ClickSource {
  return (from, to) => {
    const out: ClickEvent[] = [];
    const first = Math.ceil((from - origin) / plan.beatMs);
    for (let n = Math.max(first, countIn ? -IMPROV_BEATS : 0); ; n++) {
      const time = origin + n * plan.beatMs;
      if (time >= to) break;
      if (time < from) continue;
      if (n >= 0 && !loop) break;
      out.push({ time, accent: ((n % IMPROV_BEATS) + IMPROV_BEATS) % IMPROV_BEATS === 0 });
    }
    return out;
  };
}

export function createBackingRun(options: BackingRunOptions): BackingRun {
  const { plan, scheduler, clock } = options;
  const extra = [...(options.extra ?? [])].sort((a, b) => a.on - b.on);
  const until = options.until ?? null;
  let state: BackingState = 'stopped';
  let origin = 0;
  /** The next bar to queue, and the next of the take's notes. */
  let bar = 0;
  let next = 0;
  let stopTimer: (() => void) | null = null;
  let unsubscribe: (() => void) | null = null;
  let last: { beat: number | null; state: BackingState } | null = null;
  const listeners = new Set<() => void>();

  function position(): number | null {
    return state === 'stopped' ? null : clock.now() - origin;
  }

  function beat(): number | null {
    const at = position();
    return at === null ? null : Math.floor(at / plan.beatMs);
  }

  function notify() {
    const now = { beat: beat(), state };
    if (last && last.beat === now.beat && last.state === now.state) return;
    last = now;
    for (const listener of [...listeners]) listener();
  }

  function queue(now: number) {
    const horizon = now - origin + BACKING_QUEUE_AHEAD_MS;
    const notes: NoteSpec[] = [];
    while (barStart(plan, bar) <= horizon && (until === null || barStart(plan, bar) < until)) {
      for (const n of backingBar(plan, bar, options.level)) {
        if (until !== null && n.on >= until) continue;
        notes.push({
          midi: n.midi,
          velocity: n.velocity,
          on: origin + n.on,
          off: origin + (until === null ? n.off : Math.min(n.off, until)),
          channel: options.channel,
        });
      }
      bar++;
    }
    for (; next < extra.length && extra[next]!.on <= horizon; next++) {
      const n = extra[next]!;
      notes.push({ midi: n.midi, velocity: n.velocity, on: origin + n.on, off: origin + n.off });
    }
    if (notes.length > 0) scheduler.playAll(notes);
  }

  function end(reason: BackingEnd, silenced = false) {
    if (state === 'stopped') return;
    stopTimer?.();
    stopTimer = null;
    unsubscribe?.();
    unsubscribe = null;
    options.clicks?.stop();
    if (!silenced) scheduler.panic();
    state = 'stopped';
    notify();
    options.onEnd(reason);
  }

  function check() {
    if (state === 'stopped') return;
    const now = clock.now();
    if (state === 'counting' && now >= origin) state = 'playing';
    queue(now);
    if (until !== null) {
      const ringing = extra.reduce((latest, n) => Math.max(latest, n.off), until);
      if (now - origin >= ringing + PLAYBACK_TAIL_MS) {
        end('done');
        return;
      }
    }
    notify();
  }

  return {
    start() {
      if (state !== 'stopped') end('stopped');
      scheduler.panic();
      const lead = BACKING_LEAD_MS + (options.countIn ? plan.barMs : 0);
      origin = clock.now() + lead;
      state = options.countIn ? 'counting' : 'playing';
      bar = 0;
      next = 0;
      last = null;
      queue(clock.now());
      options.clicks?.start(backingClicks(plan, origin, options.countIn, options.click));
      unsubscribe = options.onInterrupt?.(() => end('interrupted', true)) ?? null;
      stopTimer = clock.every(CHECK_MS, check);
      notify();
      return origin;
    },
    stop: () => end('stopped'),
    getState: () => state,
    position,
    beat,
    subscribe(onChange) {
      listeners.add(onChange);
      return () => void listeners.delete(onChange);
    },
  };
}
