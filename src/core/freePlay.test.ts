import { describe, expect, it } from 'vitest';
import { activeTime, IDLE_MS } from './activity.ts';
import {
  closeFreePlay,
  MIN_FREE_PLAY_MS,
  stepFreePlay,
  type FreePlayEvent,
  type FreePlaySession,
  type OpenFreePlay,
} from './freePlay.ts';

const T = 1_700_000_000_000;

/** Feeds events in order; returns the recorded sessions and what is still open. */
function run(events: FreePlayEvent[]) {
  let ids = 0;
  let open: OpenFreePlay | null = null;
  const finished: FreePlaySession[] = [];
  const ended: OpenFreePlay[] = [];
  for (const event of events) {
    const step = stepFreePlay(open, event, () => `f${++ids}`);
    open = step.open;
    if (step.finished) finished.push(step.finished);
    if (step.ended) ended.push(step.ended);
  }
  return { open, finished, ended };
}

const on = (ms: number): FreePlayEvent => ({ type: 'note-on', at: T + ms });
const activity = (ms: number): FreePlayEvent => ({ type: 'activity', at: T + ms });
const tick = (ms: number): FreePlayEvent => ({ type: 'tick', at: T + ms });
const stop: FreePlayEvent = { type: 'stop' };

describe('free-play segmentation', () => {
  it('starts on the first note-on and counts notes', () => {
    const { open } = run([on(0), on(1000), activity(1500), on(2000)]);
    expect(open).toEqual({ id: 'f1', startedAt: T, lastActivityAt: T + 2000, notes: 3 });
  });

  it('never starts on a note-off or a pedal change', () => {
    expect(run([activity(0), activity(500), tick(IDLE_MS * 2), stop])).toEqual({
      open: null,
      finished: [],
      ended: [],
    });
  });

  it('ends after 60 s without activity and leaves the idle tail out', () => {
    const { open, finished } = run([on(0), on(20_000), activity(30_000), tick(30_000 + IDLE_MS)]);
    expect(open).toBeNull();
    expect(finished).toEqual([
      { kind: 'free', id: 'f1', startedAt: T, endedAt: T + 30_000, activeMs: 30_000, notes: 2 },
    ]);
  });

  it('stays open at 59.999 s of silence', () => {
    const { open, finished } = run([on(0), on(15_000), tick(15_000 + IDLE_MS - 1)]);
    expect(open?.id).toBe('f1');
    expect(finished).toEqual([]);
  });

  it('keeps going while the pedal or releases keep coming', () => {
    const events = [on(0)];
    for (let t = 50_000; t <= 300_000; t += 50_000) events.push(activity(t));
    events.push(tick(300_000 + IDLE_MS));
    expect(run(events).finished[0]).toMatchObject({ activeMs: 300_000, notes: 1 });
  });

  it('starts a new session on a note after an idle gap, even before the tick noticed', () => {
    const { open, finished } = run([on(0), on(15_000), on(15_000 + IDLE_MS)]);
    expect(finished).toEqual([
      { kind: 'free', id: 'f1', startedAt: T, endedAt: T + 15_000, activeMs: 15_000, notes: 2 },
    ]);
    expect(open).toMatchObject({ id: 'f2', startedAt: T + 15_000 + IDLE_MS, notes: 1 });
  });

  it('ends a session on a late note-off without starting another one', () => {
    const { open, finished } = run([on(0), on(12_000), activity(12_000 + IDLE_MS)]);
    expect(open).toBeNull();
    expect(finished[0]).toMatchObject({ activeMs: 12_000 });
  });

  it('does not record sessions shorter than 10 s, but still reports them as ended', () => {
    const short = run([on(0), on(MIN_FREE_PLAY_MS - 1), stop]);
    expect(short.finished).toEqual([]);
    expect(short.ended).toHaveLength(1);
    const exact = run([on(0), on(MIN_FREE_PLAY_MS), stop]);
    expect(exact.finished[0]).toMatchObject({ activeMs: MIN_FREE_PLAY_MS });
  });

  it('ends when Play is left, the tab is hidden or the page closes (stop)', () => {
    const { open, finished } = run([on(0), on(25_000), stop, stop]);
    expect(open).toBeNull();
    expect(finished).toEqual([
      { kind: 'free', id: 'f1', startedAt: T, endedAt: T + 25_000, activeMs: 25_000, notes: 2 },
    ]);
  });

  it('a single note is never a session', () => {
    expect(run([on(0), tick(IDLE_MS)]).finished).toEqual([]);
  });

  it('ignores events that arrive out of order', () => {
    const { open } = run([on(10_000), on(9_000)]);
    expect(open).toMatchObject({ lastActivityAt: T + 10_000, notes: 2 });
  });
});

describe('closeFreePlay', () => {
  it('finalizes a saved session from its last activity', () => {
    expect(closeFreePlay({ id: 'x', startedAt: T, lastActivityAt: T + 45_000, notes: 80 })).toEqual(
      { kind: 'free', id: 'x', startedAt: T, endedAt: T + 45_000, activeMs: 45_000, notes: 80 },
    );
    expect(
      closeFreePlay({ id: 'x', startedAt: T, lastActivityAt: T + 9_999, notes: 3 }),
    ).toBeNull();
  });
});

describe('activeTime', () => {
  it('adds the gaps and caps each one at the idle limit', () => {
    expect(activeTime([0, 1000, 3000])).toBe(3000);
    expect(activeTime([0, 1000, 1000 + 5 * IDLE_MS, 1000 + 5 * IDLE_MS + 500])).toBe(
      1000 + IDLE_MS + 500,
    );
    expect(activeTime([])).toBe(0);
    expect(activeTime([42])).toBe(0);
    expect(activeTime([10, 5])).toBe(0);
  });
});
