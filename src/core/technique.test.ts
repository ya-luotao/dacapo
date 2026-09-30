// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseMusicXml } from './musicxml.ts';
import {
  exerciseKey,
  handsAllowed,
  isScaleExercise,
  octavesOf,
  parseExerciseKey,
  scaleNotes,
  tonicsOf,
} from './scales.ts';
import { layoutOf, scaleHands, scaleMusicXml, takesPerBeat } from './scaleXml.ts';
import { TECHNIQUE_TYPES, type ScaleExercise, type ScaleNote } from './scaleTypes.ts';
import { type Hand } from './score.ts';
import { HANON_NUMBERS, techniqueRules } from './technique.ts';

const domParse = (s: string) => new DOMParser().parseFromString(s, 'application/xml');
const name = (n: ScaleNote) =>
  `${n.pitch.step}${['bb', 'b', '', '#', 'x'][n.pitch.alter + 2]}${n.pitch.octave}`;

/** Every technique exercise offered. */
function* techniqueExercises(): Generator<ScaleExercise> {
  for (const type of TECHNIQUE_TYPES) {
    const rules = techniqueRules(type);
    const variants = rules.variants.length > 0 ? rules.variants : [undefined];
    for (const tonic of rules.tonics)
      for (const octaves of rules.octaves)
        for (const hands of rules.hands)
          for (const variant of variants)
            yield { type, tonic, octaves, hands, ...(variant !== undefined && { variant }) };
  }
}

/** The steps of a hand as names: a chord's keys joined by '+'. */
function steps(notes: readonly ScaleNote[]): string[] {
  const out: string[][] = [];
  for (const n of notes) (out[n.index] ??= []).push(name(n));
  return out.map((s) => s.join('+'));
}

describe('technique exercises: keys and rules', () => {
  it('round-trips every exercise offered through its key, and nothing else', () => {
    let count = 0;
    for (const e of techniqueExercises()) {
      count++;
      expect(isScaleExercise(e), exerciseKey(e)).toBe(true);
      expect(parseExerciseKey(exerciseKey(e))).toEqual(e);
    }
    // 12 keys × 2 modes × 3 hands for the five-finger patterns; × 2 lengths for each kind of
    // chord; Hanon's twenty numbers × 3 hands.
    expect(count).toBe(72 + 144 + 144 + 3 * HANON_NUMBERS.length);
  });

  it('refuses what is not offered', () => {
    for (const key of [
      'majorFiveFinger:D:2:right', // one length only
      'majorFiveFinger:D:1:contrary',
      'majorFiveFinger:D#:1:right', // not a key of the list
      'minorChords:Db:1:right', // D♭ minor is spelled C♯
      'majorChords:C:1:both', // seven chords: no timing figure at all
      'majorBrokenChords:C:3:both',
      'majorChords:C:2:both:1', // no variant
      'hanon:C:2:both', // a number is needed
      'hanon:D:2:both:1',
      'hanon:C:1:both:1',
      'hanon:C:2:both:21',
      'hanon:C:2:contrary:1',
      'major:C:2:both:1', // a scale has no variant
    ])
      expect(parseExerciseKey(key), key).toBeNull();
    expect(parseExerciseKey('majorFiveFinger:D:1:right')).toEqual({
      type: 'majorFiveFinger',
      tonic: 'D',
      octaves: 1,
      hands: 'right',
    });
  });

  it('offers its own lengths, keys and hands', () => {
    expect(octavesOf('hanon')).toEqual([2]);
    expect(octavesOf('majorChords')).toEqual([2, 3]);
    expect(octavesOf('majorBrokenChords')).toEqual([1, 2]);
    expect(octavesOf('major')).toEqual([1, 2, 3, 4]);
    expect(tonicsOf('hanon')).toEqual(['C']);
    expect(tonicsOf('minorBrokenChords')).toEqual(tonicsOf('harmonicMinor'));
    expect(handsAllowed({ type: 'majorChords', octaves: 2 }, 'contrary')).toBe(false);
    expect(handsAllowed({ type: 'majorChords', octaves: 1 }, 'right')).toBe(false);
    expect(takesPerBeat('majorFiveFinger')).toBe(true);
    expect(takesPerBeat('hanon')).toBe(false);
    expect(takesPerBeat('majorChords')).toBe(false);
    expect(takesPerBeat('major')).toBe(true);
  });

  it('keeps every exercise within A0–C8, hands together the same number of steps', () => {
    for (const e of techniqueExercises()) {
      const { right, left } = scaleNotes(e);
      for (const n of [...right, ...left]) {
        expect(n.midi).toBeGreaterThanOrEqual(21);
        expect(n.midi).toBeLessThanOrEqual(108);
      }
      if (e.hands === 'both') expect(steps(right).length).toBe(steps(left).length);
    }
  });
});

