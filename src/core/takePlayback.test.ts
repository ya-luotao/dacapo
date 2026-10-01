import { describe, expect, it } from 'vitest';
import { bars, note, Q, quarters, score } from './scoreFixtures.ts';
import {
  COMPARE_GAP_MS,
  comparePlayback,
  keysStruck,
  PLAYBACK_TAIL_MS,
  playbackAt,
  takePlayback,
  UNRELEASED_MS,
  type PlaybackRun,
} from './takePlayback.ts';
import type { TakeEvent } from './takes.ts';

// Two bars of quarter notes at ♩ = 120 (500 ms each): C D E F | C D E F.
function piece() {
  return score(bars(2), quarters(2, [60, 62, 64, 65]), [{ tick: 0, bpm: 120 }]);
}

function run(events: TakeEvent[], options: Partial<PlaybackRun> = {}): PlaybackRun {
  return {
    score: piece(),
    hands: 'right',
    repeats: 'play',
    loop: null,
    mode: 'wait',
    tempo: 100,
    latency: 0,
    events,
    ...options,
  };
}

/** A wait-mode take: each step's key `gap` ms after the one before, held 300 ms, velocity rising. */
function waitTake(gap: number, steps = 8): TakeEvent[] {
  const keys = [60, 62, 64, 65];
  const events: TakeEvent[] = [];
  for (let i = 0; i < steps; i++) {
    events.push([i * gap, 1, keys[i % 4]!, 50 + i, i]);
    events.push([i * gap + 300, 0, keys[i % 4]!]);
  }
  return events.sort((a, b) => a[0]! - b[0]!);
}

