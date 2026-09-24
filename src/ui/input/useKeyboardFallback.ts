import { useEffect, useState } from 'react';
import { useMidiStatus } from './context.ts';

/**
 * Whether to show help for the computer-keyboard fallback: no MIDI device, or the browser is
 * still asking after 1.5 s. Access is usually granted within milliseconds, so a connected
 * keyboard does not make the help flash on every load.
 */
export function useKeyboardFallback(): boolean {
  const status = useMidiStatus();
  const pending = status.state === 'pending';
  const [long, setLong] = useState(false);
  useEffect(() => {
    if (!pending) return;
    const id = setTimeout(() => setLong(true), 1500);
    return () => clearTimeout(id);
  }, [pending]);
  return status.state !== 'connected' && (!pending || long);
}
