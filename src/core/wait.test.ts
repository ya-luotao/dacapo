import { describe, expect, it } from 'vitest';
import type { Step } from './score.ts';
import { press, startWait, waitRange, type PressResult, type WaitState } from './wait.ts';

function step(index: number, midis: number[], measure = index): Step {
  return {
    index,
    tick: index * 960,
    played: measure,
    measure,
    pass: 1,
    writtenTick: index * 960,
    beat: 1,
    midis,
    noteIds: midis.map((m) => `n${index}.${m}`),
    heldIds: [],
  };
}

const steps = [step(0, [60]), step(1, [48, 64, 67]), step(2, [62]), step(3, [62])];

/** Presses `keys` in order at the given times and returns every result. */
function play(state: WaitState, keys: [midi: number, time: number][]): PressResult[] {
  const results: PressResult[] = [];
  for (const [midi, time] of keys) {
    const result = press(steps, state, midi, time);
    results.push(result);
    state = result.state;
  }
  return results;
}

describe('wait mode', () => {
  it('starts on the first step, or not at all without steps', () => {
    expect(startWait(steps)).toMatchObject({ current: 0, first: 0, last: 3, since: null });
    expect(startWait([])).toBeNull();
  });

  it('completes a chord in any order and records the time', () => {
    const results = play(startWait(steps)!, [
      [60, 1000],
      [67, 1200],
      [48, 1250],
      // Pressing a key of the chord again does not count twice, and is not wrong.
      [67, 1300],
      [64, 1400],
    ]);
    expect(results.map((r) => r.kind)).toEqual([
      'complete',
      'progress',
      'progress',
      'progress',
      'complete',
    ]);
    // The clock starts at the first key: getting ready is not hesitation.
    expect(results[0]).toMatchObject({ record: { step: 0, ms: 0, wrong: 0, measure: 0 } });
    expect(results[4]).toMatchObject({ record: { step: 1, ms: 400, at: 1400 } });
    expect(results[4]!.state.current).toBe(2);
  });

  it('counts wrong keys without blocking', () => {
    const results = play(startWait(steps)!, [
      [61, 10],
      [59, 20],
      [60, 50],
    ]);
    expect(results.map((r) => r.kind)).toEqual(['wrong', 'wrong', 'complete']);
    expect(results[2]).toMatchObject({ record: { wrong: 2, ms: 40 } });
    expect(results[2]!.state.wrong).toBe(0);
  });

  it('needs a repeated key pressed again: a key held over from the last step does not count', () => {
    // Steps 2 and 3 are both D4. Only key-downs arrive, so holding D4 completes step 2 alone;
    // step 3 waits until D4 is struck again.
    let state = startWait(steps, { start: 2 })!;
    const first = press(steps, state, 62, 0);
    expect(first).toMatchObject({ kind: 'complete', state: { current: 3, pressed: [] } });
    state = first.state;
    expect(state.pressed).toEqual([]);
    expect(press(steps, state, 62, 500)).toMatchObject({ kind: 'finished' });
  });

  it('finishes after the last step without a loop and then ignores keys', () => {
    const results = play(startWait(steps, { start: 3 })!, [
      [62, 0],
      [62, 10],
    ]);
    expect(results.map((r) => r.kind)).toEqual(['finished', 'ignored']);
    expect(results[0]!.state).toMatchObject({ finished: true, current: 3 });
  });

  it('loops from the last step of the range back to the first and counts laps', () => {
    let state = startWait(steps, { first: 1, last: 2, loop: true })!;
    expect(state.current).toBe(1);
    const results = play(state, [
      [48, 0],
      [64, 0],
      [67, 0],
      [62, 100],
    ]);
    state = results.at(-1)!.state;
    expect(results.at(-1)).toMatchObject({ kind: 'complete', record: { step: 2 } });
    expect(state).toMatchObject({ current: 1, laps: 1, finished: false, since: 100 });
  });

  it('starts from a given step inside the range', () => {
    expect(startWait(steps, { first: 1, last: 3, start: 2 })!.current).toBe(2);
    // A start outside the range is clamped into it.
    expect(startWait(steps, { first: 1, last: 2, start: 0 })!.current).toBe(1);
    expect(startWait(steps, { first: 1, last: 2, start: 3 })!.current).toBe(2);
    expect(startWait(steps, { first: 7, last: 9 })).toMatchObject({ first: 3, last: 3 });
  });
});

describe('waitRange', () => {
  // Bars 0–3, bars 1–2 repeated: 0, 1, 2, 1, 2, 3. One step per bar, none in bar 2 on pass 2.
  const order = [0, 1, 2, 1, 2, 3].map((measure, i) => ({
    measure,
    pass: i > 2 && i < 5 ? 2 : 1,
    start: i * 960,
  }));
  const played = [0, 1, 2, 3, 5];
  const bars = played.map((p, index) => ({
    ...step(index, [60 + index], order[p]!.measure),
    played: p,
  }));

  it('covers every step without a loop, from the first time the start bar is played', () => {
    expect(waitRange(bars, order, null, 0)).toEqual({ first: 0, last: 4, start: 0, loop: false });
    expect(waitRange(bars, order, null, 2)).toEqual({ first: 0, last: 4, start: 2, loop: false });
    // Bar 3's position has no step before it: the next step after it.
    expect(waitRange(bars, order, null, 3)).toMatchObject({ start: 4 });
  });

  it('limits a loop to the steps of its bars and starts inside it', () => {
    // Bars 1–2 resolve to the first pass (positions 1–2).
    expect(waitRange(bars, order, { from: 1, to: 2 }, 0)).toEqual({
      first: 1,
      last: 2,
      start: 1,
      loop: true,
    });
    expect(waitRange(bars, order, { from: 1, to: 2 }, 2)).toMatchObject({ start: 2 });
    // Bars 2–3: the second pass (2, 3) stays inside the bars; bar 2 has no step there.
    expect(waitRange(bars, order, { from: 2, to: 3 }, 0)).toEqual({
      first: 4,
      last: 4,
      start: 4,
      loop: true,
    });
  });

  it('is null when the range has nothing to play', () => {
    expect(waitRange([], order, null, 0)).toBeNull();
    expect(waitRange(bars, order, { from: 7, to: 8 }, 0)).toBeNull();
  });
});