describe('takePlayback', () => {
  it('plays the keys as they were played, with their velocities, releases and the pedal', () => {
    const events: TakeEvent[] = [
      [0, 64, 127],
      [0, 1, 60, 80, 0],
      [250, 0, 60],
      [400, 1, 61, 30, -1], // a wrong key, let go at once
      [420, 0, 61],
      [900, 1, 62, 90, 1],
      [950, 64, 0],
      [1300, 0, 62],
    ];
    const p = takePlayback(run(events))!;
    expect(p.plan.notes).toEqual([
      { midi: 60, on: 0, off: 250, velocity: 80 },
      { midi: 61, on: 400, off: 420, velocity: 30 },
      { midi: 62, on: 900, off: 1300, velocity: 90 },
    ]);
    expect(p.plan.controls).toEqual([
      { at: 0, controller: 64, value: 127 },
      { at: 950, controller: 64, value: 0 },
    ]);
    expect(p.plan.length).toBe(1300 + PLAYBACK_TAIL_MS);
    expect(p.plan.loop).toBe(false);
    // The cursor follows the steps as the run reached them; the wrong key fell on the step the
    // run was waiting for.
    expect(p.plan.steps).toEqual([
      { step: 0, at: 0 },
      { step: 1, at: 400 },
    ]);
    expect(p.keys.map((k) => [k.midi, k.step, k.wrong])).toEqual([
      [60, 0, false],
      [61, null, true],
      [62, 1, false],
    ]);
    expect(p.bars).toEqual([{ measure: 0, at: 0 }]);
    // Every key down and up is a cue; a wrong key is shown at least 400 ms.
    expect(p.plan.cues).toEqual([0, 250, 400, 420, 800, 900, 1300]);
  });

  it('tells what sounds at a moment, the wrong key among it, and the keys of the step struck', () => {
    const events: TakeEvent[] = [
      [0, 1, 60, 80, 0],
      [100, 1, 61, 30, -1],
      [150, 0, 61],
      [200, 0, 60],
    ];
    const p = takePlayback(run(events))!;
    expect(playbackAt(p, 120)).toEqual({ sounding: [60, 61], wrong: [61], part: null });
    // Let go at 150, still shown as wrong until 500.
    expect(playbackAt(p, 300)).toEqual({ sounding: [], wrong: [61], part: null });
    expect(playbackAt(p, 600).wrong).toEqual([]);
    expect(keysStruck(p, 0, 0, 50)).toEqual([60]);
  });

  it('starts at a rhythm run’s count-in and finds where each bar is first reached', () => {
    const events: TakeEvent[] = [
      [-700, 1, 50, 60, -1], // a key in the count-in
      [-650, 0, 50],
      ...waitTake(500),
    ];
    const p = takePlayback(run(events, { mode: 'rhythm' }))!;
    expect(p.plan.notes[0]).toEqual({ midi: 50, on: 0, off: 50, velocity: 60 });
    expect(p.plan.notes[1]).toEqual({ midi: 60, on: 700, off: 1000, velocity: 50 });
    // The count-in's key is not shown as wrong.
    expect(p.keys[0]!.wrong).toBe(false);
    expect(p.bars).toEqual([
      { measure: 0, at: 700 },
      { measure: 1, at: 700 + 2000 },
    ]);
  });

  it('ends a key never let go with the take, and a key struck again where it is struck', () => {
    const events: TakeEvent[] = [
      [0, 1, 60, 80, 0],
      [100, 1, 60, 70, 0],
      [200, 1, 62, 80, 1],
    ];
    const p = takePlayback(run(events))!;
    expect(p.plan.notes).toEqual([
      { midi: 60, on: 0, off: 100, velocity: 80 },
      { midi: 60, on: 100, off: 100 + UNRELEASED_MS, velocity: 70 },
      { midi: 62, on: 200, off: 200 + UNRELEASED_MS, velocity: 80 },
    ]);
  });

  it('does not show an ornament’s principal struck again as a wrong key', () => {
    const notes = quarters(1, [60, 62, 64, 65]);
    notes[0] = { ...notes[0]!, ornaments: [{ kind: 'mordent', upper: 62, lower: 59 }] };
    const s = score(bars(1), notes, [{ tick: 0, bpm: 120 }]);
    const events: TakeEvent[] = [
      [0, 1, 60, 80, 0],
      [30, 1, 59, 80, 0], // the mordent's lower note names its step
      [60, 1, 60, 80, -1], // the principal again
      [500, 1, 63, 80, -1], // wrong
    ];
    const p = takePlayback(run(events, { score: s }))!;
    expect(p.keys.map((k) => k.wrong)).toEqual([false, false, false, true]);
  });

  it('is nothing without a key', () => {
    expect(takePlayback(run([[0, 64, 127]]))).toBeNull();
  });
});