describe('five-finger patterns', () => {
  it('plays 1 2 3 4 5 4 3 2 from the tonic four times and the tonic, the finger the degree', () => {
    const d = scaleNotes({ type: 'majorFiveFinger', tonic: 'D', octaves: 1, hands: 'both' });
    expect(d.right).toHaveLength(33);
    expect(d.right.slice(0, 9).map(name)).toEqual([
      'D4',
      'E4',
      'F#4',
      'G4',
      'A4',
      'G4',
      'F#4',
      'E4',
      'D4',
    ]);
    expect(d.right.slice(-9).map(name)).toEqual(d.right.slice(0, 9).map(name));
    expect(d.right.slice(0, 9).map((n) => n.finger)).toEqual([1, 2, 3, 4, 5, 4, 3, 2, 1]);
    expect(d.left.slice(0, 9).map(name)).toEqual([
      'D3',
      'E3',
      'F#3',
      'G3',
      'A3',
      'G3',
      'F#3',
      'E3',
      'D3',
    ]);
    expect(d.left.slice(0, 9).map((n) => n.finger)).toEqual([5, 4, 3, 2, 1, 2, 3, 4, 5]);
    // A pattern that never turns: one direction, the place in the group as its degree.
    expect(d.right.every((n) => n.direction === 'up' && !n.turn && n.pattern)).toBe(true);
    expect(d.right.slice(0, 10).map((n) => n.degree)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 0, 1]);
    expect(d.right.every((n) => n.crossing === null)).toBe(true);
    const cs = scaleNotes({ type: 'minorFiveFinger', tonic: 'C#', octaves: 1, hands: 'right' });
    expect(cs.right.slice(0, 5).map(name)).toEqual(['C#4', 'D#4', 'E4', 'F#4', 'G#4']);
  });
});

describe('block and broken chords', () => {
  it('climbs the inversions of the key’s triad two octaves and back', () => {
    const c = scaleNotes({ type: 'majorChords', tonic: 'C', octaves: 2, hands: 'right' });
    expect(steps(c.right)).toEqual([
      'C4+E4+G4',
      'E4+G4+C5',
      'G4+C5+E5',
      'C5+E5+G5',
      'E5+G5+C6',
      'G5+C6+E6',
      'C6+E6+G6',
      'G5+C6+E6',
      'E5+G5+C6',
      'C5+E5+G5',
      'G4+C5+E5',
      'E4+G4+C5',
      'C4+E4+G4',
    ]);
    expect(c.right.filter((n) => n.turn).map((n) => n.index)).toEqual([6, 6, 6]);
    // Degree is the inversion.
    expect(c.right.filter((_, i) => i % 3 === 0).map((n) => n.degree)).toEqual([
      0, 1, 2, 0, 1, 2, 0, 2, 1, 0, 2, 1, 0,
    ]);
    const fm = scaleNotes({ type: 'minorChords', tonic: 'F', octaves: 3, hands: 'left' });
    expect(steps(fm.left).slice(0, 2)).toEqual(['F2+Ab2+C3', 'Ab2+C3+F3']);
    expect(steps(fm.left)).toHaveLength(19);
  });

  it('breaks each chord low, middle, high, middle, and closes on the root', () => {
    const a = scaleNotes({ type: 'minorBrokenChords', tonic: 'A', octaves: 1, hands: 'right' });
    expect(a.right.map(name).join(' ')).toBe(
      'A4 C5 E5 C5 C5 E5 A5 E5 E5 A5 C6 A5 A5 C6 E6 C6 E5 A5 C6 A5 C5 E5 A5 E5 A4 C5 E5 C5 A4',
    );
    expect(a.right.every((n) => n.pattern)).toBe(true);
    expect(a.right.map((n) => n.degree).slice(0, 8)).toEqual([0, 1, 2, 3, 0, 1, 2, 3]);
    expect(a.right.findIndex((n) => n.turn)).toBe(15);
    expect(a.right.findIndex((n) => n.direction === 'down')).toBe(16);
  });
});

