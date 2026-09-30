// What playing a scale leaves behind: each run as played, the raw data every scale figure is
// recomputed from, and the sessions of the practice log, which keep each run's headline figures
// for lists and trends (docs/SCALES.md, "Records"). All times are epoch ms unless said otherwise.

import { activeTime, IDLE_MS } from './activity.ts';
import type { PlayedNote, RunHeadline } from './evenness.ts';
import type { ClickSettings, ScaleClick } from './scaleClick.ts';

export interface PedalChange {
  down: boolean;
  /** Ms on the run's clock. */
  time: number;
}

/** How a run ended: at its last note, after a pause, or with Stop. */
export type RunEnd = 'finished' | 'idle' | 'stopped';

/** One run of a scale. Plain data, so it can be stored as is. */
export interface ScaleRun {
  /** `exerciseKey` of what was played, e.g. `major:D:2:right`. */
  exercise: string;
  /** Epoch ms of the first key. */
  startedAt: number;
  end: RunEnd;
  /** Every key from the first one on, in the order played, ms from the first. */
  keys: PlayedNote[];
  pedal: PedalChange[];
  /** The pedal was down when the run began. */
  pedalAtStart: boolean;
  /** False when every key had the same velocity: loudness is then not measured. */
  velocityMeasured: boolean;
  /** The MIDI inputs connected, by name (velocity curves differ); empty without one. */
  inputs: string[];
  /** Played with the click (S4): its grid, so the timing against it can be recomputed. */
  click?: ScaleClick;
}

/** A run as stored (S2): the run, and where it belongs. */
export interface StoredScaleRun extends ScaleRun {
  /** `sessionId:n`, n the run's position in its session: stable, so imports merge by id. */
  id: string;
  sessionId: string;
}

/** What a session keeps of each of its runs, so lists and trends need no raw run. */
export interface ScaleRunSummary {
  /** The stored run's id. */
  id: string;
  exercise: string;
  /** Epoch ms of the first key and of the last. */
  startedAt: number;
  endedAt: number;
  headline: RunHeadline;
  /** Played with the click: its tempo and notes per beat. Absent: at free tempo. */
  click?: ClickSettings;
}

/**
 * Scales played one after another, as the practice log shows them. A pause longer than `IDLE_MS`
 * between two runs, or leaving the page, starts a new session. Only scale runs are recorded (the
 * quality gate of evenness.ts); a session has at least one.
 */
export interface ScaleSession {
  kind: 'scale';
  id: string;
  /** The first run's first key, the last run's last key. */
  startedAt: number;
  endedAt: number;
  /** From the first key to the last, pauses capped at `IDLE_MS` (the rule of every session). */
  activeMs: number;
  /** In the order played. */
  runs: ScaleRunSummary[];
}

export const scaleRunId = (sessionId: string, n: number): string => `${sessionId}:${n}`;

/** The session with `run` added: its time and runs brought up to date. */
export function withRun(
  session: ScaleSession | null,
  id: string,
  run: ScaleRunSummary,
): ScaleSession {
  const runs = [...(session?.runs ?? []), run];
  const times = runs.flatMap((r) => [r.startedAt, r.endedAt]);
  return {
    kind: 'scale',
    id: session?.id ?? id,
    startedAt: runs[0]!.startedAt,
    endedAt: run.endedAt,
    activeMs: activeTime(times),
    runs,
  };
}

/** A new run belongs to `session` unless it starts more than `IDLE_MS` after its last key. */
export function continuesSession(session: ScaleSession | null, startedAt: number): boolean {
  return session !== null && startedAt - session.endedAt <= IDLE_MS;
}

/** The order runs were played in: by start, then by id. */
export function byRunTime(a: StoredScaleRun, b: StoredScaleRun): number {
  return a.startedAt - b.startedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
