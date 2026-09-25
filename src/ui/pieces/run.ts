import type { Step } from '../../core/score.ts';
import {
  pauseClock,
  press,
  startWait,
  type StepRecord,
  type WaitRange,
  type WaitState,
} from '../../core/wait.ts';

/** A completed step, with the epoch ms it was completed at (the record's `at` is on the performance.now() clock). */
export interface RunRecord extends StepRecord {
  epoch: number;
}

/** One wait-mode run over a piece: a practice session once its first step is completed. */
export interface Run {
  /** The session id. */
  id: string;
  steps: readonly Step[];
  range: WaitRange | null;
  wait: WaitState | null;
  records: RunRecord[];
  /** The first key of the run (performance.now() clock), and the same in epoch ms. */
  startedAt: number | null;
  startedEpoch: number | null;
  /** Stopped with Finish while looping. */
  ended: boolean;
  /** The last wrong key, to flash on the keyboard; `at` tells two presses of one key apart. */
  wrongKey: { midi: number; at: number } | null;
}

export type RunAction =
  | { type: 'restart'; id: string; steps: readonly Step[]; range: WaitRange | null }
  /** `time` on the performance.now() clock, `at` in epoch ms. */
  | { type: 'press'; midi: number; time: number; at: number }
  /** The demo plays: the current step's clock starts again at the next key. */
  | { type: 'pauseClock' }
  | { type: 'end' }
  | { type: 'clearWrong'; key: Run['wrongKey'] };

export function startRun({ id, steps, range }: Pick<Run, 'id' | 'steps' | 'range'>): Run {
  return {
    id,
    steps,
    range,
    wait: range ? startWait(steps, range) : null,
    records: [],
    startedAt: null,
    startedEpoch: null,
    ended: false,
    wrongKey: null,
  };
}

export function runReducer(run: Run, action: RunAction): Run {
  switch (action.type) {
    case 'restart':
      return startRun(action);
    case 'end':
      return run.startedAt === null ? run : { ...run, ended: true };
    case 'pauseClock':
      return run.wait && run.wait.since !== null && !run.wait.finished
        ? { ...run, wait: pauseClock(run.wait) }
        : run;
    case 'clearWrong':
      return run.wrongKey === action.key ? { ...run, wrongKey: null } : run;
    case 'press': {
      if (!run.wait || run.ended) return run;
      const result = press(run.steps, run.wait, action.midi, action.time);
      if (result.kind === 'ignored') return run;
      return {
        ...run,
        wait: result.state,
        startedAt: run.startedAt ?? action.time,
        startedEpoch: run.startedEpoch ?? action.at,
        records:
          result.kind === 'complete' || result.kind === 'finished'
            ? [...run.records, { ...result.record, epoch: action.at }]
            : run.records,
        wrongKey: result.kind === 'wrong' ? { midi: action.midi, at: action.time } : run.wrongKey,
      };
    }
  }
}
