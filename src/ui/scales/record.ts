import { useEffect, useLayoutEffect, useRef } from 'react';
import { analyzeRun, runHeadline } from '../../core/evenness.ts';
import {
  continuesSession,
  scaleRunId,
  withRun,
  type ScaleRun,
  type ScaleSession,
  type StoredScaleRun,
} from '../../core/scaleRecords.ts';
import { exerciseKey } from '../../core/scales.ts';
import type { ScaleExercise } from '../../core/scaleTypes.ts';
import type { PracticeStore } from '../practice/store.ts';
import { allReleased, velocityMeasured, type ScaleRunState } from './run.ts';

/** After its last note, a run waits this long for its keys to come up before it is recorded. */
export const RELEASE_WAIT_MS = 1500;

/** The scale session of a visit to the page: kept by the page, so another scale continues it. */
export interface SessionSlot {
  get: () => ScaleSession | null;
  set: (session: ScaleSession) => void;
}

/** A finished run as a record: every key from the first on, the pedal, what it was played on. */
export function scaleRunRecord(
  exercise: ScaleExercise,
  run: ScaleRunState,
  inputs: readonly string[],
): ScaleRun {
  return {
    exercise: exerciseKey(exercise),
    startedAt: run.startedAt ?? Date.now(),
    end: run.end ?? 'stopped',
    keys: [...run.keys],
    pedal: [...run.pedal],
    pedalAtStart: run.pedalAtStart,
    velocityMeasured: velocityMeasured(run.keys),
    inputs: [...inputs],
  };
}

/**
 * Records each scale run once it is over (docs/SCALES.md, "Records"): when its keys are all up,
 * `RELEASE_WAIT_MS` after its last note at the latest, and at once when the next run starts or
 * the page is left. Only scale runs are recorded; each goes with its session, brought up to date,
 * in one write. A pause longer than `IDLE_MS` before a run starts a new session.
 */
export function useScaleRecorder(
  run: ScaleRunState,
  exercise: ScaleExercise,
  slot: SessionSlot,
  store: PracticeStore,
  inputs: () => readonly string[],
): void {
  const latest = useRef({ exercise, inputs, slot });
  useLayoutEffect(() => {
    latest.current = { exercise, inputs, slot };
  });
  /** The run over but not recorded yet, and its timer. */
  const pending = useRef<{ run: ScaleRunState; timer: ReturnType<typeof setTimeout> } | null>(null);
  /**
   * The origin of the last run taken up (waiting or recorded): a run is recorded once, whatever
   * comes after its end (a pedal change, a key let go after the wait).
   */
  const taken = useRef<number | null>(null);

  function commit() {
    const waiting = pending.current;
    if (!waiting) return;
    clearTimeout(waiting.timer);
    pending.current = null;
    const r = waiting.run;
    if (r.startedAt === null || r.keys.length === 0) return;
    const analysis = analyzeRun({
      expected: r.expected,
      played: r.keys,
      velocityMeasured: velocityMeasured(r.keys),
    });
    if (analysis.quality !== 'ok') return;
    const record = scaleRunRecord(latest.current.exercise, r, latest.current.inputs());
    const before = latest.current.slot.get();
    const session = continuesSession(before, record.startedAt) ? before : null;
    const sessionId = session?.id ?? crypto.randomUUID();
    const stored: StoredScaleRun = {
      ...record,
      id: scaleRunId(sessionId, session?.runs.length ?? 0),
      sessionId,
    };
    const next = withRun(session, sessionId, {
      id: stored.id,
      exercise: stored.exercise,
      startedAt: stored.startedAt,
      endedAt: stored.startedAt + Math.max(...stored.keys.map((key) => key.on)),
      headline: runHeadline(analysis),
    });
    latest.current.slot.set(next);
    store.recordScaleRun(stored, next);
  }

  useEffect(() => {
    const waiting = pending.current;
    if (run.phase !== 'done') {
      // The next run began: the one before is over for good.
      if (waiting && waiting.run.origin !== run.origin) commit();
      return;
    }
    if (waiting && waiting.run.origin === run.origin) {
      waiting.run = run; // a late release
    } else if (run.origin !== taken.current) {
      commit();
      taken.current = run.origin;
      pending.current = { run, timer: setTimeout(commit, RELEASE_WAIT_MS) };
    } else return; // recorded already
    if (allReleased(run)) commit();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- commit reads refs only
  }, [run]);

  // Leaving the page (or another scale), hiding it or closing the tab records what is waiting:
  // React's cleanup does not run when a tab closes.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const onHide = () => {
      if (document.visibilityState === 'hidden') commit();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', commit);
    return () => {
      mounted.current = false;
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', commit);
      // A moment later, unless it was set up again at once (React's StrictMode does that while
      // developing): only leaving for good records a run still waiting for its keys.
      queueMicrotask(() => {
        if (!mounted.current) commit();
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- commit reads refs only
  }, []);
}
