import { useEffect, useState, useSyncExternalStore } from 'react';
import type { MonitorSettings } from '../../output/monitor.ts';
import { SETTLE_MS, type OutputState } from '../../output/output.ts';
import type { BankStatus } from '../../output/pianoSamples.ts';
import { useInput } from '../input/context.ts';

export function useOutputState(): OutputState {
  const { output } = useInput();
  return useSyncExternalStore(output.subscribe, output.getState);
}

/** Whether the built-in piano's samples are loaded. */
export function useSampleStatus(): BankStatus {
  const { samples } = useInput();
  return useSyncExternalStore(samples.subscribe, samples.getStatus);
}

/** Which keys the built-in piano sounds. */
export function useMonitorSettings(): MonitorSettings {
  const { monitor } = useInput();
  return useSyncExternalStore(monitor.subscribe, monitor.getSettings);
}

/**
 * Whether what the app plays can sound: an output is selected. Right after the app starts, "auto"
 * may still be waiting for MIDI (up to `SETTLE_MS`), so no output yet is not taken for none until
 * then.
 */
export function useOutputSound(): 'ready' | 'none' | 'waiting' {
  const { selected, choice } = useOutputState();
  const [settled, setSettled] = useState(() => performance.now() > SETTLE_MS + 500);
  useEffect(() => {
    if (settled) return;
    const timer = setTimeout(() => setSettled(true), SETTLE_MS + 500 - performance.now());
    return () => clearTimeout(timer);
  }, [settled]);
  if (selected) return 'ready';
  return choice.kind === 'none' || settled ? 'none' : 'waiting';
}
