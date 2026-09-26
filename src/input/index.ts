import { audioContext, unlockOnGesture } from '../output/audio.ts';
import { createEchoGuard } from '../output/echo.ts';
import { createKeyMonitor, type KeyMonitor } from '../output/monitor.ts';
import { createMidiOutput, isBuiltin, type MidiOutput } from '../output/output.ts';
import { createPiano, readPianoVolume, type Piano } from '../output/piano.ts';
import { createSampleBank, type SampleBank } from '../output/pianoSamples.ts';
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
  /** The built-in piano and its samples. */
  piano: Piano;
  samples: SampleBank;
  /** The player's keys on the built-in piano. */
  monitor: KeyMonitor;
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
  const samples = createSampleBank({ base: import.meta.env.BASE_URL });
  const piano = createPiano({
    bank: samples,
    context: audioContext,
    volume: readPianoVolume() / 100,
  });
  const output = createMidiOutput({
    requestAccess: access,
    guard,
    builtin: { port: piano.port, prepare: samples.load },
  });
  const monitor = createKeyMonitor({ piano: piano.keys, prepare: samples.load });
  const keyboard = createKeyboardInput();
  const pointer = createPointerInput();
  // Tapped once: each start adds the same sources again.
  const sources = [
    monitor.tap(midi, 'midi'),
    monitor.tap(keyboard, 'keys'),
    monitor.tap(pointer, 'keys'),
  ];
  return {
    hub,
    midi,
    keyboard,
    pointer,
    output,
    piano,
    samples,
    monitor,
    start() {
      const stops = sources.map((source) => hub.add(source));
      const stopOutput = output.start();
      const stopMonitor = monitor.start();
      // Hidden, the player's keys stop sounding too (the output silences the rest).
      const offHidden = output.onInterrupt((reason) => {
        if (reason === 'hidden') piano.keys.silence();
      });
      const stopUnlock =
        typeof window === 'undefined'
          ? () => undefined
          : unlockOnGesture(
              window,
              () => samples.getStatus() !== 'idle' || isBuiltin(output.getState().selected),
            );
      // Access granted later (the input's "Try again") reaches the output too.
      const unsubscribe = midi.subscribeStatus(() => {
        const { state } = midi.getStatus();
        if (state === 'connected' || state === 'no-device') output.retry();
      });
      return () => {
        unsubscribe();
        stopUnlock();
        offHidden();
        stopMonitor();
        stopOutput();
        for (const stop of stops.reverse()) stop();
      };
    },
  };
}
