import { useSyncExternalStore } from 'react';
import type { OutputState } from '../../output/output.ts';
import { useInput } from '../input/context.ts';

export function useOutputState(): OutputState {
  const { output } = useInput();
  return useSyncExternalStore(output.subscribe, output.getState);
}
