import { describe, expect, it } from 'vitest';
import { createPulse, rampTempo, type PulseClick, type PulseConfig } from './pulse.ts';

const config = (patch: Partial<PulseConfig> = {}): PulseConfig => ({
  bpm: 120,
  beats: 4,
  subdivision: 1,
  accents: ['accent', 'normal', 'normal', 'normal'],
  trainer: { kind: 'off' },
  ...patch,
});

const times = (clicks: PulseClick[]) => clicks.map((c) => c.at);
const beatTimes = (clicks: PulseClick[]) => times(clicks.filter((c) => c.sub === 0));

/** 2^-44: every time in these tests is ≥ 1000 ms, so time × 2^44 is a whole number. */
const SCALE = 2 ** 44;

/**
 * How far `value` is from `origin + num / den` exactly, in units of `value`'s last place, using
 * integers only (no rounding anywhere).
 */
function ulpsFromExact(value: number, origin: number, num: bigint, den: bigint): number {
  const scaled = BigInt(value * SCALE); // exact: a power-of-two scale of a double
  const exact = BigInt(origin * SCALE) * den + num * BigInt(SCALE);
  const diff = scaled * den - exact;
  const ulp = 2 ** (Math.floor(Math.log2(value)) - 52);
  return Math.abs(Number(diff) / Number(den) / SCALE / ulp);
}

describe('the schedule is exact, however long it runs', () => {
  it.each([
    [120, 1],
    [97, 1],
    [113, 3],
    [37, 4],
    [241, 2],
  ] as const)('10 000 beats at %i BPM, subdivision %i: every click within one ulp', (bpm, s) => {
    const origin = 1000;
    const pulse = createPulse(config({ bpm, subdivision: s }), origin);
    const clicks = pulse.clicks(origin, origin + (10_000 * 60_000) / bpm);
    expect(clicks).toHaveLength(10_000 * s);
    let worst = 0;
    clicks.forEach((c, k) => {
      expect(c.beat * s + c.sub).toBe(k);
      worst = Math.max(worst, ulpsFromExact(c.at, origin, BigInt(k * 60_000), BigInt(bpm * s)));
    });
    // Correctly rounded division, then one addition: never more than one unit in the last place,
    // at beat 10 000 as at beat 1.
    expect(worst).toBeLessThanOrEqual(1);
    // The last beat is where the arithmetic says, not a sum of 10 000 rounded intervals.
    const last = clicks.at(-1 - (s - 1))!;
    expect(last.at - origin).toBeCloseTo(((10_000 - 1) * 60_000) / bpm, 9);
  });

  it('does not depend on how the time is cut into lookahead windows', () => {
    const pulse = createPulse(config({ bpm: 97, subdivision: 3 }), 1000);
    const whole = pulse.clicks(1000, 60_000);
    const pieces: PulseClick[] = [];
    for (let t = 1000; t < 60_000; t += 25)
      pieces.push(...pulse.clicks(t, Math.min(60_000, t + 25)));
    expect(pieces).toEqual(whole);
  });
});

describe('accents and subdivisions', () => {
  it('gives each beat its level; a muted beat mutes its subdivisions too', () => {
    const pulse = createPulse(
      config({ bpm: 60, subdivision: 2, accents: ['accent', 'normal', 'mute', 'normal'] }),
      1000,
    );
    const clicks = pulse.clicks(1000, 5000);
    expect(clicks.map((c) => `${c.at}:${c.level}`)).toEqual([
      '1000:accent',
      '1500:sub',
      '2000:normal',
      '2500:sub',
      '3000:mute',
      '3500:mute',
      '4000:normal',
      '4500:sub',
    ]);
  });

  it('subdivides exactly: triplets at 100 BPM', () => {
    const pulse = createPulse(config({ bpm: 100, subdivision: 3 }), 1000);
    expect(times(pulse.clicks(1000, 1600))).toEqual([1000, 1200, 1400]);
    expect(pulse.clicks(1000, 2200).at(-1)).toMatchObject({ at: 2000, beat: 1, sub: 2 });
  });

  it('counts bars and beats of the bar', () => {
    const pulse = createPulse(config({ bpm: 60, beats: 3, accents: ['accent'] }), 1000);
    const clicks = pulse.clicks(1000, 8000);
    expect(clicks.map((c) => `${c.bar}.${c.inBar}`)).toEqual([
      '0.0',
      '0.1',
      '0.2',
      '1.0',
      '1.1',
      '1.2',
      '2.0',
    ]);
    expect(clicks.filter((c) => c.level === 'accent').map((c) => c.bar)).toEqual([0, 1, 2]);
  });
});

