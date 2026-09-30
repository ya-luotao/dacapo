import { describe, expect, it } from 'vitest';
import { scaleNotes } from '../../core/scales.ts';
import { LOOP_SIDE, loopKey, loopNotes, loopSpan, startLoop, type LoopState } from './loop.ts';

describe('the span of a focus loop', () => {
  it('takes a few notes either side of the place', () => {
    expect(LOOP_SIDE).toBe(3);
    expect(loopSpan(29, 10)).toEqual({ from: 7, to: 13 });
  });

  it('keeps its length at the ends of the run', () => {
    expect(loopSpan(29, 1)).toEqual({ from: 0, to: 6 });
    expect(loopSpan(29, 28)).toEqual({ from: 22, to: 28 });
    expect(loopSpan(5, 2)).toEqual({ from: 0, to: 4 });
  });
});

describe('a focus loop', () => {
  const c = scaleNotes({ type: 'major', tonic: 'C', octaves: 2, hands: 'right' });
  // Round F4 (index 3), the thumb under going up: C4 … G4 and on to A4, B4.
  const expected = loopNotes(c, loopSpan(c.right.length, 3));
  const midis = expected.map((n) => n.midi);
  const press = (state: LoopState, keys: readonly number[]) => keys.reduce(loopKey, state);

  it('waits for each key and goes round from the last step to the first', () => {
    expect(midis).toEqual([60, 62, 64, 65, 67, 69, 71]);
    let state = startLoop(expected);
    state = press(state, midis.slice(0, 6));
    expect(state).toMatchObject({ next: 6, rounds: 0 });
    state = loopKey(state, 71);
    expect(state).toMatchObject({ next: 0, rounds: 1, played: [] });
    state = press(state, midis);
    expect(state.rounds).toBe(2);
  });

  it('flashes a wrong key and keeps waiting for the right one', () => {
    let state = press(startLoop(expected), [60, 62]);
    state = loopKey(state, 63);
    expect(state).toMatchObject({ next: 2, wrongKey: 63 });
    state = loopKey(state, 64);
    expect(state).toMatchObject({ next: 3, wrongKey: null });
  });

  it('waits for both keys of a step hands together, in either order', () => {
    const both = scaleNotes({ type: 'major', tonic: 'C', octaves: 1, hands: 'both' });
    const notes = loopNotes(both, loopSpan(both.right.length, 7));
    let state = startLoop(notes);
    expect(state.steps).toHaveLength(7);
    const [r, l] = state.steps[0]!.map((n) => notes[n]!.midi);
    state = loopKey(state, l!);
    expect(state.next).toBe(0);
    state = loopKey(state, r!);
    expect(state.next).toBe(1);
  });
});
