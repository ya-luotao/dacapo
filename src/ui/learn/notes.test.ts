import { describe, expect, it } from 'vitest';
import { MAJOR_TONICS } from '../../core/keys.ts';
import { phraseIn, pitchName, relativeMinor, scaleRun, scaleUp } from './notes.ts';

const names = (run: ReturnType<typeof scaleRun>) => run.map((n) => pitchName(n.pitch)).join(' ');

describe('the lessons’ scales', () => {
  it('spell the minors with each letter once, the raised notes as sharps or naturals', () => {
    expect(names(scaleRun('harmonicMinor', 'A').slice(0, 8))).toBe('A4 B4 C5 D5 E5 F5 G♯5 A5');
    expect(names(scaleRun('harmonicMinor', 'F#').slice(0, 8))).toBe('F♯4 G♯4 A4 B4 C♯5 D5 E♯5 F♯5');
    expect(names(scaleRun('melodicMinor', 'D'))).toBe(
      'D4 E4 F4 G4 A4 B4 C♯5 D5 C5 B♭4 A4 G4 F4 E4 D4',
    );
    expect(scaleUp('naturalMinor', 'C')).toEqual([60, 62, 63, 65, 67, 68, 70, 72]);
  });

  it('refuse a scale that needs a double sharp', () => {
    expect(() => scaleRun('harmonicMinor', 'G#')).toThrow();
    expect(() => scaleRun('naturalMinor', 'G#')).not.toThrow();
  });

  it('find each major key’s relative minor, a minor third below, except F♯ major’s D♯ minor', () => {
    expect(MAJOR_TONICS.map((t) => relativeMinor(t) ?? '-')).toEqual([
      'A',
      'E',
      'B',
      'F#',
      'C#',
      'G#',
      '-',
      'Bb',
      'F',
      'C',
      'G',
      'D',
    ]);
  });

  it('end a phrase in a minor key on its tonic, after its raised 7th, over its 5th and tonic', () => {
    const a = phraseIn({ tonic: 'A', mode: 'minor' });
    expect(a.tune.map((p) => pitchName(p)).join(' ')).toBe('C5 B4 D5 G♯4 A4');
    expect(a.bass.map((p) => pitchName(p)).join(' ')).toBe('E3 A2');
    expect(a.fifths).toBe(0);
    const c = phraseIn({ tonic: 'C', mode: 'major' });
    expect(c.tune.map((p) => pitchName(p)).join(' ')).toBe('E5 D5 F5 B4 C5');
    expect(c.bass.map((p) => pitchName(p)).join(' ')).toBe('G3 C3');
    const g = phraseIn({ tonic: 'G', mode: 'minor' });
    expect(g.tune.map((p) => pitchName(p)).join(' ')).toBe('B♭4 A4 C5 F♯4 G4');
    expect(g.fifths).toBe(-2);
    expect(g.sound).toEqual([[50, 70], 69, 72, 66, [55, 67]]);
  });
});
