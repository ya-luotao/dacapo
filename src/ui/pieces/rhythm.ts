import type { PlayResult, StepTiming } from '../../core/rhythm.ts';
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
}

export type RhythmAction =
  | { type: 'reset'; id: string }
  | { type: 'start'; id: string; epochOrigin: number }
  | { type: 'settled'; timings: readonly StepTiming[] }
  | { type: 'played'; result: PlayResult }
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
  };
}

export function rhythmReducer(state: RhythmRunState, action: RhythmAction): RhythmRunState {
  switch (action.type) {
    case 'reset':
      return idleRhythm(action.id);
    case 'start':
      return { ...idleRhythm(action.id), status: 'running', epochOrigin: action.epochOrigin };
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
    case 'played':
      if (state.status !== 'running') return state;
      if (action.result.kind === 'hit')
        return { ...state, last: { kind: 'hit', deviation: action.result.deviation } };
      if (action.result.kind === 'extra') return { ...state, last: { kind: 'extra' } };
      return state;
    case 'end':
      return state.status === 'running' ? { ...state, status: 'ended', end: action.reason } : state;
    case 'hide':
      return state.status === 'idle' ? state : { ...state, hidden: true };
  }
}
