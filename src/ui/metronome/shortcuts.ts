import { isTextEntry, type KeyLike } from '../../input/keyboard.ts';

// The Metronome page's keys. The computer keyboard's notes are switched off on that page (it has
// no piano), so T and the arrows are free; everywhere else these keys play notes or do nothing.

export type MetronomeAction =
  { kind: 'toggle' } | { kind: 'nudge'; delta: number } | { kind: 'tap' };

export interface ShortcutKey extends KeyLike {
  key: string;
  shiftKey: boolean;
}

/** Controls that give these keys a meaning of their own. */
function owns(target: EventTarget | null, keys: 'space' | 'arrows'): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as Partial<HTMLElement> & { type?: string };
  const type = (el.type ?? '').toLowerCase();
  // A button (or link) is pressed by Space on key-up: its own action, not start and stop.
  if (el.tagName === 'SUMMARY' || el.tagName === 'BUTTON' || el.tagName === 'A')
    return keys === 'space';
  if (el.tagName !== 'INPUT') return false;
  if (type === 'checkbox') return keys === 'space';
  return type === 'radio' || (type === 'range' && keys === 'arrows');
}

/**
 * Space starts and stops (unless a button or check box has the focus: Space is theirs), ← → and
 * − + change the tempo by 1 (with Shift by 10), T taps it. Never with Ctrl, ⌘ or Alt, nor while
 * typing.
 */
export function shortcutFor(e: ShortcutKey): MetronomeAction | null {
  if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing || isTextEntry(e.target)) return null;
  const step = e.shiftKey ? 10 : 1;
  switch (e.code) {
    case 'Space':
      return e.repeat || owns(e.target, 'space') ? null : { kind: 'toggle' };
    case 'ArrowLeft':
    case 'ArrowRight':
      if (owns(e.target, 'arrows')) return null;
      return { kind: 'nudge', delta: e.code === 'ArrowLeft' ? -step : step };
    case 'Minus':
    case 'NumpadSubtract':
      return { kind: 'nudge', delta: -step };
    case 'Equal':
    case 'NumpadAdd':
      return { kind: 'nudge', delta: step };
    case 'KeyT':
      return e.repeat ? null : { kind: 'tap' };
    default:
      return null;
  }
}
