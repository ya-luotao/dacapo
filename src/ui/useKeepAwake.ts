import { useEffect } from 'react';
import { holdKeepAwake } from '../lib/shell.ts';
import { useInput } from './input/context.ts';

/** How long a session that waits for the player keeps the screen on without a key being played. */
export const KEEP_AWAKE_IDLE_MS = 5 * 60_000;

/**
 * Keeps the screen on while `active` (in the Apple app; nothing in a browser). With `idleMs`, it
 * lets go after that long without a key played and takes hold again at the next key: a session
 * that waits for the player should not keep a forgotten iPad awake.
 */
export function useKeepAwake(active: boolean, idleMs: number | null = null): void {
  const { hub } = useInput();

  useEffect(() => {
    if (!active) return;
    let release: (() => void) | null = holdKeepAwake();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        release?.();
        release = null;
      }, idleMs ?? 0);
    };
    if (idleMs === null) return () => release?.();
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
    };
  }, [active, idleMs, hub]);
}
