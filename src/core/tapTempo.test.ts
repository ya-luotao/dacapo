import { describe, expect, it } from 'vitest';
import { createTapTempo, TAP_RESET_MS, TAP_WINDOW } from './tapTempo.ts';

function tapAll(times: number[]) {
  const tapper = createTapTempo();
  return { tapper, results: times.map((t) => tapper.tap(t)) };
}

describe('tap tempo', () => {
  it('needs two taps, then gives the tempo of the taps', () => {
    const { results } = tapAll([1000, 1500, 2000, 2500]);
    expect(results).toEqual([null, 120, 120, 120]);
  });

  it('takes the median interval: one stray tap does not move it', () => {
    // 500 ms taps with one late (700) and one early (400): the mean would say 116 BPM.
    const { results } = tapAll([0, 500, 1000, 1700, 2100, 2600, 3100]);
    expect(results.at(-1)).toBe(120);
  });

  it('forgets old taps: only the last few intervals count', () => {
    const slow = Array.from({ length: 8 }, (_, i) => i * 1000);
    const fast = Array.from({ length: TAP_WINDOW }, (_, i) => 7000 + (i + 1) * 750);
    const { results } = tapAll([...slow, ...fast]);
    expect(results[7]).toBe(60);
    expect(results.at(-1)).toBe(80);
  });

  it('starts over after a pause', () => {
    const restart = 1000 + TAP_RESET_MS + 1;
    const { tapper, results } = tapAll([0, 500, 1000, restart]);
    expect(results[2]).toBe(120);
    expect(results[3]).toBeNull();
    expect(tapper.count()).toBe(1);
    expect(tapper.tap(restart + 1000)).toBe(60);
  });

  it('starts over when the gap is far longer than the tempo tapped so far', () => {
    // Tapping at 120, then a 1.5 s gap: a new count, not 120 dragged down.
    const { results } = tapAll([0, 500, 1000, 2500, 3500, 4500]);
    expect(results[3]).toBeNull();
    expect(results.at(-1)).toBe(60);
  });

  it('ignores a bounce', () => {
    const { results } = tapAll([0, 500, 530, 1000, 1500]);
    expect(results).toEqual([null, 120, 120, 120, 120]);
  });

  it('keeps to the metronome’s range', () => {
    expect(tapAll([0, 150, 300]).results.at(-1)).toBe(300);
    expect(tapAll([0, 3500]).results.at(-1)).toBe(20);
  });

  it('can be reset', () => {
    const { tapper } = tapAll([0, 500]);
    tapper.reset();
    expect(tapper.tap(600)).toBeNull();
    expect(tapper.tap(1600)).toBe(60);
  });
});
