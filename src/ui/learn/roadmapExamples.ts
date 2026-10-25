import type { RoadBar } from '../../core/roadmap.ts';

/**
 * The scores the glossary's entries on repeats and jumps draw with `RoadMap`
 * (roadmapFigures.tsx), the same in every language.
 */
export const ROADMAPS = {
  /** Bars 2 to 4 between repeat signs: 1 2 3 4 2 3 4 5. */
  repeat: [{}, { start: true }, {}, { end: true }, {}],
  /** Bar 3 the first ending, bar 4 the second: 1 2 3 1 2 4 5. */
  endings: [{ start: true }, {}, { ending: [1], end: true }, { ending: [2] }, {}],
  /** D.C. al Fine: 1 2 3 4 1 2. */
  daCapo: [{}, { fine: true }, {}, { jump: { from: 'dc', to: 'fine' } }],
  /** A repeat that ends at Fine, not taken again after the D.C.: 1 2 1 2 3 4 1 2. */
  fine: [{ start: true }, { end: true, fine: true }, {}, { jump: { from: 'dc', to: 'fine' } }],
  /** D.S. al Fine: 1 2 3 4 2 3. */
  dalSegno: [{}, { segno: true }, { fine: true }, { jump: { from: 'ds', to: 'fine' } }],
  /** D.S. al Coda: 1 2 3 4 2 3 5 6. */
  coda: [
    {},
    { segno: true },
    { toCoda: true },
    { jump: { from: 'ds', to: 'coda' } },
    { coda: true },
    {},
  ],
} as const satisfies Record<string, readonly RoadBar[]>;
