import { describe, expect, it } from 'vitest';
import { midiOf } from './musicxml.ts';
import {
  arrangeProgression,
  keyChord,
  parseProgressionPieceId,
  PATTERN_IDS,
  PROGRESSION_IDS,
  PROGRESSIONS,
  progressionKeys,
  progressionNumerals,
  progressionPieceId,
  RIGHT_HIGH,
  RIGHT_LOW,
  type ProgressionSpec,
} from './progressions.ts';
import { parallels } from './voiceLeading.ts';

const name = (p: { step: string; alter: number; octave: number }) =>
  `${p.step}${p.alter > 0 ? '#'.repeat(p.alter) : 'b'.repeat(-p.alter)}${p.octave}`;

function* allSpecs(): Generator<ProgressionSpec> {
  for (const progression of PROGRESSION_IDS)
    for (const key of progressionKeys(PROGRESSIONS[progression].mode))
      for (const pattern of PATTERN_IDS) yield { progression, key, pattern };
}

const right = (spec: ProgressionSpec) =>
  arrangeProgression(spec).bars.map((b) =>
    b.notes.filter((n) => n.hand === 'right').map((n) => name(n.pitch)),
  );

describe('keys and ids', () => {
  it('lists the keys round the circle of fifths', () => {
    expect(progressionKeys('major')).toEqual([
      'C',
      'G',
      'D',
      'A',
      'E',
      'B',
      'F#',
      'Db',
      'Ab',
      'Eb',
      'Bb',
      'F',
    ]);
    expect(progressionKeys('minor').slice(0, 4)).toEqual(['Am', 'Em', 'Bm', 'F#m']);
  });

  it('names a progression, its key and its pattern, and reads the id back', () => {
    const spec: ProgressionSpec = { progression: 'i-iv-V-i', key: 'F#m', pattern: 'alberti' };
    expect(progressionPieceId(spec)).toBe('prog:i-iv-V-i:F#m:alberti');
    for (const s of allSpecs()) expect(parseProgressionPieceId(progressionPieceId(s))).toEqual(s);
  });

  it('refuses anything else', () => {
    for (const id of [
      'prog:I-IV-V-I:Cm:block', // a major progression in a minor key
      'prog:i-iv-V-i:A:block',
      'prog:I-IV-V-I:C#:block', // not one of the twelve
      'prog:I-IV-V-I:C:polka',
      'prog:I-IV-V-I:C',
      'prog:I-IV-V-I:C:block:x',
      'petzold-minuet-in-g',
      42,
    ])
      expect(parseProgressionPieceId(id)).toBeNull();
  });
});

describe('chords in a key', () => {
  it('spells each chord from the key by letter', () => {
    const symbols = (id: (typeof PROGRESSION_IDS)[number], key: string) =>
      PROGRESSIONS[id].bars.map((c) => keyChord(key, c).text);
    expect(symbols('ii-V-I', 'C')).toEqual(['Dm7', 'G7', 'Cmaj7', 'Cmaj7']);
    expect(symbols('I-vi-IV-V', 'F#')).toEqual(['F♯', 'D♯m', 'B', 'C♯']);
    expect(symbols('vi-ii-V-I', 'Db')).toEqual(['B♭m', 'E♭m', 'A♭', 'D♭']);
    // The raised leading note of harmonic minor: D♯ major in G♯ minor has F𝄪.
    expect(symbols('i-iv-V-i', 'G#m')).toEqual(['G♯m', 'C♯m', 'D♯', 'G♯m']);
    expect(keyChord('G#m', PROGRESSIONS['i-iv-V-i'].bars[2]!).tones).toContainEqual({
      step: 'F',
      alter: 2,
    });
    expect(symbols('blues', 'Bb')).toEqual([
      'B♭7',
      'B♭7',
      'B♭7',
      'B♭7',
      'E♭7',
      'E♭7',
      'B♭7',
      'B♭7',
      'F7',
      'E♭7',
      'B♭7',
      'B♭7',
    ]);
  });

  it('names the numerals once each, in order', () => {
    expect(progressionNumerals('ii-V-I').map((c) => c.numeral + c.figure)).toEqual([
      'ii7',
      'V7',
      'Imaj7',
    ]);
    expect(progressionNumerals('blues').map((c) => c.numeral + c.figure)).toEqual([
      'I7',
      'IV7',
      'V7',
    ]);
  });
});

