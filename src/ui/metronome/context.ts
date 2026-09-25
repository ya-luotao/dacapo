import { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import type { Meter } from '../../core/metronomeSettings.ts';
import type { Metronome, MetronomeSnapshot } from '../../output/metronome.ts';

/**
 * A tempo a page offers the metronome: the piece being practised, at the tempo chosen. Without a
 * meter the tempo is in quarter notes and the metronome keeps its own meter.
 */
export interface TempoOffer {
  bpm: number;
  meter: Meter | null;
}

export interface OfferStore {
  get: () => TempoOffer | null;
  set: (offer: TempoOffer | null) => void;
  subscribe: (onChange: () => void) => () => void;
}

export function createOfferStore(): OfferStore {
  let offer: TempoOffer | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => offer,
    set(next) {
      offer = next;
      for (const listener of [...listeners]) listener();
    },
    subscribe(onChange) {
      listeners.add(onChange);
      return () => void listeners.delete(onChange);
    },
  };
}

export interface MetronomeHandle {
  metronome: Metronome;
  offers: OfferStore;
}

export const MetronomeContext = createContext<MetronomeHandle | null>(null);

function useHandle(): MetronomeHandle {
  const handle = useContext(MetronomeContext);
  if (!handle) throw new Error('useMetronome must be used inside <MetronomeProvider>');
  return handle;
}

export function useMetronome(): Metronome {
  return useHandle().metronome;
}

export function useMetronomeState(): MetronomeSnapshot {
  const { metronome } = useHandle();
  return useSyncExternalStore(metronome.subscribe, metronome.getSnapshot);
}

export function useTempoOffer(): TempoOffer | null {
  const { offers } = useHandle();
  return useSyncExternalStore(offers.subscribe, offers.get);
}

/** Offers a tempo while the calling component is mounted (null: none). */
export function useOfferTempo(offer: TempoOffer | null): void {
  const { offers } = useHandle();
  const bpm = offer?.bpm;
  const numerator = offer?.meter?.numerator;
  const denominator = offer?.meter?.denominator;
  useEffect(() => {
    if (bpm === undefined) return;
    offers.set({
      bpm,
      meter: numerator && denominator ? { numerator, denominator } : null,
    });
    return () => offers.set(null);
  }, [offers, bpm, numerator, denominator]);
}
