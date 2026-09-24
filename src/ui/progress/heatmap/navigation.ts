import { useCallback, useRef, useState, type KeyboardEvent } from 'react';

type Focusable = HTMLElement | SVGElement;

const STEP: Readonly<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowUp: -1,
  ArrowRight: 1,
  ArrowDown: 1,
};

/**
 * One tab stop for a row of cells (a roving tabindex): the arrow keys, Home and End move between
 * them. The details shown are those of the cell last hovered or focused; Escape hides them until
 * the next move.
 */
export function useCellNavigation(ids: readonly string[]) {
  const elements = useRef(new Map<string, Focusable>());
  const [current, setCurrent] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  // The latest kind of interaction wins, so moving with the arrow keys is not stuck on a note
  // the mouse happens to rest on.
  const [latest, setLatest] = useState<'hover' | 'focus'>('hover');

  const tabStop = current !== null && ids.includes(current) ? current : (ids[0] ?? null);
  const pick = (id: string | null) => (id !== null && ids.includes(id) ? id : null);
  const shown = dismissed
    ? null
    : latest === 'focus'
      ? (pick(focused) ?? pick(hovered))
      : (pick(hovered) ?? pick(focused));

  const register = useCallback(
    (id: string) => (el: Focusable | null) => {
      if (el) elements.current.set(id, el);
      else elements.current.delete(id);
    },
    [],
  );

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      setDismissed(true);
      return;
    }
    const from = ids.indexOf(focused ?? tabStop ?? '');
    let to: number;
    if (event.key === 'Home') to = 0;
    else if (event.key === 'End') to = ids.length - 1;
    else if (event.key in STEP) to = Math.min(ids.length - 1, Math.max(0, from + STEP[event.key]!));
    else return;
    event.preventDefault();
    const id = ids[to];
    if (id !== undefined) elements.current.get(id)?.focus();
  }

  /** Props for the focusable element of the cell `id`. */
  function cellProps(id: string) {
    return {
      ref: register(id),
      tabIndex: id === tabStop ? 0 : -1,
      onFocus: () => {
        setFocused(id);
        setCurrent(id);
        setLatest('focus');
        setDismissed(false);
      },
      onBlur: () => setFocused((f) => (f === id ? null : f)),
      onPointerEnter: () => {
        setHovered(id);
        setLatest('hover');
        setDismissed(false);
      },
      onPointerLeave: () => setHovered((h) => (h === id ? null : h)),
      // A tap focuses the cell, so its details stay after the finger lifts.
      onClick: () => elements.current.get(id)?.focus(),
    };
  }

  const element = useCallback((id: string) => elements.current.get(id) ?? null, []);

  return { shown, onKeyDown, cellProps, element };
}
