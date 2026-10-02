import { useEffect, useLayoutEffect, useRef } from 'react';
import {
  pieceSession,
  stepId,
  type LoopRange,
  type PieceRunHeader,
  type PieceSession,
  type PieceStep,
} from '../../core/pieceRecords.ts';
import type { RepeatMode } from '../../core/repeats.ts';
import type { NoteTiming } from '../../core/rhythm.ts';
import type { HandSelection } from '../../core/score.ts';
import { isFullKeys, type KeyRange } from '../../core/instrument.ts';
import type { MemoryStage } from '../../core/memory.ts';
import type { PatternId } from '../../core/progressions.ts';
import { TAKE_CHUNK_EVENTS, takeChunkId, type TakeState } from '../../core/takes.ts';
import type { PracticeStore } from '../practice/store.ts';
import { takeDone, type Run } from './run.ts';

/** What a run is practising, besides its steps. */
export interface RunContext {
  pieceId: string;
  checksum: string;
  title: string;
  hands: HandSelection;
  loop: LoopRange | null;
  repeats: RepeatMode;
  tempo: number;
  mode?: 'rhythm' | 'memory';
  /** The left hand made from the symbols, when it is. */
  leftHand?: PatternId;
  /** Semitones the piece is moved by; absent (or 0) in the written key. */
  transpose?: number;
  /**
   * The player's keyboard: with fewer than 88 keys the run keeps it, so whatever reads the run
   * knows which notes the app played. Absent (or null): 88 keys.
   */
  keys?: KeyRange | null;
}

/** One step as a run hands it to the recorder. */
export interface RecordInput {
  measure: number;
  pass: number;
  ms: number;
  wrong: number;
  /** Epoch ms: when it was completed (wait mode) or due (rhythm mode). */
  epoch: number;
  notes?: readonly NoteTiming[];
  /** Memory mode: the step's prompts and the stage it was played at. */
  prompts?: number;
  stage?: MemoryStage;
  /** Wait and memory mode: the step had none of the player's keys and was passed. */
  passed?: true;
  /** Its keys the app played for the player (beyond their keyboard); absent when none. */
  given?: number;
}

/** The notes of a run the app played for the player: what its session keeps as `given`. */
export function givenNotes(records: readonly Pick<RecordInput, 'given'>[]): number {
  return records.reduce((sum, r) => sum + (r.given ?? 0), 0);
}

/** A run of either mode, as far as the log cares. */
export interface RecordableRun {
  id: string;
  records: readonly RecordInput[];
  startedEpoch: number | null;
  /**
   * Over: its session is written now, completed when played to the end (or a loop ended by the
   * player), not when stopped early. Null while it goes on.
   */
  ended: { completed: boolean } | null;
  /** What was played (null before the run's first key, in wait mode). */
  take: TakeState | null;
  /** The take has ended too: the run is over and the keys held then are let go. */
  takeDone: boolean;
}

/** A wait-mode run for the recorder. */
export function waitRecording(run: Run): RecordableRun {
  return {
    id: run.id,
    records: run.records,
    startedEpoch: run.startedEpoch,
    ended: run.wait?.finished || run.ended ? { completed: true } : null,
    take: run.take,
    takeDone: takeDone(run),
  };
}

/** What is known about a run at its first step: what it practises, and when it began. */
export function runHeader(
  run: Pick<RecordableRun, 'id' | 'startedEpoch'>,
  first: RecordInput,
  c: RunContext,
): PieceRunHeader {
  return {
    id: run.id,
    pieceId: c.pieceId,
    title: c.title,
    hands: c.hands,
    loop: c.loop,
    repeats: c.repeats,
    tempo: c.tempo,
    startedAt: run.startedEpoch ?? first.epoch - first.ms,
    ...(c.mode && { mode: c.mode }),
    ...(c.leftHand && { leftHand: c.leftHand }),
    ...(c.transpose && { transpose: c.transpose }),
    ...(c.keys && !isFullKeys(c.keys) && { keys: [c.keys.low, c.keys.high] as const }),
  };
}

