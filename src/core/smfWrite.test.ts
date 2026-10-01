// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import furElise from '../pieces/library/beethoven-fur-elise.musicxml?raw';
import { runClock, runSteps } from './expression.ts';
import { parseMusicXml } from './musicxml.ts';
import { DEFAULT_BPM } from './playback.ts';
import { bar, bars, note, Q, quarters, score } from './scoreFixtures.ts';
import type { Score } from './score.ts';
import {
  barMeter,
  midiFileName,
  runGrid,
  SMF_TICKS,
  steadyGrid,
  takeMidi,
  variableLength,
  type SmfGrid,
} from './smfWrite.ts';
import type { TakeEvent } from './takes.ts';
import type { BarLoop } from './wait.ts';

// A reader of our own, so the bytes are read back by other code than wrote them: the header, the
// track, variable-length quantities, running status, and the events a take's file has.

type Read =
  | { tick: number; type: 'name'; text: string }
  | { tick: number; type: 'tempo'; us: number }
  | { tick: number; type: 'meter'; beats: number; beatType: number; click: number; n32: number }
  | { tick: number; type: 'on'; channel: number; key: number; velocity: number }
  | { tick: number; type: 'off'; channel: number; key: number; velocity: number }
  | { tick: number; type: 'control'; channel: number; controller: number; value: number }
  | { tick: number; type: 'end' };

interface ReadFile {
  format: number;
  tracks: number;
  division: number;
  events: Read[];
}

function readSmf(bytes: Uint8Array): ReadFile {
  const text = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  const u32 = (i: number) =>
    bytes[i]! * 2 ** 24 + (bytes[i + 1]! << 16) + (bytes[i + 2]! << 8) + bytes[i + 3]!;
  const u16 = (i: number) => (bytes[i]! << 8) + bytes[i + 1]!;
  expect(text(0, 4)).toBe('MThd');
  expect(u32(4)).toBe(6);
  expect(text(14, 18)).toBe('MTrk');
  const end = 22 + u32(18);
  // The track's length is the rest of the file, to the byte.
  expect(end).toBe(bytes.length);
  let i = 22;
  const vlq = () => {
    let value = 0;
    for (;;) {
      const byte = bytes[i++]!;
      value = value * 128 + (byte & 0x7f);
      if (byte < 0x80) return value;
    }
  };
  const events: Read[] = [];
  let tick = 0;
  let status = 0;
  while (i < end) {
    tick += vlq();
    if (bytes[i] === 0xff) {
      const kind = bytes[i + 1]!;
      i += 2;
      const length = vlq();
      const data = bytes.subarray(i, i + length);
      i += length;
      if (kind === 0x03) events.push({ tick, type: 'name', text: new TextDecoder().decode(data) });
      else if (kind === 0x51)
        events.push({ tick, type: 'tempo', us: (data[0]! << 16) + (data[1]! << 8) + data[2]! });
      else if (kind === 0x58)
        events.push({
          tick,
          type: 'meter',
          beats: data[0]!,
          beatType: 2 ** data[1]!,
          click: data[2]!,
          n32: data[3]!,
        });
      else if (kind === 0x2f) events.push({ tick, type: 'end' });
      else throw new Error(`unexpected meta event ${kind}`);
      continue;
    }
    if (bytes[i]! & 0x80) status = bytes[i++]!;
    const channel = (status & 0x0f) + 1;
    const a = bytes[i++]!;
    const b = bytes[i++]!;
    if ((status & 0xf0) === 0x90 && b > 0)
      events.push({ tick, type: 'on', channel, key: a, velocity: b });
    else if ((status & 0xf0) === 0x90 || (status & 0xf0) === 0x80)
      events.push({ tick, type: 'off', channel, key: a, velocity: b });
    else if ((status & 0xf0) === 0xb0)
      events.push({ tick, type: 'control', channel, controller: a, value: b });
    else throw new Error(`unexpected status ${status}`);
  }
  return { format: u16(8), tracks: u16(10), division: u16(12), events };
}

interface ReadNote {
  key: number;
  on: number;
  off: number;
  velocity: number;
}

/** The notes of a file: each key down with the next key up of its key. Every one must pair. */
function notesOf(file: ReadFile): ReadNote[] {
  const open = new Map<number, ReadNote>();
  const notes: ReadNote[] = [];
  for (const e of file.events) {
    if (e.type === 'on') {
      // A key is never struck while it is down.
      expect(open.has(e.key)).toBe(false);
      const n = { key: e.key, on: e.tick, off: NaN, velocity: e.velocity };
      open.set(e.key, n);
      notes.push(n);
    } else if (e.type === 'off') {
      const n = open.get(e.key);
      // No key up without its key down.
      expect(n).toBeDefined();
      n!.off = e.tick;
      open.delete(e.key);
    }
  }
  expect(open.size).toBe(0);
  for (const n of notes) expect(n.off).toBeGreaterThan(n.on);
  return notes;
}

