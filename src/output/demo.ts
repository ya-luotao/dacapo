// Plays a demo plan on the instrument: one time round after another (for a loop), with pause and
// resume. The whole of the next round is queued a second before it starts; the scheduler hands
// it to the port only a lookahead ahead, so pausing or stopping still cancels it.

import type { DemoPlan } from '../core/playback.ts';
import type { MidiOutput } from './output.ts';
import type { Clock, Scheduler } from './scheduler.ts';

export type DemoState = 'stopped' | 'playing' | 'paused';

/** Where the demo is: which time round, and milliseconds into it. */
export interface DemoPosition {
  round: number;
  ms: number;
}

export interface DemoPlayer {
  /**
   * Starts `plan` at `from` (default: its start), after silencing the instrument. With `paused`
   * it only takes the plan and the place, to go on with `resume` (a tempo change while paused).
   */
  play: (plan: DemoPlan, velocity: number, from?: DemoPosition, paused?: boolean) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  getState: () => DemoState;
  /** Null when stopped. */
  position: () => DemoPosition | null;
  /** The step sounding now (index into the step list), or null. */
  currentStep: () => number | null;
  subscribe: (onChange: () => void) => () => void;
}

/** Time before the first note, so it is not sent late. */
export const DEMO_LEAD_MS = 120;
/** Queue the next round this long before it starts. */
const QUEUE_AHEAD_MS = 1000;
/** How often the position is checked (the cursor follows at this resolution). */
const CHECK_MS = 25;

/**
 * `onInterrupt`: sound cut from outside. A hidden page pauses the demo (it can be resumed), a new
 * route stops it; either way the instrument has already been silenced.
 */
export function createDemoPlayer(
  scheduler: Scheduler,
  clock: Clock,
  onInterrupt?: MidiOutput['onInterrupt'],
): DemoPlayer {
  let state: DemoState = 'stopped';
  let plan: DemoPlan | null = null;
  let velocity = 72;
  /** performance.now() time at which round 0, ms 0 would be. */
  let origin = 0;
  /** Rounds queued so far (the next to queue). */
  let queued = 0;
  let paused: DemoPosition | null = null;
  /** Where playing (re)started: the cursor does not show the lead-in as the bar before. */
  let floor: DemoPosition = { round: 0, ms: 0 };
  let lastStep: number | null = null;
  let unsubscribe: (() => void) | null = null;
  let stopTimer: (() => void) | null = null;
  const listeners = new Set<() => void>();

  const notify = () => {
    lastStep = currentStep();
    for (const listener of [...listeners]) listener();
  };

  function roundStart(round: number): number {
    return origin + round * plan!.length;
  }

  function queue(round: number, fromMs: number) {
    const start = roundStart(round);
    scheduler.playAll(
      plan!.notes
        .filter((n) => n.on >= fromMs)
        .map((n) => ({ midi: n.midi, velocity, on: start + n.on, off: start + n.off })),
    );
    queued = round + 1;
  }

  function check() {
    if (state !== 'playing' || !plan) return;
    const now = clock.now();
    if (plan.loop) {
      if (now >= roundStart(queued) - QUEUE_AHEAD_MS) queue(queued, 0);
    } else if (now >= roundStart(0) + plan.length) {
      stop();
      return;
    }
    if (currentStep() !== lastStep) notify();
  }

  function begin(from: DemoPosition) {
    scheduler.panic();
    unsubscribe ??=
      onInterrupt?.((reason) => (reason === 'hidden' ? pause(true) : stop(true))) ?? null;
    origin = clock.now() + DEMO_LEAD_MS - from.round * plan!.length - from.ms;
    queue(from.round, from.ms);
    floor = from;
    state = 'playing';
    paused = null;
    stopTimer?.();
    stopTimer = clock.every(CHECK_MS, check);
    notify();
  }

  function stop(silenced = false) {
    stopTimer?.();
    stopTimer = null;
    unsubscribe?.();
    unsubscribe = null;
    if (state !== 'stopped' && !silenced) scheduler.panic();
    state = 'stopped';
    paused = null;
    notify();
  }

  function pause(silenced = false) {
    if (state !== 'playing') return;
    const at = position();
    stopTimer?.();
    stopTimer = null;
    if (!silenced) scheduler.panic();
    state = 'paused';
    paused = at;
    notify();
  }

  function position(): DemoPosition | null {
    if (state === 'stopped' || !plan) return null;
    if (state === 'paused') return paused;
    const elapsed = clock.now() - origin;
    const round = plan.loop ? Math.max(floor.round, Math.floor(elapsed / plan.length)) : 0;
    let ms = Math.min(plan.length, Math.max(0, elapsed - round * plan.length));
    if (round === floor.round) ms = Math.max(ms, floor.ms);
    return { round, ms };
  }

  function currentStep(): number | null {
    const at = position();
    if (!at || !plan || plan.steps.length === 0) return null;
    // Before the first step of the round (a rest): the first step.
    let step = plan.steps[0]!.step;
    for (const s of plan.steps) {
      if (s.at > at.ms) break;
      step = s.step;
    }
    return step;
  }

  return {
    play(next, nextVelocity, from, startPaused = false) {
      plan = next;
      velocity = nextVelocity;
      const at = from ?? { round: 0, ms: next.start };
      if (!startPaused) {
        begin(at);
        return;
      }
      stopTimer?.();
      stopTimer = null;
      unsubscribe?.();
      unsubscribe = null;
      if (state === 'playing') scheduler.panic();
      state = 'paused';
      paused = at;
      notify();
    },
    pause: () => pause(),
    resume() {
      if (state === 'paused' && paused) begin(paused);
    },
    stop: () => stop(),
    getState: () => state,
    position,
    currentStep,
    subscribe(onChange) {
      listeners.add(onChange);
      return () => void listeners.delete(onChange);
    },
  };
}
