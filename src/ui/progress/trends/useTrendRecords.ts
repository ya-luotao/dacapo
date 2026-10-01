import { useEffect, useMemo, useRef, useState } from 'react';
import type { SessionRecord } from '../../../core/log.ts';
import {
  clickedRunObservations,
  pieceStepObservations,
  type LoadedObservations,
  type Observation,
} from '../../../core/trends.ts';
import { usePracticeStore } from '../../practice/context.ts';
import { clickedRunDeviations } from './clickedRuns.ts';

/** What one session gives the trends: wait-mode steps, and notes timed against a click. */
interface SessionObservations {
  wait: Observation[];
  timed: Observation[];
}

interface Wanted {
  /** Changes when the session gains records (a run goes on, an import adds to it). */
  key: string;
  id: string;
  kind: 'piece' | 'scale';
}

/**
 * The sessions whose raw records the trends need: piece runs (their steps) and scale sessions
 * with a run played with the click (their runs), from `since` on. Nothing else is read.
 */
function wantedSessions(sessions: readonly SessionRecord[], since: number): Wanted[] {
  const wanted: Wanted[] = [];
  for (const s of sessions) {
    if (s.kind === 'piece' && s.endedAt >= since) {
      wanted.push({ key: `${s.id}|${s.endedAt}|${s.steps}`, id: s.id, kind: 'piece' });
    } else if (s.kind === 'scale' && s.runs.some((r) => r.click && r.startedAt >= since)) {
      wanted.push({ key: `${s.id}|${s.runs.length}`, id: s.id, kind: 'scale' });
    }
  }
  return wanted;
}

/**
 * Piece steps and clicked scale runs of the weeks shown, read from storage once and reduced at
 * once to what the trends take (no raw record is kept); null while any is still being read.
 * `failed` when they could not be read.
 */
export function useTrendRecords(
  sessions: readonly SessionRecord[],
  since: number,
): { loaded: LoadedObservations | null; failed: boolean } {
  const store = usePracticeStore();
  const wanted = useMemo(() => wantedSessions(sessions, since), [sessions, since]);
  const [cache, setCache] = useState<ReadonlyMap<string, SessionObservations>>(() => new Map());
  const [failed, setFailed] = useState(false);
  const reading = useRef(new Set<string>());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const missing = wanted.filter((w) => !cache.has(w.key) && !reading.current.has(w.key));
    if (missing.length === 0) return;
    for (const w of missing) reading.current.add(w.key);
    const ids = (kind: Wanted['kind']) => missing.filter((w) => w.kind === kind).map((w) => w.id);
    Promise.all([store.sessionPieceSteps(ids('piece')), store.sessionScaleRuns(ids('scale'))])
      .then(([steps, runs]) => {
        const read = new Map<string, SessionObservations>();
        for (const w of missing) read.set(w.id, { wait: [], timed: [] });
        for (const step of steps) {
          const entry = read.get(step.sessionId);
          if (!entry) continue;
          const { wait, timed } = pieceStepObservations([step]);
          entry.wait.push(...wait);
          entry.timed.push(...timed);
        }
        for (const run of runs) {
          const entry = read.get(run.sessionId);
          if (!entry || run.startedAt < since) continue;
          const deviations = clickedRunDeviations(run);
          if (deviations) entry.timed.push(...clickedRunObservations(run.startedAt, deviations));
        }
        if (!mounted.current) return;
        setCache((previous) => {
          const next = new Map(previous);
          for (const w of missing) next.set(w.key, read.get(w.id)!);
          return next;
        });
      })
      .catch((error: unknown) => {
        console.error('dacapo: could not read records for the trends', error);
        if (mounted.current) setFailed(true);
      })
      .finally(() => {
        for (const w of missing) reading.current.delete(w.key);
      });
  }, [store, wanted, cache, since]);

  const loaded = useMemo((): LoadedObservations | null => {
    const entries: SessionObservations[] = [];
    for (const w of wanted) {
      const entry = cache.get(w.key);
      if (!entry) return null;
      entries.push(entry);
    }
    return {
      pieceWait: entries.flatMap((e) => e.wait),
      timed: entries.flatMap((e) => e.timed),
    };
  }, [wanted, cache]);

  return { loaded: failed ? null : loaded, failed };
}
