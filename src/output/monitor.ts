// The keys the player plays, sounded on the built-in piano: the computer keyboard's and the
// on-screen piano's (they have no sound of their own) unless turned off, and a MIDI keyboard's
// when asked for (one without a sound of its own). Each source is tapped on its way into the input
// hub, and what the chosen ones hold is merged by a second hub, so a key held twice sounds once
// and the pedal holds the strings as it does anywhere else.

import { createInputHub } from '../input/hub.ts';
import type { Emit, NoteInput } from '../input/types.ts';
import { readPref, writePref } from '../lib/localPrefs.ts';
import type { PianoKeys } from './piano.ts';

export type MonitorKind = 'keys' | 'midi';

export interface MonitorSettings {
  /** The computer keyboard and the on-screen piano. */
  keys: boolean;
  midi: boolean;
}

export interface KeyMonitor {
  /**
   * `source` with its events also going to the monitor as `kind`; add this to the input hub. Once
   * per source: the result can be started and stopped again and again.
   */
  tap: (source: NoteInput, kind: MonitorKind) => NoteInput;
  getSettings: () => MonitorSettings;
  /** For `useSyncExternalStore`. */
  subscribe: (onChange: () => void) => () => void;
  set: (settings: MonitorSettings) => void;
  /** Starts sounding keys. Returns a function that stops (and silences them). */
  start: () => () => void;
}

export const MONITOR_KEYS_PREF = 'dacapo.piano.keys';
export const MONITOR_MIDI_PREF = 'dacapo.piano.midi';

export interface KeyMonitorOptions {
  piano: PianoKeys;
  /** Called on the first key to sound, so the samples load (they are not needed before). */
  prepare?: () => void;
  prefs?: {
    read: (key: string) => string | null;
    write: (key: string, value: string | null) => void;
  };
}

export function createKeyMonitor(options: KeyMonitorOptions): KeyMonitor {
  const { piano } = options;
  const prefs = options.prefs ?? { read: readPref, write: writePref };
  let settings: MonitorSettings = {
    keys: prefs.read(MONITOR_KEYS_PREF) !== 'off',
    midi: prefs.read(MONITOR_MIDI_PREF) === 'on',
  };
  const listeners = new Set<() => void>();
  const hub = createInputHub();
  const branches: { kind: MonitorKind; source: NoteInput }[] = [];
  /** Removes each branch added to the hub, by source id. */
  const added = new Map<string, () => void>();
  let running = false;

  function follow() {
    for (const { kind, source } of branches) {
      const on = running && settings[kind];
      const remove = added.get(source.id);
      if (on && !remove) added.set(source.id, hub.add(source));
      else if (!on && remove) {
        // Its keys come up in the hub, and so stop sounding.
        remove();
        added.delete(source.id);
      }
    }
  }

  return {
    tap(source, kind) {
      if (branches.some((b) => b.source.id === source.id))
        throw new Error(`Input source "${source.id}" is already tapped`);
      let branch: Emit | null = null;
      branches.push({
        kind,
        source: {
          id: source.id,
          start(emit) {
            branch = emit;
            return () => void (branch = null);
          },
        },
      });
      follow();
      return {
        id: source.id,
        start: (emit) =>
          source.start((event, port) => {
            emit(event, port);
            branch?.(event, port);
          }),
      };
    },
    getSettings: () => settings,
    subscribe(onChange) {
      listeners.add(onChange);
      return () => void listeners.delete(onChange);
    },
    set(next) {
      if (next.keys === settings.keys && next.midi === settings.midi) return;
      settings = { ...next };
      prefs.write(MONITOR_KEYS_PREF, next.keys ? null : 'off');
      prefs.write(MONITOR_MIDI_PREF, next.midi ? 'on' : null);
      if (next.midi) options.prepare?.();
      follow();
      for (const listener of [...listeners]) listener();
    },
    start() {
      running = true;
      const off = hub.onEvent((event) => {
        if (event.type === 'on') {
          options.prepare?.();
          piano.noteOn(event.midi, event.velocity);
        } else if (event.type === 'off') {
          piano.noteOff(event.midi);
        } else if (event.type === 'sustain') {
          piano.sustain(event.down);
        }
      });
      if (settings.midi) options.prepare?.();
      follow();
      return () => {
        running = false;
        follow();
        off();
        piano.silence();
      };
    },
  };
}
