import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ImprovSession } from '../../core/improvFigures.ts';
import { PEDALS_UP, TAKE_CHUNK_EVENTS } from '../../core/takes.ts';
import { BACKING_LEAD_MS } from '../../output/backing.ts';
import type { InterruptReason } from '../../output/output.ts';
import { createScheduler } from '../../output/scheduler.ts';
import { fakeClock, FakePort } from '../../output/testing.ts';
import { createPracticeStore } from '../practice/store.ts';
import { CHECKPOINT_MS, createImprovController, type ImprovStart } from './improvController.ts';

let stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops) stop();
  stops = [];
});

const EPOCH = 1_700_000_000_000;
const START = 10_000;

function setup() {
  const clock = fakeClock(START);
  const port = new FakePort();
  const scheduler = createScheduler({ clock });
  scheduler.setPort(port);
  const practice = createPracticeStore();
  stops.push(practice.start());
  let held = 0;
  let interrupt: ((reason: InterruptReason) => void) | null = null;
  let ids = 0;
  const make = () =>
    createImprovController({
      practice,
      scheduler,
      clock,
      clicks: () => null,
      hold: () => {
        held++;
        return () => held--;
      },
      onInterrupt: (listener) => {
        interrupt = listener;
        return () => (interrupt = null);
      },
      now: () => EPOCH + clock.now() - START,
      newId: () => `im${++ids}`,
      newSeed: () => 42,
    });
  const controller = make();
  const options: ImprovStart = {
    spec: {
      backing: 'blues',
      key: 'C',
      scale: 'blues',
      pattern: 'shuffle',
      feel: 'straight',
      bpm: 120,
      call: false,
    },
    click: false,
    level: 60,
    channel: 1,
    latency: 0,
    pedals: PEDALS_UP,
  };
  const state = () => controller.getState();
  const sessions = () => practice.getSnapshot().sessions as ImprovSession[];
  return {
    clock,
    port,
    practice,
    controller,
    options,
    state,
    sessions,
    held: () => held,
    interrupt: () => interrupt,
    make,
  };
}

/** Time 0 of a loop started at START: after the lead and a bar of count-in (2 s at 120). */
const ZERO = START + BACKING_LEAD_MS + 2000;