describe('technique exercises as MusicXML', () => {
  const samples: ScaleExercise[] = [
    { type: 'majorChords', tonic: 'Eb', octaves: 2, hands: 'both' },
    { type: 'minorChords', tonic: 'G#', octaves: 3, hands: 'left' },
    { type: 'majorBrokenChords', tonic: 'B', octaves: 2, hands: 'both' },
    { type: 'minorFiveFinger', tonic: 'F', octaves: 1, hands: 'both' },
    ...HANON_NUMBERS.map((variant) => ({
      type: 'hanon' as const,
      tonic: 'C',
      octaves: 2 as const,
      hands: 'both' as const,
      variant,
    })),
  ];

  it.each(samples.map((e) => [exerciseKey(e), e] as const))(
    'parses back to the exercise: %s',
    (_, e) => {
      const xml = scaleMusicXml(e);
      const score = parseMusicXml(domParse(xml), { hands: scaleHands(e) });
      expect(score.warnings).toEqual([]);
      const expected = scaleNotes(e);
      for (const hand of ['right', 'left'] as Hand[]) {
        const ours = score.notes
          .filter((n) => n.hand === hand)
          .sort((a, b) => a.onset - b.onset || a.midi - b.midi);
        const run = expected[hand];
        expect(ours.map((n) => n.midi)).toEqual(run.map((n) => n.midi));
        expect(ours.map((n) => n.finger)).toEqual(run.map((n) => n.finger));
        // A step's keys at one onset, the steps one division apart.
        const onsets = [...new Set(ours.map((n) => n.onset))];
        expect(onsets).toHaveLength(steps(run).length);
      }
      // Bars of whole beats, the run ending with the last bar.
      const last = score.notes.at(-1)!;
      const end = score.measures.at(-1)!;
      expect(end.start + end.duration).toBe(last.onset + last.duration);
    },
  );

  it('writes a chord as one note and its <chord/>s, and closes block chords on the bar', () => {
    const xml = scaleMusicXml({ type: 'majorChords', tonic: 'C', octaves: 2, hands: 'right' });
    expect(xml.match(/<chord\/>/g)).toHaveLength(26);
    // Thirteen quarter-note chords: the last starts a bar and fills it as a whole note.
    expect(xml.match(/<type>quarter<\/type>/g)).toHaveLength(36);
    expect(xml.match(/<type>whole<\/type>/g)).toHaveLength(3);
    expect(layoutOf({ type: 'majorChords' }, 4).perBeat).toBe(1);
  });

  it('shows Hanon’s time signature as printed, and hides the others', () => {
    if (HANON_NUMBERS.length === 0) return;
    const hanon = scaleMusicXml({
      type: 'hanon',
      tonic: 'C',
      octaves: 2,
      hands: 'both',
      variant: HANON_NUMBERS[0]!,
    });
    expect(hanon).toMatch(/<time><beats>2<\/beats><beat-type>4<\/beat-type><\/time>/);
    const five = scaleMusicXml({ type: 'majorFiveFinger', tonic: 'C', octaves: 1, hands: 'right' });
    expect(five).not.toMatch(/<time>/);
  });

  it('draws a focus loop of chords: whole chords between repeat signs', () => {
    const e: ScaleExercise = { type: 'majorChords', tonic: 'C', octaves: 2, hands: 'both' };
    const xml = scaleMusicXml(e, { loop: { from: 2, to: 8 } });
    const score = parseMusicXml(domParse(xml), { hands: scaleHands(e) });
    expect(score.notes.filter((n) => n.hand === 'right')).toHaveLength(21);
    expect(xml).toContain('<note id="r2">');
    expect(xml).toContain('<note id="r2.2">');
    expect(xml).not.toContain('<note id="r9">');
  });
});
