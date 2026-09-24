import type { ReactNode } from 'react';
import { PracticeContext } from './context.ts';
import type { PracticeStore } from './store.ts';

/** Provides the app's practice store, which is created and started once, outside React. */
export function PracticeProvider({
  store,
  children,
}: {
  store: PracticeStore;
  children: ReactNode;
}) {
  return <PracticeContext value={store}>{children}</PracticeContext>;
}
