import { useSyncExternalStore } from 'react';
import type { MonitorSettings } from '../../output/monitor.ts';
import type { OutputState } from '../../output/output.ts';
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
