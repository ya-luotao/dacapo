import { isTextEntry } from '../../input/keyboard.ts';

/** A key of the Ear session: Space hears again, Enter goes on, 1–9 and 0 choose a name. */
export type EarShortcut =
  { kind: 'hearAgain' } | { kind: 'next' } | { kind: 'name'; index: number };

/** How many answer buttons the number keys reach: 1–9, then 0 for the tenth. */
export const NAME_KEYS = 10;

type KeyLike = Pick<
  KeyboardEvent,
  'code' | 'repeat' | 'ctrlKey' | 'metaKey' | 'altKey' | 'isComposing' | 'target'
>;

/** The shortcut for a keydown, or null. Physical keys (`code`), so any layout works. */
export function earShortcut(e: KeyLike): EarShortcut | null {
  if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing || isTextEntry(e.target)) return null;
  if (e.code === 'Space') return e.repeat ? null : { kind: 'hearAgain' };
  if (e.repeat) return null;
  if (e.code === 'Enter' || e.code === 'NumpadEnter') return { kind: 'next' };
  const digit = /^(?:Digit|Numpad)(\d)$/.exec(e.code);
  if (!digit) return null;
  const n = Number(digit[1]);
  return { kind: 'name', index: n === 0 ? 9 : n - 1 };
}

/** The key that chooses the button at `index`, or null past the tenth. */
export function nameKey(index: number): string | null {
  if (index >= NAME_KEYS) return null;
  return index === 9 ? '0' : String(index + 1);
}
