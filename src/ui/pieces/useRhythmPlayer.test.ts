import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../core/metronomeSettings.ts';
import { performanceOrder } from '../../core/repeats.ts';
import { rhythmPlan } from '../../core/rhythm.ts';
import { buildSteps } from '../../core/score.ts';
import { bars, note, Q, score } from '../../core/scoreFixtures.ts';
import { createMetronome } from '../../output/metronome.ts';
import { createScheduler } from '../../output/scheduler.ts';
import { fakeClock, FakeAudioContext } from '../../output/testing.ts';
import { createRhythmPlayer } from './useRhythmPlayer.ts';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup() {
  const clock = fakeClock(10_000);
  const context = new FakeAudioContext(10_000);
  const metronome = createMetronome({ clock, context: () => context, settings: DEFAULT_SETTINGS });
  const s = score(bars(1), [note(0, 0, Q, 60)], [{ tick: 0, bpm: 60 }]);
  const order = performanceOrder(s.measures);
  const steps = buildSteps(s, 'right', order);
  const plan = rhythmPlan({ score: s, order, steps, loop: null, startBar: 0, scale: 1 })!;
  const ends: string[] = [];
  const player = createRhythmPlayer(
    createScheduler({ clock }),
    () => () => undefined,
    () => metronome.block('rhythm'),
  );
  const start = () =>
    player.start({
      plan,
      backing: null,
      velocity: 60,
      clickMode: 'off',
      volume: 70,
      latency: 0,
      onSettled: () => undefined,
      onEnd: (reason) => ends.push(reason),
    });
  return { metronome, player, start, ends };
}

describe('a rhythm run and the metronome', () => {
  it('pauses the metronome and keeps it paused until the run ends', () => {
    const { metronome, player, start, ends } = setup();
    metronome.start();
    start();
    expect(metronome.getSnapshot()).toMatchObject({
      status: 'paused',
      pausedBy: 'rhythm',
      blockedBy: 'rhythm',
    });
    metronome.start();
    expect(metronome.getSnapshot().status).toBe('paused');
    player.stop();
    expect(ends).toEqual(['stopped']);
    expect(metronome.getSnapshot()).toMatchObject({ status: 'paused', blockedBy: null });
    metronome.start();
    expect(metronome.getSnapshot().status).toBe('running');
  });

  it('a new run releases the previous one’s hold before taking its own', () => {
    const { metronome, player, start } = setup();
    start();
    start();
    player.stop();
    expect(metronome.getSnapshot().blockedBy).toBeNull();
  });
});
