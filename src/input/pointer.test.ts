import { describe, expect, it } from 'vitest';
import { createInputHub, type HubEvent } from './hub.ts';
import { createPointerInput, POINTER_VELOCITY } from './pointer.ts';

function setup() {
  const hub = createInputHub();
  const pointer = createPointerInput();
  const events: HubEvent[] = [];
  hub.onEvent((e) => events.push(e));
  const stop = hub.add(pointer);
  return { hub, pointer, events, stop };
}

describe('createPointerInput', () => {
  it('presses and releases a key', () => {
    const { hub, pointer, events } = setup();
    pointer.press(1, 60, 10);
    expect(hub.getState().held.get(60)).toBe(POINTER_VELOCITY);
    expect(pointer.isDown(1)).toBe(true);
    pointer.release(1, 20);
    expect(pointer.isDown(1)).toBe(false);
    expect(events).toEqual([
      { type: 'on', midi: 60, velocity: POINTER_VELOCITY, time: 10 },
      { type: 'off', midi: 60, velocity: 0, time: 20 },
    ]);
  });

  it('slides from key to key with one pointer (glissando)', () => {
    const { hub, pointer, events } = setup();
    pointer.press(1, 60, 1);
    pointer.press(1, 60, 2);
    pointer.press(1, 62, 3);
    expect([...hub.getState().held.keys()]).toEqual([62]);
    expect(events.map((e) => [e.type, 'midi' in e ? e.midi : null])).toEqual([
      ['on', 60],
      ['off', 60],
      ['on', 62],
    ]);
  });

  it('keeps a key held while another finger still holds it', () => {
    const { hub, pointer } = setup();
    pointer.press(1, 60, 1);
    pointer.press(2, 60, 2);
    pointer.release(1, 3);
    expect(hub.getState().held.has(60)).toBe(true);
    pointer.release(2, 4);
    expect(hub.getState().held.has(60)).toBe(false);
  });

  it('ignores keys off the piano, unknown pointers and presses before start', () => {
    const idle = createPointerInput();
    expect(() => idle.press(1, 60, 0)).not.toThrow();
    expect(idle.isDown(1)).toBe(false);

    const { hub, pointer } = setup();
    pointer.press(1, 20, 0);
    pointer.press(1, 109, 0);
    pointer.release(7, 0);
    expect(hub.getState().held.size).toBe(0);
  });

  it('releases everything when stopped', () => {
    const { hub, pointer, stop } = setup();
    pointer.press(1, 60, 0);
    stop();
    expect(hub.getState().held.size).toBe(0);
    expect(pointer.isDown(1)).toBe(false);
  });
});
