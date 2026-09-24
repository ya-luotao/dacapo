import { isMidiNote } from '../core/note.ts';
import type { InputEvent, NoteEvent, NoteInput, SustainEvent } from './types.ts';

export interface HubState {
  /** Keys physically held down by any source, in press order, with their note-on velocity. */
  held: ReadonlyMap<number, number>;
  /** Keys released while the pedal is down; cleared when the pedal comes up. */
  sustained: ReadonlySet<number>;
  /** True while any source holds the sustain pedal. */
  sustain: boolean;
  /** The keys held at the most recent note-on, low to high. Stays after release. */
  lastChord: readonly number[];
}

/** Merged transitions: `on` when a key becomes held by anyone, `off` when nobody holds it. */
export type HubEvent = NoteEvent | SustainEvent;

export interface InputHub {
  /** Starts `source` and merges its events. Returns a function that stops it and releases its keys. */
  add: (source: NoteInput) => () => void;
  getState: () => HubState;
  /** For `useSyncExternalStore`: called after every state change. */
  subscribe: (onChange: () => void) => () => void;
  onEvent: (listener: (event: HubEvent) => void) => () => void;
}

const EMPTY_STATE: HubState = {
  held: new Map(),
  sustained: new Set(),
  sustain: false,
  lastChord: [],
};

export function createInputHub(): InputHub {
  // midi → holder → velocity. A holder is one port of one source.
  const holders = new Map<number, Map<string, number>>();
  const pedals = new Set<string>();
  const held = new Map<number, number>();
  const sustained = new Set<number>();
  const sources = new Map<string, () => void>();
  let lastChord: readonly number[] = [];

  let state = EMPTY_STATE;
  const changeListeners = new Set<() => void>();
  const eventListeners = new Set<(event: HubEvent) => void>();

  function release(midi: number, holder: string, velocity: number, time: number, out: HubEvent[]) {
    const byHolder = holders.get(midi);
    if (!byHolder?.delete(holder) || byHolder.size > 0) return;
    holders.delete(midi);
    held.delete(midi);
    if (pedals.size > 0) sustained.add(midi);
    out.push({ type: 'off', midi, velocity, time });
  }

  function setPedal(holder: string, down: boolean, time: number, out: HubEvent[]) {
    const before = pedals.size > 0;
    if (down) pedals.add(holder);
    else pedals.delete(holder);
    const after = pedals.size > 0;
    if (before === after) return;
    if (!after) sustained.clear();
    out.push({ type: 'sustain', down: after, time });
  }

  function resetHolder(holder: string, time: number, out: HubEvent[]) {
    for (const [midi, byHolder] of [...holders]) {
      if (byHolder.has(holder)) release(midi, holder, 0, time, out);
    }
    setPedal(holder, false, time, out);
  }

  function apply(event: InputEvent, holder: string, out: HubEvent[]) {
    switch (event.type) {
      case 'on': {
        if (!isMidiNote(event.midi)) return;
        let byHolder = holders.get(event.midi);
        if (!byHolder) holders.set(event.midi, (byHolder = new Map<string, number>()));
        const wasHeld = byHolder.size > 0;
        byHolder.set(holder, event.velocity);
        if (wasHeld) return;
        held.set(event.midi, event.velocity);
        sustained.delete(event.midi);
        lastChord = [...held.keys()].sort((a, b) => a - b);
        out.push(event);
        return;
      }
      case 'off':
        release(event.midi, holder, event.velocity, event.time, out);
        return;
      case 'sustain':
        setPedal(holder, event.down, event.time, out);
        return;
      case 'reset':
        resetHolder(holder, event.time, out);
        return;
    }
  }

  function publish(out: HubEvent[]) {
    if (out.length === 0) return;
    state = {
      held: new Map(held),
      sustained: new Set(sustained),
      sustain: pedals.size > 0,
      lastChord,
    };
    for (const listener of [...changeListeners]) listener();
    for (const event of out) for (const listener of [...eventListeners]) listener(event);
  }

  return {
    add(source) {
      if (sources.has(source.id)) throw new Error(`Input source "${source.id}" is already added`);
      const prefix = `${source.id}\u0000`;
      let active = true;
      const stopSource = source.start((event, port = '') => {
        if (!active) return;
        const out: HubEvent[] = [];
        apply(event, prefix + port, out);
        publish(out);
      });
      const remove = () => {
        if (!active) return;
        active = false;
        sources.delete(source.id);
        stopSource();
        const time = globalThis.performance?.now() ?? 0;
        const out: HubEvent[] = [];
        const owned = new Set<string>(pedals);
        for (const byHolder of holders.values()) for (const h of byHolder.keys()) owned.add(h);
        for (const holder of owned) if (holder.startsWith(prefix)) resetHolder(holder, time, out);
        publish(out);
      };
      sources.set(source.id, remove);
      return remove;
    },
    getState: () => state,
    subscribe(onChange) {
      changeListeners.add(onChange);
      return () => void changeListeners.delete(onChange);
    },
    onEvent(listener) {
      eventListeners.add(listener);
      return () => void eventListeners.delete(listener);
    },
  };
}
