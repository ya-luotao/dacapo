import { describe, expect, it } from 'vitest';
import { MAX_BPM, MIN_BPM } from '../../core/pulse.ts';
import {
  AMPLITUDE,
  BAND_ADVANCE,
  BAND_SIZE,
  BAND_X,
  caseHalf,
  CX,
  LABEL_SIZE,
  LABEL_SIZE_NARROW,
  PIVOT_Y,
  plateHalf,
  RECESS_TOP,
  ROD_LENGTH,
  ROD_TOP,
  SCALE_LABELS,
  SCALE_LABELS_NARROW,
  SCALE_MARKS,
  tempoAt,
  TEMPO_BANDS,
  VIEW_W,
  WEIGHT_BOTTOM_HALF,
  WEIGHT_H,
  weightY,
} from './geometry.ts';

const rad = (deg: number) => (deg * Math.PI) / 180;

describe('the scale', () => {
  it('is Maelzel’s series, carried down to 20 and up to 300', () => {
    const maelzel = [
      40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 63, 66, 69, 72, 76, 80, 84, 88, 92, 96, 100, 104,
      108, 112, 116, 120, 126, 132, 138, 144, 152, 160, 168, 176, 184, 192, 200, 208,
    ];
    expect(SCALE_MARKS.filter((m) => m >= 40 && m <= 208)).toEqual(maelzel);
    expect(SCALE_MARKS.filter((m) => m < 40)).toEqual([20, 22, 24, 26, 28, 30, 32, 34, 36, 38]);
    expect(SCALE_MARKS.filter((m) => m > 208)).toEqual([
      216, 224, 232, 240, 252, 264, 276, 288, 300,
    ]);
    expect(SCALE_MARKS[0]).toBe(MIN_BPM);
    expect(SCALE_MARKS.at(-1)).toBe(MAX_BPM);
    expect([...SCALE_MARKS].sort((a, b) => a - b)).toEqual(SCALE_MARKS);
  });

  it('puts every mark lower than the last, each on its own line', () => {
    const ys = SCALE_MARKS.map(weightY);
    for (let i = 1; i < ys.length; i++) expect(ys[i]! - ys[i - 1]!).toBeGreaterThan(0.5);
  });

  it('labels a subset of the marks with room between the numbers', () => {
    for (const [labels, size] of [
      [SCALE_LABELS, LABEL_SIZE],
      [SCALE_LABELS_NARROW, LABEL_SIZE_NARROW],
    ] as const) {
      for (const mark of labels) expect(SCALE_MARKS).toContain(mark);
      const ys = labels.map(weightY);
      for (let i = 1; i < ys.length; i++)
        expect(ys[i]! - ys[i - 1]!).toBeGreaterThanOrEqual(size * 1.15);
    }
    for (const mark of SCALE_LABELS_NARROW) expect(SCALE_LABELS).toContain(mark);
    expect(SCALE_LABELS[0]).toBe(MIN_BPM);
    expect(SCALE_LABELS.at(-1)).toBe(MAX_BPM);
  });

  it('engraves the Italian marks on the plate, apart, and clear of the rod', () => {
    for (let i = 1; i < TEMPO_BANDS.length; i++)
      expect(TEMPO_BANDS[i]!.y - TEMPO_BANDS[i - 1]!.y).toBeGreaterThan(BAND_SIZE * 1.2);
    for (const band of TEMPO_BANDS) {
      const right = BAND_X + band.word.length * BAND_ADVANCE;
      // Clear of the engraved frame line (2 inside the plate's edge).
      expect(right).toBeLessThan(CX + plateHalf(band.y - BAND_SIZE / 2) - 2.5);
      expect(band.top).toBeLessThan(band.bottom);
    }
    expect(TEMPO_BANDS[0]!.top).toBe(weightY(MIN_BPM));
    expect(TEMPO_BANDS.at(-1)!.bottom).toBe(weightY(MAX_BPM));
  });
});

describe('the weight', () => {
  it('sits higher for a slower tempo, as the physics of the pendulum places it', () => {
    let previous = -Infinity;
    for (let bpm = MIN_BPM; bpm <= MAX_BPM; bpm++) {
      const y = weightY(bpm);
      expect(y).toBeGreaterThan(previous);
      previous = y;
    }
    expect(weightY(10)).toBe(weightY(MIN_BPM));
    expect(weightY(400)).toBe(weightY(MAX_BPM));
  });

  it('is placed where the pendulum beats that tempo', () => {
    for (const bpm of [20, 21, 37, 60, 97, 120, 208, 241, 300]) {
      const x = PIVOT_Y - weightY(bpm) - WEIGHT_H / 2;
      expect(tempoAt(x)).toBeCloseTo(bpm, 6);
    }
  });

  it('crowds the slow marks near the top of the rod, as the swing nears its balance', () => {
    const gap = (a: number, b: number) => weightY(b) - weightY(a);
    expect(gap(20, 22)).toBeLessThan(gap(40, 42));
    expect(gap(40, 42)).toBeLessThan(gap(200, 208));
    expect(gap(200, 208)).toBeLessThan(gap(288, 300));
  });

  it('stays on the rod, clear of the plate’s top and of the pivot', () => {
    expect(weightY(MIN_BPM)).toBeGreaterThan(RECESS_TOP + 6);
    expect(weightY(MIN_BPM)).toBeGreaterThan(ROD_TOP);
    expect(weightY(MAX_BPM) + WEIGHT_H).toBeLessThan(PIVOT_Y - 5);
  });
});

describe('the swing', () => {
  it('is wider than the case, and stays inside the drawing', () => {
    // The rod's top, and the weight's outer corner at its highest.
    const tip = CX + ROD_LENGTH * Math.sin(rad(AMPLITUDE)) + 2;
    const r = PIVOT_Y - weightY(MIN_BPM);
    const corner =
      CX + r * Math.sin(rad(AMPLITUDE)) + WEIGHT_BOTTOM_HALF * Math.cos(rad(AMPLITUDE));
    const tipY = PIVOT_Y - ROD_LENGTH * Math.cos(rad(AMPLITUDE));
    expect(tip - 2).toBeGreaterThan(CX + caseHalf(tipY) + 20);
    expect(tip).toBeLessThan(VIEW_W - 8);
    expect(corner).toBeLessThan(VIEW_W - 8);
    expect(AMPLITUDE).toBeGreaterThan(24);
  });
});
