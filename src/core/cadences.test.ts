import { describe, expect, it } from 'vitest';
import {
  CADENCE_LEVEL_IDS,
  CADENCE_PROGRESSIONS,
  CADENCE_RULES,
  CADENCES,
  cadenceFits,
  cadenceKeyChords,
  cadenceKeyOf,
  cadenceKeys,
  cadenceMelodyKey,
  cadenceOfNumerals,
  cadenceTiming,
  makeCadence,
  readCadence,
  voiceCadence,
} from './cadences.ts';
import { keyTonic } from './progressions.ts';
import { seededRng } from './random.ts';
import { parallels } from './voiceLeading.ts';

describe('cadence progressions', () => {
  it('end in their cadence, and start from the tonic chord and the same few chords', () => {
    for (const mode of ['major', 'minor'] as const)
      for (const cadence of CADENCES)
        for (const p of CADENCE_PROGRESSIONS[mode][cadence]) {
          expect(cadenceOfNumerals(p)).toBe(cadence);
          expect(p[0]).toBe(mode === 'major' ? 'I' : 'i');
          expect(mode === 'major' ? ['IV', 'ii', 'vi'] : ['iv', 'VI']).toContain(p[1]);
          expect(p).toHaveLength(4);
        }
  });

  it('spells the chords in the key', () => {
    expect(cadenceKeyChords('D', ['I', 'IV', 'V', 'vi']).map((c) => c.text)).toEqual([
      'D',
      'G',
      'A',
      'Bm',
    ]);
    expect(cadenceKeyChords('C#m', ['i', 'VI', 'V', 'VI']).map((c) => c.text)).toEqual([
      'C♯m',
      'A',
      'G♯',
      'A',
    ]);
  });
});

describe('levels', () => {
  it('add a cadence a level, then the minor keys', () => {
    expect(CADENCE_LEVEL_IDS.map((l) => CADENCE_RULES[l].cadences)).toEqual([
      ['authentic', 'half'],
      ['authentic', 'plagal', 'half'],
      CADENCES,
      CADENCES,
    ]);
    expect(cadenceKeys('CA3')).toHaveLength(12);
    expect(cadenceKeys('CA4')).toHaveLength(24);
  });

  it('keeps an answer’s key as a key of its level', () => {
    expect(cadenceMelodyKey('F#m')).toEqual({ tonic: 'F#', scale: 'harmonicMinor' });
    expect(cadenceKeyOf('CA4', { tonic: 'F#', scale: 'harmonicMinor' })).toBe('F#m');
    expect(cadenceKeyOf('CA3', { tonic: 'F#', scale: 'harmonicMinor' })).toBeNull();
    expect(cadenceKeyOf('CA1', { tonic: 'Bb', scale: 'major' })).toBe('Bb');
    expect(cadenceKeyOf('CA1', { tonic: 'A#', scale: 'major' })).toBeNull();
    expect(cadenceKeyOf('CA1', { tonic: 'C', scale: 'naturalMinor' })).toBeNull();
    expect(cadenceKeyOf('CA1', { tonic: 'C', scale: 'major', mode: 'major' })).toBeNull();
  });
});

describe('prompts', () => {
  it('are a progression ending in the cadence, voiced in four parts, in every level', () => {
    const rng = seededRng(3);
    let pairs = 0;
    let outer = 0;
    for (const level of CADENCE_LEVEL_IDS)
      for (const cadence of CADENCE_RULES[level].cadences)
        for (let i = 0; i < 60; i++) {
          const p = makeCadence(cadence, level, rng);
          expect(cadenceKeys(level)).toContain(p.key);
          const notes = p.chords.flat();
          expect(cadenceFits(cadence, p.key, notes)).toBe(true);
          expect(readCadence(p.key, notes)).toEqual(p.numerals);
          for (const other of CADENCES)
            if (other !== cadence) expect(cadenceFits(other, p.key, notes)).toBe(false);
          for (const [bass, ...upper] of p.chords) {
            expect(bass).toBeGreaterThanOrEqual(41);
            expect(bass).toBeLessThanOrEqual(52);
            expect(upper[0]).toBeGreaterThan(bass!);
            expect(upper.at(-1)).toBeLessThanOrEqual(81);
          }
          for (let c = 1; c < p.chords.length; c++) {
            const [b1, ...u1] = p.chords[c - 1]!;
            const [b2, ...u2] = p.chords[c]!;
            pairs++;
            outer += parallels({ bass: b1!, upper: u1 }, { bass: b2!, upper: u2 }).outer;
          }
        }
    // No parallel fifths or octaves between the bass and the top voice.
    expect(pairs).toBeGreaterThan(1000);
    expect(outer).toBe(0);
  });

  it('voice the first chord as asked, and the others to move least', () => {
    expect(voiceCadence('C', ['I', 'IV', 'V', 'I'], 0)).toEqual([
      [48, 60, 64, 67],
      [41, 60, 65, 69],
      [43, 59, 62, 67],
      [48, 60, 64, 67],
    ]);
  });

  it('are read back only as this app draws them', () => {
    const notes = voiceCadence('G', ['I', 'vi', 'IV', 'V'], 1).flat();
    expect(readCadence('G', notes)).toEqual(['I', 'vi', 'IV', 'V']);
    expect(readCadence('D', notes)).toBeNull();
    expect(readCadence('G', notes.slice(4))).toBeNull();
    // The bass above the chord, or a wrong key in it.
    const moved = [...notes];
    moved[0] = moved[0]! + 24;
    expect(readCadence('G', moved)).toBeNull();
    const wrong = [...notes];
    wrong[5] = wrong[5]! + 1;
    expect(readCadence('G', wrong)).toBeNull();
    expect(keyTonic('Ebm')).toEqual({ tonic: 'Eb', mode: 'minor' });
  });

  it('sound a chord a second, the last one longer, the answer opening at it', () => {
    const timed = cadenceTiming(voiceCadence('C', ['I', 'IV', 'V', 'I'], 0).flat());
    expect(timed.map((n) => n.on)).toEqual([
      0, 0, 0, 0, 1000, 1000, 1000, 1000, 2000, 2000, 2000, 2000, 3000, 3000, 3000, 3000,
    ]);
    expect(timed.at(-1)!.off).toBe(4800);
    expect(timed[0]!.off).toBe(900);
  });
});
