import { describe, expect, it } from 'vitest';
import { createInputHub, type HubEvent } from '../../input/hub.ts';
import { createPointerInput, POINTER_VELOCITY } from '../../input/pointer.ts';
import { createLatchedPointer } from './latch.ts';

function setup() {
  const hub = createInputHub();
  const pointer = createPointerInput();
  const events: HubEvent[] = [];
  hub.onEvent((e) => events.push(e));
  hub.add(pointer);
  const latch = createLatchedPointer(pointer);
  const held = () => [...hub.getState().held.keys()].sort((a, b) => a - b);
  return { hub, pointer, latch, events, held };
}

describe('the latched keyboard of a chord card', () => {
  it('holds each key clicked until it is clicked again', () => {
    const { latch, events, held } = setup();
    latch.press(1, 60, 10);
    latch.release(1, 20);
    latch.press(1, 64, 30);
    latch.release(1, 40);
    latch.press(2, 67, 50);
    expect(held()).toEqual([60, 64, 67]);
    latch.press(1, 64, 60);
    expect(held()).toEqual([60, 67]);
    expect(events).toEqual([
      { type: 'on', midi: 60, velocity: POINTER_VELOCITY, time: 10 },
      { type: 'on', midi: 64, velocity: POINTER_VELOCITY, time: 30 },
      { type: 'on', midi: 67, velocity: POINTER_VELOCITY, time: 50 },
      { type: 'off', midi: 64, velocity: 0, time: 60 },
    ]);
  });

  it('never glides across keys, and lets go of everything for the next card', () => {
    const { latch, events, held } = setup();
    latch.press(1, 60, 10);
    expect(latch.isDown(1)).toBe(false);
    latch.press(-1, 62, 20);
    latch.release(-1, 20);
    expect(held()).toEqual([60, 62]);
    latch.releaseAll(30);
    expect(held()).toEqual([]);
    expect(events.filter((e) => e.type === 'off')).toHaveLength(2);
    // Clicked again afterwards, a key is held again.
    latch.press(1, 60, 40);
    expect(held()).toEqual([60]);
  });

  it('leaves the plain pointer as it is', () => {
    const { pointer, latch, held } = setup();
    latch.press(1, 60, 10);
    pointer.press(1, 64, 20);
    pointer.release(1, 30);
    expect(held()).toEqual([60]);
  });
});