describe('a tempo change', () => {
  it('takes effect on the next beat: the interval under way keeps its length', () => {
    const pulse = createPulse(config({ bpm: 120, subdivision: 2 }), 1000);
    expect(pulse.update({ bpm: 60 }, 2200)).toBe(2500);
    expect(times(pulse.clicks(1000, 5600))).toEqual([
      1000, 1250, 1500, 1750, 2000, 2250, 2500, 3000, 3500, 4000, 4500, 5000, 5500,
    ]);
    expect(pulse.bpmAt(2499)).toBe(120);
    expect(pulse.bpmAt(2500)).toBe(60);
  });

  it('never changes a beat due at the moment it is asked for', () => {
    const pulse = createPulse(config({ bpm: 120 }), 1000);
    // 2000 is a beat; the change comes on the one after it.
    expect(pulse.update({ bpm: 60 }, 2000)).toBe(2500);
  });

  it('keeps the bar going; a new meter starts a bar on the boundary', () => {
    const pulse = createPulse(config({ bpm: 60 }), 1000);
    pulse.update({ bpm: 120 }, 2500); // at beat 2 of bar 0
    const clicks = pulse.clicks(3000, 5000);
    expect(clicks.map((c) => `${c.bar}.${c.inBar}`)).toEqual(['0.2', '0.3', '1.0', '1.1']);

    const meter = createPulse(config({ bpm: 60 }), 1000);
    meter.update({ beats: 3, accents: ['accent', 'normal', 'normal'] }, 2500);
    expect(meter.clicks(3000, 7000).map((c) => `${c.bar}.${c.inBar}:${c.level}`)).toEqual([
      '1.0:accent',
      '1.1:normal',
      '1.2:normal',
      '2.0:accent',
    ]);
  });

  it('before the first beat replaces the settings outright', () => {
    const pulse = createPulse(config({ bpm: 120 }), 1000);
    expect(pulse.update({ bpm: 60 }, 900)).toBe(1000);
    expect(times(pulse.clicks(1000, 3500))).toEqual([1000, 2000, 3000]);
  });

  it('several changes in a row: each from its own boundary, times still exact', () => {
    const pulse = createPulse(config({ bpm: 120 }), 1000);
    pulse.update({ bpm: 90 }, 1100); // boundary 1500
    pulse.update({ bpm: 97 }, 1600); // boundary 1500 + 666.67 = 2166.67
    const clicks = pulse.clicks(1000, 10_000);
    const b = 1500 + 60_000 / 90;
    expect(clicks[2]!.at).toBe(b);
    for (let k = 0; k < 10 && clicks[3 + k]; k++) {
      expect(clicks[3 + k]!.at).toBeCloseTo(b + ((k + 1) * 60_000) / 97, 9);
    }
  });
});

