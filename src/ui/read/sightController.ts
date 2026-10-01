import type { Rng } from '../../core/random.ts';
import { drawSeed, SIGHT_GENERATOR_VERSION, type SightLevelId } from '../../core/sightLevels.ts';
import {
  endSightSession,
  nextSightFragment,
  recordSightRun,
  startSightSession,
  summarizeSightSession,
  type SightRun,
  type SightSessionState,
} from '../../core/sightRead.ts';
import type { PracticeStore } from '../practice/store.ts';

export interface SightConfig {
  level: SightLevelId;
  /** Fragments. */
  length: number;
}

export interface SightControllerOptions {
  practice: PracticeStore;
  /** Epoch ms, for stored timestamps. */
  now?: () => number;
  /** Draws the seeds. */
  rng?: Rng;
  newId?: () => string;
}

export interface SightController {
  /** null while no session was started (the setup screen). */
  getState: () => SightSessionState | null;
  /** For `useSyncExternalStore`. */
  subscribe: (onChange: () => void) => () => void;
  start: (config: SightConfig) => void;
  /** A run played to its end, judged. */
  recordRun: (run: SightRun) => void;
  /** The next fragment, or the summary after the last. */
  next: () => void;
  /** Ends the running session early; the runs played are kept. */
  stop: () => void;
  /** Leaves the summary for the setup screen. */
  close: () => void;
  /** Stops a running session. The controller stays usable. */
  dispose: () => void;
}

/**
 * Drives one session of sight-reading on top of `core/sightRead.ts`, as the rhythm controller
 * does for rhythm lines: draws each fragment's seed, and stores the session again after every run
 * (so a closed tab loses nothing and needs no recovery). The run itself is the page's.
 * Framework-free, so it is testable.
 */
export function createSightController({
  practice,
  now = Date.now,
  rng = Math.random,
  newId = () => crypto.randomUUID(),
}: SightControllerOptions): SightController {
  let state: SightSessionState | null = null;
  const listeners = new Set<() => void>();

  function update(next: SightSessionState | null) {
    if (next === state) return;
    const prev = state;
    state = next;
    // A run recorded: the session as it stands now replaces the copy stored after the last run.
    if (prev && next && prev.id === next.id && next.last && next.last !== prev.last) {
      const summary = summarizeSightSession(next);
      if (summary) practice.recordSession({ kind: 'sight', ...summary });
    }
    for (const listener of [...listeners]) listener();
  }

  function stop() {
    if (state) update(endSightSession(state, now()));
  }

  return {
    getState: () => state,
    subscribe(onChange) {
      listeners.add(onChange);
      return () => void listeners.delete(onChange);
    },
    start(config) {
      stop();
      update(
        startSightSession({
          id: newId(),
          level: config.level,
          length: config.length,
          at: now(),
          seed: drawSeed(rng),
          version: SIGHT_GENERATOR_VERSION,
        }),
      );
    },
    recordRun(run) {
      if (state) update(recordSightRun(state, run));
    },
    next() {
      if (!state || state.phase !== 'running') return;
      update(nextSightFragment(state, drawSeed(rng), SIGHT_GENERATOR_VERSION, now()));
    },
    stop,
    close() {
      stop();
      update(null);
    },
    dispose: stop,
  };
}
