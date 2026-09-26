// The built-in piano's samples (public/piano/, made by scripts/piano/build.ts): which one a key and
// velocity play, and loading them. They are fetched only once the piano is needed, the middle layer
// first, and decoded on an OfflineAudioContext, which needs no user gesture; an AudioBuffer plays
// on any context, at its own sample rate.

import { PIANO_LAYERS, PIANO_SAMPLES } from './pianoTable.ts';

export const LOWEST_KEY = PIANO_SAMPLES[0]!.key;
export const HIGHEST_KEY = PIANO_SAMPLES[PIANO_SAMPLES.length - 1]!.key;
/** The samples are a minor third apart. */
const STEP = 3;

/** The parts of an AudioBuffer the piano uses. */
export interface SampleBuffer {
  readonly sampleRate: number;
  readonly length: number;
  readonly numberOfChannels: number;
  getChannelData: (channel: number) => Float32Array;
}

export interface Sample {
  buffer: SampleBuffer;
  /** Seconds into the buffer where the note starts. */
  offset: number;
}

export interface SamplePick {
  sample: Sample;
  /** Playback rate: the distance from the sampled key, and its retuning. */
  rate: number;
  /** Gain for the velocity, relative to how loud the layer was recorded. */
  gain: number;
}

export type BankStatus = 'idle' | 'loading' | 'ready' | 'failed';

export interface SampleBank {
  /** The sample for key `midi` at `velocity`, or null while none of its layers is loaded. */
  pick: (midi: number, velocity: number) => SamplePick | null;
  /** Starts loading (again, after a failure); does nothing while loading or once loaded. */
  load: () => void;
  getStatus: () => BankStatus;
  subscribe: (onChange: () => void) => () => void;
}

/** The first sample louder than this (−66 dBFS) is the note's start; 1 ms before it is kept. */
const ONSET = 10 ** (-66 / 20);

/**
 * Where the note starts: the recordings are trimmed to it, but a decoder may put its own silence
 * in front (the MP3 encoder's delay, where the browser does not take it off).
 */
export function onsetOf(buffer: SampleBuffer): number {
  const frames = Math.min(buffer.length, Math.round(buffer.sampleRate * 0.25));
  let first = frames;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < first; i++) {
      if (Math.abs(data[i]!) > ONSET) {
        first = i;
        break;
      }
    }
  }
  if (first === frames) return 0;
  return Math.max(0, first - buffer.sampleRate / 1000) / buffer.sampleRate;
}

/** Index of the sample that plays key `midi`: the nearest, as the SFZ maps them. */
export function sampleIndex(midi: number): number {
  const clamped = Math.min(HIGHEST_KEY, Math.max(LOWEST_KEY, midi));
  return Math.min(PIANO_SAMPLES.length - 1, Math.round((clamped - LOWEST_KEY) / STEP));
}

/** The layers in the order to try for `velocity`: the nearest first. */
export function layerOrder(velocity: number): number[] {
  return PIANO_LAYERS.map((layer, i) => ({ i, d: Math.abs(layer.velocity - velocity) }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .map(({ i }) => i);
}

/**
 * Gain for `velocity` played from a layer recorded at `layerVelocity`. A layer's loudness grows
 * about in proportion to its velocity (−18 dB from the loudest to the softest), so scaling by the
 * ratio joins the layers up; the square root on top widens the range a little, as the SFZ's
 * velocity tracking does.
 */
export function velocityGain(velocity: number, layerVelocity: number): number {
  const v = Math.min(127, Math.max(1, velocity));
  return (v / layerVelocity) * Math.sqrt(v / 127);
}

export function sampleUrl(base: string, index: number, layer: number): string {
  return `${base}piano/${PIANO_SAMPLES[index]!.name}-${PIANO_LAYERS[layer]!.id}.mp3`;
}

/** Loading order: the middle layer (the demo's) first, then the louder, then the softer. */
const LOAD_ORDER = [1, 2, 0];
/** Files fetched at once. */
const PARALLEL = 6;

export interface SampleBankOptions {
  /** The app's base path, ending in `/`. */
  base: string;
  fetch?: (url: string) => Promise<{ ok: boolean; arrayBuffer: () => Promise<ArrayBuffer> }>;
  /** Null: this browser cannot decode audio, so the piano stays silent. */
  decode?: ((data: ArrayBuffer) => Promise<SampleBuffer>) | null;
}

function browserDecoder(): ((data: ArrayBuffer) => Promise<SampleBuffer>) | null {
  const Offline = globalThis.OfflineAudioContext as typeof OfflineAudioContext | undefined;
  if (!Offline) return null;
  let context: OfflineAudioContext | null = null;
  return (data) => {
    context ??= new Offline(2, 1, 48_000);
    return context.decodeAudioData(data);
  };
}

export function createSampleBank(options: SampleBankOptions): SampleBank {
  const fetchFile = options.fetch ?? ((url: string) => globalThis.fetch(url));
  const decode = options.decode === undefined ? browserDecoder() : options.decode;
  /** samples[layer][index] */
  const samples: (Sample | undefined)[][] = PIANO_LAYERS.map(() => []);
  let status: BankStatus = 'idle';
  const listeners = new Set<() => void>();

  function setStatus(next: BankStatus) {
    if (next === status) return;
    status = next;
    for (const listener of [...listeners]) listener();
  }

  async function loadOne(layer: number, index: number) {
    const response = await fetchFile(sampleUrl(options.base, index, layer));
    if (!response.ok) throw new Error('not found');
    const buffer = await decode!(await response.arrayBuffer());
    samples[layer]![index] = { buffer, offset: onsetOf(buffer) };
  }

  async function loadAll() {
    const queue: [number, number][] = [];
    for (const layer of LOAD_ORDER)
      for (let index = 0; index < PIANO_SAMPLES.length; index++)
        if (!samples[layer]![index]) queue.push([layer, index]);
    let failed = false;
    const worker = async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        try {
          await loadOne(...next);
        } catch {
          failed = true;
        }
      }
    };
    await Promise.all(Array.from({ length: PARALLEL }, worker));
    setStatus(failed ? 'failed' : 'ready');
  }

  return {
    pick(midi, velocity) {
      const index = sampleIndex(midi);
      for (const layer of layerOrder(velocity)) {
        const sample = samples[layer]![index];
        if (!sample) continue;
        const { key, tune } = PIANO_SAMPLES[index]!;
        return {
          sample,
          rate: 2 ** (((midi - key) * 100 + tune) / 1200),
          gain: velocityGain(velocity, PIANO_LAYERS[layer]!.velocity),
        };
      }
      return null;
    },
    load() {
      if (status === 'loading' || status === 'ready') return;
      if (!decode) {
        setStatus('failed');
        return;
      }
      setStatus('loading');
      void loadAll();
    },
    getStatus: () => status,
    subscribe(onChange) {
      listeners.add(onChange);
      return () => void listeners.delete(onChange);
    },
  };
}
