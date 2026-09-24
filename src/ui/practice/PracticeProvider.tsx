import { useState, type ReactNode } from 'react';
import { PracticeContext } from './context.ts';
import { createPracticeStore } from './store.ts';

/** Owns the practice data for the lifetime of the tab (in memory until storage lands). */
export function PracticeProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createPracticeStore());
  return <PracticeContext value={store}>{children}</PracticeContext>;
}
