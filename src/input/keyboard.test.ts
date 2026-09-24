import { describe, expect, it } from 'vitest';
import { createInputHub, type HubEvent } from './hub.ts';
import {
  createKeyboardInput,
  createKeyboardMapper,
  DEFAULT_OCTAVE,
  isTextEntry,
  KEYBOARD_VELOCITY,
  MAX_OCTAVE,
  MIN_OCTAVE,
  noteForKey,
  type KeyLike,
} from './keyboard.ts';

function key(code: string, extra: Partial<KeyLike> = {}): KeyLike {
  return {
    code,
    repeat: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    target: null,
    timeStamp: 100,
    ...extra,
  };
}

const el = (tagName: string, extra: Record<string, unknown> = {}) =>
  ({ tagName, ...extra }) as unknown as EventTarget;

describe('noteForKey', () => {
  it('maps A W S E D F T G Y H U J K to C4…C5 at octave 4', () => {
    const codes = ['A', 'W', 'S', 'E', 'D', 'F', 'T', 'G', 'Y', 'H', 'U', 'J', 'K'];
    expect(codes.map((c) => noteForKey(`Key${c}`, 4))).toEqual([
      60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72,
    ]);
  });

  it('returns null for other keys and for notes off the piano', () => {
    expect(noteForKey('KeyQ', 4)).toBeNull();
    expect(noteForKey('KeyZ', 4)).toBeNull();
    expect(noteForKey('Semicolon', 4)).toBeNull();
    expect(noteForKey('KeyG', 0)).toBeNull(); // G0 is below A0
    expect(noteForKey('KeyH', 0)).toBe(21); // A0
    expect(noteForKey('KeyK', 7)).toBe(108); // C8
  });
});

describe('isTextEntry', () => {
  it.each([
    [el('INPUT'), true],
    [el('INPUT', { type: 'text' }), true],
    [el('INPUT', { type: 'search' }), true],
    [el('INPUT', { type: 'number' }), true],
    [el('INPUT', { type: 'email' }), true],
    [el('TEXTAREA'), true],
    [el('SELECT'), true],
    [el('DIV', { isContentEditable: true }), true],
    [el('INPUT', { type: 'radio' }), false],
    [el('INPUT', { type: 'checkbox' }), false],
    [el('INPUT', { type: 'range' }), false],
    [el('BUTTON'), false],
    [el('DIV'), false],
    [el('BODY'), false],
    [null, false],
  ] as const)('%o → %s', (target, expected) => {
    expect(isTextEntry(target)).toBe(expected);
  });
});

describe('createKeyboardMapper', () => {
  it('starts at octave 4 and plays notes with a fixed velocity and the event time', () => {
    const mapper = createKeyboardMapper();
    expect(mapper.octave).toBe(DEFAULT_OCTAVE);
    expect(mapper.keyDown(key('KeyA', { timeStamp: 12.5 }))).toEqual({
      kind: 'note',
      event: { type: 'on', midi: 60, velocity: KEYBOARD_VELOCITY, time: 12.5 },
    });
    expect(mapper.keyUp(key('KeyA', { timeStamp: 80 }))).toEqual({
      type: 'off',
      midi: 60,
      velocity: 0,
      time: 80,
    });
  });

  it('ignores auto-repeat and a second keydown without keyup', () => {
    const mapper = createKeyboardMapper();
    expect(mapper.keyDown(key('KeyA'))).not.toBeNull();
    expect(mapper.keyDown(key('KeyA', { repeat: true }))).toBeNull();
    expect(mapper.keyDown(key('KeyA'))).toBeNull();
  });

  it('ignores keys while focus is in a text field, but still releases keys pressed before', () => {
    const mapper = createKeyboardMapper();
    const input = el('INPUT', { type: 'text' });
    expect(mapper.keyDown(key('KeyS', { target: input }))).toBeNull();
    expect(mapper.keyDown(key('KeyX', { target: input }))).toBeNull();
    expect(mapper.octave).toBe(4);

    mapper.keyDown(key('KeyA'));
    expect(mapper.keyUp(key('KeyA', { target: input }))).toMatchObject({ type: 'off', midi: 60 });
  });

  it('ignores shortcuts and IME composition', () => {
    const mapper = createKeyboardMapper();
    expect(mapper.keyDown(key('KeyA', { metaKey: true }))).toBeNull();
    expect(mapper.keyDown(key('KeyA', { ctrlKey: true }))).toBeNull();
    expect(mapper.keyDown(key('KeyA', { altKey: true }))).toBeNull();
    expect(mapper.keyDown(key('KeyA', { isComposing: true }))).toBeNull();
    expect(mapper.keyDown(key('KeyX', { metaKey: true }))).toBeNull();
    expect(mapper.octave).toBe(4);
  });

  it('ignores key-ups of keys it never pressed', () => {
    expect(createKeyboardMapper().keyUp(key('KeyA'))).toBeNull();
    expect(createKeyboardMapper().keyUp(key('KeyQ'))).toBeNull();
  });

  it('shifts the octave with Z / X within bounds', () => {
    const mapper = createKeyboardMapper();
    expect(mapper.keyDown(key('KeyX'))).toEqual({ kind: 'octave', octave: 5 });
    expect(mapper.keyDown(key('KeyA'))).toMatchObject({ event: { midi: 72 } });

    for (let i = 0; i < 10; i++) mapper.keyDown(key('KeyX'));
    expect(mapper.octave).toBe(MAX_OCTAVE);
    expect(mapper.keyDown(key('KeyX'))).toBeNull();
    expect(mapper.keyDown(key('KeyK'))).toMatchObject({ event: { midi: 108 } });

    for (let i = 0; i < 10; i++) mapper.keyDown(key('KeyZ'));
    expect(mapper.octave).toBe(MIN_OCTAVE);
    expect(mapper.keyDown(key('KeyZ'))).toBeNull();
    expect(mapper.keyDown(key('KeyA'))).toBeNull(); // C0 is off the piano
    expect(mapper.keyDown(key('KeyH'))).toMatchObject({ event: { midi: 21 } });
  });

  it('does not auto-repeat octave shifts', () => {
    const mapper = createKeyboardMapper();
    mapper.keyDown(key('KeyX'));
    expect(mapper.keyDown(key('KeyX', { repeat: true }))).toBeNull();
    expect(mapper.octave).toBe(5);
  });

  it('releases the note that was started even after an octave shift', () => {
    const mapper = createKeyboardMapper();
    mapper.keyDown(key('KeyA'));
    mapper.keyDown(key('KeyX'));
    expect(mapper.keyUp(key('KeyA'))).toMatchObject({ midi: 60 });
    expect(mapper.keyDown(key('KeyA'))).toMatchObject({ event: { midi: 72 } });
  });
});

