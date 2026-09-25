import { describe, expect, it } from 'vitest';
import {
  calibrate,
  CALIBRATION_CLICKS,
  CALIBRATION_DISCARD,
  CALIBRATION_INTERVAL_MS,
  CALIBRATION_MAX_SPREAD_MS,
  calibrationClicks,
} from './calibration.ts';

const clicks = calibrationClicks(10_000);
const tapsAt = (offset: (i: number) => number | null) =>
  clicks.flatMap((c, i) => {
    const off = offset(i);
    return off === null ? [] : [c + off];
  });

describe('calibrate', () => {
  it('16 clicks at ♩ = 90', () => {
    expect(clicks).toHaveLength(CALIBRATION_CLICKS);
    expect(CALIBRATION_INTERVAL_MS).toBeCloseTo(666.667, 2);
    expect(clicks[15]! - clicks[0]!).toBeCloseTo(10_000, 6);
  });

  it('takes the median offset of the taps after the first four', () => {
    // Finding the beat: the first four are wild and do not count.
    const taps = tapsAt((i) => (i < CALIBRATION_DISCARD ? 250 : [30, 35, 40, 45, 25][i % 5]!));
    const result = calibrate(clicks, taps);
    // 25 25 25 30 30 30 | 35 35 40 40 45 45
    expect(result).toMatchObject({ ok: true, offset: 32.5, taps: 12 });
  });

  it('shrugs off a stray tap and a missed click', () => {
    const taps = tapsAt((i) => (i === 9 ? null : 42 + (i % 3)));
    taps.push(clicks[6]! + 300); // a second, stray tap near click 6 (first tap per click counts)
    taps.push(clicks[12]! - 10); // an extra tap: the earlier one of the two counts
    const result = calibrate(clicks, taps);
    expect(result.ok).toBe(true);
    expect(result.ok && result.offset).toBe(43);
  });

  it('asks to try again when the taps are too uneven', () => {
    const taps = tapsAt((i) => (i % 2 === 0 ? -40 : 60));
    const result = calibrate(clicks, taps);
    expect(result).toMatchObject({ ok: false, reason: 'uneven' });
    expect(!result.ok && result.reason === 'uneven' && result.spread).toBeGreaterThan(
      CALIBRATION_MAX_SPREAD_MS,
    );
    // Just inside the limit is accepted.
    expect(
      calibrate(
        clicks,
        tapsAt((i) => (i % 2 === 0 ? 0 : CALIBRATION_MAX_SPREAD_MS)),
      ).ok,
    ).toBe(true);
  });

  it('asks to try again with too few taps; taps far from any click do not count', () => {
    expect(
      calibrate(
        clicks,
        tapsAt((i) => (i < 11 ? 20 : null)),
      ),
    ).toEqual({
      ok: false,
      reason: 'few',
      taps: 7,
    });
    const last = clicks.at(-1)!;
    const late = [last + CALIBRATION_INTERVAL_MS / 2 + 1, last + 1000, last + 2000];
    expect(calibrate(clicks, late)).toEqual({ ok: false, reason: 'few', taps: 0 });
  });
});
