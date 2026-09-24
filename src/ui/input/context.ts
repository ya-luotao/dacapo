import { createContext, useContext, useSyncExternalStore } from 'react';
import type { HubState, InputSystem, MidiStatus } from '../../input/index.ts';

export const InputContext = createContext<InputSystem | null>(null);

export function useInput(): InputSystem {
  const system = useContext(InputContext);
  if (!system) throw new Error('useInput must be used inside <InputProvider>');
  return system;
}

export function useHubState(): HubState {
  const { hub } = useInput();
  return useSyncExternalStore(hub.subscribe, hub.getState);
}

export function useMidiStatus(): MidiStatus {
  const { midi } = useInput();
  return useSyncExternalStore(midi.subscribeStatus, midi.getStatus);
}

export function useKeyboardOctave(): number {
  const { keyboard } = useInput();
  return useSyncExternalStore(keyboard.subscribeOctave, keyboard.getOctave);
}
