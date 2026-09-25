import { isPianoKey } from '../core/note.ts';
import type { Emit, NoteEvent, NoteInput } from './types.ts';

/**
 * Physical keys (`KeyboardEvent.code`, so any layout or IME works) laid out like a piano:
 * the home row plays white keys C…C, the row above plays the black keys.
 */
export const NOTE_KEYS = [
  ['KeyA', 'A'],
  ['KeyW', 'W'],
  ['KeyS', 'S'],
  ['KeyE', 'E'],
  ['KeyD', 'D'],
  ['KeyF', 'F'],
  ['KeyT', 'T'],
  ['KeyG', 'G'],
  ['KeyY', 'Y'],
  ['KeyH', 'H'],
  ['KeyU', 'U'],
  ['KeyJ', 'J'],
  ['KeyK', 'K'],
] as const;

export const OCTAVE_DOWN_KEY = 'KeyZ';
export const OCTAVE_UP_KEY = 'KeyX';
export const DEFAULT_OCTAVE = 4;
/** Octave 0 reaches A0–C1; notes below A0 are ignored. Octave 7 ends on C8. */
export const MIN_OCTAVE = 0;
export const MAX_OCTAVE = 7;
/** The computer keyboard cannot sense touch, so every note gets the same velocity. */
export const KEYBOARD_VELOCITY = 96;

const OFFSETS = new Map<string, number>(NOTE_KEYS.map(([code], i) => [code, i]));

export interface KeyLike {
  code: string;
  repeat: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  isComposing?: boolean;
  target: EventTarget | null;
  timeStamp: number;
}

const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

/** True for elements where letter keys type or choose something: text fields, selects, editors. */
export function isTextEntry(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as Partial<HTMLElement> & { type?: string };
  if (el.isContentEditable) return true;
  switch (el.tagName) {
    case 'TEXTAREA':
    case 'SELECT':
      return true;
    case 'INPUT':
      return !NON_TEXT_INPUT_TYPES.has((el.type ?? 'text').toLowerCase());
    default:
      return false;
  }
}

/** The MIDI note a key plays at `octave`, or null if it is not a note key or off the piano. */
export function noteForKey(code: string, octave: number): number | null {
  const offset = OFFSETS.get(code);
  if (offset === undefined) return null;
  const midi = (octave + 1) * 12 + offset;
  return isPianoKey(midi) ? midi : null;
}

export type KeyAction = { kind: 'note'; event: NoteEvent } | { kind: 'octave'; octave: number };

/** Pure key handling; the DOM binding below only forwards events to it. */
export function createKeyboardMapper(initialOctave = DEFAULT_OCTAVE) {
  let octave = initialOctave;
  // The note a key started, so releasing it after an octave shift ends the right note.
  const pressed = new Map<string, number>();

  return {
    get octave() {
      return octave;
    },
    keyDown(e: KeyLike): KeyAction | null {
      if (e.repeat || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return null;
      if (isTextEntry(e.target)) return null;
      if (e.code === OCTAVE_DOWN_KEY || e.code === OCTAVE_UP_KEY) {
        const next = Math.min(
          MAX_OCTAVE,
          Math.max(MIN_OCTAVE, octave + (e.code === OCTAVE_UP_KEY ? 1 : -1)),
        );
        if (next === octave) return null;
        octave = next;
        return { kind: 'octave', octave };
      }
      if (pressed.has(e.code)) return null;
      const midi = noteForKey(e.code, octave);
      if (midi === null) return null;
      pressed.set(e.code, midi);
      return {
        kind: 'note',
        event: { type: 'on', midi, velocity: KEYBOARD_VELOCITY, time: e.timeStamp },
      };
    },
    keyUp(e: Pick<KeyLike, 'code' | 'timeStamp'>): NoteEvent | null {
      const midi = pressed.get(e.code);
      if (midi === undefined) return null;
      pressed.delete(e.code);
      return { type: 'off', midi, velocity: 0, time: e.timeStamp };
    },
    /** Forgets held keys, e.g. when the window loses focus and key-ups will never arrive. */
    releaseAll(): void {
      pressed.clear();
    },
  };
}

export interface KeyboardInput extends NoteInput {
  getOctave: () => number;
  /** For `useSyncExternalStore`. */
  subscribeOctave: (onChange: () => void) => () => void;
  /**
   * Stops playing notes (held ones are released) until the returned function is called, so a
   * page can use the letter keys for itself. Suspensions nest.
   */
  suspend: () => () => void;
}

/** `target` receives keydown, keyup and blur; in the app that is `window`. */
export function createKeyboardInput(
  target: EventTarget | null = globalThis.window ?? null,
): KeyboardInput {
  const mapper = createKeyboardMapper();
  const octaveListeners = new Set<() => void>();
  let suspended = 0;
  let current: Emit | null = null;

  return {
    id: 'keyboard',
    start(emit: Emit) {
      if (!target) return () => undefined;
      current = emit;
      const onKeyDown = (e: Event) => {
        if (suspended > 0) return;
        const action = mapper.keyDown(e as KeyboardEvent);
        if (action?.kind === 'note') emit(action.event);
        if (action?.kind === 'octave') for (const listener of [...octaveListeners]) listener();
      };
      const onKeyUp = (e: Event) => {
        const event = mapper.keyUp(e as KeyboardEvent);
        if (event) emit(event);
      };
      const onBlur = (e: Event) => {
        mapper.releaseAll();
        emit({ type: 'reset', time: e.timeStamp });
      };
      target.addEventListener('keydown', onKeyDown);
      target.addEventListener('keyup', onKeyUp);
      target.addEventListener('blur', onBlur);
      return () => {
        target.removeEventListener('keydown', onKeyDown);
        target.removeEventListener('keyup', onKeyUp);
        target.removeEventListener('blur', onBlur);
        mapper.releaseAll();
        if (current === emit) current = null;
      };
    },
    suspend() {
      if (suspended++ === 0) {
        mapper.releaseAll();
        current?.({ type: 'reset', time: globalThis.performance?.now() ?? 0 });
      }
      let done = false;
      return () => {
        if (done) return;
        done = true;
        suspended--;
      };
    },
    getOctave: () => mapper.octave,
    subscribeOctave(onChange) {
      octaveListeners.add(onChange);
      return () => void octaveListeners.delete(onChange);
    },
  };
}
