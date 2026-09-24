import { describe, expect, it } from 'vitest';
import { IDLE_MS } from '../../core/activity.ts';
import type { OpenFreePlay } from '../../core/freePlay.ts';
import type { SessionRecord } from '../../core/log.ts';
import type { HubEvent } from '../../input/index.ts';
import { createFreePlayTracker, FREE_PLAY_SAVE_MS, FREE_PLAY_TICK_MS } from './freePlayTracker.ts';

const T = 1_700_000_000_000;

function setup() {
  let now = T;
  let visible = true;
  let ids = 0;
  const listeners = new Set<(event: HubEvent) => void>();
  const intervals = new Map<number, { run: () => void; ms: number; due: number }>();
  let nextInterval = 1;
  const recorded: SessionRecord[] = [];
  const saved: OpenFreePlay[] = [];
  const ended: string[] = [];

  const tracker = createFreePlayTracker({
    onHubEvent: (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    practice: {
      saveOpenFreePlay: (open) => void saved.push(open),
      finishFreePlay: (id, session) => {
        ended.push(id);
        if (session) recorded.push(session);
      },
    },
    isVisible: () => visible,
    now: () => now,
    newId: () => `f${++ids}`,
    setInterval: (run, ms) => {
      intervals.set(nextInterval, { run, ms, due: now + ms });
      return nextInterval++;
    },
    clearInterval: (id) => void intervals.delete(id),
  });

  /** Moves the clock, firing intervals as they come due. */
  const wait = (ms: number) => {
    const end = now + ms;
    for (;;) {
      const next = [...intervals.values()].sort((a, b) => a.due - b.due)[0];
      if (!next || next.due > end) break;
      now = next.due;
      next.due += next.ms;
      next.run();
    }
    now = end;
  };
  const emit = (event: HubEvent) => {
    for (const listener of [...listeners]) listener(event);
  };
  const note = () => emit({ type: 'on', midi: 60, velocity: 80, time: 0 });
  const release = () => emit({ type: 'off', midi: 60, velocity: 0, time: 0 });
  const pedal = (down: boolean) => emit({ type: 'sustain', down, time: 0 });

  return {
    tracker,
    recorded,
    saved,
    ended,
    intervals,
    listeners,
    wait,
    note,
    release,
    pedal,
    hide: () => (visible = false),
    show: () => (visible = true),
  };
}

describe('free-play tracker', () => {
  it('records a session once 60 s pass without activity, up to the last activity', () => {
    const t = setup();
    t.note();
    t.wait(10_000);
    t.release();
    t.wait(10_000);
    t.pedal(true);
    t.wait(IDLE_MS - 1);
    expect(t.recorded).toEqual([]);
    t.wait(FREE_PLAY_TICK_MS);
    expect(t.recorded).toEqual([
      { kind: 'free', id: 'f1', startedAt: T, endedAt: T + 20_000, activeMs: 20_000, notes: 1 },
    ]);
    expect(t.intervals.size).toBe(0);
  });

  it('drops a session shorter than 10 s', () => {
    const t = setup();
    t.note();
    t.wait(9_000);
    t.note();
    t.wait(IDLE_MS + FREE_PLAY_TICK_MS);
    expect(t.recorded).toEqual([]);
    expect(t.ended).toEqual(['f1']);
    expect(t.tracker.getOpen()).toBeNull();
  });

  it('saves a running session every 10 s and finishes it in one step when it ends', () => {
    const t = setup();
    t.note();
    for (let i = 0; i < 20; i++) {
      t.wait(4_000);
      t.note();
    }
    // Saved at 10, 20, … 80 s with the notes played before each save.
    expect(t.saved.map((s) => s.notes)).toEqual([3, 5, 8, 10, 13, 15, 18, 20]);
    expect(t.saved.every((s) => s.id === 'f1')).toBe(true);
    t.tracker.end();
    expect(t.recorded).toEqual([
      expect.objectContaining({ id: 'f1', activeMs: 80_000, notes: 21 }),
    ]);
    expect(t.ended).toEqual(['f1']);
  });

  it('does not count notes while the tab is hidden, and hiding ends the session', () => {
    const t = setup();
    t.note();
    t.wait(15_000);
    t.note();
    t.hide();
    t.tracker.end(); // what useFreePlay does on visibilitychange → hidden
    t.wait(1_000);
    t.note();
    t.wait(20_000);
    t.note();
    expect(t.tracker.getOpen()).toBeNull();
    expect(t.recorded).toEqual([expect.objectContaining({ activeMs: 15_000, notes: 2 })]);
    t.show();
    t.note();
    expect(t.tracker.getOpen()).toMatchObject({ id: 'f2', notes: 1 });
  });

  it('ends the session and stops listening when disposed (leaving Play)', () => {
    const t = setup();
    t.note();
    t.wait(12_000);
    t.note();
    t.tracker.dispose();
    expect(t.recorded).toEqual([expect.objectContaining({ activeMs: 12_000 })]);
    expect(t.listeners.size).toBe(0);
    expect(t.intervals.size).toBe(0);
    t.tracker.dispose();
    expect(t.recorded).toHaveLength(1);
  });

  it('never starts on the pedal alone', () => {
    const t = setup();
    t.pedal(true);
    t.pedal(false);
    expect(t.tracker.getOpen()).toBeNull();
    expect(t.intervals.size).toBe(0);
  });

  it('does not save again while nothing changed', () => {
    const t = setup();
    t.note();
    t.wait(1_000);
    t.note();
    t.wait(FREE_PLAY_SAVE_MS * 4);
    expect(t.saved).toHaveLength(1);
  });
});
