import { useEffect, useLayoutEffect, useRef } from 'react';
import { isTextEntry } from '../input/keyboard.ts';

function shouldIgnoreTarget(target: EventTarget | null): boolean {
  if (isTextEntry(target)) return true;
  if (!(target instanceof Element)) return false;
  if (target.closest('details[open]') !== null) return true;
  const editable = target.closest('[contenteditable]');
  const attr = editable?.getAttribute('contenteditable');
  return attr === 'true' || attr === '';
}

/**
 * Attaches a window `keydown` listener to invoke `onStop` on Escape while `enabled` is true.
 * Ignores modified/IME/already-handled events, open modal dialogs, open `<details>` panels, and
 * text-entry/select controls.
 */
export function useEscapeToStop(onStop: () => void, enabled = true): void {
  const latest = useRef(onStop);
  useLayoutEffect(() => {
    latest.current = onStop;
  });

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key !== 'Escape' ||
        e.defaultPrevented ||
        e.isComposing ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      ) {
        return;
      }
      if (document.querySelector('[role="dialog"], [aria-modal="true"]') !== null) return;
      if (shouldIgnoreTarget(e.target)) return;
      e.preventDefault();
      latest.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
