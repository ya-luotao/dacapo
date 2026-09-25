import { useSyncExternalStore, type ReactNode } from 'react';
import { useKeepAwake } from '../useKeepAwake.ts';
import { MetronomeContext, type MetronomeHandle } from './context.ts';

/** The app's one metronome, made outside React (see main.tsx) so StrictMode cannot make two. */
export function MetronomeProvider({
  handle,
  children,
}: {
  handle: MetronomeHandle;
  children: ReactNode;
}) {
  const { metronome } = handle;
  const running = useSyncExternalStore(
    metronome.subscribe,
    () => metronome.getSnapshot().status === 'running',
  );
  // The screen stays on while it ticks (in the Apple app; nothing in a browser).
  useKeepAwake(running);
  return <MetronomeContext value={handle}>{children}</MetronomeContext>;
}
