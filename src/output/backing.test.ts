import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backingBar, improvPlan, type ImprovSpec } from '../core/improv.ts';
import {
  BACKING_LEAD_MS,
  BACKING_QUEUE_AHEAD_MS,
  backingClicks,
  createBackingRun,
  type BackingEnd,
  type BackingRunOptions,
} from './backing.ts';
import { createClickTrack } from './click.ts';
import type { InterruptReason } from './output.ts';
import { createScheduler } from './scheduler.ts';
import { fakeClock, FakeAudioContext, FakePort } from './testing.ts';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const spec = (patch: Partial<ImprovSpec> = {}): ImprovSpec => ({
  backing: 'blues',
  key: 'C',
  scale: 'blues',
  pattern: 'shuffle',
  feel: 'swing',
  bpm: 120,
  call: false,
  seed: 3,
  ...patch,
});

function setup(patch: Partial<ImprovSpec> = {}, options: Partial<BackingRunOptions> = {}) {
  const clock = fakeClock(10_000);
  const port = new FakePort();
  const scheduler = createScheduler({ clock });
  scheduler.setPort(port);
  const context = new FakeAudioContext(10_000);
  const clicks = createClickTrack(context, clock);
  const plan = improvPlan(spec(patch));
  const ends: BackingEnd[] = [];
  let interrupt: ((reason: InterruptReason) => void) | null = null;
  const run = createBackingRun({
    plan,
    level: 60,
    channel: 1,
    scheduler,
    clock,
    clicks,
    click: true,
    countIn: true,
    onInterrupt: (listener) => {
      interrupt = listener;
      return () => (interrupt = null);
    },
    onEnd: (reason) => ends.push(reason),
    ...options,
  });
  const advance = (ms: number) => {
    for (let t = 0; t < ms; t += 5) {
      clock.advance(5);
      context.currentTime = (clock.now() - 10_000) / 1000;
    }
  };
  /** Note-ons sent, as `[channel, key, velocity, ms from time 0]`. */
  const ons = (origin: number) =>
    port.sent
      .filter((s) => (s.data[0]! & 0xf0) === 0x90)
      .map((s) => [s.data[0]! & 0x0f, s.data[1], s.data[2], Math.round(s.time! - origin)]);
  return { clock, port, context, run, plan, ends, advance, ons, interrupt: () => interrupt };
}

describe('backing clicks', () => {
  it('counts in a bar, then clicks every beat with the 1 accented, or only the count-in', () => {
    const plan = improvPlan(spec({ bpm: 60 }));
    const all = backingClicks(plan, 5000, true, true)(-Infinity, 5000 + 5000);
    expect(all.map((c) => `${c.time - 5000}${c.accent ? '!' : ''}`)).toEqual([
      '-4000!',
      '-3000',
      '-2000',
      '-1000',
      '0!',
      '1000',
      '2000',
      '3000',
      '4000!',
    ]);
    expect(backingClicks(plan, 5000, true, false)(-Infinity, 100_000)).toHaveLength(4);
    expect(backingClicks(plan, 5000, false, false)(-Infinity, 100_000)).toEqual([]);
    expect(backingClicks(plan, 5000, true, true)(7000, 8000).map((c) => c.time)).toEqual([7000]);
  });
});

describe('backing run', () => {
  it('counts in, then plays the loop bar by bar, a second ahead, on its own channel', () => {
    const { run, advance, ons, context, plan } = setup();
    const origin = run.start();
    expect(origin).toBe(10_000 + BACKING_LEAD_MS + 2000);
    expect(run.getState()).toBe('counting');
    expect(run.beat()).toBe(-5);
    advance(BACKING_LEAD_MS + 2000 + 10);
    expect(run.getState()).toBe('playing');
    expect(run.beat()).toBe(0);
    // Nothing more than the scheduler's lookahead is handed over: the first beat's shuffle.
    expect(ons(origin)).toEqual([
      [1, 48, 60, 0],
      [1, 55, 60, 0],
    ]);
    // The count-in's four clicks and the first beat's, on the context.
    expect(context.started.length).toBe(5);
    // Thirty seconds on, the loop is still going round, as the plan has it.
    advance(30_000);
    const bar = Math.floor(30_000 / plan.barMs);
    const expected = backingBar(plan, bar, 60).map((n) => [
      1,
      n.midi,
      n.velocity,
      Math.round(n.on),
    ]);
    const sent = ons(origin).filter(
      ([, , , at]) => at! >= bar * plan.barMs && at! < (bar + 1) * plan.barMs,
    );
    expect(sent).toEqual(
      expected.filter(([, , , at]) => at! < 30_010).sort((a, b) => a[3]! - b[3]! || a[1]! - b[1]!),
    );
  });

  it('plays the calls of call and response, and nothing of the answers', () => {
    const { run, advance, ons, plan } = setup({ call: true });
    const origin = run.start();
    advance(BACKING_LEAD_MS + 2000 + 4 * plan.barMs);
    const above = ons(origin).filter(([, key]) => key! >= 60);
    expect(above.filter(([, , , at]) => at! < 2 * plan.barMs).length).toBeGreaterThan(3);
    // The answer's two bars are the player's; the next call follows them.
    expect(above.filter(([, , , at]) => at! >= 2 * plan.barMs && at! < 4 * plan.barMs)).toEqual([]);
    expect(above.some(([, , , at]) => at! >= 4 * plan.barMs)).toBe(true);
  });

  it('stops: silences the instrument and the click, and says so', () => {
    const { run, advance, port, ends, context } = setup();
    run.start();
    advance(3000);
    const sent = port.sent.length;
    run.stop();
    expect(run.getState()).toBe('stopped');
    expect(ends).toEqual(['stopped']);
    expect(
      port
        .log()
        .slice(sent)
        .some((l) => l.startsWith('cc 123')),
    ).toBe(true);
    expect(context.cancelled).toBeGreaterThan(0);
    advance(5000);
    expect(port.sent.filter((s) => (s.data[0]! & 0xf0) === 0x90).length).toBe(
      port.sent.slice(0, sent).filter((s) => (s.data[0]! & 0xf0) === 0x90).length,
    );
  });

  it('ends when sound is cut from outside, without silencing again', () => {
    const { run, advance, port, ends, interrupt } = setup();
    run.start();
    advance(3000);
    const sent = port.sent.length;
    interrupt()!('hidden');
    expect(ends).toEqual(['interrupted']);
    expect(port.sent.length).toBe(sent);
    expect(interrupt()).toBeNull();
  });

  it('plays a take back with its backing from time 0, and stops after it', () => {
    const { run, advance, ons, ends, plan } = setup(
      {},
      {
        countIn: false,
        click: false,
        until: 3000,
        extra: [
          { midi: 72, velocity: 90, on: 0, off: 400 },
          { midi: 75, velocity: 70, on: 2500, off: 3400 },
        ],
      },
    );
    const origin = run.start();
    expect(origin).toBe(10_000 + BACKING_LEAD_MS);
    advance(BACKING_LEAD_MS + 3000 + BACKING_QUEUE_AHEAD_MS);
    const sent = ons(origin);
    expect(sent.filter(([channel]) => channel === 0)).toEqual([
      [0, 72, 90, 0],
      [0, 75, 70, 2500],
    ]);
    // The backing stops where the take does.
    expect(Math.max(...sent.filter(([c]) => c === 1).map(([, , , at]) => at!))).toBeLessThan(3000);
    expect(sent.some(([c, , , at]) => c === 1 && at! >= plan.barMs)).toBe(true);
    advance(2000);
    expect(ends).toEqual(['done']);
  });
});
