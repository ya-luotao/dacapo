import type { ReactNode } from 'react';
import { MetronomeContext, type MetronomeHandle } from './context.ts';

/** The app's one metronome, made outside React (see main.tsx) so StrictMode cannot make two. */
export function MetronomeProvider({
  handle,
  children,
}: {
  handle: MetronomeHandle;
  children: ReactNode;
}) {
  return <MetronomeContext value={handle}>{children}</MetronomeContext>;
}
