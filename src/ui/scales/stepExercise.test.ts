import { describe, expect, it } from 'vitest';
import { CHROMATIC_TONICS, MAJOR_TONICS, MINOR_TONICS } from '../../core/keys.ts';
import { isScaleExercise, tonicsFor } from '../../core/scales.ts';
import { HANON_TRILL, type ScaleExercise } from '../../core/scaleTypes.ts';
import { HANON_NUMBERS, techniqueRules } from '../../core/technique.ts';
import { adjacentExercise } from './stepExercise.ts';

describe('adjacentExercise', () => {
  it('steps major scales forward and backward around the circle of fifths with wrap-around', () => {
    const cMajor: ScaleExercise = { type: 'major', tonic: 'C', octaves: 2, hands: 'both' };
    const forward = adjacentExercise(cMajor, 1);
    expect(forward).toEqual({ ...cMajor, tonic: MAJOR_TONICS[1] });
    expect(forward?.tonic).toBe('G');
    expect(isScaleExercise(forward)).toBe(true);

    const backFromC = adjacentExercise(cMajor, -1);
    expect(backFromC).toEqual({ ...cMajor, tonic: MAJOR_TONICS[MAJOR_TONICS.length - 1] });
    expect(backFromC?.tonic).toBe('F');

    const wrapForward = adjacentExercise(backFromC!, 1);
    expect(wrapForward).toEqual(cMajor);
  });

  it('steps natural minor scales around MINOR_TONICS', () => {
    const aMinor: ScaleExercise = { type: 'naturalMinor', tonic: 'A', octaves: 1, hands: 'right' };
    expect(adjacentExercise(aMinor, 1)).toEqual({ ...aMinor, tonic: MINOR_TONICS[1] });
    expect(adjacentExercise(aMinor, -1)).toEqual({
      ...aMinor,
      tonic: MINOR_TONICS[MINOR_TONICS.length - 1],
    });
  });

  it('steps chromatic scales through CHROMATIC_TONICS preserving octaves and hands', () => {
    const cChrom: ScaleExercise = { type: 'chromatic', tonic: 'C', octaves: 2, hands: 'contrary' };
    expect(adjacentExercise(cChrom, 1)).toEqual({ ...cChrom, tonic: CHROMATIC_TONICS[1] });
    expect(adjacentExercise(cChrom, -1)).toEqual({
      ...cChrom,
      tonic: CHROMATIC_TONICS[CHROMATIC_TONICS.length - 1],
    });
  });

  it('steps numbered variants for single-tonic Hanon exercises and wraps cleanly', () => {
    const hanon1: ScaleExercise = {
      type: 'hanon',
      tonic: 'C',
      octaves: 2,
      hands: 'both',
      variant: HANON_NUMBERS[0],
    };
    const next = adjacentExercise(hanon1, 1);
    expect(next).toEqual({ ...hanon1, variant: '2', tonic: 'C' });
    expect(isScaleExercise(next)).toBe(true);

    const prev = adjacentExercise(hanon1, -1);
    expect(prev).toEqual({
      ...hanon1,
      variant: HANON_NUMBERS[HANON_NUMBERS.length - 1],
      tonic: 'C',
    });
    expect(adjacentExercise(prev!, 1)).toEqual(hanon1);
  });

  it('steps repeatedNotes and thirds variants and keeps valid tonics', () => {
    const repVariants = techniqueRules('repeatedNotes').variants;
    const repStart: ScaleExercise = {
      type: 'repeatedNotes',
      tonic: 'C',
      octaves: 2,
      hands: 'both',
      variant: repVariants[0],
    };
    const repNext = adjacentExercise(repStart, 1);
    expect(repNext).toEqual({
      ...repStart,
      variant: repVariants[1],
      tonic: tonicsFor('repeatedNotes', repVariants[1])[0],
    });
    expect(isScaleExercise(repNext)).toBe(true);

    const thirdVariants = techniqueRules('thirds').variants;
    const thirdStart: ScaleExercise = {
      type: 'thirds',
      tonic: 'C',
      octaves: 2,
      hands: 'both',
      variant: thirdVariants[0],
    };
    const thirdPrev = adjacentExercise(thirdStart, -1);
    const lastThirdVariant = thirdVariants[thirdVariants.length - 1]!;
    expect(thirdPrev).toEqual({
      ...thirdStart,
      variant: lastThirdVariant,
      tonic: tonicsFor('thirds', lastThirdVariant)[0],
    });
    expect(isScaleExercise(thirdPrev)).toBe(true);
  });

  it('steps trill variants when on Hanon No. 46 and tonics when on a finger-pair trill', () => {
    const trillVariants = techniqueRules('trill').variants;
    const hanonTrill: ScaleExercise = {
      type: 'trill',
      tonic: 'C',
      octaves: 1,
      hands: 'both',
      variant: HANON_TRILL,
    };
    const nextFrom46 = adjacentExercise(hanonTrill, 1);
    expect(nextFrom46).toEqual({
      ...hanonTrill,
      variant: trillVariants[1],
      tonic: tonicsFor('trill', trillVariants[1])[0],
    });

    const pairTrill: ScaleExercise = {
      type: 'trill',
      tonic: 'C',
      octaves: 1,
      hands: 'right',
      variant: '12-4',
    };
    expect(adjacentExercise(pairTrill, 1)).toEqual({ ...pairTrill, tonic: 'G' });
    expect(adjacentExercise(pairTrill, -1)).toEqual({ ...pairTrill, tonic: 'F' });
  });

  it('returns null for octaves which has only one tonic and no variants', () => {
    const octaves: ScaleExercise = { type: 'octaves', tonic: 'C', octaves: 2, hands: 'both' };
    expect(adjacentExercise(octaves, 1)).toBeNull();
    expect(adjacentExercise(octaves, -1)).toBeNull();
  });

  it('falls back to index 0 when the current tonic or variant is not listed', () => {
    const oddMajor: ScaleExercise = { type: 'major', tonic: 'B#', octaves: 1, hands: 'right' };
    expect(adjacentExercise(oddMajor, 1)).toEqual({ ...oddMajor, tonic: MAJOR_TONICS[1] });

    const oddHanon: ScaleExercise = {
      type: 'hanon',
      tonic: 'C',
      octaves: 2,
      hands: 'both',
      variant: '999',
    };
    expect(adjacentExercise(oddHanon, 1)).toEqual({ ...oddHanon, variant: HANON_NUMBERS[1] });
  });
});