const of = <T extends Read['type']>(file: ReadFile, type: T) =>
  file.events.filter((e): e is Extract<Read, { type: T }> => e.type === type);

function midi(take: Parameters<typeof takeMidi>[0]): ReadFile {
  const file = takeMidi(take);
  expect(file).not.toBeNull();
  const read = readSmf(file!.bytes);
  expect(read).toMatchObject({ format: 0, tracks: 1, division: SMF_TICKS });
  // One name first, one end of track last, at the last event.
  expect(read.events[0]).toEqual({ tick: 0, type: 'name', text: take.title });
  expect(of(read, 'name')).toHaveLength(1);
  expect(of(read, 'end')).toHaveLength(1);
  expect(read.events.at(-1)).toEqual({ tick: read.events.at(-2)!.tick, type: 'end' });
  // Everything is on channel 1, and ticks never go back.
  for (const e of read.events) if ('channel' in e) expect(e.channel).toBe(1);
  notesOf(read);
  return read;
}

/** The bar lines of a file from its time signatures, up to `end`. */
function barLines(file: ReadFile, end: number): number[] {
  const meters = of(file, 'meter');
  const lines: number[] = [];
  let tick = 0;
  while (tick <= end) {
    lines.push(tick);
    const meter = meters.findLast((m) => m.tick <= tick)!;
    tick += (meter.beats * 4 * SMF_TICKS) / meter.beatType;
  }
  return lines;
}

describe('variableLength', () => {
  it('writes seven bits a byte, the high bit on all but the last', () => {
    expect(variableLength(0)).toEqual([0x00]);
    expect(variableLength(0x40)).toEqual([0x40]);
    expect(variableLength(0x7f)).toEqual([0x7f]);
    expect(variableLength(0x80)).toEqual([0x81, 0x00]);
    expect(variableLength(0x2000)).toEqual([0xc0, 0x00]);
    expect(variableLength(0x3fff)).toEqual([0xff, 0x7f]);
    expect(variableLength(0x4000)).toEqual([0x81, 0x80, 0x00]);
    expect(variableLength(0x1fffff)).toEqual([0xff, 0xff, 0x7f]);
    expect(variableLength(0x200000)).toEqual([0x81, 0x80, 0x80, 0x00]);
    expect(variableLength(0x0fffffff)).toEqual([0xff, 0xff, 0xff, 0x7f]);
  });
});

