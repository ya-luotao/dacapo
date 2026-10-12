import { describe, expect, it } from 'vitest';
import {
  BALANCE,
  HAMMER,
  HAMMER_MAX,
  KEY,
  NOTES,
  partsOf,
  placeUZ,
  poseOf,
  speakingOf,
  stringRuns,
  STRING_Z,
  struckStrings,
  tensionOf,
  turn,
  UNISON,
} from './grandPiano.ts';
import { LET_OFF } from './pianoAction.ts';

const kgf = (newtons: number) => newtons / 9.81;

describe('grand piano section', () => {
  it('tunes every string with the tension of a real scale, about 70 kgf', () => {
    for (let i = 0; i < NOTES; i++) {
      expect(kgf(tensionOf(i))).toBeGreaterThan(65);
      expect(kgf(tensionOf(i))).toBeLessThan(76);
    }
  });

  it('gives A4 380 mm of speaking length, and longer strings lower down', () => {
    expect(speakingOf(9)).toBeCloseTo(380, 6);
    for (let i = 1; i < NOTES; i++) expect(speakingOf(i)).toBeLessThan(speakingOf(i - 1));
  });

  it('lets 10 mm of key dip throw the hammer about 47 mm, crown to string', () => {
    const front = turn(
      [KEY.from, KEY.bottom],
      BALANCE,
      poseOf({ key: 1, jack: 0, hammer: 0, damper: 0 }).key,
    );
    expect(KEY.bottom - front[1]).toBeCloseTo(KEY.dip, 1);
    const felt = partsOf(0).find((part) => part.id === 'felt');
    if (felt?.kind !== 'prism') throw new Error('no felt');
    const top = (hammer: number) =>
      Math.max(
        ...felt.poly.map(
          (point) => placeUZ('hammer', point, poseOf({ key: 0, jack: 0, hammer, damper: 0 }))[1],
        ),
      );
    expect(top(1)).toBeCloseTo(STRING_Z - 0.5, 1);
    expect(top(1) - top(0)).toBeGreaterThan(44);
    expect(top(1) - top(0)).toBeLessThan(50);
    expect(HAMMER_MAX).toBeGreaterThan(0);
  });

  it('carries the knuckle with the jack while the key goes down', () => {
    // The jack's top and the knuckle rise together within a millimetre over the whole stroke.
    for (const key of [0.25, 0.5, LET_OFF]) {
      const pose = poseOf({ key, jack: 0, hammer: key, damper: 0 });
      const jackTop = placeUZ('jack', [HAMMER.knuckle[0], 98], pose)[1];
      const knuckle = placeUZ('hammer', HAMMER.knuckle, pose)[1] - HAMMER.knuckleR;
      expect(Math.abs(jackTop - knuckle)).toBeLessThan(1);
    }
  });

  it('strikes all three strings, or two with the soft pedal down', () => {
    expect(struckStrings(false)).toBe(UNISON);
    expect(struckStrings(true)).toBe(2);
  });

  it('runs each string from its pin to its hitch pin without a gap', () => {
    for (let i = 0; i < NOTES; i++) {
      for (let s = 0; s < UNISON; s++) {
        const runs = stringRuns(i, s);
        for (let n = 2; n < runs.length; n++)
          expect(runs[n]!.run[0][0]).toBe(runs[n - 1]!.run[1][0]);
        expect(runs.filter((run) => run.speaking).length).toBeGreaterThan(2);
      }
    }
  });
});
