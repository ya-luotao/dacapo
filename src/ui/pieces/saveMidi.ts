import { midiFileName, takeMidi, type SmfGrid } from '../../core/smfWrite.ts';
import type { TakeEvent } from '../../core/takes.ts';
import { downloadBytes } from '../../lib/download.ts';

/** A take to save as a MIDI file (docs/PIECES.md, "A take as a MIDI file"). */
export interface MidiTake {
  /** The piece's title: the track's name, and the file's. */
  title: string;
  events: readonly TakeEvent[];
  /** Epoch ms of the take's time 0. */
  startedAt: number;
  /** The beat it was played against, with the latency its timing took off; none: its own times. */
  grid?: SmfGrid | null;
  latency?: number;
}

/**
 * Saves the take as `<title> <date and time>.mid`, the time being when the file's time 0 was
 * played: made here and handed to the browser (in the Apple app, to the share sheet or the save
 * panel, as the backup is). False when the take has no key in it, and nothing is saved.
 */
export function saveMidi(take: MidiTake): boolean {
  const file = takeMidi(take);
  if (!file) return false;
  downloadBytes(file.bytes, midiFileName(take.title, take.startedAt + file.start), 'audio/midi');
  return true;
}