describe('takeMidi, a run without a beat (wait and memory mode)', () => {
  it('writes the header, the track and every byte of a small take', () => {
    const file = takeMidi({
      title: 'Ode',
      events: [
        [0, 1, 60, 80, 0],
        [500, 0, 60],
      ],
    })!;
    expect([...file.bytes]).toEqual([
      // MThd, length 6, format 0, one track, 480 ticks to the quarter.
      ...[0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0x01, 0xe0],
      // MTrk and the length of what follows.
      ...[0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, 27],
      // The track's name.
      ...[0x00, 0xff, 0x03, 0x03, 0x4f, 0x64, 0x65],
      // ♩ = 120: 500,000 µs to the quarter.
      ...[0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20],
      // The key down, and its key up 480 ticks (half a second) later.
      ...[0x00, 0x90, 60, 80],
      ...[0x83, 0x60, 0x80, 60, 64],
      // End of track.
      ...[0x00, 0xff, 0x2f, 0x00],
    ]);
    expect(file.start).toBe(0);
  });

  it('is at ♩ = 120 with every event at its own time, and claims no time signature', () => {
    const read = midi({
      title: 'A run',
      events: [
        [0, 64, 127],
        [0, 1, 60, 80, 0],
        [250, 0, 60],
        [1000, 1, 62, 30, -1], // a wrong key: it was played, so it is in the file
        [1100, 0, 62],
        [61_000, 1, 64, 90, 1], // a minute's hesitation
        [61_500, 66, 100],
        [61_500, 67, 40],
        [62_000, 64, 0],
        [62_500, 0, 64],
      ],
    });
    expect(of(read, 'tempo')).toEqual([{ tick: 0, type: 'tempo', us: 500_000 }]);
    expect(of(read, 'meter')).toEqual([]);
    // 960 ticks a second.
    expect(notesOf(read)).toEqual([
      { key: 60, on: 0, off: 240, velocity: 80 },
      { key: 62, on: 960, off: 1056, velocity: 30 },
      { key: 64, on: 58_560, off: 60_000, velocity: 90 },
    ]);
    expect(of(read, 'control').map((c) => [c.tick, c.controller, c.value])).toEqual([
      [0, 64, 127],
      [59_040, 66, 100],
      [59_040, 67, 40],
      [59_520, 64, 0],
    ]);
  });

  it('begins at the take’s first event', () => {
    // A rhythm run of other notes than the piece has now is written like this: its first event
    // (here in its count-in) is time 0.
    const file = takeMidi({
      title: '',
      events: [
        [-1500, 1, 60, 80, -1],
        [-1000, 0, 60],
        [0, 1, 62, 80, 0],
        [500, 0, 62],
      ],
    })!;
    expect(file.start).toBe(-1500);
    expect(notesOf(readSmf(file.bytes))).toEqual([
      { key: 60, on: 0, off: 480, velocity: 80 },
      { key: 62, on: 1440, off: 1920, velocity: 80 },
    ]);
  });

  it('orders what falls on one tick: pedals, key ups, then key downs', () => {
    const read = midi({
      title: 'Order',
      events: [
        [0, 1, 60, 80, 0],
        [0, 1, 64, 80, 0],
        // All at 500 ms, as they came: a key down, a key up, the pedal, another key up.
        [500, 1, 67, 70, 1],
        [500, 0, 60],
        [500, 64, 127],
        [500, 0, 64],
        [900, 0, 67],
      ],
    });
    expect(
      read.events
        .filter((e) => e.tick === 480)
        .map((e) => (e.type === 'control' ? 'pedal' : `${e.type} ${'key' in e ? e.key : ''}`)),
    ).toEqual(['pedal', 'off 60', 'off 64', 'on 67']);
  });

  it('gives every key down its key up', () => {
    const read = midi({
      title: 'Pairs',
      events: [
        [0, 0, 72], // a key let go that the take never saw go down: left out
        [0, 1, 60, 80, 0],
        [400, 1, 60, 90, 0], // struck again with no key up between: the first ends here
        [600, 0, 60],
        [600, 0, 60], // let go twice: once
        [1000, 1, 64, 70, 1], // never let go: closed at the last event
        [1200, 1, 65, 70, 2],
        [2000, 64, 0],
      ],
    });
    expect(notesOf(read)).toEqual([
      { key: 60, on: 0, off: 384, velocity: 80 },
      { key: 60, on: 384, off: 576, velocity: 90 },
      { key: 64, on: 960, off: 1920, velocity: 70 },
      { key: 65, on: 1152, off: 1920, velocity: 70 },
    ]);
    // The first stroke's key up comes before the second stroke's key down.
    expect(read.events.filter((e) => e.tick === 384).map((e) => e.type)).toEqual(['off', 'on']);
  });

  it('closes a key that is the take’s last event a tick later', () => {
    const read = midi({ title: 'One', events: [[0, 1, 60, 80, 0]] });
    expect(notesOf(read)).toEqual([{ key: 60, on: 0, off: 1, velocity: 80 }]);
  });

  it('keeps a key down and its key up apart when they fall on one tick', () => {
    const read = midi({
      title: 'Short',
      events: [
        [0, 1, 60, 80, 0],
        [0, 0, 60],
        [0, 1, 60, 70, 0],
        [0, 0, 60],
        [1000, 1, 62, 80, 1],
        [1000, 0, 62],
      ],
    });
    expect(notesOf(read)).toEqual([
      { key: 60, on: 0, off: 1, velocity: 80 },
      { key: 60, on: 1, off: 2, velocity: 70 },
      { key: 62, on: 960, off: 961, velocity: 80 },
    ]);
  });

  it('clamps velocities and pedal values to what MIDI has', () => {
    const read = midi({
      title: 'Clamp',
      events: [
        [0, 64, 300],
        [0, 1, 60, 200, 0],
        [100, 1, 62, 0, 1], // velocity 0 would be a key up: the softest key down is 1
        [200, 1, 64, -5, 2],
        [300, 64, -20],
        [400, 66, 127.6],
        [500, 0, 60],
        [500, 0, 62],
        [500, 0, 64],
        [600, 1, 128, 80, -1], // no such key: left out
        [600, 1, -1, 80, -1],
      ],
    });
    expect(notesOf(read).map((n) => [n.key, n.velocity])).toEqual([
      [60, 127],
      [62, 1],
      [64, 1],
    ]);
    expect(of(read, 'control').map((c) => c.value)).toEqual([127, 0, 127]);
    for (const e of read.events) {
      if (e.type === 'on' || e.type === 'off') expect(e.key).toBeLessThanOrEqual(127);
    }
  });

  it('offers no file for a take without a key', () => {
    expect(takeMidi({ title: 'Nothing', events: [] })).toBeNull();
    expect(
      takeMidi({
        title: 'Pedal only',
        events: [
          [0, 64, 127],
          [500, 64, 0],
          [600, 0, 60],
        ],
      }),
    ).toBeNull();
  });

  it('names the track with the piece’s title, in UTF-8', () => {
    const title = 'Für Elise · 致爱丽丝 · エリーゼのために';
    const file = takeMidi({ title, events: [[0, 1, 60, 80, 0]] })!;
    const name = new TextEncoder().encode(title);
    // The name's length is a variable-length quantity of its bytes, not of its characters.
    expect([...file.bytes.subarray(22, 26)]).toEqual([0x00, 0xff, 0x03, name.length]);
    expect(midi({ title, events: [[0, 1, 60, 80, 0]] }).events[0]).toMatchObject({ text: title });
    const long = '長'.repeat(60);
    expect(midi({ title: long, events: [[0, 1, 60, 80, 0]] }).events[0]).toMatchObject({
      text: long,
    });
  });

  it('writes the keys as played: a transposed run is in the key it was played in', () => {
    // The Ode a tone up: the take's keys are the keys struck, whatever the written key.
    const read = midi({
      title: 'Up a tone',
      events: [
        [0, 1, 66, 80, 0],
        [400, 0, 66],
        [500, 1, 68, 80, 1],
        [900, 0, 68],
      ],
    });
    expect(notesOf(read).map((n) => n.key)).toEqual([66, 68]);
  });

  it('writes the rounds of a looped run one after another, as they were played', () => {
    // Two bars looped in wait mode, three times round: the steps come again and again.
    const events: TakeEvent[] = [];
    for (let i = 0; i < 12; i++) {
      events.push([i * 700, 1, [60, 62, 64, 65][i % 4]!, 60 + i, i % 4]);
      events.push([i * 700 + 300, 0, [60, 62, 64, 65][i % 4]!]);
    }
    events.sort((a, b) => a[0]! - b[0]!);
    const notes = notesOf(midi({ title: 'Loop', events }));
    expect(notes).toHaveLength(12);
    expect(notes.map((n) => n.key)).toEqual([60, 62, 64, 65, 60, 62, 64, 65, 60, 62, 64, 65]);
    expect(notes.map((n) => n.on)).toEqual(Array.from({ length: 12 }, (_, i) => i * 672));
  });
});

