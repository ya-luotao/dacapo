// What playing a scale leaves behind: the run as played, the raw data every scale figure is
// recomputed from (docs/SCALES.md, "Records"). S2 stores it; until then the development build can
// save it to a file, to set the loudness thresholds from real instruments.

import type { PlayedNote } from './evenness.ts';

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
}
