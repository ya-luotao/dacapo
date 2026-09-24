import { createContext, useContext, useSyncExternalStore } from 'react';
import type { PracticeData, PracticeStore } from './store.ts';

export const PracticeContext = createContext<PracticeStore | null>(null);

export function usePracticeStore(): PracticeStore {
  const store = useContext(PracticeContext);
  if (!store) throw new Error('usePracticeStore must be used inside <PracticeProvider>');
  return store;
}

export function usePractice(): PracticeData {
  const store = usePracticeStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