// --- A run with a beat ----------------------------------------------------------------------------

interface Run {
  score: Score;
  hands: 'right' | 'left' | 'both';
  repeats: 'play' | 'skip';
  loop: BarLoop | null;
  tempo: number;
  latency: number;
}

const settings = (piece: Score, options: Partial<Run> = {}): Run => ({
  score: piece,
  hands: 'right',
  repeats: 'play',
  loop: null,
  tempo: 100,
  latency: 0,
  ...options,
});

/**
 * A rhythm-mode take: every step of the run's rounds on its beat by the app's own clock
 * (`runClock`), `early` ms before it, each key held `held` ms, the latency in the raw times.
 */
function rhythmTake(run: Run, options: { rounds?: number; from?: number; held?: number } = {}) {
  const { order, steps, first, last } = runSteps(run.score, run.hands, run.repeats, run.loop);
  const clock = runClock(run.score, order, run.loop, run.tempo / 100)!;
  const events: TakeEvent[] = [];
  const due: { round: number; step: number; ms: number }[] = [];
  for (let round = 0; round < (options.rounds ?? 1); round++) {
    for (let s = round === 0 ? (options.from ?? first) : first; s <= last; s++) {
      const step = steps[s]!;
      const ms = round * (clock.length ?? 0) + clock.ms(step.tick);
      due.push({ round, step: s, ms });
      for (const key of step.midis) {
        events.push([Math.round(ms + run.latency), 1, key, 70, s]);
        events.push([Math.round(ms + run.latency + (options.held ?? 100)), 0, key]);
      }
    }
  }
  events.sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!);
  return { events, due, order, steps, clock };
}

const us = (bpm: number) => Math.round(60_000_000 / bpm);

