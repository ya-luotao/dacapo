import { describe, expect, it } from 'vitest';
import { chordKey, chordShortcut, intervalShortcut } from './theoryShortcuts.ts';

type Key = Parameters<typeof intervalShortcut>[0];

const key = (key: string, code: string, patch: Partial<Key> = {}): Key => ({
  key,
  code,
  shiftKey: false,
  repeat: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  isComposing: false,
  target: null,
  ...patch,
});

describe('interval keys', () => {
  it('chooses the quality by its letter as printed, m minor and M major', () => {
    expect(intervalShortcut(key('m', 'KeyM'))).toEqual({ kind: 'quality', quality: 'm' });
    expect(intervalShortcut(key('M', 'KeyM', { shiftKey: true }))).toEqual({
      kind: 'quality',
      quality: 'M',
    });
    for (const [typed, quality] of [
      ['d', 'd'],
      ['D', 'd'],
      ['p', 'P'],
      ['P', 'P'],
      ['a', 'A'],
      ['A', 'A'],
    ] as const) {
      expect(intervalShortcut(key(typed, `Key${typed.toUpperCase()}`))).toEqual({
        kind: 'quality',
        quality,
      });
    }
  });

  it('reads the letter typed (AZERTY) and the physical key on a non-Latin layout', () => {
    // AZERTY: the key labelled A is where QWERTY has Q.
    expect(intervalShortcut(key('a', 'KeyQ'))).toEqual({ kind: 'quality', quality: 'A' });
    // A Cyrillic layout: ь on the M key, Ь with Shift.
    expect(intervalShortcut(key('ь', 'KeyM'))).toEqual({ kind: 'quality', quality: 'm' });
    expect(intervalShortcut(key('Ь', 'KeyM', { shiftKey: true }))).toEqual({
      kind: 'quality',
      quality: 'M',
    });
  });

  it('chooses the number by 2–8 and nothing else', () => {
    expect(intervalShortcut(key('2', 'Digit2'))).toEqual({ kind: 'number', number: 2 });
    expect(intervalShortcut(key('8', 'Numpad8'))).toEqual({ kind: 'number', number: 8 });
    // AZERTY's unshifted digit row types é, but the key is the 2.
    expect(intervalShortcut(key('é', 'Digit2'))).toEqual({ kind: 'number', number: 2 });
    expect(intervalShortcut(key('1', 'Digit1'))).toBeNull();
    expect(intervalShortcut(key('9', 'Digit9'))).toBeNull();
    expect(intervalShortcut(key('x', 'KeyX'))).toBeNull();
  });

  it('leaves held modifiers, repeats and text fields alone', () => {
    expect(intervalShortcut(key('m', 'KeyM', { metaKey: true }))).toBeNull();
    expect(intervalShortcut(key('3', 'Digit3', { repeat: true }))).toBeNull();
    const input = { tagName: 'INPUT', type: 'text' } as unknown as EventTarget;
    expect(intervalShortcut(key('m', 'KeyM', { target: input }))).toBeNull();
  });
});

describe('chord keys', () => {
  it('chooses the root letter, its sign and the chord', () => {
    expect(chordShortcut(key('f', 'KeyF'))).toEqual({ kind: 'letter', letter: 'F' });
    expect(chordShortcut(key('B', 'KeyB', { shiftKey: true }))).toEqual({
      kind: 'letter',
      letter: 'B',
    });
    expect(chordShortcut(key('#', 'Digit3', { shiftKey: true }))).toEqual({
      kind: 'accidental',
      alter: 1,
    });
    expect(chordShortcut(key('+', 'NumpadAdd'))).toEqual({ kind: 'accidental', alter: 1 });
    expect(chordShortcut(key('-', 'Minus'))).toEqual({ kind: 'accidental', alter: -1 });
    expect(chordShortcut(key('n', 'KeyN'))).toEqual({ kind: 'accidental', alter: 0 });
    expect(chordShortcut(key('3', 'Digit3'))).toEqual({ kind: 'chord', index: 2 });
    expect(chordShortcut(key('0', 'Digit0'))).toEqual({ kind: 'chord', index: 9 });
    expect(chordShortcut(key('h', 'KeyH'))).toBeNull();
  });

  it('prints 1–9 and 0 on the first ten chords', () => {
    expect(chordKey(0)).toBe('1');
    expect(chordKey(9)).toBe('0');
    expect(chordKey(10)).toBeNull();
  });
});
