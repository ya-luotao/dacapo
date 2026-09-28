import { useEffect } from 'react';
import { beginPractice, holdKeepAwake } from '../lib/shell.ts';
import { useInput } from './input/context.ts';

/** How long a session that waits for the player keeps the screen on without a key being played. */
export const KEEP_AWAKE_IDLE_MS = 5 * 60_000;

/**
 * Keeps the screen on while `active` (in the Apple app; nothing in a browser), and marks it as
 * practice, which sync waits for (`beginPractice`). With `idleMs`, the screen is let go after that
 * long without a key played and taken again at the next key: a session that waits for the player
 * should not keep a forgotten iPad awake. The practice lasts as long as `active`.
 */
export function useKeepAwake(active: boolean, idleMs: number | null = null): void {
  const { hub } = useInput();

  useEffect(() => {
    if (!active) return;
    const endPractice = beginPractice();
    let release: (() => void) | null = holdKeepAwake();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        release?.();
        release = null;
      }, idleMs ?? 0);
    };
    if (idleMs === null) {
      return () => {
        release?.();
        endPractice();
      };
    }
    arm();
    const stop = hub.onEvent((event) => {
      if (event.type !== 'on') return;
      release ??= holdKeepAwake();
      arm();
    });
    return () => {
      clearTimeout(timer);
      stop();
      release?.();
      endPractice();
    };
  }, [active, idleMs, hub]);
}
