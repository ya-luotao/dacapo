import { describe, expect, it } from 'vitest';
import { controlChange, noteOff, noteOn, resetAllChannels } from './messages.ts';
import { createPiano, MAX_VOICES, releaseTime, UNDAMPED_FROM } from './piano.ts';
import type { SamplePick } from './pianoSamples.ts';
import { createScheduler } from './scheduler.ts';
import { fakeClock, FakePianoContext, fakeSampleBuffer } from './testing.ts';

function setup() {
  // Context time 0 is performance time 10 000.
  const clock = fakeClock(10_000);
  const context = new FakePianoContext(10_000);
  const buffer = fakeSampleBuffer();
  let loaded = true;
  let contexts = 0;
  const piano = createPiano({
    bank: {
      pick: (midi, velocity): SamplePick | null =>
        loaded
          ? { sample: { buffer, offset: 0.002 }, rate: 1 + midi / 1000, gain: velocity / 100 }
          : null,
    },
    context: () => {
      contexts++;
      return context;
    },
    now: clock.now,
    volume: 0.5,
  });
  const advance = (ms: number) => {
    for (let t = 0; t < ms; t += 5) {
      clock.advance(Math.min(5, ms - t));
      context.currentTime = (clock.now() - 10_000) / 1000;
    }
  };
  const send = (data: number[], time?: number) => piano.port.send(data, time);
  return {
    clock,
    context,
    piano,
    buffer,
    advance,
    send,
    unload: () => (loaded = false),
    contexts: () => contexts,
  };
}

const round = (seconds: number | null) => (seconds === null ? null : Math.round(seconds * 1000));

