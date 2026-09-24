import type { Emit, InputEvent, NoteInput } from './types.ts';

export type MidiStatus =
  | { state: 'pending' }
  | { state: 'unsupported' }
  | { state: 'no-permission' }
  | { state: 'no-device' }
  /** Device names as reported by the browser; an empty string means the device has no name. */
  | { state: 'connected'; names: readonly string[] };

export type MidiMessage =
  | { type: 'on' | 'off'; channel: number; midi: number; velocity: number }
  | { type: 'sustain'; channel: number; down: boolean }
  /** "All sound off" (CC120) or "all notes off" (CC123). */
  | { type: 'reset'; channel: number };

const NOTE_OFF = 0x80;
const NOTE_ON = 0x90;
const CONTROL_CHANGE = 0xb0;
const CC_SUSTAIN = 64;
const CC_ALL_SOUND_OFF = 120;
const CC_ALL_NOTES_OFF = 123;

/**
 * Parses one complete MIDI message as delivered by Web MIDI (always with its status byte,
 * so running status never occurs). Returns null for anything that is not a note or pedal
 * message on any channel: system messages (clock, active sensing, SysEx), other controllers,
 * truncated or malformed data.
 */
export function parseMidiMessage(data: ArrayLike<number> | null | undefined): MidiMessage | null {
  if (!data || data.length < 3) return null;
  const status = data[0]!;
  const data1 = data[1]!;
  const data2 = data[2]!;
  if (status < 0x80 || status >= 0xf0 || data1 > 0x7f || data2 > 0x7f) return null;
  const kind = status & 0xf0;
  const channel = status & 0x0f;
  switch (kind) {
    case NOTE_ON:
      return { type: data2 === 0 ? 'off' : 'on', channel, midi: data1, velocity: data2 };
    case NOTE_OFF:
      return { type: 'off', channel, midi: data1, velocity: data2 };
    case CONTROL_CHANGE:
      if (data1 === CC_SUSTAIN) return { type: 'sustain', channel, down: data2 >= 64 };
      if (data1 === CC_ALL_SOUND_OFF || data1 === CC_ALL_NOTES_OFF)
        return { type: 'reset', channel };
      return null;
    default:
      return null;
  }
}

function toInputEvent(message: MidiMessage, time: number): InputEvent {
  switch (message.type) {
    case 'on':
    case 'off':
      return { type: message.type, midi: message.midi, velocity: message.velocity, time };
    case 'sustain':
      return { type: 'sustain', down: message.down, time };
    case 'reset':
      return { type: 'reset', time };
  }
}

export interface WebMidiInput extends NoteInput {
  getStatus: () => MidiStatus;
  /** For `useSyncExternalStore`. */
  subscribeStatus: (onChange: () => void) => () => void;
  /** Asks for access again, e.g. after the user allowed MIDI in the site settings. */
  retry: () => void;
}

export type RequestMidiAccess = () => Promise<MIDIAccess>;

export function browserMidiAccess(): RequestMidiAccess | null {
  if (typeof navigator === 'undefined' || !('requestMIDIAccess' in navigator)) return null;
  return () => navigator.requestMIDIAccess({ sysex: false });
}

// Development guard: which live listener owns each MIDI port id, across all instances.
const portOwners = new Map<string, object>();

function statusFromError(error: unknown): MidiStatus {
  const name = error instanceof Error || error instanceof DOMException ? error.name : '';
  return name === 'NotSupportedError' ? { state: 'unsupported' } : { state: 'no-permission' };
}

function sameStatus(a: MidiStatus, b: MidiStatus): boolean {
  if (a.state !== b.state) return false;
  if (a.state !== 'connected' || b.state !== 'connected') return true;
  return a.names.length === b.names.length && a.names.every((name, i) => name === b.names[i]);
}

/**
 * Listens to every connected MIDI input and follows hot-plugging. Each port is its own holder
 * in the hub, so unplugging one device releases exactly the keys it was holding.
 */
export function createWebMidiInput(
  requestAccess: RequestMidiAccess | null = browserMidiAccess(),
): WebMidiInput {
  const owner = {};
  let status: MidiStatus = requestAccess ? { state: 'pending' } : { state: 'unsupported' };
  const statusListeners = new Set<() => void>();
  let pending: Promise<MIDIAccess> | null = null;
  let access: MIDIAccess | null = null;
  let emit: Emit | null = null;
  let generation = 0;
  const attached = new Map<string, { input: MIDIInput; listener: (e: Event) => void }>();

  function setStatus(next: MidiStatus) {
    if (sameStatus(status, next)) return;
    status = next;
    for (const listener of [...statusListeners]) listener();
  }

  function attach(input: MIDIInput) {
    if (import.meta.env.DEV) {
      const current = portOwners.get(input.id);
      if (current && current !== owner) {
        console.error(
          `dacapo: a second listener was attached to MIDI input "${input.name ?? input.id}"`,
        );
      }
      portOwners.set(input.id, owner);
    }
    const listener = (event: Event) => {
      const { data, timeStamp } = event as MIDIMessageEvent;
      const message = parseMidiMessage(data);
      if (message && emit) emit(toInputEvent(message, timeStamp), input.id);
    };
    input.addEventListener('midimessage', listener);
    attached.set(input.id, { input, listener });
    // Adding a listener should open the port implicitly; opening explicitly costs nothing.
    input.open().catch(() => undefined);
  }

  function detach(id: string, time: number) {
    const entry = attached.get(id);
    if (!entry) return;
    entry.input.removeEventListener('midimessage', entry.listener);
    attached.delete(id);
    if (import.meta.env.DEV && portOwners.get(id) === owner) portOwners.delete(id);
    emit?.({ type: 'reset', time }, id);
  }

  function sync() {
    if (!access) return;
    const connected = new Map<string, MIDIInput>();
    access.inputs.forEach((input) => {
      if (input.state === 'connected') connected.set(input.id, input);
    });
    const time = performance.now();
    for (const [id, { input }] of [...attached]) {
      if (connected.get(id) !== input) detach(id, time);
    }
    for (const [id, input] of connected) if (!attached.has(id)) attach(input);
    const names = [...new Set([...connected.values()].map((input) => input.name?.trim() ?? ''))];
    setStatus(names.length > 0 ? { state: 'connected', names } : { state: 'no-device' });
  }

  function connect(request: RequestMidiAccess, run: number) {
    if (!pending) {
      setStatus({ state: 'pending' });
      pending = request();
    }
    pending.then(
      (granted) => {
        if (run !== generation) return;
        access = granted;
        access.onstatechange = sync;
        sync();
      },
      (error: unknown) => {
        pending = null;
        if (run !== generation) return;
        setStatus(statusFromError(error));
      },
    );
  }

  return {
    id: 'webmidi',
    start(nextEmit) {
      if (!requestAccess) return () => undefined;
      emit = nextEmit;
      const run = ++generation;
      connect(requestAccess, run);
      return () => {
        if (run !== generation) return;
        generation++;
        const time = performance.now();
        for (const id of [...attached.keys()]) detach(id, time);
        if (access?.onstatechange === sync) access.onstatechange = null;
        emit = null;
      };
    },
    getStatus: () => status,
    subscribeStatus(onChange) {
      statusListeners.add(onChange);
      return () => void statusListeners.delete(onChange);
    },
    retry() {
      if (!requestAccess || !emit || status.state !== 'no-permission') return;
      connect(requestAccess, generation);
    },
  };
}
