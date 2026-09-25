import { createEchoGuard } from '../output/echo.ts';
import { createMidiOutput, type MidiOutput } from '../output/output.ts';
import { createInputHub, type InputHub } from './hub.ts';
import { createKeyboardInput, type KeyboardInput } from './keyboard.ts';
import { createPointerInput, type PointerInput } from './pointer.ts';
import {
  browserMidiAccess,
  createWebMidiInput,
  shareMidiAccess,
  type WebMidiInput,
} from './webmidi.ts';

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
  /** The instrument's MIDI output, sharing the input's access (one permission prompt). */
  output: MidiOutput;
  /** Starts every source. Returns a function that stops them all; start again afterwards is fine. */
  start: () => () => void;
}

/** Creating the system has no side effects; nothing listens until `start()`. */
export function createInputSystem(): InputSystem {
  const browser = browserMidiAccess();
  const access = browser && shareMidiAccess(browser);
  const guard = createEchoGuard();
  const hub = createInputHub();
  const midi = createWebMidiInput(access, guard.isEcho);
  const output = createMidiOutput({ requestAccess: access, guard });
  const keyboard = createKeyboardInput();
  const pointer = createPointerInput();
  return {
    hub,
    midi,
    keyboard,
    pointer,
    output,
    start() {
      const stops = [midi, keyboard, pointer].map((source) => hub.add(source));
      const stopOutput = output.start();
      // Access granted later (the input's "Try again") reaches the output too.
      const unsubscribe = midi.subscribeStatus(() => {
        const { state } = midi.getStatus();
        if (state === 'connected' || state === 'no-device') output.retry();
      });
      return () => {
        unsubscribe();
        stopOutput();
        for (const stop of stops.reverse()) stop();
      };
    },
  };
}
