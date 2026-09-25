import { describe, expect, it } from 'vitest';
import { shortcutFor, type ShortcutKey } from './shortcuts.ts';

const el = (tagName: string, type?: string) => ({ tagName, type }) as unknown as EventTarget;

function key(code: string, extra: Partial<ShortcutKey> = {}): ShortcutKey {
  return {
    code,
    key: '',
    repeat: false,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    target: null,
    timeStamp: 0,
    ...extra,
  };
}

describe('metronome shortcuts', () => {
  it('Space starts and stops, T taps, the arrows and − + change the tempo', () => {
    expect(shortcutFor(key('Space'))).toEqual({ kind: 'toggle' });
    expect(shortcutFor(key('KeyT'))).toEqual({ kind: 'tap' });
    expect(shortcutFor(key('ArrowLeft'))).toEqual({ kind: 'nudge', delta: -1 });
    expect(shortcutFor(key('ArrowRight', { shiftKey: true }))).toEqual({
      kind: 'nudge',
      delta: 10,
    });
    expect(shortcutFor(key('Minus'))).toEqual({ kind: 'nudge', delta: -1 });
    expect(shortcutFor(key('Equal', { shiftKey: true }))).toEqual({ kind: 'nudge', delta: 10 });
    expect(shortcutFor(key('NumpadAdd'))).toEqual({ kind: 'nudge', delta: 1 });
    expect(shortcutFor(key('NumpadSubtract'))).toEqual({ kind: 'nudge', delta: -1 });
  });

  it('holding an arrow keeps changing the tempo; holding Space or T does nothing more', () => {
    expect(shortcutFor(key('ArrowRight', { repeat: true }))).toEqual({ kind: 'nudge', delta: 1 });
    expect(shortcutFor(key('Space', { repeat: true }))).toBeNull();
    expect(shortcutFor(key('KeyT', { repeat: true }))).toBeNull();
  });

  it('leaves browser and system shortcuts alone', () => {
    for (const mod of ['ctrlKey', 'metaKey', 'altKey'] as const) {
      expect(shortcutFor(key('KeyT', { [mod]: true }))).toBeNull();
      expect(shortcutFor(key('Equal', { [mod]: true }))).toBeNull();
    }
    expect(shortcutFor(key('KeyT', { isComposing: true }))).toBeNull();
  });

  it('does not take keys from a control that uses them', () => {
    expect(shortcutFor(key('KeyT', { target: el('INPUT', 'number') }))).toBeNull();
    expect(shortcutFor(key('Space', { target: el('SELECT') }))).toBeNull();
    expect(shortcutFor(key('Space', { target: el('INPUT', 'checkbox') }))).toBeNull();
    expect(shortcutFor(key('Space', { target: el('SUMMARY') }))).toBeNull();
    expect(shortcutFor(key('ArrowLeft', { target: el('INPUT', 'range') }))).toBeNull();
    expect(shortcutFor(key('ArrowRight', { target: el('INPUT', 'radio') }))).toBeNull();
    // A button is pressed by Space itself; the slider has no use for it.
    expect(shortcutFor(key('Space', { target: el('BUTTON') }))).toBeNull();
    expect(shortcutFor(key('Space', { target: el('A') }))).toBeNull();
    expect(shortcutFor(key('ArrowRight', { target: el('BUTTON') }))).toEqual({
      kind: 'nudge',
      delta: 1,
    });
    expect(shortcutFor(key('Space', { target: el('INPUT', 'range') }))).toEqual({ kind: 'toggle' });
  });

  it('ignores the other letter keys', () => {
    for (const code of ['KeyA', 'KeyW', 'KeyZ', 'KeyX', 'Enter'])
      expect(shortcutFor(key(code))).toBeNull();
  });
});
