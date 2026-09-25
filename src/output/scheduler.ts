// Sends notes to a MIDI output ahead of time with `send(data, timestamp)` on the performance.now()
// clock. Chrome cannot take back what it has been given (`MIDIOutput.clear()` is missing), so
// messages are handed over only a short lookahead before they are due; everything later stays
// here, where it can still be cancelled.

import { isChannelMessage, noteOff, noteOn, resetAllChannels } from './messages.ts';

export interface OutPort {
  send: (data: number[], timestamp?: number) => void;
}

export interface Clock {
  now: () => number;
  /** Calls `fn` every `ms` until the returned function is called. */
  every: (ms: number, fn: () => void) => () => void;
}

export const browserClock: Clock = {
  now: () => performance.now(),
  every(ms, fn) {
    const id = setInterval(fn, ms);
    return () => clearInterval(id);
  },
};

export const LOOKAHEAD_MS = 80;
export const TICK_MS = 20;

export interface NoteSpec {
  midi: number;
  velocity: number;
  /** performance.now() times; a time already past means "now". */
  on: number;
  off: number;
  channel?: number;
}

export interface Scheduler {
  /** Queues a note; returns its id for `cut`. */
  play: (note: NoteSpec) => number;
  /** Queues several notes at once (one hand-over for all of them). */
  playAll: (notes: readonly NoteSpec[]) => number[];
  /** Ends a note early: before its note-on is sent it never sounds, afterwards its note-off moves to `at` (default now). */
  cut: (id: number, at?: number) => void;
  /** Forgets a note not yet handed to the port; false if it is already on its way (or unknown). */
  drop: (id: number) => boolean;
  /**
   * Forgets everything queued and silences the instrument: note-offs for the notes it tracks,
   * then sustain up, all notes off and all sound off on 16 channels. Skipped when nothing has
   * been sent since the last time.
   */
  panic: () => void;
  /** Panics on the previous port first. */
  setPort: (port: OutPort | null) => void;
  /** Keys sounding now or already handed to the port, low to high. */
  sounding: () => { channel: number; midi: number }[];
  /** Notes not finished yet. */
  pending: () => number;
}

export interface SchedulerOptions {
  clock?: Clock;
  lookahead?: number;
  interval?: number;
  /** Every message handed to the port, with its timestamp. */
  onSent?: (data: readonly number[], time: number | undefined) => void;
}

interface Entry {
  id: number;
  channel: number;
  midi: number;
  velocity: number;
  on: number;
  off: number;
  /** Timestamps the messages were sent with; null while still queued here. */
  onAt: number | null;
  offAt: number | null;
}

