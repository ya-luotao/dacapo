import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import type { PulsePosition } from '../../core/pulse.ts';
import { useMetronome } from './context.ts';

/**
 * Added to a frame's time before asking what is heard: a frame is shown a little after its
 * timestamp. Measured in the browser (see the lane report); 0 means the frame's own time.
 */
export const DISPLAY_LEAD_MS = 0;

/**
 * Calls `onFrame` on every animation frame while `active`, with where the beat is for what is
 * heard then, and with null when it stops: once, or on every frame for `linger` ms more (for a
 * pendulum that settles). Drawing goes straight to the DOM: no React render per frame.
 */
export function useBeatFrame(
  active: boolean,
  onFrame: (position: PulsePosition | null, now: number) => void,
  linger = 0,
): void {
  const metronome = useMetronome();
  const callback = useRef(onFrame);
  const wasActive = useRef(false);
  useLayoutEffect(() => {
    callback.current = onFrame;
  });
  useEffect(() => {
    if (!active) {
      const stoppedAt = performance.now();
      callback.current(null, stoppedAt);
      if (!wasActive.current || linger <= 0) return;
      wasActive.current = false;
      let id = requestAnimationFrame(function frame(now) {
        callback.current(null, now);
        if (now - stoppedAt < linger) id = requestAnimationFrame(frame);
      });
      return () => cancelAnimationFrame(id);
    }
    wasActive.current = true;
    let id = requestAnimationFrame(function frame(now) {
      callback.current(metronome.position(now + DISPLAY_LEAD_MS), now);
      id = requestAnimationFrame(frame);
    });
    return () => {
      cancelAnimationFrame(id);
      callback.current(null, performance.now());
    };
  }, [active, linger, metronome]);
}

const REDUCED = '(prefers-reduced-motion: reduce)';

function subscribeReduced(onChange: () => void) {
  const query = globalThis.matchMedia?.(REDUCED);
  query?.addEventListener('change', onChange);
  return () => query?.removeEventListener('change', onChange);
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => globalThis.matchMedia?.(REDUCED).matches ?? false,
    () => false,
  );
}