describe('runGrid and takeMidi, a rhythm-mode run', () => {
  // Four bars of quarter notes: ♩ = 120, from bar 2 ♩ = 60, and ♩ = 90 from the third beat of bar 3.
  const changing = () =>
    score(bars(4), quarters(4, [60, 62, 64, 65]), [
      { tick: 0, bpm: 120 },
      { tick: 4 * Q, bpm: 60 },
      { tick: 10 * Q, bpm: 90 },
    ]);

  it('carries the score’s tempo marks times the run’s percent, and its time signature', () => {
    const run = settings(changing(), { tempo: 50, latency: 40 });
    const { events } = rhythmTake(run);
    const grid = runGrid({ ...run, events })!;
    expect(grid).toEqual({
      tempos: [
        { tick: 0, bpm: 60 },
        { tick: 1920, bpm: 30 },
        { tick: 4800, bpm: 45 },
      ],
      meters: [{ tick: 0, beats: 4, beatType: 4 }],
      length: 7680,
      loop: false,
      start: 0,
    });
    const read = midi({ title: 'Changing', events, latency: run.latency, grid });
    expect(of(read, 'tempo')).toEqual([
      { tick: 0, type: 'tempo', us: us(60) },
      { tick: 1920, type: 'tempo', us: us(30) },
      { tick: 4800, type: 'tempo', us: us(45) },
    ]);
    expect(of(read, 'meter')).toEqual([
      { tick: 0, type: 'meter', beats: 4, beatType: 4, click: 24, n32: 8 },
    ]);
    // Every note is on its beat, whatever the tempo there: the bar lines fall on whole bars.
    expect(notesOf(read).map((n) => n.on)).toEqual(Array.from({ length: 16 }, (_, i) => i * 480));
  });

  it('places a key by the run’s clock: early and late stay early and late', () => {
    const run = settings(changing(), { tempo: 100, latency: 25 });
    // Bar 1 at ♩ = 120: 500 ms a beat. Bar 2 at ♩ = 60, from 2000 ms: 1000 ms a beat.
    const events: TakeEvent[] = [
      [25, 1, 60, 80, 0],
      [275, 0, 60], // half a beat: 240 ticks
      [25 + 500 + 50, 1, 62, 80, 1], // 50 ms late at ♩ = 120: 48 ticks
      [25 + 2000 - 100, 1, 60, 80, 4], // 100 ms early for bar 2, still in bar 1's tempo: 96 ticks
      [25 + 3000 + 100, 1, 62, 80, 5], // 100 ms late at ♩ = 60: 48 ticks
      [25 + 4000, 0, 62],
    ];
    const read = midi({ title: '', events, latency: 25, grid: runGrid({ ...run, events }) });
    // (The first D ends where D is struck again; the second C is held to the take's end.)
    expect(notesOf(read).map((n) => [n.on, n.off])).toEqual([
      [0, 240],
      [480 + 48, 2400 + 48],
      [1920 - 96, 2880],
      [2400 + 48, 2880],
    ]);
  });

  it('leaves the count-in out: a key before the first bar is moved to time 0', () => {
    const run = settings(changing(), { latency: 30 });
    const events: TakeEvent[] = [
      [-1970, 64, 127], // the pedal, down through the count-in
      [-1500, 1, 48, 60, -1], // a key in the count-in, and let go in it
      [-1200, 0, 48],
      [-900, 1, 48, 60, -1], // and again
      [-600, 0, 48],
      [10, 1, 60, 80, 0], // the first note, 20 ms early
      [300, 0, 60],
      [530, 1, 62, 80, 1],
      [800, 0, 62],
    ];
    const file = takeMidi({ title: '', events, latency: 30, grid: runGrid({ ...run, events }) })!;
    // The file's time 0 is the first bar's downbeat: the take's 0, heard `latency` later.
    expect(file.start).toBe(30);
    const read = readSmf(file.bytes);
    expect(notesOf(read)).toEqual([
      { key: 48, on: 0, off: 1, velocity: 60 },
      { key: 60, on: 0, off: 259, velocity: 80 },
      { key: 48, on: 1, off: 2, velocity: 60 },
      { key: 62, on: 480, off: 739, velocity: 80 },
    ]);
    expect(of(read, 'control')).toEqual([
      { tick: 0, type: 'control', channel: 1, controller: 64, value: 127 },
    ]);
  });

  it('begins at the bar of the first key matched, when the run started later in the piece', () => {
    // Started from bar 3: the count-in is in bar 2 on the run's clock, the take's time 0 at bar 1.
    const run = settings(changing());
    const { events, clock } = rhythmTake(run, { from: 8 });
    const bar3 = clock.ms(8 * Q);
    events.unshift([Math.round(bar3 - 800), 1, 50, 60, -1], [Math.round(bar3 - 500), 0, 50]);
    // The first note of bar 3 comes 60 ms early: it is still bar 3's.
    const first = events.findIndex((e) => e[1] === 1 && e[4] === 8);
    events[first] = [events[first]![0]! - 60, ...events[first]!.slice(1)];
    events.sort((a, b) => a[0]! - b[0]!);
    const grid = runGrid({ ...run, events })!;
    expect(grid.start).toBe(3840);
    const file = takeMidi({ title: '', events, grid })!;
    expect(file.start).toBeCloseTo(bar3, 6);
    const read = readSmf(file.bytes);
    // What is in force at bar 3 is written at 0; the change inside the bar follows.
    expect(of(read, 'tempo')).toEqual([
      { tick: 0, type: 'tempo', us: us(60) },
      { tick: 960, type: 'tempo', us: us(90) },
    ]);
    expect(of(read, 'meter')).toHaveLength(1);
    const notes = notesOf(read);
    expect(notes[0]).toMatchObject({ key: 50, on: 0 });
    expect(notes.slice(1).map((n) => n.on)).toEqual([0, 480, 960, 1440, 1920, 2400, 2880, 3360]);
  });

  it('writes a looped run round after round, the tempo and the bars going round with it', () => {
    // Bars 2–3 looped, three times round: ♩ = 60, then ♩ = 90 from the third beat of bar 3.
    const run = settings(changing(), { loop: { from: 1, to: 2 }, latency: 20 });
    const { events } = rhythmTake(run, { rounds: 3 });
    const grid = runGrid({ ...run, events })!;
    expect(grid).toMatchObject({ length: 3840, loop: true, start: 0 });
    const read = midi({ title: 'Loop', events, latency: 20, grid });
    expect(of(read, 'tempo').map((t) => [t.tick, t.us])).toEqual([
      [0, us(60)],
      [2880, us(90)],
      [3840, us(60)],
      [6720, us(90)],
      [7680, us(60)],
      [10_560, us(90)],
    ]);
    // One time signature: it does not change from round to round.
    expect(of(read, 'meter')).toHaveLength(1);
    expect(notesOf(read).map((n) => n.on)).toEqual(Array.from({ length: 24 }, (_, i) => i * 480));
  });

  it('begins a loop started inside it at the bar it started from, and goes round from there', () => {
    const run = settings(changing(), { loop: { from: 1, to: 2 } });
    // From bar 3 (its step 8 of the piece), then twice round bars 2–3.
    const { events } = rhythmTake(run, { rounds: 3, from: 8 });
    const grid = runGrid({ ...run, events })!;
    expect(grid.start).toBe(1920);
    const read = midi({ title: '', events, grid });
    expect(of(read, 'tempo').map((t) => [t.tick, t.us])).toEqual([
      [0, us(60)],
      [960, us(90)],
      [1920, us(60)],
      [4800, us(90)],
      [5760, us(60)],
      [8640, us(90)],
    ]);
    expect(notesOf(read).map((n) => n.on)).toEqual(Array.from({ length: 20 }, (_, i) => i * 480));
  });

  it('follows the repeats as they were played', () => {
    // |: bar 1 :| bar 2, ♩ = 120 with ♩ = 60 from bar 2: bar 1 twice, then bar 2.
    const piece = score(
      [bar(0, 0, { repeat: { forward: true, backwardTimes: 2, ending: [] } }), bar(1, 4 * Q)],
      quarters(2, [60, 62, 64, 65]),
      [
        { tick: 0, bpm: 120 },
        { tick: 4 * Q, bpm: 60 },
      ],
    );
    const played = settings(piece);
    const a = rhythmTake(played);
    const read = midi({
      title: '',
      events: a.events,
      grid: runGrid({ ...played, events: a.events }),
    });
    expect(of(read, 'tempo').map((t) => [t.tick, t.us])).toEqual([
      [0, us(120)],
      [3840, us(60)],
    ]);
    expect(notesOf(read)).toHaveLength(12);
    // With the repeats skipped the run is two bars long.
    const skipped = settings(piece, { repeats: 'skip' });
    const b = rhythmTake(skipped);
    const grid = runGrid({ ...skipped, events: b.events })!;
    expect(grid.length).toBe(3840);
    expect(grid.tempos.map((t) => t.tick)).toEqual([0, 1920]);
  });

  it('uses 90 to the quarter for a score without a tempo mark, as the click does', () => {
    const piece = score(bars(1), quarters(1));
    const run = settings(piece, { tempo: 40 });
    const { events } = rhythmTake(run);
    const read = midi({ title: '', events, grid: runGrid({ ...run, events }) });
    expect(of(read, 'tempo')).toEqual([{ tick: 0, type: 'tempo', us: us(DEFAULT_BPM * 0.4) }]);
    expect(us(DEFAULT_BPM * 0.4)).toBe(1_666_667);
  });

  it('clicks the dotted beat in a compound meter, and the beat in the others', () => {
    const meterOf = (beats: number, beatType: number) => {
      const piece = score(bars(1, beats, beatType), [note(0, 0, Q / 2, 60)]);
      const run = settings(piece);
      const { events } = rhythmTake(run);
      return of(midi({ title: '', events, grid: runGrid({ ...run, events }) }), 'meter')[0];
    };
    expect(meterOf(6, 8)).toMatchObject({ beats: 6, beatType: 8, click: 36 });
    expect(meterOf(3, 8)).toMatchObject({ beats: 3, beatType: 8, click: 12 });
    expect(meterOf(2, 2)).toMatchObject({ beats: 2, beatType: 2, click: 48 });
    expect(meterOf(3, 4)).toMatchObject({ beats: 3, beatType: 4, click: 24 });
  });

  it('writes a bar of another length than its time signature with the signature it has', () => {
    const m = (duration: number, beats: number, beatType: number) =>
      barMeter({ duration, beats, beatType });
    expect(m(4 * Q, 4, 4)).toEqual({ beats: 4, beatType: 4 });
    // A quarter's pickup in 3/4, and the two beats that end the piece.
    expect(m(Q, 3, 4)).toEqual({ beats: 1, beatType: 4 });
    expect(m(2 * Q, 3, 4)).toEqual({ beats: 2, beatType: 4 });
    // Half a bar of 4/4 stays in quarters; an eighth's pickup needs eighths.
    expect(m(2 * Q, 4, 4)).toEqual({ beats: 2, beatType: 4 });
    expect(m(Q / 2, 4, 4)).toEqual({ beats: 1, beatType: 8 });
    expect(m(Q * 1.5, 4, 4)).toEqual({ beats: 3, beatType: 8 });
    expect(m(Q / 2, 6, 8)).toEqual({ beats: 1, beatType: 8 });
    // A length no signature has keeps the bar's own.
    expect(m(Q / 3, 4, 4)).toEqual({ beats: 4, beatType: 4 });
  });

  it('has no grid for a loop the score does not have', () => {
    const run = settings(changing(), { loop: { from: 7, to: 9 } });
    expect(runGrid({ ...run, events: [] })).toBeNull();
  });

  it('begins at the take’s time 0 when no key was matched to the score', () => {
    const run = settings(changing());
    const events: TakeEvent[] = [
      [100, 1, 61, 80, -1],
      [300, 0, 61],
    ];
    expect(runGrid({ ...run, events })!.start).toBe(0);
    // And when the take names a step the score does not have (another version of its notes).
    expect(runGrid({ ...run, events: [[100, 1, 61, 80, 400]] })!.start).toBe(0);
  });
});