describe('comparePlayback', () => {
  // The run took 600 ms a step: bar 1 from 0 to 2400, bar 2 from 2400 to 4800 (+300 held).
  const slow = () => [[1200, 64, 100] as TakeEvent, ...waitTake(600)].sort((a, b) => a[0]! - b[0]!);

  it('plays each bar as written, then as the run played it, with a gap between', () => {
    const p = comparePlayback(run(slow()), 'bar')!;
    const runStart = 2000 + COMPARE_GAP_MS; // bar 1 as written lasts 2000 ms
    expect(p.parts).toEqual([
      { at: 0, kind: 'written', measure: 0, pass: 1 },
      { at: runStart, kind: 'run', measure: 0, pass: 1 },
      { at: runStart + 2400 + COMPARE_GAP_MS, kind: 'written', measure: 1, pass: 1 },
      {
        at: runStart + 2400 + COMPARE_GAP_MS + 2000 + COMPARE_GAP_MS,
        kind: 'run',
        measure: 1,
        pass: 1,
      },
    ]);
    // As written: the demo's velocity (none given); the run's own.
    expect(p.plan.notes.slice(0, 4).map((n) => [n.midi, n.on, n.velocity])).toEqual([
      [60, 0, undefined],
      [62, 500, undefined],
      [64, 1000, undefined],
      [65, 1500, undefined],
    ]);
    expect(p.plan.notes.slice(4, 8).map((n) => [n.midi, n.on - runStart, n.velocity])).toEqual([
      [60, 0, 50],
      [62, 600, 51],
      [64, 1200, 52],
      [65, 1800, 53],
    ]);
    // The pedal goes down where the run put it down, and comes up at the end of the run's bar.
    const barEnd = runStart + 2400;
    expect(p.plan.controls!.filter((c) => c.controller === 64).slice(0, 2)).toEqual([
      { at: runStart + 1200, controller: 64, value: 100 },
      { at: barEnd, controller: 64, value: 0 },
    ]);
    // In bar 2 it is down from the start, as the run left it.
    const bar2 = p.parts[3]!.at;
    expect(p.plan.controls!.find((c) => c.at === bar2 && c.controller === 64)).toEqual({
      at: bar2,
      controller: 64,
      value: 100,
    });
    // The cursor: the written steps, then the run's.
    expect(p.plan.steps.slice(0, 8).map((s) => [s.step, s.at])).toEqual([
      [0, 0],
      [1, 500],
      [2, 1000],
      [3, 1500],
      [0, runStart],
      [1, runStart + 600],
      [2, runStart + 1200],
      [3, runStart + 1800],
    ]);
    expect(p.bars).toEqual([
      { measure: 0, at: 0 },
      { measure: 1, at: p.parts[2]!.at },
    ]);
    expect(playbackAt(p, runStart + 10).part).toEqual(p.parts[1]);
  });

  it('plays all of it as written, then all of it as played', () => {
    const p = comparePlayback(run(slow()), 'whole')!;
    expect(p.parts.map((x) => [x.at, x.kind, x.measure])).toEqual([
      [0, 'written', null],
      [4000 + COMPARE_GAP_MS, 'run', null],
    ]);
    // The run's last key is held 300 ms past its last step.
    expect(p.plan.length).toBe(4000 + COMPARE_GAP_MS + 4500 + PLAYBACK_TAIL_MS);
    expect(p.plan.notes.filter((n) => n.velocity !== undefined)).toHaveLength(8);
  });

  it('times a rhythm run’s bars on its clock, an early key included', () => {
    const events = waitTake(500).map((e) => (e[0] === 2000 ? [1980, ...e.slice(1)] : e));
    const p = comparePlayback(run(events, { mode: 'rhythm', latency: 0 }), 'bar')!;
    const second = p.parts[1]!.at;
    // Bar 1 as played ends where bar 2's first key fell, 20 ms early.
    expect(p.parts[2]!.at - second).toBe(1980 + COMPARE_GAP_MS);
  });

  it('compares the first round of a loop', () => {
    const notes = quarters(1, [60, 62, 64, 65]);
    const s = score(bars(1), notes, [{ tick: 0, bpm: 120 }]);
    const events: TakeEvent[] = [];
    for (let i = 0; i < 8; i++) events.push([i * 500, 1, [60, 62, 64, 65][i % 4]!, 60, i % 4]);
    const p = comparePlayback(run(events, { score: s, loop: { from: 0, to: 0 } }), 'bar')!;
    expect(p.parts).toHaveLength(2);
    expect(p.plan.notes.filter((n) => n.velocity !== undefined)).toHaveLength(4);
  });

  it('places the first note of a bar as written at its start', () => {
    const s = score(bars(2), [note(0, Q, Q, 60), note(1, 4 * Q, Q, 62)], [{ tick: 0, bpm: 120 }]);
    const events: TakeEvent[] = [
      [0, 1, 60, 70, 0],
      [800, 1, 62, 70, 1],
    ];
    const p = comparePlayback(run(events, { score: s }), 'bar')!;
    // Bar 1's note is on beat 2.
    expect(p.plan.notes[0]).toMatchObject({ midi: 60, on: 500 });
  });
});
