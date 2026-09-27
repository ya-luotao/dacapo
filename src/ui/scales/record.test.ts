// @vitest-environment jsdom
import { act, createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScaleSession, StoredScaleRun } from '../../core/scaleRecords.ts';
import { scaleNotes } from '../../core/scales.ts';
import type { ScaleExercise } from '../../core/scaleTypes.ts';
import type { PracticeStore } from '../practice/store.ts';
import { RELEASE_WAIT_MS, useScaleRecorder, type SessionSlot } from './record.ts';
import { sessionStep, waitingRun, type RunEvent, type ScaleRunState } from './run.ts';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const EXERCISE: ScaleExercise = { type: 'major', tonic: 'C', octaves: 2, hands: 'right' };
const EXPECTED = scaleNotes(EXERCISE).right;
const T0 = 10_000;

/** The whole scale, evenly, each key let go 20 ms after the next one goes down (legato). */
function playScale(holdLast: boolean): { state: ScaleRunState; lastOff: RunEvent } {
  let state = waitingRun(EXPECTED);
  const step = (e: RunEvent) => (state = sessionStep(state, e));
  EXPECTED.forEach((note, i) => {
    const time = T0 + i * 200;
    step({ type: 'on', midi: note.midi, velocity: 60 + (i % 5), time, at: 1_700_000_000_000 + i });
    if (i > 0) step({ type: 'off', midi: EXPECTED[i - 1]!.midi, time: time + 20 });
  });
  const lastOff: RunEvent = {
    type: 'off',
    midi: EXPECTED.at(-1)!.midi,
    time: T0 + EXPECTED.length * 200,
  };
  if (!holdLast) step(lastOff);
  return { state, lastOff };
}

function Harness({
  run,
  store,
  slot,
}: {
  run: ScaleRunState;
  store: PracticeStore;
  slot: SessionSlot;
}) {
  useScaleRecorder(run, EXERCISE, slot, store, () => []);
  return null;
}

describe('useScaleRecorder', () => {
  let root: Root;
  let recorded: { run: StoredScaleRun; session: ScaleSession }[];
  let store: PracticeStore;
  let slot: SessionSlot;
  const render = (run: ScaleRunState) =>
    act(() =>
      root.render(createElement(StrictMode, null, createElement(Harness, { run, store, slot }))),
    );

  beforeEach(() => {
    vi.useFakeTimers();
    root = createRoot(document.createElement('div'));
    recorded = [];
    store = {
      recordScaleRun: (run: StoredScaleRun, session: ScaleSession) =>
        recorded.push({ run, session }),
    } as unknown as PracticeStore;
    let session: ScaleSession | null = null;
    slot = { get: () => session, set: (next) => (session = next) };
  });

  afterEach(() => {
    act(() => root.unmount());
    vi.useRealTimers();
  });

  it('records a run once its keys are up, and only once whatever comes after', () => {
    const { state } = playScale(false);
    expect(state.phase).toBe('done');
    render(state);
    expect(recorded).toHaveLength(1);
    // A pedal change after the end makes a new state of the same run.
    render(sessionStep(state, { type: 'pedal', down: true, time: T0 + 9000 }));
    render(sessionStep(state, { type: 'pedal', down: false, time: T0 + 9500 }));
    expect(recorded).toHaveLength(1);
    expect(recorded[0]!.run.id).toBe(`${recorded[0]!.session.id}:0`);
  });

  it('waits for the last key, and a key let go after the wait records nothing more', () => {
    const { state, lastOff } = playScale(true);
    render(state);
    expect(recorded).toHaveLength(0);
    act(() => void vi.advanceTimersByTime(RELEASE_WAIT_MS + 100));
    expect(recorded).toHaveLength(1);
    render(sessionStep(state, lastOff));
    expect(recorded).toHaveLength(1);
  });

  it('records a waiting run when the page is hidden or left', () => {
    const { state } = playScale(true);
    render(state);
    act(() => void window.dispatchEvent(new Event('pagehide')));
    expect(recorded).toHaveLength(1);
    act(() => root.unmount());
    root = createRoot(document.createElement('div'));
    expect(recorded).toHaveLength(1);
  });

  it('records a waiting run when its page is left, not when StrictMode remounts it', async () => {
    const { state } = playScale(true);
    render(state);
    await act(async () => {
      await Promise.resolve();
    });
    // Set up twice in development, the recorder is still waiting for the last key.
    expect(recorded).toHaveLength(0);
    act(() => root.unmount());
    await act(async () => {
      await Promise.resolve();
    });
    expect(recorded).toHaveLength(1);
    root = createRoot(document.createElement('div'));
  });

  it('continues the session with the next run', () => {
    const first = playScale(false).state;
    render(first);
    // The next run starts at the tonic a few seconds later.
    let next = first;
    EXPECTED.forEach((note, i) => {
      const time = T0 + 8000 + i * 200;
      next = sessionStep(next, {
        type: 'on',
        midi: note.midi,
        velocity: 64 + (i % 3),
        time,
        at: 1_700_000_010_000 + i,
      });
      next = sessionStep(next, { type: 'off', midi: note.midi, time: time + 150 });
    });
    render(next);
    expect(recorded).toHaveLength(2);
    expect(recorded[1]!.session.id).toBe(recorded[0]!.session.id);
    expect(recorded[1]!.session.runs.map((r) => r.id)).toEqual([
      recorded[0]!.run.id,
      recorded[1]!.run.id,
    ]);
  });
});