describe('a library piece with a pickup and bars divided by its repeats: Für Elise', () => {
  const piece = parseMusicXml(new DOMParser().parseFromString(furElise, 'application/xml'));

  it('puts every bar line of the score on a bar line of the file', () => {
    // The pickup is an eighth of 3/8, and each repeat divides a bar into two.
    expect(piece.measures[0]).toMatchObject({ duration: Q / 2, beats: 3, beatType: 8 });
    expect(piece.tempos).toEqual([{ tick: 0, bpm: 72 }]);
    const run = settings(piece, { hands: 'both', tempo: 80, latency: 35 });
    const { events, due, order, steps } = rhythmTake(run);
    const grid = runGrid({ ...run, events })!;
    expect(grid.start).toBe(0);
    const read = midi({ title: piece.title, events, latency: 35, grid });
    expect(read.events[0]).toMatchObject({ text: 'Für Elise' });
    expect(of(read, 'tempo')).toEqual([{ tick: 0, type: 'tempo', us: us(72 * 0.8) }]);

    // The pickup is a bar of 1/8, then 3/8 from the first whole bar.
    const meters = of(read, 'meter');
    expect(meters.slice(0, 2).map((m) => [m.tick, m.beats, m.beatType])).toEqual([
      [0, 1, 8],
      [240, 3, 8],
    ]);
    // The bars the repeats divide have their own lengths too.
    expect(meters.length).toBeGreaterThan(2);

    // Every bar played starts on a bar line of the file, and there is no other bar line.
    const end = read.events.at(-1)!.tick;
    const starts = order.map((p) => p.start / 2);
    expect(barLines(read, end)).toEqual(starts.filter((tick) => tick <= end));

    // Every key is where its step is in the score, to the tick.
    const notes = notesOf(read);
    const ons = [...new Set(notes.map((n) => n.on))].sort((a, b) => a - b);
    expect(ons).toEqual(due.map((d) => steps[d.step]!.tick / 2));
    expect(notes).toHaveLength(steps.reduce((sum, s) => sum + s.midis.length, 0));
  });

  it('begins a run of the right hand alone at its pickup too', () => {
    const run = settings(piece, { hands: 'right' });
    const { events } = rhythmTake(run);
    const read = midi({ title: piece.title, events, grid: runGrid({ ...run, events }) });
    expect(
      notesOf(read)
        .slice(0, 3)
        .map((n) => [n.key, n.on]),
    ).toEqual([
      [76, 0],
      [75, 120],
      [76, 240],
    ]);
  });
});