describe('built-in piano', () => {
  it('plays a note when it is due on the audio clock, with the sample’s rate, gain and onset', () => {
    const { context, send, buffer } = setup();
    send(noteOn(0, 60, 72), 10_050);
    expect(context.voices).toHaveLength(1);
    const [voice] = context.voices;
    expect(round(voice!.start)).toBe(50);
    expect(voice).toMatchObject({ buffer, rate: 1.06, gain: 0.72, offset: 0.002 });
  });

  it('a timestamp already past, or none, means now', () => {
    const { context, send, advance } = setup();
    advance(100);
    send(noteOn(0, 60, 72), 10_020);
    send(noteOn(0, 62, 72));
    expect(context.voices.map((v) => round(v.start))).toEqual([100, 100]);
  });

  it('follows the output latency the context reports through its timestamps', () => {
    const { context, send, advance } = setup();
    advance(100);
    // The output runs 40 ms behind: a note for 10 500 is started 40 ms earlier.
    context.getOutputTimestamp = () => ({
      contextTime: context.currentTime - 0.04,
      performanceTime: 10_000 + context.currentTime * 1000,
    });
    send(noteOn(0, 60, 72), 10_500);
    expect(round(context.voices[0]!.start)).toBe(460);
  });

  it('damps a string when its key comes up, slower in the bass', () => {
    const { context, send } = setup();
    send(noteOn(0, 36, 72), 10_000);
    send(noteOn(0, 84, 72), 10_000);
    send(noteOff(0, 36), 10_400);
    send(noteOff(0, 84), 10_400);
    const [bass, treble] = context.voices;
    expect(bass!.ramps).toEqual([[0, 0.4, releaseTime(36)]]);
    expect(treble!.ramps).toEqual([[0, 0.4, releaseTime(84)]]);
    expect(releaseTime(36)).toBeGreaterThan(releaseTime(84));
    expect(bass!.stop).toBeCloseTo(0.4 + releaseTime(36) * 8);
  });

  it('lets the undamped treble ring on after the key comes up', () => {
    const { context, send, piano } = setup();
    send(noteOn(0, UNDAMPED_FROM, 72), 10_000);
    send(noteOff(0, UNDAMPED_FROM), 10_300);
    expect(context.voices[0]!.ramps).toEqual([]);
    expect(context.voices[0]!.stop).toBeNull();
    expect(piano.voices()).toBe(1);
  });

  it('the pedal holds the strings until it comes up', () => {
    const { context, send } = setup();
    send(controlChange(0, 64, 127));
    send(noteOn(0, 60, 72), 10_000);
    send(noteOff(0, 60), 10_200);
    expect(context.voices[0]!.ramps).toEqual([]);
    send(controlChange(0, 64, 0), 10_500);
    expect(context.voices[0]!.ramps).toEqual([[0, 0.5, releaseTime(60)]]);
  });

  it('keeps the player’s keys apart from the port: each has its own pedal and silence', () => {
    const { context, send, piano, advance } = setup();
    piano.keys.sustain(true);
    piano.keys.noteOn(64, 90);
    send(noteOn(0, 60, 72), 10_000);
    // The port's pedal is up: its key is damped; the player's pedal holds theirs.
    send(noteOff(0, 60), 10_100);
    piano.keys.noteOff(64);
    const [keys, port] = context.voices;
    expect(port!.ramps).toHaveLength(1);
    expect(keys!.ramps).toEqual([]);
    // The scheduler's panic silences the port's notes only.
    for (const data of resetAllChannels()) send(data);
    expect(keys!.ramps).toEqual([]);
    advance(10);
    piano.keys.silence();
    expect(keys!.ramps).toEqual([[0, 0.01, 0.008]]);
  });

  it('all sound off stops everything of the port at once, and a note not started never sounds', () => {
    const { context, send, advance, piano } = setup();
    send(noteOn(0, 60, 72), 10_000);
    send(noteOn(0, 64, 72), 10_080);
    advance(20);
    send(controlChange(0, 120, 0));
    const [started, waiting] = context.voices;
    expect(started!.ramps).toEqual([[0, 0.02, 0.008]]);
    // Stopped before its start: it never plays.
    expect(round(waiting!.stop)).toBe(20);
    expect(waiting!.ramps).toEqual([]);
    expect(piano.voices()).toBe(0);
  });

  it('all notes off lets the keys up (the pedal still holds them)', () => {
    const { context, send } = setup();
    send(noteOn(0, 60, 72), 10_000);
    send(noteOn(0, 64, 72), 10_000);
    send(controlChange(0, 123, 0), 10_200);
    expect(context.voices.map((v) => v.ramps.length)).toEqual([1, 1]);
  });

  it('a key struck again damps the string that is still ringing', () => {
    const { context, send } = setup();
    send(noteOn(0, 60, 72), 10_000);
    send(noteOff(0, 60), 10_100);
    send(noteOn(0, 60, 72), 10_110);
    // Already damping from the key-up: the new strike leaves it be.
    expect(context.voices[0]!.ramps).toHaveLength(1);
    send(noteOn(0, 67, 72), 10_000);
    send(noteOn(0, 67, 90), 10_300);
    expect(context.voices[2]!.ramps).toEqual([[0, 0.3, 0.05]]);
    expect(context.voices[3]!.ramps).toEqual([]);
  });

  it(`gives up the oldest voice past ${MAX_VOICES}`, () => {
    const { context, send, piano } = setup();
    for (let i = 0; i < MAX_VOICES + 2; i++) send(noteOn(0, 21 + i, 72), 10_000 + i);
    expect(piano.voices()).toBe(MAX_VOICES);
    expect(context.voices[0]!.ramps).toHaveLength(1);
    expect(context.voices[1]!.ramps).toHaveLength(1);
    expect(context.voices[2]!.ramps).toEqual([]);
  });

  it('forgets a voice once its sample has played out', () => {
    const { context, send, piano } = setup();
    send(noteOn(0, 60, 72), 10_000);
    expect(piano.voices()).toBe(1);
    context.voices[0]!.end();
    expect(piano.voices()).toBe(0);
  });

  it('asks for the AudioContext only to play a note, and is silent while the sample is not loaded', () => {
    const { context, send, piano, unload, contexts } = setup();
    send(noteOff(0, 60), 10_000);
    for (const data of resetAllChannels()) send(data);
    piano.keys.noteOff(60);
    piano.keys.sustain(true);
    piano.keys.silence();
    expect(contexts()).toBe(0);
    unload();
    send(noteOn(0, 60, 72), 10_000);
    piano.keys.noteOn(62, 90);
    expect(contexts()).toBe(2);
    expect(context.voices).toEqual([]);
  });

  it('sets the volume on the master gain', () => {
    const { context, send, piano } = setup();
    send(noteOn(0, 60, 72), 10_000);
    piano.setVolume(0.25);
    piano.setVolume(3);
    expect(context.levels).toEqual([0.25 * 0.9, 0.9]);
  });

  it('plays what the scheduler sends it, and the scheduler’s panic silences it', () => {
    const { clock, context, piano, advance } = setup();
    const scheduler = createScheduler({ clock });
    scheduler.setPort(piano.port);
    scheduler.playAll([
      { midi: 60, velocity: 72, on: 10_000, off: 10_400 },
      { midi: 64, velocity: 72, on: 10_500, off: 10_900 },
    ]);
    advance(450);
    expect(context.voices.map((v) => [round(v.start), v.ramps.length])).toEqual([
      [0, 1],
      [500, 0],
    ]);
    scheduler.panic();
    expect(context.voices[1]!.stop).toBeCloseTo(0.45);
  });
});
