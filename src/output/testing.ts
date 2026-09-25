// Fakes for the output tests: a clock moved by hand and a port that records what it is sent.

import type { Clock, OutPort } from './scheduler.ts';

export interface FakeClock extends Clock {
  /** Moves time forward, running the periodic callbacks on their schedule. */
  advance: (ms: number) => void;
  set: (time: number) => void;
  timers: () => number;
}

export function fakeClock(start = 1000): FakeClock {
  let time = start;
  const timers = new Map<number, { every: number; next: number; fn: () => void }>();
  let lastId = 0;
  return {
    now: () => time,
    every(ms, fn) {
      const id = ++lastId;
      timers.set(id, { every: ms, next: time + ms, fn });
      return () => void timers.delete(id);
    },
    advance(ms) {
      const end = time + ms;
      for (;;) {
        let due: { every: number; next: number; fn: () => void } | null = null;
        for (const timer of timers.values()) if (!due || timer.next < due.next) due = timer;
        if (!due || due.next > end) break;
        time = due.next;
        due.next += due.every;
        due.fn();
      }
      time = end;
    },
    /** Jumps to `next` as if the timers could not run in between; they run at the next advance. */
    set(next) {
      time = next;
      for (const timer of timers.values()) timer.next = Math.max(timer.next, time);
    },
    timers: () => timers.size,
  };
}

export interface Sent {
  data: number[];
  /** Undefined: sent for immediate delivery. */
  time: number | undefined;
}

export class FakePort implements OutPort {
  sent: Sent[] = [];
  broken = false;

  send(data: number[], time?: number) {
    if (this.broken) throw new DOMException('port disconnected', 'InvalidStateError');
    this.sent.push({ data: [...data], time });
  }

  /** "on 60@1000" / "off 60@1400" / "cc 123 ch0" — easy to read in assertions. */
  log(): string[] {
    return this.sent.map(({ data, time }) => {
      const kind = data[0]! & 0xf0;
      const at = time === undefined ? '' : `@${time}`;
      if (kind === 0x90) return `on ${data[1]} v${data[2]}${at}`;
      if (kind === 0x80) return `off ${data[1]}${at}`;
      return `cc ${data[1]}=${data[2]} ch${data[0]! & 0x0f}${at}`;
    });
  }
}

/** An AudioContext stand-in that records the clicks it is asked to play. */
export class FakeAudioContext {
  currentTime = 0;
  outputLatency = 0;
  baseLatency = 0;
  readonly destination = {};
  /** Every oscillator started: when, its pitch and the gain's peak. */
  started: { when: number; frequency: number; peak: number }[] = [];
  /** Oscillators stopped at once (a stop of the click track). */
  cancelled = 0;
  private peak = 0;

  /** performance.now() at context time 0. */
  origin: number;

  constructor(origin = 0) {
    this.origin = origin;
  }

  getOutputTimestamp() {
    return {
      contextTime: this.currentTime,
      performanceTime: this.origin + this.currentTime * 1000,
    };
  }

  createOscillator() {
    const osc = {
      frequency: { value: 0 },
      connect: () => undefined,
      start: (when: number) =>
        void this.started.push({ when, frequency: osc.frequency.value, peak: this.peak }),
      stop: (when?: number) => {
        if (when === 0) this.cancelled++;
      },
      disconnect: () => undefined,
    };
    return osc;
  }

  createGain() {
    return {
      gain: {
        setValueAtTime: () => undefined,
        linearRampToValueAtTime: (value: number) => void (this.peak = value),
        exponentialRampToValueAtTime: () => undefined,
      },
      connect: () => undefined,
      disconnect: () => undefined,
    };
  }
}
