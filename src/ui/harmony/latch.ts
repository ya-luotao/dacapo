import type { PointerInput } from '../../input/pointer.ts';

/** Each latched key is held by a pointer of its own, apart from any real one. */
const LATCH_POINTER = -2000;
const latchPointer = (midi: number) => LATCH_POINTER - midi;

export interface LatchedPointer extends PointerInput {
  /** Lets go of every latched key, e.g. when the next card comes. */
  releaseAll: (time: number) => void;
}

/**
 * The on-screen keyboard of a chord card, for a mouse or a finger: a click or tap latches a key
 * down, a second one lets it go, so a chord can be built one key at a time and held. The keys go
 * through the app's own pointer input, so they sound, light up and reach the session as any held
 * key does. A pointer never glides across keys here, and a key activated without a pointer
 * (a keyboard or a screen reader) toggles the same way. MIDI and the computer keyboard are not
 * affected.
 */
export function createLatchedPointer(pointer: PointerInput): LatchedPointer {
  const latched = new Set<number>();

  function unlatch(midi: number, time: number) {
    latched.delete(midi);
    pointer.release(latchPointer(midi), time);
  }

  return {
    id: pointer.id,
    start: (emit) => pointer.start(emit),
    press(_pointerId, midi, time, velocity) {
      if (latched.has(midi)) {
        unlatch(midi, time);
        return;
      }
      latched.add(midi);
      pointer.press(latchPointer(midi), midi, time, velocity);
    },
    // A pointer going up leaves its key down: only a second press lets it go.
    release: () => {},
    isDown: () => false,
    releaseAll(time) {
      for (const midi of [...latched]) unlatch(midi, time);
    },
  };
}
