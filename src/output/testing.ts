// Fakes for the output tests: a clock moved by hand and a port that records what it is sent.

import type { SampleBuffer } from './pianoSamples.ts';
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
  state: AudioContextState = 'running';
  readonly destination = {};
  /** Every oscillator started: when, its pitch and the gain's peak. */
  started: { when: number; frequency: number; peak: number; type: OscillatorType }[] = [];
  /** Oscillators stopped at once (a stop of the click track). */
  cancelled = 0;
  /** Gains that were set to a level at once (the metronome's volume). */
  levels: number[] = [];
  resumed = 0;
  private peak = 0;

  /** performance.now() at context time 0. */
  origin: number;

  constructor(origin = 0) {
    this.origin = origin;
  }

  resume() {
    this.resumed++;
    return Promise.resolve();
  }

  getOutputTimestamp() {
    return {
      contextTime: this.currentTime,
      performanceTime: this.origin + this.currentTime * 1000,
    };
  }

  createOscillator() {
    const param = {
      value: 0,
      setValueAtTime: () => undefined,
      exponentialRampToValueAtTime: () => undefined,
    };
    const osc = {
      type: 'sine' as OscillatorType,
      frequency: param,
      connect: () => undefined,
      start: (when: number) =>
        void this.started.push({ when, frequency: param.value, peak: this.peak, type: osc.type }),
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
        value: 1,
        setValueAtTime: () => undefined,
        linearRampToValueAtTime: (value: number) => void (this.peak = value),
        exponentialRampToValueAtTime: () => undefined,
        setTargetAtTime: (value: number) => void this.levels.push(value),
      },
      connect: () => undefined,
      disconnect: () => undefined,
    };
  }
}

/** A buffer of `seconds` of silence and then a note at `onset` seconds (for the piano's tests). */
export function fakeSampleBuffer(seconds = 2, onset = 0, sampleRate = 1000) {
  const data = new Float32Array(Math.round(seconds * sampleRate));
  data.fill(0.5, Math.round(onset * sampleRate));
  return { sampleRate, length: data.length, numberOfChannels: 1, getChannelData: () => data };
}

/** One voice of the fake piano context: what it was told, in context seconds. */
export interface FakeVoice {
  buffer: unknown;
  rate: number;
  gain: number;
  start: number | null;
  offset: number | null;
  /** The last stop time asked for. */
  stop: number | null;
  /** setTargetAtTime calls on its gain: [target, when, time constant]. */
  ramps: [number, number, number][];
  /** Plays the sample to its end. */
  end: () => void;
}

/** An AudioContext stand-in for the piano: its voices (buffer source → gain) are recorded. */
export class FakePianoContext {
  currentTime = 0;
  outputLatency = 0;
  baseLatency = 0;
  readonly destination = {};
  voices: FakeVoice[] = [];
  /** The master gain's level changes. */
  levels: number[] = [];

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

  createBufferSource() {
    const voice: FakeVoice = {
      buffer: null,
      rate: 1,
      gain: 1,
      start: null,
      offset: null,
      stop: null,
      ramps: [],
      end: () => source.onended?.(new Event('ended')),
    };
    const source = {
      voice,
      buffer: null as SampleBuffer | null,
      playbackRate: { value: 1 },
      onended: null as ((event: Event) => unknown) | null,
      connect: (gain: { voice?: FakeVoice; gain: { value: number } }) => {
        voice.gain = gain.gain.value;
        gain.voice = voice;
        return gain;
      },
      disconnect: () => undefined,
      start: (when: number, offset?: number) => {
        voice.buffer = source.buffer;
        voice.rate = source.playbackRate.value;
        voice.start = when;
        voice.offset = offset ?? 0;
        this.voices.push(voice);
      },
      stop: (when?: number) => void (voice.stop = when ?? this.currentTime),
    };
    return source;
  }

  createGain() {
    const node: { voice?: FakeVoice } & Record<string, unknown> = {};
    const gain = {
      get value() {
        return node.voice ? node.voice.gain : level;
      },
      set value(next: number) {
        if (node.voice) node.voice.gain = next;
        else level = next;
      },
      setValueAtTime: () => undefined,
      setTargetAtTime: (target: number, when: number, constant: number) => {
        if (node.voice) node.voice.ramps.push([target, when, constant]);
        else this.levels.push(target);
      },
    };
    let level = 1;
    return Object.assign(node, {
      gain,
      connect: (next: unknown) => next,
      disconnect: () => undefined,
    });
  }
}