describe('steadyGrid, an improvisation over a backing', () => {
  it('is in 4/4 at the backing’s tempo from the first bar’s 1, the count-in left out', () => {
    // ♩ = 96: 625 ms a beat. The latency is 50 ms.
    const events: TakeEvent[] = [
      [-575, 1, 72, 80, -1], // in the count-in: moved to time 0
      [-200, 0, 72],
      [50, 1, 60, 80, -1], // on the 1
      [675, 0, 60],
      [50 + 2500 * 13, 1, 67, 80, -1], // the second time round a twelve-bar loop, its bar 2
      [50 + 2500 * 13 + 625, 0, 67],
    ];
    const file = takeMidi({ title: 'Blues in F', events, latency: 50, grid: steadyGrid(96) })!;
    expect(file.start).toBe(50);
    const read = readSmf(file.bytes);
    expect(of(read, 'tempo')).toEqual([{ tick: 0, type: 'tempo', us: 625_000 }]);
    expect(of(read, 'meter')).toEqual([
      { tick: 0, type: 'meter', beats: 4, beatType: 4, click: 24, n32: 8 },
    ]);
    expect(notesOf(read)).toEqual([
      { key: 72, on: 0, off: 1, velocity: 80 },
      { key: 60, on: 0, off: 480, velocity: 80 },
      { key: 67, on: 13 * 1920, off: 13 * 1920 + 480, velocity: 80 },
    ]);
  });
});

