import type { MemoryStage } from '../../core/memory.ts';
import type { Step } from '../../core/score.ts';
import {
  startTake,
  takeInput,
  takeNoteOn,
  type PedalPositions,
  type TakeInput,
  type TakeState,
} from '../../core/takes.ts';
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
  /** Memory mode: the step's prompts, and the stage it was played at. */
  prompts?: number;
  stage?: MemoryStage;
}

/** A memory-mode run (P7): the stage it is played at and the written bars hidden. */
export interface MemoryRun {
  stage: MemoryStage;
  hidden: ReadonlySet<number>;
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
  /**
   * The last wrong key, to flash on the keyboard; `at` tells two presses of one key apart, and
   * `step` is the step it fell on.
   */
  wrongKey: { midi: number; at: number; step: number } | null;
  /**
   * What was played, from the run's first key (docs/EXPRESSION.md, "Takes"); after the run ends it
   * still takes the releases of the keys held then (and the pedals meanwhile).
   */
  take: TakeState | null;
  /** Memory mode, else null. */
  memory: MemoryRun | null;
  /** Memory mode: prompts on the current step so far (a wrong key or a peek in a hidden bar). */
  prompts: number;
}

export type RunAction =
  | {
      type: 'restart';
      id: string;
      steps: readonly Step[];
      range: WaitRange | null;
      memory?: MemoryRun | null;
    }
  /**
   * `time` on the performance.now() clock, `at` in epoch ms; `pedals`: where the pedals were before
   * the run's first key.
   */
  | {
      type: 'press';
      midi: number;
      velocity: number;
      time: number;
      at: number;
      pedals?: PedalPositions;
    }
  /** A key up or a pedal: for the take only. */
  | { type: 'input'; input: TakeInput }
  /** The demo plays: the current step's clock starts again at the next key. */
  | { type: 'pauseClock' }
  | { type: 'end' }
  | { type: 'clearWrong'; key: Run['wrongKey'] }
  /** Memory mode: the player peeked at the current bar. */
  | { type: 'peek' };

/** Whether the current step's bar is hidden (memory mode): a prompt there counts. */
export function stepHidden(run: Pick<Run, 'memory' | 'wait' | 'steps'>): boolean {
  const step = run.wait ? run.steps[run.wait.current] : undefined;
  return Boolean(run.memory && step && run.memory.hidden.has(step.measure));
}

export function startRun({
  id,
  steps,
  range,
  memory = null,
}: Pick<Run, 'id' | 'steps' | 'range'> & { memory?: MemoryRun | null }): Run {
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
    take: null,
    memory,
    prompts: 0,
  };
}

/** Over (played to the end, or ended with Finish) and every key held then let go. */
export function takeDone(run: Pick<Run, 'wait' | 'ended' | 'take'>): boolean {
  return Boolean((run.wait?.finished || run.ended) && run.take && run.take.held.length === 0);
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
    case 'peek':
      return run.wait && !run.wait.finished && !run.ended && stepHidden(run)
        ? { ...run, prompts: run.prompts + 1 }
        : run;
    case 'input':
      if (!run.take || takeDone(run)) return run;
      return { ...run, take: takeInput(run.take, action.input) };
    case 'press': {
      if (!run.wait || run.ended) return run;
      const result = press(run.steps, run.wait, action.midi, action.time);
      if (result.kind === 'ignored') return run;
      // In memory mode a wrong key in a hidden bar shows the step's notes: a prompt.
      const prompts = run.prompts + (result.kind === 'wrong' && stepHidden(run) ? 1 : 0);
      const completed = result.kind === 'complete' || result.kind === 'finished';
      const take = run.take ?? startTake(action.time, action.at, action.pedals);
      // The key belongs to the step it was pressed on, unless it is not one of its keys; a key of
      // an ornament to its step, unless it is the principal struck again after the step.
      const step =
        result.kind === 'wrong'
          ? -1
          : result.kind === 'ornament'
            ? result.principal
              ? -1
              : result.step
            : run.wait.current;
      return {
        ...run,
        take: takeNoteOn(take, action.time, action.midi, action.velocity, step),
        wait: result.state,
        startedAt: run.startedAt ?? action.time,
        startedEpoch: run.startedEpoch ?? action.at,
        records: completed
          ? [
              ...run.records,
              {
                ...result.record,
                epoch: action.at,
                ...(run.memory && { prompts, stage: run.memory.stage }),
              },
            ]
          : run.records,
        prompts: completed ? 0 : prompts,
        wrongKey:
          result.kind === 'wrong'
            ? { midi: action.midi, at: action.time, step: run.wait.current }
            : run.wrongKey,
      };
    }
  }
}
