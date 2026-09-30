import type { Letter } from '../../core/note.ts';
import type { IntervalNumber, Quality } from '../../core/theoryItems.ts';
import { isTextEntry } from '../../input/keyboard.ts';

// Keys that answer a theory card by name (docs/EAR.md, "Clarifications (decided during E3)").
// While a card is answered by name, the computer keyboard plays no notes (`suspend()`), so the
// letters are free: an interval's quality by its letter as printed (d m P M A) and its number by
// the digits 2–8; a chord's root by its letter (A–G), its sign by − and # (or +), N for natural,
// and the chord by the digits 1–9 and 0, as on the Ear page.

export type TheoryShortcut =
  | { kind: 'quality'; quality: Quality }
  | { kind: 'number'; number: IntervalNumber }
  | { kind: 'letter'; letter: Letter }
  | { kind: 'accidental'; alter: -1 | 0 | 1 }
  | { kind: 'chord'; index: number };

type KeyLike = Pick<
  KeyboardEvent,
  | 'key'
  | 'code'
  | 'shiftKey'
  | 'repeat'
  | 'ctrlKey'
  | 'metaKey'
  | 'altKey'
  | 'isComposing'
  | 'target'
>;

/**
 * The letter typed, as printed: the character when it is a Latin letter (so AZERTY's A is A),
 * otherwise the physical key's with Shift for a capital (a Cyrillic or Hangul layout).
 */
function typedLetter(e: KeyLike): string | null {
  if (/^[a-zA-Z]$/.test(e.key)) return e.key;
  const physical = /^Key([A-Z])$/.exec(e.code);
  if (!physical) return null;
  return e.shiftKey ? physical[1]! : physical[1]!.toLowerCase();
}

/** A digit by its physical key, so every layout (AZERTY's shifted digits too) works. */
function digit(e: KeyLike): number | null {
  const match = /^(?:Digit|Numpad)(\d)$/.exec(e.code);
  return match ? Number(match[1]) : null;
}

const ignored = (e: KeyLike) =>
  e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.isComposing || isTextEntry(e.target);

const QUALITY_KEYS: Readonly<Record<string, Quality>> = {
  d: 'd',
  D: 'd',
  m: 'm',
  M: 'M',
  p: 'P',
  P: 'P',
  a: 'A',
  A: 'A',
};

/**
 * An interval's name by keys: its quality by the letter as printed (m minor, M major; d, P and A
 * in either case) and its number by 2–8 (8 the octave).
 */
export function intervalShortcut(e: KeyLike): TheoryShortcut | null {
  if (ignored(e)) return null;
  const n = digit(e);
  if (n !== null) return n >= 2 && n <= 8 ? { kind: 'number', number: n as IntervalNumber } : null;
  const letter = typedLetter(e);
  const quality = letter === null ? undefined : QUALITY_KEYS[letter];
  return quality ? { kind: 'quality', quality } : null;
}

/**
 * A chord's name by keys: its root's letter (A–G, either case), its sign (− flat, # or + sharp,
 * N natural) and the chord by 1–9 and 0 (the tenth).
 */
export function chordShortcut(e: KeyLike): TheoryShortcut | null {
  if (ignored(e)) return null;
  if (e.key === '#' || e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
    return { kind: 'accidental', alter: 1 };
  }
  if (e.key === '-' || e.code === 'NumpadSubtract') return { kind: 'accidental', alter: -1 };
  const n = digit(e);
  if (n !== null) return { kind: 'chord', index: n === 0 ? 9 : n - 1 };
  const letter = typedLetter(e)?.toUpperCase();
  if (letter === 'N') return { kind: 'accidental', alter: 0 };
  if (letter && /^[A-G]$/.test(letter)) return { kind: 'letter', letter: letter as Letter };
  return null;
}

/** The key printed on the chord button at `index`: 1–9, then 0 for the tenth; null past it. */
export function chordKey(index: number): string | null {
  if (index >= 10) return null;
  return index === 9 ? '0' : String(index + 1);
}
