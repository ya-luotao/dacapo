import { useEffect, useState, type ReactNode } from 'react';
import { createInputSystem } from '../../input/index.ts';
import { InputContext } from './context.ts';

/**
 * Owns the app's single input system. StrictMode runs the effect twice (start → stop → start);
 * the sources are built for that, and webmidi.ts reports a second listener on a port in development.
 */
export function InputProvider({ children }: { children: ReactNode }) {
  const [system] = useState(createInputSystem);
  useEffect(() => system.start(), [system]);
  return <InputContext value={system}>{children}</InputContext>;
}