describe('the arrangement', () => {
  it('voices the right hand as keyboard harmony does', () => {
    // Common tones held; IV to V against the bass.
    expect(right({ progression: 'I-IV-V-I', key: 'C', pattern: 'block' })).toEqual([
      ['E4', 'G4', 'C5'],
      ['F4', 'A4', 'C5'],
      ['D4', 'G4', 'B4'],
      ['E4', 'G4', 'C5'],
    ]);
    // ii–V–I: the 7th of each chord falling to the 3rd of the next.
    expect(right({ progression: 'ii-V-I', key: 'C', pattern: 'block' })).toEqual([
      ['D4', 'F4', 'A4', 'C5'],
      ['D4', 'F4', 'G4', 'B4'],
      ['C4', 'E4', 'G4', 'B4'],
      ['C4', 'E4', 'G4', 'B4'],
    ]);
    expect(right({ progression: 'i-iv-V-i', key: 'Am', pattern: 'block' })).toEqual([
      ['E4', 'A4', 'C5'],
      ['F4', 'A4', 'D5'],
      ['E4', 'G#4', 'B4'],
      ['E4', 'A4', 'C5'],
    ]);
  });

  it('writes each pattern in the left hand', () => {
    const left = (pattern: (typeof PATTERN_IDS)[number]) =>
      arrangeProgression({ progression: 'I-IV-V-I', key: 'C', pattern })
        .bars[0]!.notes.filter((n) => n.hand === 'left')
        .map((n) => `${name(n.pitch)}@${n.onset}/${n.duration}`);
    expect(left('block')).toEqual(['C3@0/8', 'E3@0/8', 'G3@0/8']);
    expect(left('rootFifth')).toEqual(['C2@0/8', 'G2@0/8']);
    expect(left('alberti')).toEqual([
      'C3@0/1',
      'G3@1/1',
      'E3@2/1',
      'G3@3/1',
      'C3@4/1',
      'G3@5/1',
      'E3@6/1',
      'G3@7/1',
    ]);
    expect(left('arpeggio')).toEqual(['C2@0/2', 'G2@2/2', 'C3@4/2', 'E3@6/2']);
    expect(left('waltz')).toEqual([
      'C2@0/2',
      'C3@2/2',
      'E3@2/2',
      'G3@2/2',
      'C3@4/2',
      'E3@4/2',
      'G3@4/2',
    ]);
    expect(left('stride')).toEqual([
      'C2@0/2',
      'C3@2/2',
      'E3@2/2',
      'G3@2/2',
      'G2@4/2',
      'C3@6/2',
      'E3@6/2',
      'G3@6/2',
    ]);
    // A seventh chord: root, 3rd and 7th on the 1; 1–5–7–10 up.
    const blues = (pattern: (typeof PATTERN_IDS)[number]) =>
      arrangeProgression({ progression: 'blues', key: 'C', pattern })
        .bars[0]!.notes.filter((n) => n.hand === 'left')
        .map((n) => name(n.pitch));
    expect(blues('block')).toEqual(['C3', 'E3', 'Bb3']);
    expect(blues('arpeggio')).toEqual(['C2', 'G2', 'Bb2', 'E3']);
  });

  it('keeps every hand in its place, spelled as the chord is, for every progression, key and pattern', () => {
    let pairs = 0;
    let found = 0;
    for (const spec of allSpecs()) {
      const a = arrangeProgression(spec);
      expect(a.beats).toBe(spec.pattern === 'waltz' ? 3 : 4);
      expect(a.bars).toHaveLength(PROGRESSIONS[spec.progression].bars.length);
      const barLength = a.beats * 2;
      let previous: { bass: number; upper: number[] } | null = null;
      for (const bar of a.bars) {
        const rh = bar.notes.filter((n) => n.hand === 'right');
        const lh = bar.notes.filter((n) => n.hand === 'left');
        for (const n of bar.notes) {
          // The spelling sounds as the key, and is one of the chord's tones.
          expect(midiOf(n.pitch)).toBe(n.midi);
          expect(bar.chord.tones).toContainEqual({ step: n.pitch.step, alter: n.pitch.alter });
          expect(n.onset + n.duration).toBeLessThanOrEqual(barLength);
        }
        // The right hand: the whole chord, close, in C4–C6, held through the bar.
        const keys = rh.map((n) => n.midi).sort((x, y) => x - y);
        expect(new Set(keys.map((m) => m % 12))).toEqual(new Set(bar.chord.pcs));
        expect(keys).toHaveLength(bar.chord.pcs.length);
        expect(keys.at(-1)! - keys[0]!).toBeLessThan(12);
        expect(keys[0]).toBeGreaterThanOrEqual(RIGHT_LOW);
        expect(keys.at(-1)).toBeLessThanOrEqual(RIGHT_HIGH);
        expect(rh.every((n) => n.onset === 0 && n.duration === barLength)).toBe(true);
        // The left hand from C2, wholly below the right, its root lowest on the 1.
        expect(Math.min(...lh.map((n) => n.midi))).toBeGreaterThanOrEqual(36);
        expect(Math.max(...lh.map((n) => n.midi))).toBeLessThan(keys[0]!);
        const low = Math.min(...lh.filter((n) => n.onset === 0).map((n) => n.midi));
        expect(low % 12).toBe(bar.chord.pcs[0]);
        if (previous) {
          pairs++;
          const p = parallels(previous, { bass: low, upper: keys });
          found += p.outer + p.inner;
        }
        previous = { bass: low, upper: keys };
      }
    }
    // No parallel fifths or octaves, between the bass and the right hand or within it, anywhere.
    expect(pairs).toBeGreaterThan(1500);
    expect(found).toBe(0);
  });

  it('is the same every time', () => {
    const spec: ProgressionSpec = { progression: 'blues', key: 'F#', pattern: 'stride' };
    expect(arrangeProgression(spec)).toEqual(arrangeProgression(spec));
  });
});
