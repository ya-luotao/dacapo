import { describe, expect, it } from 'vitest';
// @ts-expect-error The anatomy kit is plain JavaScript, used by the figure's build.
import * as kit from '../../../../scripts/figures/anatomy/iso-kit.mjs';
// @ts-expect-error The anatomy kit is plain JavaScript, used by the figure's build.
import * as lathe from '../../../../scripts/figures/anatomy/lathe.mjs';
import { iso, prismOf, solidSvg, translateAlong, type Frame, type Projection } from './draw.ts';

// The figure is drawn at rest by the kit and moved by these ports: a part that moves must look
// exactly as it did standing still.

type Kit = {
  iso: (point: number[], P: Projection) => number[];
  solidSvg: (paths: unknown, style: object) => string;
  translateAlong: (P: Projection, by: number[]) => string;
};
const K = kit as Kit;
const prism = (lathe as { prismOf: (...args: unknown[]) => unknown }).prismOf;

const P: Projection = { origin: [634.1, 293.1], scale: 1.0934, azimuth: 57, elevation: 30 };
const ALONG: Frame = { o: [0, 0, 0], a: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] };
const SHAPES: [number, number][][] = [
  [
    [-10, 4],
    [-60, 4],
    [-60, 9],
    [-10, 9],
  ],
  [
    [-184.4, 55.2],
    [-190.8, 55.2],
    [-190.8, 58.8],
    [-189.8, 61],
    [-187.6, 62.2],
    [-185.4, 61],
    [-184.4, 58.8],
  ],
  [
    [-21.6, 13.6],
    [-58, 13.6],
    [-58, 18.8],
    [-25.6, 18.8],
    [-21.6, 16.4],
  ],
];

describe('anatomy ports', () => {
  it('projects like the kit', () => {
    expect(iso([-12, 30, 40], P)).toEqual(K.iso([-12, 30, 40], P));
    expect(translateAlong(P, [0, 1, 2.6])).toBe(K.translateAlong(P, [0, 1, 2.6]));
  });

  it('draws a prism and its solid exactly as the kit does', () => {
    for (const poly of SHAPES) {
      for (const [s0, s1] of [
        [2, 6.4],
        [60.1, 64.9],
      ] as const) {
        const ours = prismOf(ALONG, poly, s0, s1, P);
        const theirs = prism(ALONG, poly, s0, s1, P);
        expect(ours).toEqual(theirs);
        for (const style of [
          { tone: 'mid', crease: 'faint' },
          { tone: 'hi', crease: 'lo', lit: true },
        ]) {
          expect(solidSvg(ours, style)).toBe(K.solidSvg(theirs, style));
        }
      }
    }
  });
});