describe('createKeyboardInput', () => {
  function keyEvent(type: string, props: Partial<KeyLike>) {
    const event = new Event(type);
    for (const [name, value] of Object.entries({ ...key(''), ...props })) {
      Object.defineProperty(event, name, { value });
    }
    return event;
  }

  it('feeds the hub from DOM key events and stops cleanly', () => {
    const target = new EventTarget();
    const hub = createInputHub();
    const events: HubEvent[] = [];
    hub.onEvent((e) => events.push(e));
    const keyboard = createKeyboardInput(target);
    const stop = hub.add(keyboard);

    target.dispatchEvent(keyEvent('keydown', { code: 'KeyA' }));
    target.dispatchEvent(keyEvent('keydown', { code: 'KeyA', repeat: true }));
    target.dispatchEvent(keyEvent('keydown', { code: 'KeyD' }));
    expect([...hub.getState().held.keys()]).toEqual([60, 64]);
    target.dispatchEvent(keyEvent('keyup', { code: 'KeyA' }));
    expect([...hub.getState().held.keys()]).toEqual([64]);

    stop();
    expect(hub.getState().held.size).toBe(0);
    target.dispatchEvent(keyEvent('keydown', { code: 'KeyA' }));
    expect(hub.getState().held.size).toBe(0);
    expect(events.map((e) => e.type)).toEqual(['on', 'on', 'off', 'off']);
  });

  it('releases every held key when the window loses focus', () => {
    const target = new EventTarget();
    const hub = createInputHub();
    const keyboard = createKeyboardInput(target);
    hub.add(keyboard);
    target.dispatchEvent(keyEvent('keydown', { code: 'KeyA' }));
    target.dispatchEvent(keyEvent('keydown', { code: 'KeyG' }));
    target.dispatchEvent(new Event('blur'));
    expect(hub.getState().held.size).toBe(0);
    // The key-up that arrives later is harmless, and the key can be played again.
    target.dispatchEvent(keyEvent('keyup', { code: 'KeyA' }));
    target.dispatchEvent(keyEvent('keydown', { code: 'KeyA' }));
    expect([...hub.getState().held.keys()]).toEqual([60]);
  });

  it('notifies octave subscribers', () => {
    const target = new EventTarget();
    const keyboard = createKeyboardInput(target);
    createInputHub().add(keyboard);
    let calls = 0;
    const unsubscribe = keyboard.subscribeOctave(() => calls++);
    target.dispatchEvent(keyEvent('keydown', { code: 'KeyZ' }));
    expect(keyboard.getOctave()).toBe(3);
    expect(calls).toBe(1);
    unsubscribe();
    target.dispatchEvent(keyEvent('keydown', { code: 'KeyZ' }));
    expect(calls).toBe(1);
  });

  it('does nothing without a target (no window)', () => {
    const keyboard = createKeyboardInput(null);
    expect(() => createInputHub().add(keyboard)()).not.toThrow();
  });
});
