import { isPianoKey } from '../core/note.ts';
import type { Emit, NoteInput } from './types.ts';

/** A click cannot express touch strength, so every note gets the same velocity. */
export const POINTER_VELOCITY = 96;

export interface PointerInput extends NoteInput {
  /** Presses `midi` for `pointerId`; a pointer that slides to another key releases the first. */
  press: (pointerId: number, midi: number, time: number) => void;
  release: (pointerId: number, time: number) => void;
  /** Whether `pointerId` is currently holding a key (for glissando across keys). */
  isDown: (pointerId: number) => boolean;
}

/** Notes played by clicking or tapping the on-screen piano. Each pointer is its own holder. */
export function createPointerInput(): PointerInput {
  let emit: Emit | null = null;
  const down = new Map<number, number>();

  function release(pointerId: number, time: number) {
    const midi = down.get(pointerId);
    if (midi === undefined) return;
    down.delete(pointerId);
    emit?.({ type: 'off', midi, velocity: 0, time }, `p${pointerId}`);
  }

  return {
    id: 'pointer',
    start(next) {
      emit = next;
      return () => {
        emit = null;
        down.clear();
      };
    },
    press(pointerId, midi, time) {
      if (!emit || !isPianoKey(midi) || down.get(pointerId) === midi) return;
      release(pointerId, time);
      down.set(pointerId, midi);
      emit({ type: 'on', midi, velocity: POINTER_VELOCITY, time }, `p${pointerId}`);
    },
    release,
    isDown: (pointerId) => down.has(pointerId),
  };
}
