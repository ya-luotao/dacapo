import { describe, expect, it } from 'vitest';
import { earShortcut, nameKey } from './shortcuts.ts';

const key = (code: string, patch: Partial<Parameters<typeof earShortcut>[0]> = {}) =>
  earShortcut({
    code,
    repeat: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    isComposing: false,
    target: null,
    ...patch,
  });

describe('ear shortcuts', () => {
  it('hears again with Space and goes on with Enter', () => {
    expect(key('Space')).toEqual({ kind: 'hearAgain' });
    expect(key('Enter')).toEqual({ kind: 'next' });
    expect(key('NumpadEnter')).toEqual({ kind: 'next' });
    expect(key('Space', { repeat: true })).toBeNull();
  });

  it('chooses the first ten names with 1–9 and 0', () => {
    expect(key('Digit1')).toEqual({ kind: 'name', index: 0 });
    expect(key('Digit9')).toEqual({ kind: 'name', index: 8 });
    expect(key('Digit0')).toEqual({ kind: 'name', index: 9 });
    expect(key('Numpad3')).toEqual({ kind: 'name', index: 2 });
    expect(nameKey(0)).toBe('1');
    expect(nameKey(9)).toBe('0');
    expect(nameKey(10)).toBeNull();
  });

  it('leaves other keys, held modifiers and repeats alone', () => {
    expect(key('KeyA')).toBeNull();
    expect(key('Digit1', { metaKey: true })).toBeNull();
    expect(key('Digit1', { repeat: true })).toBeNull();
    expect(key('Enter', { ctrlKey: true })).toBeNull();
  });
});
