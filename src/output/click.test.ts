import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLICK_LOOKAHEAD_MS, createClickTrack, type ClickEvent } from './click.ts';
import { fakeClock, FakeAudioContext } from './testing.ts';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** A click every 500 ms from `first`, every fourth accented. */
const every500 =
  (first: number) =>
  (from: number, to: number): ClickEvent[] => {
    const out: ClickEvent[] = [];
    for (let i = 0; i < 100; i++) {
      const time = first + i * 500;
      if (time >= from && time < to) out.push({ time, accent: i % 4 === 0 });
    }
    return out;
  };

function setup() {
  // Context time 0 is performance time 10 000; it runs with the clock (and has just started).
  const clock = fakeClock(10_005);
  const context = new FakeAudioContext(10_000);
  const sync = () => (context.currentTime = (clock.now() - 10_000) / 1000);
  sync();
  const scheduled: { time: number; when: number; ahead: number }[] = [];
  const track = createClickTrack(context, clock, {
    onScheduled: (click, when) =>
      scheduled.push({ time: click.time, when, ahead: click.time - clock.now() }),
  });
  const advance = (ms: number) => {
    for (let t = 0; t < ms; t += 5) {
      clock.advance(5);
      sync();
    }
  };
  return { clock, context, track, scheduled, advance };
}

describe('click track', () => {
  it('schedules each click on the audio clock, at most the lookahead ahead, accents higher', () => {
    const { context, track, scheduled, advance } = setup();
    track.start(every500(10_200));
    advance(2000);
    expect(scheduled.map((s) => s.time)).toEqual([10_200, 10_700, 11_200, 11_700]);
    expect(context.started.map((s) => Math.round(s.when * 1000))).toEqual([200, 700, 1200, 1700]);
    for (const s of scheduled) {
      expect(s.ahead).toBeGreaterThan(0);
      expect(s.ahead).toBeLessThanOrEqual(CLICK_LOOKAHEAD_MS);
    }
    const [accent, plain] = context.started;
    expect(accent!.frequency).toBeGreaterThan(plain!.frequency);
    expect(accent!.peak).toBeGreaterThan(plain!.peak);
  });

  it('follows the output latency the context reports through its timestamps', () => {
    const { context, track, advance } = setup();
    // The context says its output runs 40 ms behind: a click for 10 500 goes in 40 ms earlier.
    context.getOutputTimestamp = () => ({
      contextTime: context.currentTime - 0.04,
      performanceTime: 10_000 + context.currentTime * 1000,
    });
    track.start(every500(10_500));
    advance(600);
    expect(Math.round(context.started[0]!.when * 1000)).toBe(460);
  });

  it('stops: nothing more is scheduled and what is waiting is cancelled', () => {
    const { context, track, advance } = setup();
    track.start(every500(10_050));
    advance(10);
    expect(context.started).toHaveLength(1);
    track.stop();
    expect(context.cancelled).toBe(1);
    advance(3000);
    expect(context.started).toHaveLength(1);
  });

  it('skips a click found too late, rather than playing it late', () => {
    const { clock, context, track } = setup();
    track.start(() => []);
    clock.set(10_300);
    context.currentTime = 0.3;
    track.start(every500(10_250));
    expect(context.started.map((s) => Math.round(s.when * 1000))).toEqual([]);
  });

  it('waits for a new context’s output timestamps before scheduling', () => {
    const { clock, context, track, advance } = setup();
    let running = false;
    const real = context.getOutputTimestamp.bind(context);
    context.getOutputTimestamp = () => (running ? real() : { contextTime: 0, performanceTime: 0 });
    track.start(every500(10_300));
    advance(60);
    expect(context.started).toHaveLength(0);
    running = true;
    advance(250);
    expect(context.started.map((s) => Math.round(s.when * 1000))).toEqual([300]);
    expect(clock.now()).toBe(10_315);
  });

  it('plays at the volume set', () => {
    const { context, track, advance } = setup();
    track.setVolume(0.5);
    track.start(every500(10_050));
    advance(10);
    expect(context.started[0]!.peak).toBe(0.5);
    track.setVolume(3);
    track.start(every500(10_100));
    advance(10);
    expect(context.started.at(-1)!.peak).toBe(1);
  });
});
