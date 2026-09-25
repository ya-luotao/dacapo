import { describe, expect, it } from 'vitest';
import { clockOffset, createAudioClock, type AudioClockSource } from './audioClock.ts';

describe('audio clock', () => {
  it('uses the output timestamp: its latency is in the pair already', () => {
    const source: AudioClockSource = {
      currentTime: 10.05,
      outputLatency: 0.04,
      getOutputTimestamp: () => ({ contextTime: 10, performanceTime: 20_030 }),
    };
    expect(clockOffset(source, 20_000)).toBe(10_030);
  });

  it('falls back on currentTime plus the reported latencies', () => {
    const source: AudioClockSource = { currentTime: 10, baseLatency: 0.005, outputLatency: 0.02 };
    expect(clockOffset(source, 20_000)).toBeCloseTo(10_025, 9);
    // A timestamp of zeros (the context not running yet) is no timestamp.
    const zeros = { ...source, getOutputTimestamp: () => ({ contextTime: 0, performanceTime: 0 }) };
    expect(clockOffset(zeros, 20_000)).toBeCloseTo(10_025, 9);
    expect(clockOffset({ currentTime: 10 }, 20_000)).toBe(10_000);
  });

  it('maps both ways with the median of recent readings', () => {
    let reading = 10_000;
    const source: AudioClockSource = {
      currentTime: 0,
      getOutputTimestamp: () => ({ contextTime: 1, performanceTime: 1000 + reading }),
    };
    const clock = createAudioClock(source);
    for (const r of [10_000, 10_002, 9_999, 10_500, 10_001]) {
      reading = r;
      clock.sample(0);
    }
    // One wild reading (10 500) does not move it.
    expect(clock.toPerformance(2)).toBe(2000 + 10_001);
    expect(clock.toContext(12_001)).toBe(2);
  });
});

describe('a context that has only just started', () => {
  it('is not ready until it gives output timestamps, then forgets the estimates', () => {
    let running = false;
    const source: AudioClockSource = {
      currentTime: 0,
      outputLatency: 0.04,
      getOutputTimestamp: () =>
        running
          ? { contextTime: 1, performanceTime: 11_000 }
          : { contextTime: 0, performanceTime: 0 },
    };
    const clock = createAudioClock(source);
    clock.sample(10_000);
    expect(clock.ready()).toBe(false);
    expect(clock.toPerformance(0)).toBe(10_040);
    running = true;
    clock.sample(10_010);
    expect(clock.ready()).toBe(true);
    expect(clock.toPerformance(0)).toBe(10_000);
    // A stray zero reading afterwards changes nothing.
    running = false;
    clock.sample(10_020);
    expect(clock.toPerformance(0)).toBe(10_000);
    expect(createAudioClock({ currentTime: 0 }).ready()).toBe(true);
  });
});
