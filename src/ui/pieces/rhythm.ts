import type { PlayResult, StepTiming } from '../../core/rhythm.ts';
import {
  startTake,
  takeInput,
  takeNoteOn,
  type PedalPositions,
  type TakeInput,
  type TakeState,
} from '../../core/takes.ts';
import type { RhythmEnd } from '../../output/rhythm.ts';
import type { RecordInput } from './record.ts';

// A rhythm-mode run as React sees it: the steps settled so far (the records), the last note's
// timing for the quiet indicator, and how it ended.

export type RhythmStatus = 'idle' | 'running' | 'ended';

export type LastNote = { kind: 'hit'; deviation: number } | { kind: 'extra' };

export interface RhythmRunState {
  /** The session id. */
  id: string;
  status: RhythmStatus;
  timings: StepTiming[];
  records: RecordInput[];
  startedEpoch: number | null;
  /** Epoch ms of the run clock's zero. */
  epochOrigin: number;
  last: LastNote | null;
  end: RhythmEnd | null;
  /** Ended because the settings changed under it: saved, but no result sheet. */
  hidden: boolean;
  /**
   * What was played from Start on, times from the span's start (the count-in before it negative);
   * after the end it still takes the releases of the keys held then.
   */
  take: TakeState | null;
}

export type RhythmAction =
  | { type: 'reset'; id: string }
  /** `origin`: the run clock's zero on the performance.now() clock (`epochOrigin` in epoch ms). */
  | {
      type: 'start';
      id: string;
      epochOrigin: number;
      origin: number;
      latency: number;
      pedals?: PedalPositions;
    }
  | { type: 'settled'; timings: readonly StepTiming[] }
  /** Every key down while the run goes, judged or not (`time` on the performance.now() clock). */
  | { type: 'played'; result: PlayResult; midi: number; velocity: number; time: number }
  /** A key up or a pedal: for the take only. */
  | { type: 'input'; input: TakeInput }
  | { type: 'end'; reason: RhythmEnd }
  | { type: 'hide' };

export function idleRhythm(id: string): RhythmRunState {
  return {
    id,
    status: 'idle',
    timings: [],
    records: [],
    startedEpoch: null,
    epochOrigin: 0,
    last: null,
    end: null,
    hidden: false,
    take: null,
  };
}

/** Ended, and every key held then let go. */
export function rhythmTakeDone(state: Pick<RhythmRunState, 'status' | 'take'>): boolean {
  return state.status === 'ended' && (state.take?.held.length ?? 0) === 0;
}

export function rhythmReducer(state: RhythmRunState, action: RhythmAction): RhythmRunState {
  switch (action.type) {
    case 'reset':
      return idleRhythm(action.id);
    case 'start':
      return {
        ...idleRhythm(action.id),
        status: 'running',
        epochOrigin: action.epochOrigin,
        take: startTake(action.origin, action.epochOrigin, action.pedals, action.latency),
      };
    case 'settled': {
      if (state.status === 'idle' || action.timings.length === 0) return state;
      const records = action.timings.map((t): RecordInput => ({
        measure: t.measure,
        pass: t.pass,
        ms: t.slot,
        wrong: t.extra,
        epoch: Math.round(state.epochOrigin + t.due),
        notes: t.notes,
      }));
      return {
        ...state,
        timings: [...state.timings, ...action.timings],
        records: [...state.records, ...records],
        startedEpoch: state.startedEpoch ?? records[0]!.epoch,
      };
    }
    case 'played': {
      if (state.status !== 'running' || !state.take) return state;
      const { result } = action;
      // A key names the step it was matched to; a key of an ornament its step, unless it is the
      // principal struck again.
      const step =
        result.kind === 'hit' || (result.kind === 'ornament' && !result.principal)
          ? result.step
          : -1;
      const take = takeNoteOn(state.take, action.time, action.midi, action.velocity, step);
      if (result.kind === 'hit')
        return { ...state, take, last: { kind: 'hit', deviation: result.deviation } };
      if (result.kind === 'extra') return { ...state, take, last: { kind: 'extra' } };
      return { ...state, take };
    }
    case 'input':
      if (state.status === 'idle' || !state.take || rhythmTakeDone(state)) return state;
      return { ...state, take: takeInput(state.take, action.input) };
    case 'end':
      return state.status === 'running' ? { ...state, status: 'ended', end: action.reason } : state;
    case 'hide':
      return state.status === 'idle' ? state : { ...state, hidden: true };
  }
}