describe('the tempo trainer', () => {
  it('ramps up by whole steps every n bars, then holds the target', () => {
    expect(
      [0, 1, 2, 3, 4, 5, 6, 7, 30].map((bar) =>
        rampTempo({ bar: 0, bpm: 60 }, bar, { to: 70, step: 4, every: 2 }),
      ),
    ).toEqual([60, 60, 64, 64, 68, 68, 70, 70, 70]);
    expect(
      [0, 1, 2, 9].map((bar) =>
        rampTempo({ bar: 0, bpm: 100 }, bar, { to: 90, step: 3, every: 1 }),
      ),
    ).toEqual([100, 97, 94, 90]);
  });

  it('changes tempo on the downbeats, exactly where the previous tempo put them', () => {
    const pulse = createPulse(
      config({ bpm: 60, trainer: { kind: 'ramp', to: 72, step: 4, every: 2 } }),
      1000,
    );
    const downbeats = pulse.clicks(1000, 60_000).filter((c) => c.inBar === 0);
    const bar2 = 1000 + 8 * 1000;
    const bar4 = bar2 + (8 * 60_000) / 64;
    const bar6 = bar4 + (8 * 60_000) / 68;
    expect(downbeats[2]!.at).toBe(bar2);
    expect(downbeats[4]!.at).toBeCloseTo(bar4, 9);
    expect(downbeats[6]!.at).toBeCloseTo(bar6, 9);
    expect(downbeats[7]!.at).toBeCloseTo(bar6 + (4 * 60_000) / 72, 9);
    expect(pulse.bpmAt(bar2 - 1)).toBe(60);
    expect(pulse.bpmAt(bar2)).toBe(64);
    expect(pulse.bpmAt(59_000)).toBe(72);
  });

  it('a tempo set by hand during a ramp becomes its new starting point', () => {
    const pulse = createPulse(
      config({ bpm: 60, trainer: { kind: 'ramp', to: 100, step: 10, every: 1 } }),
      1000,
    );
    // Bar 0 at 60 (4 s), bar 1 at 70 from 5000; set 50 during bar 1.
    const boundary = pulse.update({ bpm: 50 }, 5100);
    expect(boundary).toBeCloseTo(5000 + 60_000 / 70, 9);
    expect(pulse.bpmAt(boundary + 1)).toBe(50);
    // Bar 2 counts from the change: one bar on, one step up.
    const bar2 = pulse.clicks(boundary, boundary + 20_000).find((c) => c.bar === 2)!;
    expect(pulse.bpmAt(bar2.at)).toBe(60);
  });

  it('a change of anything else keeps the ramp where it is', () => {
    const pulse = createPulse(
      config({ bpm: 60, trainer: { kind: 'ramp', to: 100, step: 10, every: 1 } }),
      1000,
    );
    pulse.update({ subdivision: 2 }, 5100);
    expect(pulse.bpmAt(6000)).toBe(70);
    const clicks = pulse.clicks(5100, 20_000);
    const bar2 = clicks.find((c) => c.bar === 2)!;
    const bar3 = clicks.find((c) => c.bar === 3)!;
    expect(pulse.bpmAt(bar2.at)).toBe(80);
    expect(pulse.bpmAt(bar3.at)).toBe(90);
    expect(clicks.find((c) => c.sub === 1)!.at).toBeCloseTo(5000 + 60_000 / 70 + 30_000 / 70, 9);
  });

  it('gap: plays n bars and mutes m, round and round', () => {
    const pulse = createPulse(
      config({ bpm: 240, beats: 2, trainer: { kind: 'gap', play: 2, mute: 1 } }),
      1000,
    );
    const clicks = pulse.clicks(1000, 1000 + 7 * 500);
    const muted = [...new Set(clicks.filter((c) => c.level === 'mute').map((c) => c.bar))];
    expect(muted).toEqual([2, 5]);
    // The schedule itself does not change: silent bars keep time.
    expect(beatTimes(clicks)).toEqual(Array.from({ length: 14 }, (_, i) => 1000 + i * 250));
    expect(pulse.position(1000 + 4 * 250 + 10)!.silent).toBe(true);
    expect(pulse.position(1000 + 6 * 250 + 10)!.silent).toBe(false);
  });
});

describe('position', () => {
  it('is null before the start, then the beat and how far to the next', () => {
    const pulse = createPulse(config({ bpm: 120 }), 1000);
    expect(pulse.position(999)).toBeNull();
    expect(pulse.position(1000)).toMatchObject({ beat: 0, bar: 0, inBar: 0, phase: 0 });
    expect(pulse.position(1125)).toMatchObject({ beat: 0, phase: 0.25, from: 1000, to: 1500 });
    expect(pulse.position(3250)).toMatchObject({ beat: 4, bar: 1, inBar: 0, phase: 0.5 });
  });

  it('runs on smoothly across a tempo change: phase 1 meets phase 0 at the boundary', () => {
    const pulse = createPulse(config({ bpm: 120 }), 1000);
    const boundary = pulse.update({ bpm: 75 }, 1600);
    expect(pulse.position(boundary - 1e-6)!.phase).toBeCloseTo(1, 6);
    expect(pulse.position(boundary)).toMatchObject({ beat: 2, phase: 0, bpm: 75 });
    expect(pulse.position(boundary + 400)!.phase).toBeCloseTo(0.5, 9);
  });

  it('finds its place after a long ramp', () => {
    const pulse = createPulse(
      config({ bpm: 20, trainer: { kind: 'ramp', to: 300, step: 1, every: 1 } }),
      1000,
    );
    const clicks = pulse.clicks(1000, 1000 + 3_600_000);
    for (const c of clicks.filter((_, i) => i % 97 === 0)) {
      expect(pulse.position(c.at)).toMatchObject({ beat: c.beat, phase: 0 });
    }
    expect(pulse.bpmAt(1000 + 3_599_000)).toBe(300);
  });
});