describe('midiFileName', () => {
  const at = Date.UTC(2026, 9, 1, 6, 5);

  it('is the title and the local date and time, to the minute', () => {
    expect(midiFileName('Ode to Joy', at, 'UTC')).toBe('Ode to Joy 2026-10-01 06.05.mid');
    expect(midiFileName('Ode to Joy', at, 'Asia/Shanghai')).toBe('Ode to Joy 2026-10-01 14.05.mid');
    expect(midiFileName('Ode to Joy', at, 'America/Los_Angeles')).toBe(
      'Ode to Joy 2026-09-30 23.05.mid',
    );
    // Midnight is 00, not 24.
    expect(midiFileName('Ode', Date.UTC(2026, 9, 1, 0, 0), 'UTC')).toBe('Ode 2026-10-01 00.00.mid');
  });

  it('leaves out the characters a file name cannot have', () => {
    expect(midiFileName('Prelude: C/G \\ "No. 1" <a|b> *?', at, 'UTC')).toBe(
      'Prelude CG No. 1 ab 2026-10-01 06.05.mid',
    );
    expect(midiFileName('A\tB\nC\u0000D\u007fE\u0085F', at, 'UTC')).toBe(
      'ABCDEF 2026-10-01 06.05.mid',
    );
    // No dot or space at either end (a hidden file, a name Windows cuts).
    expect(midiFileName('  ..hidden.. ', at, 'UTC')).toBe('hidden 2026-10-01 06.05.mid');
    expect(midiFileName('', at, 'UTC')).toBe('dacapo 2026-10-01 06.05.mid');
    expect(midiFileName('///', at, 'UTC')).toBe('dacapo 2026-10-01 06.05.mid');
  });

  it('keeps the letters of every script', () => {
    expect(midiFileName('致爱丽丝', at, 'UTC')).toBe('致爱丽丝 2026-10-01 06.05.mid');
    expect(midiFileName('エリーゼのために', at, 'UTC')).toBe(
      'エリーゼのために 2026-10-01 06.05.mid',
    );
    expect(midiFileName('엘리제를 위하여', at, 'UTC')).toBe('엘리제를 위하여 2026-10-01 06.05.mid');
    expect(midiFileName('Für Elise – Nº 1', at, 'UTC')).toBe(
      'Für Elise – Nº 1 2026-10-01 06.05.mid',
    );
  });

  it('cuts a long title, never through a character', () => {
    const name = midiFileName('𝄞'.repeat(200), at, 'UTC');
    expect(name).toBe(`${'𝄞'.repeat(80)} 2026-10-01 06.05.mid`);
  });
});

// A grid written by hand, to check the clock without a score.
describe('a grid', () => {
  it('extends its last tempo past the end of a span that does not go round', () => {
    const grid: SmfGrid = {
      tempos: [{ tick: 0, bpm: 60 }],
      meters: [{ tick: 0, beats: 4, beatType: 4 }],
      length: 1920,
      loop: false,
      start: 0,
    };
    // The last key is let go two seconds after the span's end.
    const read = midi({
      title: '',
      grid,
      events: [
        [3000, 1, 60, 80, 3],
        [6000, 0, 60],
      ],
    });
    expect(notesOf(read)).toEqual([{ key: 60, on: 1440, off: 2880, velocity: 80 }]);
    expect(of(read, 'tempo')).toHaveLength(1);
  });
});