/** The `n`th step of a run, as it is stored. */
export function storedStep(
  header: PieceRunHeader,
  checksum: string,
  n: number,
  record: RecordInput,
): PieceStep {
  return {
    id: stepId(header.id, n),
    sessionId: header.id,
    pieceId: header.pieceId,
    checksum,
    hands: header.hands,
    measure: record.measure,
    pass: record.pass,
    ms: Math.round(record.ms),
    wrong: record.wrong,
    at: record.epoch,
    ...(record.notes && {
      mode: 'rhythm' as const,
      notes: record.notes.map((n) => ({
        midi: n.midi,
        deviation: n.deviation === null ? null : Math.round(n.deviation),
      })),
    }),
    ...(record.stage && {
      mode: 'memory' as const,
      prompts: record.prompts ?? 0,
      stage: record.stage,
    }),
    // A step passed has none of the player's keys: in rhythm mode its list is empty already.
    ...(record.passed && { notes: [] }),
    ...(header.transpose !== undefined && { transpose: header.transpose }),
  };
}

/** A run as the log has it: its session and its step records. */
export interface RecordedRun {
  session: PieceSession;
  steps: PieceStep[];
}

/**
 * A run as the recorder writes it, worked out here from the run itself: the summary of a run
 * reads its session and steps at once, before they are stored (docs/ADVICE.md). Null before its
 * first step.
 */
export function recordedRun(run: RecordableRun, context: RunContext): RecordedRun | null {
  const first = run.records[0];
  if (!first) return null;
  const header = runHeader(run, first, context);
  const steps = run.records.map((record, n) => storedStep(header, context.checksum, n, record));
  const completed = run.ended?.completed ?? false;
  return { session: pieceSession(header, steps, completed, givenNotes(run.records)), steps };
}

interface Tracked {
  run: RecordableRun;
  /** Steps handed to the store so far. */
  count: number;
  header: PieceRunHeader | null;
  checksum: string;
  steps: PieceStep[];
  closed: boolean;
  /** Events of the take stored so far, in how many chunks, and whether it is written to the end. */
  takeSent: number;
  takeChunks: number;
  takeClosed: boolean;
}

/**
 * Stores every completed step of the runs as it happens, and each run's session when it
 * finishes, is replaced by a new run (a restart, other hands or bars) or the page is left. A run
 * without a completed step leaves nothing behind.
 *
 * Its take goes with it (docs/EXPRESSION.md, "Takes"): a chunk whenever `TAKE_CHUNK_EVENTS` events
 * are waiting, the rest once the keys held at the end are let go, or when the run is replaced or
 * the page is left. Nothing of the take is stored before the run's first step, so a take never
 * outlives a run that left no session.
 */
export function useRunRecorder(
  run: RecordableRun,
  context: RunContext,
  store: PracticeStore,
): void {
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
        takeSent: 0,
        takeChunks: 0,
        takeClosed: false,
      };
    }
    current.run = run;
    flush(current);
    flushTake(current, run.takeDone);
    if (run.ended) close(current, run.ended.completed, false);
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
      if (!t.header) header = t.header = runHeader(r, record, latest.current);
      const step = storedStep(t.header, t.checksum, t.count, record);
      t.steps.push(step);
      store.recordPieceStep(step, header);
    }
  }

  /** Stores the take's full chunks, and with `final` the rest: then it is closed. */
  function flushTake(t: Tracked, final: boolean) {
    const take = t.run.take;
    if (!take || !t.header || t.takeClosed) return;
    const { events } = take;
    while (
      events.length - t.takeSent >= TAKE_CHUNK_EVENTS ||
      (final && events.length > t.takeSent)
    ) {
      const chunk = events.slice(t.takeSent, t.takeSent + TAKE_CHUNK_EVENTS);
      const header = t.header;
      store.recordTake({
        id: takeChunkId(t.run.id, t.takeChunks),
        sessionId: t.run.id,
        pieceId: header.pieceId,
        checksum: t.checksum,
        hands: header.hands,
        repeats: header.repeats,
        tempo: header.tempo,
        ...(header.mode && { mode: header.mode }),
        ...(take.latency !== undefined && { latency: take.latency }),
        ...(header.transpose !== undefined && { transpose: header.transpose }),
        startedAt: take.startedAt,
        chunk: t.takeChunks,
        events: chunk.map((e) => [...e]),
      });
      t.takeSent += chunk.length;
      t.takeChunks++;
    }
    if (final) t.takeClosed = true;
  }

  /** The run is over or replaced: its session, and (unless it waits for keys) its take. */
  function close(t: Tracked, completed: boolean, replaced = true) {
    flush(t);
    if (replaced) flushTake(t, true);
    if (t.closed || !t.header) return;
    t.closed = true;
    const header = { ...t.header, tempo: latest.current.tempo };
    const given = givenNotes(t.run.records.slice(0, t.count));
    store.finishPieceRun(header.id, pieceSession(header, t.steps, completed, given));
  }
}
