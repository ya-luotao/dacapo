import { createInputHub, type InputHub } from './hub.ts';
import { createKeyboardInput, type KeyboardInput } from './keyboard.ts';
import { createPointerInput, type PointerInput } from './pointer.ts';
import { createWebMidiInput, type WebMidiInput } from './webmidi.ts';

export type { HubEvent, HubState, InputHub } from './hub.ts';
export type { KeyboardInput } from './keyboard.ts';
export type { PointerInput } from './pointer.ts';
export type { InputEvent, NoteEvent, NoteInput } from './types.ts';
export type { MidiStatus, WebMidiInput } from './webmidi.ts';

export interface InputSystem {
  hub: InputHub;
  midi: WebMidiInput;
  keyboard: KeyboardInput;
  pointer: PointerInput;
  /** Starts every source. Returns a function that stops them all; start again afterwards is fine. */
  start: () => () => void;
}

/** Creating the system has no side effects; nothing listens until `start()`. */
export function createInputSystem(): InputSystem {
  const hub = createInputHub();
  const midi = createWebMidiInput();
  const keyboard = createKeyboardInput();
  const pointer = createPointerInput();
  return {
    hub,
    midi,
    keyboard,
    pointer,
    start() {
      const stops = [midi, keyboard, pointer].map((source) => hub.add(source));
      return () => {
        for (const stop of stops.reverse()) stop();
      };
    },
  };
}
