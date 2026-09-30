import { isTextEntry, KEYBOARD_VELOCITY } from '../../input/keyboard.ts';
import type { Emit, NoteInput } from '../../input/types.ts';
import type { KeyMonitor } from '../../output/monitor.ts';

// The computer keyboard while a rhythm line is tapped: any letter or the space bar is a tap. The
// keyboard's own notes (A plays C4, all of them from middle C up) cannot tell the hands apart, so
// while a run lasts the page takes the keys itself (the hub's keyboard suspended): the left half
// of the letters for the left hand, below middle C, and the right half and the space bar for the
// right hand, from middle C up (docs/READING.md, "Clarifications (decided during R1)"). Each key
// has a note of its own, so a key still held never swallows the tap of another.

/** The left hand's keys: the letters left of the middle, by row. */
export const LEFT_TAP_KEYS = [
  'KeyQ',
  'KeyW',
  'KeyE',
  'KeyR',
  'KeyT',
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyF',
  'KeyG',
  'KeyZ',
  'KeyX',
  'KeyC',
  'KeyV',
  'KeyB',
] as const;

/** The right hand's keys: the letters right of the middle, the punctuation beside them, space. */
export const RIGHT_TAP_KEYS = [
  'KeyY',
  'KeyU',
  'KeyI',
  'KeyO',
  'KeyP',
  'KeyH',
  'KeyJ',
  'KeyK',
  'KeyL',
  'Semicolon',
  'KeyN',
  'KeyM',
  'Comma',
  'Period',
  'Slash',
  'Space',
] as const;

/** The pads' notes: the left hand's below middle C, the right hand's above it. */
export const LEFT_PAD_KEY = 36;
export const RIGHT_PAD_KEY = 72;

/** The note a key taps: the left hand's from D2 up, the right hand's from D5 up; null: none. */
export function tapKeyNote(code: string): number | null {
  const left = (LEFT_TAP_KEYS as readonly string[]).indexOf(code);
  if (left >= 0) return 38 + left;
  const right = (RIGHT_TAP_KEYS as readonly string[]).indexOf(code);
  return right >= 0 ? 74 + right : null;
}

/** Key events as the tap keys need them (the DOM's, or a test's). */
interface KeyLike {
  code: string;
  repeat: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  isComposing?: boolean;
  target: EventTarget | null;
  timeStamp: number;
  preventDefault: () => void;
}

/** The tap keys as a source of the input hub; `target` receives the key events. */
export function createTapKeyInput(
  target: EventTarget | null = globalThis.window ?? null,
): NoteInput {
  return {
    id: 'tap-keys',
    start(emit: Emit) {
      if (!target) return () => undefined;
      const pressed = new Map<string, number>();
      const onKeyDown = (event: Event) => {
        const e = event as unknown as KeyLike;
        if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing || isTextEntry(e.target)) return;
        const midi = tapKeyNote(e.code);
        if (midi === null) return;
        // The space bar would press a focused button, and scroll the page.
        e.preventDefault();
        if (e.repeat || pressed.has(e.code)) return;
        pressed.set(e.code, midi);
        emit({ type: 'on', midi, velocity: KEYBOARD_VELOCITY, time: e.timeStamp });
      };
      const onKeyUp = (event: Event) => {
        const e = event as unknown as KeyLike;
        const midi = pressed.get(e.code);
        if (midi === undefined) return;
        e.preventDefault();
        pressed.delete(e.code);
        emit({ type: 'off', midi, velocity: 0, time: e.timeStamp });
      };
      const onBlur = (event: Event) => {
        pressed.clear();
        emit({ type: 'reset', time: event.timeStamp });
      };
      target.addEventListener('keydown', onKeyDown);
      target.addEventListener('keyup', onKeyUp);
      target.addEventListener('blur', onBlur);
      return () => {
        target.removeEventListener('keydown', onKeyDown);
        target.removeEventListener('keyup', onKeyUp);
        target.removeEventListener('blur', onBlur);
        // The hub lets go of whatever this source held.
        pressed.clear();
      };
    },
  };
}

const tapped = new WeakMap<KeyMonitor, NoteInput>();

/**
 * The tap keys as the input system takes them: through the monitor, so a key sounds as the
 * computer keyboard's do. A monitor taps a source once, so this is the same source every time.
 */
export function tapKeysFor(monitor: KeyMonitor): NoteInput {
  let source = tapped.get(monitor);
  if (!source) {
    source = monitor.tap(createTapKeyInput(), 'keys');
    tapped.set(monitor, source);
  }
  return source;
}
