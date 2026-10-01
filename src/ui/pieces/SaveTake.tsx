import { ANALYSIS_VERSION } from '../../core/expression.ts';
import type { RepeatMode } from '../../core/repeats.ts';
import type { HandSelection } from '../../core/score.ts';
import type { TakeEvent } from '../../core/takes.ts';
import type { BarLoop } from '../../core/wait.ts';
import type { MidiStatus } from '../../input/index.ts';
import { useInput } from '../input/context.ts';

/** A piece run as saved for calibrating the expression thresholds (docs/EXPRESSION.md). */
export interface SavedTake {
  kind: 'piece-take';
  analysisVersion: number;
  pieceId: string;
  /** The score is referred to, not copied: the piece and the checksum of its notes. */
  checksum: string;
  title: string;
  mode: 'wait' | 'rhythm' | 'memory';
  hands: HandSelection;
  repeats: RepeatMode;
  loop: BarLoop | null;
  /** Percent of the score's tempo. */
  tempo: number;
  latency: number;
  /** The left hand made from the chord symbols, and the semitones the piece was moved by. */
  leftHand?: string;
  transpose?: number;
  /** Epoch ms of the take's time 0. */
  startedAt: number;
  /** The MIDI inputs connected, by name: velocity curves differ between instruments. */
  inputs: string[];
  events: TakeEvent[];
}

/**
 * Development only: saves the run's take with a reference to its score, for setting the
 * expression thresholds from real instruments (as the Scales page's "Save this run" does).
 */
export function SaveTake({ run }: { run: Omit<SavedTake, 'kind' | 'analysisVersion' | 'inputs'> }) {
  const { midi } = useInput();
  function save() {
    const record: SavedTake = {
      kind: 'piece-take',
      analysisVersion: ANALYSIS_VERSION,
      ...run,
      inputs: inputNames(midi.getStatus()),
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(record)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `piece-take-${record.pieceId}-${record.startedAt}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <p className="expression-dev">
      <button type="button" className="button is-compact" onClick={save}>
        Save this run (development)
      </button>
    </p>
  );
}

function inputNames(status: MidiStatus): string[] {
  return status.state === 'connected' ? [...status.names] : [];
}
