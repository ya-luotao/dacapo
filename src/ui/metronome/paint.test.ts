// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { PulsePosition } from '../../core/pulse.ts';
import { AMPLITUDE, paintDots, swingAngle, weightY } from './paint.ts';

const at = (patch: Partial<PulsePosition>): PulsePosition => ({
  beat: 0,
  bar: 0,
  inBar: 0,
  beats: 4,
  phase: 0,
  from: 0,
  to: 500,
  bpm: 120,
  subdivision: 1,
  accent: 'normal',
  silent: false,
  ...patch,
});

describe('the pendulum', () => {
  it('crosses the centre on every beat and turns at the ends, one way then the other', () => {
    for (const beat of [0, 1, 2, 7, 1001]) expect(swingAngle(at({ beat }))).toBeCloseTo(0, 9);
    expect(swingAngle(at({ beat: 0, phase: 0.5 }))).toBeCloseTo(AMPLITUDE, 9);
    expect(swingAngle(at({ beat: 1, phase: 0.5 }))).toBeCloseTo(-AMPLITUDE, 9);
    // Slow at the ends, fastest through the middle.
    const middle = swingAngle(at({ phase: 0.05 })) - swingAngle(at({ phase: 0 }));
    const end = swingAngle(at({ phase: 0.5 })) - swingAngle(at({ phase: 0.45 }));
    expect(middle).toBeGreaterThan(end * 5);
  });

  it('carries its weight higher for a slower tempo', () => {
    expect(weightY(40)).toBeLessThan(weightY(60));
    expect(weightY(60)).toBeLessThan(weightY(200));
    expect(weightY(10)).toBe(weightY(20));
    expect(weightY(400)).toBe(weightY(300));
  });
});

describe('the beat dots', () => {
  it('mark the beat and subdivision heard, and only change the DOM when they move', () => {
    const root = document.createElement('div');
    root.innerHTML = [0, 1, 2]
      .map(
        (i) =>
          `<span class="beat-dot" data-beat="${i}"></span><span class="beat-sub" data-beat="${i}" data-sub="1"></span>`,
      )
      .join('');
    paintDots(root, at({ inBar: 1, subdivision: 2, phase: 0.2 }));
    expect(root.querySelector('[data-now]')!.outerHTML).toContain('beat-dot" data-beat="1"');
    paintDots(root, at({ inBar: 1, subdivision: 2, phase: 0.7, silent: true }));
    const marked = [...root.querySelectorAll('[data-now]')].map((el) => el.className);
    expect(marked).toEqual(['beat-dot', 'beat-sub']);
    expect(root.dataset.silent).toBe('');
    paintDots(root, null);
    expect(root.querySelectorAll('[data-now]')).toHaveLength(0);
    expect(root.dataset.silent).toBeUndefined();
  });
});