describe('improv controller', () => {
  it('hears each key against the backing, then records the session and its take', async () => {
    const { clock, controller, options, state, sessions, practice, held } = setup();
    controller.start(options);
    expect(state().phase).toBe('running');
    expect(held()).toBe(1);
    clock.advance(ZERO - START);
    controller.press(64, 80, ZERO + 5); // E over C7
    expect(state().heard.get(64)).toBe('chord');
    controller.release(64, ZERO + 400);
    expect([...state().heard.keys()]).toEqual([]);
    controller.press(69, 70, ZERO + 500); // A: outside the blues scale and C7
    expect(state().heard.get(69)).toBe('outside');
    controller.release(69, ZERO + 900);
    controller.press(63, 70, ZERO + 1000); // E♭, the blue third
    expect(state().heard.get(63)).toBe('scale');
    controller.release(63, ZERO + 1400);
    clock.advance(4000);
    controller.stop();
    expect(held()).toBe(0);
    expect(state().phase).toBe('done');
    const session = state().session!;
    expect(session).toMatchObject({
      kind: 'improv',
      id: 'im1',
      startedAt: EPOCH,
      backing: 'blues',
      seed: 42,
      figures: { notes: 3, chord: 1, scale: 1, outside: 1, strong: 2, strongChord: 1 },
    });
    expect(sessions()).toEqual([session]);
    await practice.settled();
    const takes = await practice.takes({ sessionId: 'im1' });
    expect(takes).toHaveLength(1);
    expect(takes[0]).toMatchObject({
      id: 'im1:take:000',
      pieceId: 'improv:blues:C',
      hands: 'both',
      mode: 'rhythm',
      latency: 0,
      startedAt: EPOCH + ZERO - START,
    });
    expect(takes[0]!.events).toEqual([
      [5, 1, 64, 80, -1],
      [400, 0, 64],
      [500, 1, 69, 70, -1],
      [900, 0, 69],
      [1000, 1, 63, 70, -1],
      [1400, 0, 63],
    ]);
  });

  it('waits for the keys held at the stop before it stores the take, and ignores new ones', async () => {
    const { clock, controller, options, practice } = setup();
    controller.start(options);
    clock.advance(ZERO - START + 100);
    controller.press(60, 80, ZERO + 100);
    controller.stop();
    controller.press(62, 80, ZERO + 300);
    await practice.settled();
    expect(await practice.takes({ sessionId: 'im1' })).toEqual([]);
    controller.release(62, ZERO + 350);
    controller.release(60, ZERO + 400);
    await practice.settled();
    const [chunk] = await practice.takes({ sessionId: 'im1' });
    expect(chunk!.events).toEqual([
      [100, 1, 60, 80, -1],
      [400, 0, 60],
    ]);
  });

  it('records nothing for a loop with nothing played', async () => {
    const { clock, controller, options, sessions, practice, state } = setup();
    controller.start(options);
    clock.advance(6000);
    controller.stop();
    expect(state().session).toBeNull();
    expect(sessions()).toEqual([]);
    await practice.settled();
    expect(await practice.allTakes()).toEqual([]);
  });

  it('ends the loop when sound is cut from outside, and keeps what was played', () => {
    const { clock, controller, options, sessions, interrupt, held } = setup();
    controller.start(options);
    clock.advance(ZERO - START);
    controller.press(67, 80, ZERO);
    controller.release(67, ZERO + 200);
    clock.advance(1000);
    interrupt()!('hidden');
    expect(controller.getState().phase).toBe('done');
    expect(held()).toBe(0);
    expect(sessions()).toHaveLength(1);
  });

  it('stores the session as it goes, and before a chunk of the take', async () => {
    const { clock, controller, options, sessions, practice } = setup();
    controller.start(options);
    clock.advance(ZERO - START);
    controller.press(60, 80, ZERO + 10);
    controller.release(60, ZERO + 20);
    clock.advance(CHECKPOINT_MS);
    expect(sessions()).toHaveLength(1);
    expect(sessions()[0]!.figures.notes).toBe(1);
    // A full chunk while the loop goes on: stored at once, its session first.
    for (let i = 1; i < TAKE_CHUNK_EVENTS / 2; i++) {
      controller.press(60, 80, ZERO + 100 + i * 10);
      controller.release(60, ZERO + 105 + i * 10);
    }
    await practice.settled();
    const takes = await practice.takes({ sessionId: 'im1' });
    expect(takes).toHaveLength(1);
    expect(takes[0]!.events).toHaveLength(TAKE_CHUNK_EVENTS);
    expect(sessions()[0]!.figures.notes).toBe(TAKE_CHUNK_EVENTS / 2);
    controller.stop();
    await practice.settled();
    expect(await practice.takes({ sessionId: 'im1' })).toHaveLength(1);
  });

  it('plays the loop back with its backing, and a stored one read back', async () => {
    const { clock, controller, options, port, held, practice, make } = setup();
    controller.start(options);
    clock.advance(ZERO - START);
    controller.press(72, 90, ZERO + 20);
    controller.release(72, ZERO + 300);
    clock.advance(3000);
    controller.stop();
    const session = controller.getState().session!;
    port.sent.length = 0;
    controller.playBack(session, { level: 60, channel: 1 });
    expect(held()).toBe(1);
    expect(controller.getState().playback?.notes).toEqual([
      { midi: 72, velocity: 90, on: 20, off: 300 },
    ]);
    clock.advance(BACKING_LEAD_MS + 100);
    const ons = port.sent.filter((s) => (s.data[0]! & 0xf0) === 0x90);
    expect(ons.some((s) => s.data[0] === 0x90 && s.data[1] === 72 && s.data[2] === 90)).toBe(true);
    expect(ons.some((s) => s.data[0] === 0x91)).toBe(true);
    clock.advance(10_000);
    expect(controller.getState().playback).toBeNull();
    expect(held()).toBe(0);

    // From storage, on another visit to the page.
    controller.close();
    await practice.settled();
    const later = make();
    later.playBack(session, { level: 60, channel: 1 });
    expect(later.getState().loading).toBe(session.id);
    await vi.waitFor(() => expect(later.getState().playback).not.toBeNull());
    expect(later.getState().playback!.notes).toEqual([
      { midi: 72, velocity: 90, on: 20, off: 300 },
    ]);
    later.stopPlayback();
    expect(later.getState().playback).toBeNull();
    expect(held()).toBe(0);
  });
});
