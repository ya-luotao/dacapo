// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { PulsePosition } from '../../core/pulse.ts';
import { AMPLITUDE, weightY } from './geometry.ts';
import {
  createPendulumPainter,
  paintDots,
  pendulumMotion,
  settleAngle,
  SETTLE_MS,
  swingAngle,
} from './paint.ts';

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

describe('start and stop', () => {
  const periods = [200, 250, 500, 857, 3000];

  it('is released on the first beat: from rest at the centre to the full swing at the first end', () => {
    for (const to of periods) {
      const start = pendulumMotion(at({ to }));
      expect(start.angle).toBe(0);
      expect(start.velocity).toBeCloseTo(0, 12);
      const end = pendulumMotion(at({ to, phase: 0.5 }));
      expect(end.angle).toBeCloseTo(AMPLITUDE, 9);
      expect(end.velocity).toBeCloseTo(0, 9);
      // From there on it is the swing itself: centre on every beat.
      for (const beat of [1, 2, 9])
        expect(pendulumMotion(at({ to, beat })).angle).toBeCloseTo(0, 9);
      for (let phase = 0.5; phase < 1; phase += 0.05)
        expect(pendulumMotion(at({ to, phase })).angle).toBeCloseTo(swingAngle(at({ phase })), 9);
    }
    // It goes out one way only, never past the end.
    let previous = -1;
    for (let phase = 0; phase <= 0.5; phase += 0.01) {
      const { angle } = pendulumMotion(at({ phase }));
      expect(angle).toBeGreaterThan(previous);
      expect(angle).toBeLessThanOrEqual(AMPLITUDE);
      previous = angle;
    }
  });

  it('gives the rate of the angle it gives', () => {
    for (const to of periods)
      for (const u of [0.1, 0.3, 0.49, 0.51, 0.8, 1.2, 3.7]) {
        const beat = Math.floor(u);
        const pos = (phase: number) => at({ to, beat, phase });
        const h = 1e-6;
        const phase = u - beat;
        const numeric =
          (pendulumMotion(pos(phase + h)).angle - pendulumMotion(pos(phase - h)).angle) /
          (2 * h * to);
        expect(pendulumMotion(pos(phase)).velocity).toBeCloseTo(numeric, 6);
      }
  });

  it('settles when stopped: smoothly from where it was, to rest, never wider than the swing', () => {
    for (const period of periods)
      for (let u = 0; u < 3; u += 0.0625) {
        const beat = Math.floor(u);
        const { angle, velocity } = pendulumMotion(at({ to: period, beat, phase: u - beat }));
        const swing = { angle, velocity, period };
        expect(settleAngle(swing, 0)).toBeCloseTo(angle, 9);
        // It carries on at the speed it had (no snap).
        expect((settleAngle(swing, 1e-3) - settleAngle(swing, 0)) / 1e-3).toBeCloseTo(velocity, 3);
        for (let t = 0; t < SETTLE_MS + 50; t += 5)
          expect(Math.abs(settleAngle(swing, t))).toBeLessThanOrEqual(AMPLITUDE);
        expect(Math.abs(settleAngle(swing, SETTLE_MS * 0.9))).toBeLessThan(0.5);
        expect(settleAngle(swing, SETTLE_MS)).toBe(0);
        expect(settleAngle(swing, SETTLE_MS * 3)).toBe(0);
        // The last steps are small: it comes to rest, it does not jump there.
        for (let t = SETTLE_MS * 0.6; t < SETTLE_MS; t += 5)
          expect(Math.abs(settleAngle(swing, t + 5) - settleAngle(swing, t))).toBeLessThan(0.3);
      }
  });

  it('paints the swing, then the settle, then rest in the clip; still with reduced motion', () => {
    const root = document.createElement('div');
    root.innerHTML =
      '<svg class="pendulum-shadow"></svg><svg class="pendulum-rod"><path class="pendulum-glint"/></svg>';
    const rod = root.querySelector<SVGSVGElement>('.pendulum-rod')!;
    const shadow = root.querySelector<SVGSVGElement>('.pendulum-shadow')!;
    const glint = root.querySelector<SVGElement>('.pendulum-glint')!;
    const angle = () => Number(/rotate\((-?[\d.]+)deg\)/.exec(rod.style.transform)?.[1]);
    const paint = createPendulumPainter();
    paint(root, null, 0, false);
    expect(angle()).toBe(0);
    // An accented downbeat glints; a plain beat does not.
    paint(root, at({ beat: 4, phase: 0.1, accent: 'accent' }), 1000, false);
    expect(angle()).toBeCloseTo(AMPLITUDE * Math.sin(Math.PI * 0.1), 3);
    expect(shadow.style.transform).toContain(rod.style.transform);
    expect(glint.style.opacity).toBe('1');
    paint(root, at({ beat: 5, phase: 0.1 }), 1500, false);
    expect(glint.style.opacity).toBe('0');
    // A muted beat swings, and nothing glints; a silent bar dims.
    paint(root, at({ beat: 8, phase: 0.1, accent: 'accent', silent: true }), 3000, false);
    expect(glint.style.opacity).toBe('0');
    expect(root.dataset.silent).toBe('');
    paint(root, at({ beat: 9, phase: 0.25 }), 3075, false);
    const swung = angle();
    expect(Math.abs(swung)).toBeCloseTo(AMPLITUDE * Math.SQRT1_2, 3);
    // Stopped: it swings on for a moment, then rests.
    paint(root, null, 3091, false);
    expect(root.dataset.silent).toBeUndefined();
    expect(Math.abs(angle())).toBeGreaterThan(0);
    expect(Math.sign(angle())).toBe(Math.sign(swung));
    paint(root, null, 3075 + SETTLE_MS + 1, false);
    expect(angle()).toBe(0);
    paint(root, at({ beat: 9, phase: 0.25 }), 4000, true);
    expect(angle()).toBe(0);
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
