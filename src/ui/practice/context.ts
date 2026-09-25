import { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import type { PieceStep } from '../../core/pieceRecords.ts';
import type { PracticeData, PracticeStore, StorageStatus } from './store.ts';

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

export function useStorageStatus(): StorageStatus {
  const store = usePracticeStore();
  return useSyncExternalStore(store.subscribeStatus, store.getStatus);
}

/** A piece's step records, read from storage on first use; null while loading. */
export function usePieceSteps(pieceId: string): readonly PieceStep[] | null {
  const store = usePracticeStore();
  const steps = useSyncExternalStore(store.subscribePieceSteps, () => store.getPieceSteps(pieceId));
  useEffect(() => {
    if (steps === null) store.loadPieceSteps(pieceId);
  }, [store, pieceId, steps]);
  return steps;
}
