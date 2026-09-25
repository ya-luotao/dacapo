import type { Step } from '../../core/score.ts';
import {
  press,
  startWait,
  type StepRecord,
  type WaitRange,
  type WaitState,
} from '../../core/wait.ts';

/** One wait-mode run over a piece, in memory (records are kept for P3's measure heatmap). */
export interface Run {
  steps: readonly Step[];
  range: WaitRange | null;
  wait: WaitState | null;
  records: StepRecord[];
  /** The first key of the run (performance.now() clock). */
  startedAt: number | null;
  /** Stopped with Finish while looping. */
  ended: boolean;
  /** The last wrong key, to flash on the keyboard; `at` tells two presses of one key apart. */
  wrongKey: { midi: number; at: number } | null;
}

export type RunAction =
  | { type: 'restart'; steps: readonly Step[]; range: WaitRange | null }
  | { type: 'press'; midi: number; time: number }
  | { type: 'end' }
  | { type: 'clearWrong'; key: Run['wrongKey'] };

export function startRun({ steps, range }: Pick<Run, 'steps' | 'range'>): Run {
  return {
    steps,
    range,
    wait: range ? startWait(steps, range) : null,
    records: [],
    startedAt: null,
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
        records:
          result.kind === 'complete' || result.kind === 'finished'
            ? [...run.records, result.record]
            : run.records,
        wrongKey: result.kind === 'wrong' ? { midi: action.midi, at: action.time } : run.wrongKey,
      };
    }
  }
}
