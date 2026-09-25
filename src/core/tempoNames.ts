// The Italian tempo marks, one per range of the metronome's scale, as printed on a Maelzel
// metronome (which gives overlapping ranges; each mark here starts where the next one ends).

export const TEMPO_NAMES = [
  'grave',
  'largo',
  'larghetto',
  'adagio',
  'andante',
  'moderato',
  'allegro',
  'presto',
  'prestissimo',
] as const;

export type TempoName = (typeof TEMPO_NAMES)[number];

/** Each mark's lowest tempo; it runs up to the next mark's. */
export const TEMPO_FROM: Readonly<Record<TempoName, number>> = {
  grave: 20,
  largo: 40,
  larghetto: 60,
  adagio: 66,
  andante: 76,
  moderato: 108,
  allegro: 120,
  presto: 168,
  prestissimo: 200,
};

export function tempoName(bpm: number): TempoName {
  let name: TempoName = TEMPO_NAMES[0];
  for (const n of TEMPO_NAMES) if (bpm >= TEMPO_FROM[n]) name = n;
  return name;
}

/** The mark's range, the upper end included; null for the last, which is open. */
export function tempoRange(name: TempoName): { from: number; to: number | null } {
  const i = TEMPO_NAMES.indexOf(name);
  const next = TEMPO_NAMES[i + 1];
  return { from: TEMPO_FROM[name], to: next ? TEMPO_FROM[next] - 1 : null };
}

/** The Italian word as printed. */
export const tempoWord = (name: TempoName) => name[0]!.toUpperCase() + name.slice(1);
