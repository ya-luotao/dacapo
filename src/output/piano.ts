// The built-in piano: the Salamander grand's samples (see pianoSamples.ts) played with Web Audio,
// for anyone whose keyboard has no sound of its own to send demos and the other hand to. It is a
// MIDI output like any other to the scheduler (`port`), so everything that plays through an
// instrument plays through it unchanged, and the scheduler's panic silences it the same way. The
// keys the player plays (`keys`, see monitor.ts) are a part of their own: stopping a demo does not
// cut the notes the player is holding, and the player's pedal does not hold the demo's.
//
// Timestamps are on the performance.now() clock, mapped to the AudioContext's with the click's
// mapping (audioClock.ts), so a note is heard when a MIDI instrument would have sounded it, and in
// time with the click in rhythm mode. A timestamp already past means now.

import { readPref, writePref } from '../lib/localPrefs.ts';
import { createAudioClock, type AudioClock, type AudioClockSource } from './audioClock.ts';
import { CC_ALL_NOTES_OFF, CC_ALL_SOUND_OFF, CC_SUSTAIN } from './messages.ts';
import type { SampleBank, SampleBuffer } from './pianoSamples.ts';
import type { OutPort } from './scheduler.ts';

interface Param {
  value: number;
  setValueAtTime: (value: number, when: number) => unknown;
  setTargetAtTime: (value: number, when: number, constant: number) => unknown;
}

interface Node {
  connect: (node: never) => unknown;
  disconnect: () => void;
}

export interface PianoSource extends Node {
  buffer: SampleBuffer | null;
  playbackRate: { value: number };
  onended: ((event: Event) => unknown) | null;
  start: (when: number, offset?: number) => void;
  stop: (when?: number) => void;
}

/** The parts of an AudioContext the piano uses (a fake one in tests). */
export interface PianoContext extends AudioClockSource {
  readonly destination: unknown;
  createBufferSource: () => PianoSource;
  createGain: () => Node & { gain: Param };
  createDynamicsCompressor?: () => Node & {
    threshold: { value: number };
    knee: { value: number };
    ratio: { value: number };
    attack: { value: number };
    release: { value: number };
  };
}

/** Voices at once; past that the oldest is let go (a long pedalled run can reach it). */
export const MAX_VOICES = 64;
/** From F♯6 up a piano's strings have no dampers: they ring on after the key comes up. */
export const UNDAMPED_FROM = 90;
/** Time constants (s): a key struck again while it rings, a voice given up, all sound off. */
const RESTRIKE = 0.05;
const STEAL = 0.02;
const SILENCE = 0.008;
/** A setTargetAtTime tail is over (below −70 dB) after this many time constants. */
const TAIL = 8;
/** At volume 1. The limiter keeps full chords under the pedal from clipping. */
const MASTER_GAIN = 0.9;

/** How fast a damper stops the string (time constant, s): 0.2 s in the bass to 0.08 s at C8. */
export function releaseTime(midi: number): number {
  const t = (Math.min(108, Math.max(21, midi)) - 21) / 87;
  return 0.2 - 0.12 * t;
}

const VOLUME_PREF = 'dacapo.piano.volume';
export const DEFAULT_PIANO_VOLUME = 80;

/** 0–100. */
export function readPianoVolume(): number {
  const value = Number(readPref(VOLUME_PREF) ?? DEFAULT_PIANO_VOLUME);
  return Number.isInteger(value) && value >= 0 && value <= 100 ? value : DEFAULT_PIANO_VOLUME;
}

export function writePianoVolume(volume: number): void {
  writePref(VOLUME_PREF, volume === DEFAULT_PIANO_VOLUME ? null : String(Math.round(volume)));
}

export type PianoPart = 'port' | 'keys';

export interface PianoKeys {
  noteOn: (midi: number, velocity: number) => void;
  noteOff: (midi: number) => void;
  sustain: (down: boolean) => void;
  /** Everything of this part stops at once. */
  silence: () => void;
}

export interface Piano {
  /** For the scheduler: note on and off, sustain, all notes off and all sound off. */
  port: OutPort;
  /** The player's own keys, sounded as they come. */
  keys: PianoKeys;
  /** 0–1. */
  setVolume: (volume: number) => void;
  /** Voices still sounding or about to (a test and debugging aid). */
  voices: () => number;
}

export interface PianoOptions {
  bank: Pick<SampleBank, 'pick'>;
  /** The page's AudioContext (created or resumed as it is asked for); null: no Web Audio. */
  context: () => PianoContext | null;
  /** performance.now(). */
  now?: () => number;
  /** 0–1. */
  volume?: number;
}

interface Voice {
  part: PianoPart;
  channel: number;
  midi: number;
  source: PianoSource;
  gain: Node & { gain: Param };
  /** Context time it starts. */
  start: number;
  /** The key is down. */
  held: boolean;
  /** The key is up but the pedal holds the string. */
  pedalled: boolean;
  /** Fading or stopped: nothing more changes it. */
  ending: boolean;
}

interface Graph {
  context: PianoContext;
  bus: Node & { gain: Param };
  clock: AudioClock;
}

