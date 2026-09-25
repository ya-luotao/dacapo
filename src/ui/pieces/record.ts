import { useEffect, useLayoutEffect, useRef } from 'react';
import {
  pieceSession,
  stepId,
  type LoopRange,
  type PieceRunHeader,
  type PieceStep,
} from '../../core/pieceRecords.ts';
import type { RepeatMode } from '../../core/repeats.ts';
import type { HandSelection } from '../../core/score.ts';
import type { PracticeStore } from '../practice/store.ts';
import type { Run } from './run.ts';

/** What a run is practising, besides its steps. */
export interface RunContext {
  pieceId: string;
  checksum: string;
  title: string;
  hands: HandSelection;
  loop: LoopRange | null;
  repeats: RepeatMode;
  tempo: number;
}

interface Tracked {
  run: Run;
  /** Steps handed to the store so far. */
  count: number;
  header: PieceRunHeader | null;
  checksum: string;
  steps: PieceStep[];
  closed: boolean;
}

/**
 * Stores every completed step of the runs as it happens, and each run's session when it
 * finishes, is replaced by a new run (a restart, other hands or bars) or the page is left. A run
 * without a completed step leaves nothing behind.
 */
export function useRunRecorder(run: Run, context: RunContext, store: PracticeStore): void {
  const latest = useRef(context);
  useLayoutEffect(() => {
    latest.current = context;
  });
  const tracked = useRef<Tracked | null>(null);

  useEffect(() => {
    let current = tracked.current;
    if (current && current.run.id !== run.id) {
      close(current, false);
      current = null;
    }
    if (!current) {
      current = tracked.current = {
        run,
        count: 0,
        header: null,
        checksum: latest.current.checksum,
        steps: [],
        closed: false,
      };
    }
    current.run = run;
    flush(current);
    if (run.wait?.finished || run.ended) close(current, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- store and helpers are stable
  }, [run]);

  useEffect(
    () => () => {
      if (tracked.current) close(tracked.current, false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on leaving the page only
    [],
  );

  function flush(t: Tracked) {
    const { run: r } = t;
    for (; t.count < r.records.length; t.count++) {
      const record = r.records[t.count]!;
      let header: PieceRunHeader | null = null;
      if (!t.header) {
        const c = latest.current;
        header = t.header = {
          id: r.id,
          pieceId: c.pieceId,
          title: c.title,
          hands: c.hands,
          loop: c.loop,
          repeats: c.repeats,
          tempo: c.tempo,
          startedAt: r.startedEpoch ?? record.epoch - record.ms,
        };
      }
      const step: PieceStep = {
        id: stepId(r.id, t.count),
        sessionId: r.id,
        pieceId: t.header.pieceId,
        checksum: t.checksum,
        hands: t.header.hands,
        measure: record.measure,
        pass: record.pass,
        ms: Math.round(record.ms),
        wrong: record.wrong,
        at: record.epoch,
      };
      t.steps.push(step);
      store.recordPieceStep(step, header);
    }
  }

  function close(t: Tracked, completed: boolean) {
    flush(t);
    if (t.closed || !t.header) return;
    t.closed = true;
    const header = { ...t.header, tempo: latest.current.tempo };
    store.finishPieceRun(header.id, pieceSession(header, t.steps, completed));
  }
}
