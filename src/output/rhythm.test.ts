import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { demoPlan, otherHand } from '../core/playback.ts';
import { performanceOrder } from '../core/repeats.ts';
import { rhythmPlan, type StepTiming } from '../core/rhythm.ts';
import { buildSteps, type Score } from '../core/score.ts';
import { bars, note, Q, score } from '../core/scoreFixtures.ts';
import { createClickTrack } from './click.ts';
import type { InterruptReason } from './output.ts';
import { clickSource, createRhythmRun, RHYTHM_LEAD_MS, type RhythmEnd } from './rhythm.ts';
import { createScheduler } from './scheduler.ts';
import { fakeClock, FakeAudioContext, FakePort } from './testing.ts';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** ♩ = 60. Right hand: C D E F quarters in each bar; left hand: a C3 half note on beats 1 and 3. */
function piece(count = 2): Score {
  const notes = [];
  for (let b = 0; b < count; b++) {
    [60, 62, 64, 65].forEach((midi, k) => notes.push(note(b, (b * 4 + k) * Q, Q, midi)));
    notes.push(note(b, b * 4 * Q, 2 * Q, 48, 'left'), note(b, (b * 4 + 2) * Q, 2 * Q, 43, 'left'));
  }
  return score(bars(count), notes, [{ tick: 0, bpm: 60 }]);
}

function plans(s: Score, loop: { from: number; to: number } | null = null, startBar = 0) {
  const order = performanceOrder(s.measures);
  const steps = buildSteps(s, 'right', order);
  const options = { score: s, order, steps, loop, startBar, scale: 1 };
  return {
    plan: rhythmPlan(options)!,
    backing: demoPlan({ ...options, hands: 'right', include: otherHand('right') }),
  };
}

function setup(options: { loop?: { from: number; to: number }; latency?: number } = {}) {
  const clock = fakeClock(10_000);
  const port = new FakePort();
  const scheduler = createScheduler({ clock });
  scheduler.setPort(port);
  const context = new FakeAudioContext(10_000);
  const clicks = createClickTrack(context, clock);
  const { plan, backing } = plans(piece(), options.loop ?? null);
  const settled: StepTiming[] = [];
  const ends: RhythmEnd[] = [];
  let interrupt: ((reason: InterruptReason) => void) | null = null;
  const run = createRhythmRun({
    plan,
    backing,
    velocity: 60,
    scheduler,
    clock,
    clicks,
    clickMode: 'on',
    latency: options.latency ?? 0,
    onInterrupt: (listener) => {
      interrupt = listener;
      return () => (interrupt = null);
    },
    onSettled: (list) => settled.push(...list),
    onEnd: (reason) => ends.push(reason),
  });
  const advance = (ms: number) => {
    for (let t = 0; t < ms; t += 5) {
      clock.advance(5);
      context.currentTime = (clock.now() - 10_000) / 1000;
    }
  };
  return { clock, port, context, run, plan, settled, ends, advance, interrupt: () => interrupt };
}

describe('clickSource', () => {
  it('gives the count-in, then every round’s clicks, as the mode asks', () => {
    const { plan } = plans(piece(1), { from: 0, to: 0 });
    const all = clickSource(plan, 1000, 'on')(-Infinity, 1000 + 8000);
    expect(all.map((c) => `${c.time - 1000}${c.accent ? '!' : ''}`)).toEqual([
      '-4000!',
      '-3000',
      '-2000',
      '-1000',
      '0!',
      '1000',
      '2000',
      '3000',
      '4000!',
      '5000',
      '6000',
      '7000',
    ]);
    expect(clickSource(plan, 1000, 'countIn')(-Infinity, 9000)).toHaveLength(4);
    expect(clickSource(plan, 1000, 'off')(-Infinity, 9000)).toEqual([]);
    // Only what falls in the window asked for.
    expect(clickSource(plan, 1000, 'on')(5000, 6000).map((c) => c.time)).toEqual([5000]);
  });

  it('the first round starts at the start bar; without a loop there is one round', () => {
    const { plan } = plans(piece(2), null, 1);
    const times = clickSource(plan, 0, 'on')(-Infinity, 100_000).map((c) => c.time);
    expect(times).toEqual([0, 1000, 2000, 3000, 4000, 5000, 6000, 7000]);
  });
});