export function createPiano(options: PianoOptions): Piano {
  const now = options.now ?? (() => performance.now());
  let volume = clampVolume(options.volume ?? 1);
  let graph: Graph | null = null;
  /** In the order they were struck. */
  let voices: Voice[] = [];
  const pedal: Record<PianoPart, boolean> = { port: false, keys: false };

  function ensure(): Graph | null {
    const context = options.context();
    if (!context) return null;
    if (graph?.context === context) return graph;
    const bus = context.createGain();
    bus.gain.value = volume * MASTER_GAIN;
    const limiter = context.createDynamicsCompressor?.();
    if (limiter) {
      limiter.threshold.value = -6;
      limiter.knee.value = 6;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.25;
      bus.connect(limiter as never);
      limiter.connect(context.destination as never);
    } else {
      bus.connect(context.destination as never);
    }
    // Voices on another context are that context's to finish.
    voices = [];
    graph = { context, bus, clock: createAudioClock(context) };
    return graph;
  }

  function forget(voice: Voice) {
    voice.source.disconnect();
    voice.gain.disconnect();
    voices = voices.filter((v) => v !== voice);
  }

  function end(voice: Voice, when: number, constant: number) {
    if (voice.ending) return;
    voice.ending = true;
    try {
      if (when <= voice.start) {
        // Not started yet: it never sounds, and is forgotten now rather than when it has ended.
        voice.source.stop(when);
        forget(voice);
      } else {
        voice.gain.gain.setTargetAtTime(0, when, constant);
        voice.source.stop(when + constant * TAIL);
      }
    } catch {
      // Already stopped.
    }
  }

  function damp(voice: Voice, when: number) {
    if (voice.midi < UNDAMPED_FROM) end(voice, when, releaseTime(voice.midi));
  }

  function strike(
    g: Graph,
    part: PianoPart,
    channel: number,
    midi: number,
    velocity: number,
    when: number,
  ) {
    const pick = options.bank.pick(midi, velocity);
    if (!pick) return;
    for (const voice of voices) {
      if (voice.part === part && voice.channel === channel && voice.midi === midi)
        end(voice, when, RESTRIKE);
    }
    const live = voices.filter((v) => !v.ending);
    for (let i = 0; i <= live.length - MAX_VOICES; i++) end(live[i]!, when, STEAL);

    const source = g.context.createBufferSource();
    source.buffer = pick.sample.buffer;
    source.playbackRate.value = pick.rate;
    const gain = g.context.createGain();
    gain.gain.value = pick.gain;
    source.connect(gain as never);
    gain.connect(g.bus as never);
    const voice: Voice = {
      part,
      channel,
      midi,
      source,
      gain,
      start: when,
      held: true,
      pedalled: false,
      ending: false,
    };
    source.onended = () => forget(voice);
    source.start(when, pick.sample.offset);
    voices.push(voice);
  }

  function release(part: PianoPart, channel: number | null, midi: number | null, when: number) {
    for (const voice of voices) {
      if (voice.part !== part || !voice.held) continue;
      if ((channel !== null && voice.channel !== channel) || (midi !== null && voice.midi !== midi))
        continue;
      voice.held = false;
      if (pedal[part]) voice.pedalled = true;
      else damp(voice, when);
    }
  }

  function setPedal(part: PianoPart, down: boolean, when: number) {
    if (pedal[part] === down) return;
    pedal[part] = down;
    if (down) return;
    for (const voice of voices) {
      if (voice.part !== part || !voice.pedalled) continue;
      voice.pedalled = false;
      damp(voice, when);
    }
  }

  function silence(part: PianoPart, when: number) {
    pedal[part] = false;
    for (const voice of voices) if (voice.part === part) end(voice, when, SILENCE);
  }

  const port: OutPort = {
    send(data, timestamp) {
      const status = data[0]! & 0xf0;
      const channel = data[0]! & 0x0f;
      const on = status === 0x90 && data[2]! > 0;
      // Only a note needs the context. Without one nothing sounds, but the pedal still counts.
      const g = on ? ensure() : graph;
      if (on && !g) return;
      g?.clock.sample(now());
      const current = g?.context.currentTime ?? 0;
      const when =
        !g || timestamp === undefined ? current : Math.max(current, g.clock.toContext(timestamp));
      if (on) strike(g!, 'port', channel, data[1]!, data[2]!, when);
      else if (status === 0x80 || status === 0x90) release('port', channel, data[1]!, when);
      else if (status === 0xb0 && data[1] === CC_SUSTAIN) setPedal('port', data[2]! >= 64, when);
      else if (status === 0xb0 && data[1] === CC_ALL_NOTES_OFF)
        release('port', channel, null, when);
      else if (status === 0xb0 && data[1] === CC_ALL_SOUND_OFF) silence('port', when);
    },
  };

  /** The keys part plays as soon as it can. */
  const at = () => graph?.context.currentTime ?? 0;

  return {
    port,
    keys: {
      noteOn(midi, velocity) {
        const g = ensure();
        if (g) strike(g, 'keys', 0, midi, velocity, g.context.currentTime);
      },
      noteOff: (midi) => release('keys', 0, midi, at()),
      sustain: (down) => setPedal('keys', down, at()),
      silence: () => silence('keys', at()),
    },
    setVolume(next) {
      volume = clampVolume(next);
      if (!graph) return;
      graph.bus.gain.setTargetAtTime(volume * MASTER_GAIN, graph.context.currentTime, 0.02);
    },
    voices: () => voices.filter((v) => !v.ending).length,
  };
}

function clampVolume(volume: number): number {
  return Math.min(1, Math.max(0, volume));
}