export function createScheduler(options: SchedulerOptions = {}): Scheduler {
  const clock = options.clock ?? browserClock;
  const lookahead = options.lookahead ?? LOOKAHEAD_MS;
  const interval = options.interval ?? TICK_MS;
  const entries = new Map<number, Entry>();
  let port: OutPort | null = null;
  let lastId = 0;
  let stopTimer: (() => void) | null = null;
  /** Nothing sent since the last panic (or ever): the instrument has nothing of ours to stop. */
  let quiet = true;

  function send(data: number[], time?: number) {
    if (!port || !isChannelMessage(data)) return;
    quiet = false;
    try {
      if (time === undefined) port.send(data);
      else port.send(data, time);
    } catch {
      // A port that just went away throws; its loss is handled by the owner.
    }
    options.onSent?.(data, time);
  }

  function tick() {
    const now = clock.now();
    const horizon = now + lookahead;
    const due: { time: number; off: boolean; entry: Entry }[] = [];
    for (const entry of entries.values()) {
      if (entry.onAt === null) {
        if (entry.on > horizon) continue;
        const onTime = Math.max(entry.on, now);
        due.push({ time: onTime, off: false, entry });
        // A note always ends after it starts, even when both times have passed (a late timer).
        if (entry.off <= horizon)
          due.push({ time: Math.max(entry.off, onTime + 1), off: true, entry });
      } else if (entry.offAt === null && entry.off <= horizon) {
        due.push({ time: Math.max(entry.off, entry.onAt + 1, now), off: true, entry });
      }
    }
    // In time order; at the same time a key is released before it is struck again.
    due.sort((a, b) => a.time - b.time || Number(b.off) - Number(a.off) || a.entry.id - b.entry.id);
    for (const { time, off, entry } of due) {
      if (off) {
        send(noteOff(entry.channel, entry.midi), time);
        entry.offAt = time;
      } else {
        send(noteOn(entry.channel, entry.midi, entry.velocity), time);
        entry.onAt = time;
      }
    }
    for (const [id, entry] of entries) {
      if (entry.offAt !== null && entry.offAt <= now) entries.delete(id);
    }
    if (entries.size === 0) {
      stopTimer?.();
      stopTimer = null;
    } else if (!stopTimer) {
      stopTimer = clock.every(interval, tick);
    }
  }

  function panic() {
    const now = clock.now();
    const sounding = new Map<number, Entry>();
    const late = new Map<number, Entry>();
    let latest = now;
    for (const entry of entries.values()) {
      if (entry.onAt === null) continue;
      const key = entry.channel * 128 + entry.midi;
      if (entry.offAt === null || entry.offAt > now) sounding.set(key, entry);
      if (entry.onAt > now) {
        late.set(key, entry);
        latest = Math.max(latest, entry.onAt);
      }
    }
    entries.clear();
    stopTimer?.();
    stopTimer = null;
    if (quiet) return;
    for (const entry of sounding.values()) send(noteOff(entry.channel, entry.midi));
    for (const message of resetAllChannels()) send(message);
    // Note-ons already handed over for later still arrive; release them just after the last one
    // (a millisecond later, so no port has to keep equal timestamps in order).
    for (const entry of late.values()) send(noteOff(entry.channel, entry.midi), latest + 1);
    quiet = true;
  }

  function add(spec: NoteSpec): number {
    const id = ++lastId;
    const channel = spec.channel ?? 0;
    let on = Math.max(spec.on, clock.now());
    let off = Math.max(spec.off, on);
    // One key, one note at a time: an overlapping note of the same key ends where this starts.
    for (const other of entries.values()) {
      if (other.channel !== channel || other.midi !== spec.midi) continue;
      const otherOn = other.onAt ?? other.on;
      const otherOff = other.offAt ?? other.off;
      if (otherOff <= on || otherOn >= off) continue;
      if (other.onAt === null && otherOn >= on) {
        if (otherOn === on) {
          other.off = Math.max(other.off, off);
          return id;
        }
        off = otherOn;
        continue;
      }
      on = Math.max(on, otherOn);
      if (other.offAt === null) other.off = on;
      else on = Math.max(on, other.offAt);
    }
    if (off <= on) return id;
    entries.set(id, {
      id,
      channel,
      midi: spec.midi,
      velocity: spec.velocity,
      on,
      off,
      onAt: null,
      offAt: null,
    });
    return id;
  }

  return {
    play(spec) {
      const id = add(spec);
      tick();
      return id;
    },
    playAll(specs) {
      const ids = specs.map(add);
      tick();
      return ids;
    },
    cut(id, at) {
      const entry = entries.get(id);
      if (!entry || entry.offAt !== null) return;
      if (entry.onAt === null) {
        entries.delete(id);
        return;
      }
      entry.off = Math.min(entry.off, Math.max(at ?? clock.now(), entry.onAt + 1));
      tick();
    },
    drop(id) {
      const entry = entries.get(id);
      if (!entry || entry.onAt !== null) return false;
      entries.delete(id);
      return true;
    },
    panic,
    setPort(next) {
      if (next === port) return;
      if (port) panic();
      port = next;
    },
    sounding() {
      const now = clock.now();
      const keys = new Map<number, { channel: number; midi: number }>();
      for (const entry of entries.values()) {
        if (entry.onAt === null || (entry.offAt !== null && entry.offAt <= now)) continue;
        keys.set(entry.channel * 128 + entry.midi, { channel: entry.channel, midi: entry.midi });
      }
      return [...keys].sort((a, b) => a[0] - b[0]).map(([, key]) => key);
    },
    pending: () => entries.size,
  };
}