describe('rhythm run', () => {
  it('counts in one bar, clicks in time and plays the other hand from the timeline', () => {
    const { run, port, context, advance } = setup();
    const origin = run.start();
    // Four count-in beats from 200 ms after Start; the first bar at origin.
    expect(origin).toBe(10_000 + RHYTHM_LEAD_MS + 4000);
    expect(run.getState()).toBe('counting');
    advance(1100);
    expect(run.countBeat()).toBe(1);
    advance(1000);
    expect(run.countBeat()).toBe(2);
    advance(3000);
    expect(run.getState()).toBe('playing');
    // 900 ms into the bar: beat 2 is still more than the lookahead away.
    expect(context.started.map((s) => Math.round(s.when * 1000) + 10_000 - origin)).toEqual([
      -4000, -3000, -2000, -1000, 0,
    ]);
    // The left hand, sent with timestamps on the run's clock, not when keys are pressed.
    expect(port.log().filter((l) => l.startsWith('on'))).toEqual([`on 48 v60@${origin}`]);
    advance(2000);
    expect(port.log().filter((l) => l.startsWith('on'))).toEqual([
      `on 48 v60@${origin}`,
      `on 43 v60@${origin + 2000}`,
    ]);
    expect(run.currentStep()).toBe(2); // 2.9 s in: beat 3
  });

  it('judges each note against the plan, the latency taken off', () => {
    const { run, advance, settled, clock } = setup({ latency: 30 });
    const origin = run.start();
    advance(origin - clock.now());
    // 40 ms late after the 30 ms latency, then 10 ms early.
    expect(run.press(60, origin + 70)).toMatchObject({ kind: 'hit', deviation: 40 });
    advance(1000);
    expect(run.press(62, origin + 1020)).toMatchObject({ kind: 'hit', deviation: -10 });
    expect(run.press(70, origin + 1200)).toEqual({ kind: 'extra', midi: 70 });
    advance(1000);
    expect(settled.map((t) => [t.step, t.notes[0]!.deviation, t.extra])).toEqual(
      [
        [0, 40],
        [1, -10, 1],
      ].map(([step, dev, extra = 0]) => [step, dev, extra]),
    );
  });

  it('ends by itself after the last step, letting the notes ring', () => {
    const { run, advance, ends, settled, port, clock } = setup();
    const origin = run.start();
    advance(origin - clock.now() + 8000 + 200);
    expect(ends).toEqual(['done']);
    expect(settled).toHaveLength(8);
    expect(settled.every((t) => t.notes[0]!.deviation === null)).toBe(true);
    expect(port.log().some((l) => l.startsWith('cc'))).toBe(false);
    expect(run.getState()).toBe('stopped');
  });

  it('stop silences at once and settles what was due', () => {
    const { run, advance, ends, settled, port, clock, context } = setup();
    const origin = run.start();
    advance(origin - clock.now() + 1500);
    run.press(60, origin + 5);
    run.stop();
    expect(ends).toEqual(['stopped']);
    expect(settled.map((t) => t.step)).toEqual([0, 1]);
    expect(port.log().filter((l) => l.startsWith('cc 123'))).toHaveLength(16);
    const count = context.started.length;
    advance(3000);
    expect(context.started).toHaveLength(count);
    expect(run.press(62, clock.now())).toEqual({ kind: 'ignored' });
  });

  it('a loop goes round, the other hand queued a round ahead, until stopped', () => {
    const { run, advance, settled, port, clock } = setup({ loop: { from: 0, to: 0 } });
    const origin = run.start();
    for (let round = 0; round < 3; round++) {
      [60, 62, 64, 65].forEach((midi, k) => run.press(midi, origin + round * 4000 + k * 1000 + 15));
    }
    advance(origin - clock.now() + 12_000);
    expect(settled.filter((t) => t.round < 3).every((t) => t.notes[0]!.deviation === 15)).toBe(
      true,
    );
    expect(settled.filter((t) => t.round < 3)).toHaveLength(12);
    const lefts = port.log().filter((l) => l.startsWith('on 48'));
    expect(lefts.slice(0, 3)).toEqual([0, 1, 2].map((r) => `on 48 v60@${origin + r * 4000}`));
    run.stop();
  });

  it('an interrupt from the output (a hidden page, another route) ends the run', () => {
    const { run, advance, ends, interrupt } = setup();
    run.start();
    advance(500);
    interrupt()!('hidden');
    expect(ends).toEqual(['interrupted']);
    expect(interrupt()).toBeNull();
  });
});
