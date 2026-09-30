/** A key going down or up. `time` is on the `performance.now()` clock (an event's `timeStamp`). */
export interface NoteEvent {
  type: 'on' | 'off';
  midi: number;
  /** 1–127 for note-on; release velocity (often 0 or 64) for note-off. */
  velocity: number;
  time: number;
}

/** Sustain pedal (MIDI CC64) pressed or released. */
export interface SustainEvent {
  type: 'sustain';
  down: boolean;
  time: number;
}

/**
 * A pedal's raw position as the keyboard sends it: CC 64 (sustain), 66 (sostenuto) or 67 (una
 * corda), 0–127. The hub passes it on unmerged, for what a run records (its take); the sustain
 * pedal's down or up for sounding and holding keys is `SustainEvent`.
 */
export interface PedalEvent {
  type: 'pedal';
  controller: PedalController;
  value: number;
  time: number;
}

export type PedalController = 64 | 66 | 67;

/** Everything a port was holding is released (port gone, "all notes off", window lost focus). */
export interface ResetEvent {
  type: 'reset';
  time: number;
}

export type InputEvent = NoteEvent | SustainEvent | PedalEvent | ResetEvent;

/**
 * Sends an event into the hub. `port` separates independent holders inside one source
 * (two MIDI devices, two fingers) so one releasing a key does not release the other's.
 */
export type Emit = (event: InputEvent, port?: string) => void;

export interface NoteInput {
  /** Unique among the sources added to one hub. */
  readonly id: string;
  /** Starts listening and returns a function that stops. Must support start → stop → start. */
  start: (emit: Emit) => () => void;
}
