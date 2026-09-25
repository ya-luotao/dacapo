import { useEffect, useState, useSyncExternalStore } from 'react';
import type { DemoPlan } from '../../core/playback.ts';
import type { PlayResult, RhythmPlan, StepTiming } from '../../core/rhythm.ts';
import { audioContext } from '../../output/audio.ts';
import { createClickTrack, type ClickTrack } from '../../output/click.ts';
import type { MidiOutput } from '../../output/output.ts';
import {
  createRhythmRun,
  type ClickMode,
  type RhythmEnd,
  type RhythmRun,
  type RhythmState,
} from '../../output/rhythm.ts';
import { browserClock, type Scheduler } from '../../output/scheduler.ts';

export interface RhythmSnapshot {
  state: RhythmState;
  step: number | null;
  count: number | null;
}

const STOPPED: RhythmSnapshot = { state: 'stopped', step: null, count: null };

let clickTrack: { context: AudioContext; track: ClickTrack } | null = null;

/** The page's click track, on the page's AudioContext. Call from a user gesture. */
export function sharedClickTrack(): ClickTrack | null {
  const context = audioContext();
  if (!context) return null;
  if (clickTrack?.context !== context)
    clickTrack = { context, track: createClickTrack(context, browserClock) };
  return clickTrack.track;
}

export interface RhythmStart {
  plan: RhythmPlan;
  backing: DemoPlan | null;
  velocity: number;
  clickMode: ClickMode;
  /** 0–100. */
  volume: number;
  latency: number;
  onSettled: (timings: StepTiming[]) => void;
  onEnd: (reason: RhythmEnd) => void;
}

export interface RhythmPlayer {
  /** Call from the Start click (it may create the AudioContext). Returns the origin. */
  start: (options: RhythmStart) => number;
  stop: () => void;
  press: (midi: number, time: number) => PlayResult;
  getSnapshot: () => RhythmSnapshot;
  subscribe: (onChange: () => void) => () => void;
}

function createRhythmPlayer(
  scheduler: Scheduler,
  onInterrupt: MidiOutput['onInterrupt'],
): RhythmPlayer {
  let run: RhythmRun | null = null;
  let unsubscribe: (() => void) | null = null;
  let snapshot = STOPPED;
  const listeners = new Set<() => void>();

  const update = () => {
    const next = run
      ? { state: run.getState(), step: run.currentStep(), count: run.countBeat() }
      : STOPPED;
    if (
      next.state === snapshot.state &&
      next.step === snapshot.step &&
      next.count === snapshot.count
    )
      return;
    snapshot = next;
    for (const listener of [...listeners]) listener();
  };

  return {
    start(options) {
      run?.stop();
      unsubscribe?.();
      const clicks = options.clickMode === 'off' ? null : sharedClickTrack();
      clicks?.setVolume(options.volume / 100);
      run = createRhythmRun({ ...options, scheduler, clock: browserClock, clicks, onInterrupt });
      unsubscribe = run.subscribe(update);
      const origin = run.start();
      update();
      return origin;
    },
    stop: () => run?.stop(),
    press: (midi, time) => run?.press(midi, time) ?? { kind: 'ignored' },
    getSnapshot: () => snapshot,
    subscribe(onChange) {
      listeners.add(onChange);
      return () => void listeners.delete(onChange);
    },
  };
}

/** One rhythm player for the practice view; stopped when the view goes away. */
export function useRhythmPlayer(scheduler: Scheduler, onInterrupt: MidiOutput['onInterrupt']) {
  const [player] = useState(() => createRhythmPlayer(scheduler, onInterrupt));
  const snapshot = useSyncExternalStore(player.subscribe, player.getSnapshot);
  useEffect(() => () => player.stop(), [player]);
  return { player, snapshot };
}
