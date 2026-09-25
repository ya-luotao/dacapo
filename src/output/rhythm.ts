// A rhythm-mode run in time: the count-in and the click on the AudioContext, the other hand on the
// instrument, and the player's notes matched against the plan, all from one origin on the
// performance.now() clock. Everything the player hears is scheduled ahead from that timeline,
// never from their key presses.

import type { DemoPlan } from '../core/playback.ts';
import {
  createMatcher,
  type Matcher,
  type PlayResult,
  type RhythmPlan,
  type StepTiming,
} from '../core/rhythm.ts';
import type { ClickEvent, ClickSource, ClickTrack } from './click.ts';
import type { MidiOutput } from './output.ts';
import type { Clock, Scheduler } from './scheduler.ts';

export type ClickMode = 'on' | 'countIn' | 'off';
export type RhythmState = 'stopped' | 'counting' | 'playing';
export type RhythmEnd = 'done' | 'stopped' | 'interrupted';

/** Time from Start to the first count-in click. */
export const RHYTHM_LEAD_MS = 200;
/** Queue the other hand's next round this long before it starts. */
const QUEUE_AHEAD_MS = 1000;
/** How often the run looks at the time (the cursor follows at this resolution). */
const CHECK_MS = 25;

/** The clicks of a run starting at `origin` (performance.now() ms of the span's start). */
export function clickSource(plan: RhythmPlan, origin: number, mode: ClickMode): ClickSource {
  return (from, to) => {
    if (mode === 'off') return [];
    const out: ClickEvent[] = [];
    const add = (at: number, accent: boolean) => {
      const time = origin + at;
      if (time >= from && time < to) out.push({ time, accent });
    };
    for (const c of plan.countIn) add(c.at, c.accent);
    if (mode === 'countIn' || plan.length <= 0) return out;
    const first = Math.max(0, Math.floor((from - origin) / plan.length));
    const last = plan.loop ? Math.floor((to - origin) / plan.length) : 0;
    for (let round = first; round <= last; round++) {
      for (const c of plan.clicks) {
        if (round === 0 && c.at < plan.start) continue;
        add(round * plan.length + c.at, c.accent);
      }
    }
    return out;
  };
}

export interface RhythmRunOptions {
  plan: RhythmPlan;
  /** The other hand and unpractised parts, same span and tempo; null: nothing to play. */
  backing: DemoPlan | null;
  velocity: number;
  scheduler: Scheduler;
  clock: Clock;
  /** Null without Web Audio: the run goes on silently. */
  clicks: ClickTrack | null;
  clickMode: ClickMode;
  /** From the calibration: how much later than the sound the player's notes arrive, in ms. */
  latency: number;
  onInterrupt?: MidiOutput['onInterrupt'];
  /** Steps settled, in order. */
  onSettled: (timings: StepTiming[]) => void;
  onEnd: (reason: RhythmEnd) => void;
}

export interface RhythmRun {
  /** Starts the count-in; returns the origin. */
  start: () => number;
  press: (midi: number, time: number) => PlayResult;
  stop: () => void;
  getState: () => RhythmState;
  /** Milliseconds on the run's clock (negative in the count-in), or null when stopped. */
  position: () => number | null;
  /** The step due now (index into the step list), or null. */
  currentStep: () => number | null;
  /** The count-in's beat heard last (1 on each bar's first beat), or null outside the count-in. */
  countBeat: () => number | null;
  subscribe: (onChange: () => void) => () => void;
}

export function createRhythmRun(options: RhythmRunOptions): RhythmRun {
  const { plan, backing, scheduler, clock } = options;
  let state: RhythmState = 'stopped';
  let origin = 0;
  let matcher: Matcher = createMatcher(plan);
  let queued = 0;
  let stopTimer: (() => void) | null = null;
  let unsubscribe: (() => void) | null = null;
  let last: { step: number | null; count: number | null; state: RhythmState } | null = null;
  const listeners = new Set<() => void>();

  const notify = () => {
    const now = { step: currentStep(), count: countBeat(), state };
    if (last && last.step === now.step && last.count === now.count && last.state === now.state)
      return;
    last = now;
    for (const listener of [...listeners]) listener();
  };

  function queue(round: number) {
    queued = round + 1;
    if (!backing) return;
    const start = origin + round * backing.length;
    scheduler.playAll(
      backing.notes
        .filter((n) => round > 0 || n.on >= backing.start)
        .map((n) => ({
          midi: n.midi,
          velocity: options.velocity,
          on: start + n.on,
          off: start + n.off,
        })),
    );
  }

  function position(): number | null {
    return state === 'stopped' ? null : clock.now() - origin;
  }

  function currentStep(): number | null {
    const at = position();
    if (at === null || plan.steps.length === 0) return null;
    const round = plan.loop ? Math.max(0, Math.floor(at / plan.length)) : 0;
    // The first round begins at the start bar.
    const from = round === 0 ? plan.start : -Infinity;
    const within = Math.max(from, at - round * plan.length);
    let step: number | null = null;
    for (const s of plan.steps) {
      if (s.at < from) continue;
      if (s.at > within) break;
      step = s.step;
    }
    // Before the round's first step (a rest): the step to come.
    return step ?? (plan.steps.find((s) => s.at >= from) ?? plan.steps[0]!).step;
  }

  function countBeat(): number | null {
    const at = position();
    if (at === null || at >= plan.start) return null;
    let beat: number | null = null;
    for (const c of plan.countIn) {
      if (c.at > at) break;
      beat = c.accent ? 1 : (beat ?? 0) + 1;
    }
    return beat;
  }

  function end(reason: RhythmEnd, silenced = false) {
    if (state === 'stopped') return;
    const now = clock.now();
    stopTimer?.();
    stopTimer = null;
    unsubscribe?.();
    unsubscribe = null;
    options.clicks?.stop();
    const settled = reason === 'done' ? [] : matcher.finish(now - origin - options.latency);
    // A finished run lets its last notes ring; a stopped one is silenced at once.
    if (reason !== 'done' && !silenced) scheduler.panic();
    state = 'stopped';
    if (settled.length > 0) options.onSettled(settled);
    options.onEnd(reason);
    notify();
  }

  function check() {
    if (state === 'stopped') return;
    const now = clock.now();
    const at = now - origin;
    if (state === 'counting' && at >= plan.start) state = 'playing';
    if (plan.loop && backing && now >= origin + queued * backing.length - QUEUE_AHEAD_MS)
      queue(queued);
    const settled = matcher.advance(at - options.latency);
    if (settled.length > 0) options.onSettled(settled);
    if (matcher.done() && at >= plan.length) {
      end('done');
      return;
    }
    notify();
  }

  return {
    start() {
      if (state !== 'stopped') end('stopped');
      scheduler.panic();
      matcher = createMatcher(plan);
      const countLength = plan.start - (plan.countIn[0]?.at ?? plan.start);
      origin = clock.now() + RHYTHM_LEAD_MS + countLength - plan.start;
      state = 'counting';
      last = null;
      queue(0);
      options.clicks?.start(clickSource(plan, origin, options.clickMode));
      unsubscribe = options.onInterrupt?.(() => end('interrupted', true)) ?? null;
      stopTimer = clock.every(CHECK_MS, check);
      notify();
      return origin;
    },
    press(midi, time) {
      if (state === 'stopped') return { kind: 'ignored' };
      return matcher.play(midi, time - origin - options.latency);
    },
    stop: () => end('stopped'),
    getState: () => state,
    position,
    currentStep,
    countBeat,
    subscribe(onChange) {
      listeners.add(onChange);
      return () => void listeners.delete(onChange);
    },
  };
}
