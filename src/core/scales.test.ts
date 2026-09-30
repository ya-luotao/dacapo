import { describe, expect, it } from 'vitest';
import { readHanon, type HanonEntry, type HanonRun } from './hanonData.ts';
import hanonJson from '../../scripts/scales/hanon/hanon.json?raw';
import { isBlack } from './note.ts';
import { HANON_ARPEGGIOS, HANON_CORRECTIONS } from './scaleFingering.ts';
import {
  CHROMATIC_FINGERS,
  CHROMATIC_TONICS,
  exerciseKey,
  FINGERING_SOURCE,
  isScaleExercise,
  keyAlters,
  notesPerOctave,
  SCALE_HANDS,
  keySignature,
  SIGNATURE_FIFTHS,
  signatureTonic,
  MAJOR_TONICS,
  MINOR_TONICS,
  parseExerciseKey,
  scaleFingering,
  rightHandFloor,
  scaleNotes,
  shortenRun,
  startingTonics,
  tonicsOf,
} from './scales.ts';
import {
  SCALE_OCTAVES,
  SCALE_TYPES,
  type ScaleExercise,
  type ScaleNote,
  type ScaleType,
} from './scaleTypes.ts';
import type { Hand, SpelledPitch } from './score.ts';

const HANDS = ['right', 'left', 'both'] as const;
const FINGERED: ScaleType[] = ['major', 'harmonicMinor', 'melodicMinor'];

function* exercises(
  types: readonly ScaleType[] = SCALE_TYPES,
): Generator<ScaleExercise & { type: ScaleType }> {
  for (const type of types)
    for (const tonic of tonicsOf(type))
      for (const octaves of SCALE_OCTAVES)
        for (const hands of HANDS) yield { type, tonic, octaves, hands };
}

const name = (p: SpelledPitch) => `${p.step}${['bb', 'b', '', '#', 'x'][p.alter + 2]}`;

// Hanon as transcribed, with the correction applied, by his key and mode.
const HANON = new Map<string, HanonEntry>();
for (const entry of readHanon(JSON.parse(hanonJson) as unknown)) {
  const e = { ...entry };
  for (const c of HANON_CORRECTIONS)
    if (c.key === e.key && c.mode === e.mode) e[c.run] = e[c.run].with(c.index, c.used);
  HANON.set(`${e.key}:${e.mode}`, e);
}

function hanonOf(type: ScaleType, tonic: string): HanonEntry {
  const key = type === 'major' && tonic === 'F#' ? 'Gb' : tonic;
  return HANON.get(`${type === 'chromatic' ? 'C' : key}:${type}`)!;
}

const NOTE = /^([A-G])(#{1,2}|b{1,2})?(\d)$/;
function hanonMidi(note: string): number {
  const [, step, acc = '', octave] = NOTE.exec(note)!;
  const semis = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[step!]!;
  return 12 * (Number(octave) + 1) + semis + (acc[0] === '#' ? acc.length : -acc.length);
}

/** One hand's run split at the top note, both halves including it. */
function halves(run: readonly ScaleNote[]): { up: ScaleNote[]; down: ScaleNote[] } {
  const top = run.findIndex((n) => n.turn);
  return { up: run.slice(0, top + 1), down: run.slice(top) };
}

const runsOf = (hand: Hand): [HanonRun, HanonRun] =>
  hand === 'right' ? ['rightUp', 'rightDown'] : ['leftUp', 'leftDown'];

describe('keys', () => {
  it('lists one spelling per key, in circle-of-fifths order', () => {
    expect(MAJOR_TONICS).toEqual(['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F']);
    expect(MINOR_TONICS).toEqual(['A', 'E', 'B', 'F#', 'C#', 'G#', 'Eb', 'Bb', 'F', 'C', 'G', 'D']);
    expect(CHROMATIC_TONICS).toEqual([
      'C',
      'C#',
      'D',
      'Eb',
      'E',
      'F',
      'F#',
      'G',
      'Ab',
      'A',
      'Bb',
      'B',
    ]);
    for (const type of ['naturalMinor', 'harmonicMinor', 'melodicMinor'] as const)
      expect(tonicsOf(type)).toBe(MINOR_TONICS);
  });

  it('gives each exercise a stable key that parses back', () => {
    expect(exerciseKey({ type: 'major', tonic: 'D', octaves: 2, hands: 'both' })).toBe(
      'major:D:2:both',
    );
    const keys = new Set<string>();
    for (const type of SCALE_TYPES)
      for (const tonic of tonicsOf(type))
        for (const octaves of SCALE_OCTAVES)
          for (const hands of SCALE_HANDS) {
            const e: ScaleExercise = { type, tonic, octaves, hands };
            const key = exerciseKey(e);
            if (!isScaleExercise(e)) {
              expect(parseExerciseKey(key)).toBeNull();
              continue;
            }
            keys.add(key);
            expect(parseExerciseKey(key)).toEqual(e);
          }
    // Scales, chromatic and arpeggios, 1–4 octaves, three ways each; contrary motion for majors,
    // harmonic minors and chromatic scales, 1–3 octaves.
    expect(keys.size).toBe((12 + 36 + 12 + 24) * 4 * 3 + 36 * 3);
  });

  it.each([
    '',
    'major',
    'major:D:2',
    'major:D:2:both:x',
    'Major:D:2:both',
    'major:d:2:both',
    'major:G#:2:both', // not one of the major spellings
    'naturalMinor:Ab:2:both',
    'chromatic:Db:1:right',
    'major:D:0:both',
    'major:D:5:both',
    'major:D:02:both',
    'major:D:2.0:both',
    'major:D: 2:both',
    'major:D:2:Both',
    'major:D:2:hands',
    'arpeggio:C:1:right',
  ])('rejects %j', (key) => {
    expect(parseExerciseKey(key)).toBeNull();
  });

  it('validates exercise values', () => {
    const ok = { type: 'melodicMinor', tonic: 'G#', octaves: 3, hands: 'left' };
    expect(isScaleExercise(ok)).toBe(true);
    for (const bad of [
      null,
      'major:D:2:both',
      [],
      { ...ok, octaves: '3' },
      { ...ok, octaves: 5 },
      { ...ok, tonic: 'Ab' },
      { ...ok, hands: 'together' },
      { ...ok, type: 'dorian' },
      { ...ok, extra: 1 },
      { type: 'major', tonic: 'C', octaves: 1 },
    ])
      expect(isScaleExercise(bad)).toBe(false);
  });

  it('names the fingering source', () => {
    expect(FINGERING_SOURCE).toMatch(/Hanon.*G\. Schirmer.*\[1900\].*IMSLP #91547/);
  });
});

describe('spelling', () => {
  // Locked: one octave up, and down where it differs (melodic minor, chromatic), from the tonic.
  it.each([
    ['major', 'C', 'C D E F G A B'],
    ['major', 'G', 'G A B C D E F#'],
    ['major', 'D', 'D E F# G A B C#'],
    ['major', 'A', 'A B C# D E F# G#'],
    ['major', 'E', 'E F# G# A B C# D#'],
    ['major', 'B', 'B C# D# E F# G# A#'],
    ['major', 'F#', 'F# G# A# B C# D# E#'],
    ['major', 'Db', 'Db Eb F Gb Ab Bb C'],
    ['major', 'Ab', 'Ab Bb C Db Eb F G'],
    ['major', 'Eb', 'Eb F G Ab Bb C D'],
    ['major', 'Bb', 'Bb C D Eb F G A'],
    ['major', 'F', 'F G A Bb C D E'],
    ['naturalMinor', 'A', 'A B C D E F G'],
    ['naturalMinor', 'E', 'E F# G A B C D'],
    ['naturalMinor', 'B', 'B C# D E F# G A'],
    ['naturalMinor', 'F#', 'F# G# A B C# D E'],
    ['naturalMinor', 'C#', 'C# D# E F# G# A B'],
    ['naturalMinor', 'G#', 'G# A# B C# D# E F#'],
    ['naturalMinor', 'Eb', 'Eb F Gb Ab Bb Cb Db'],
    ['naturalMinor', 'Bb', 'Bb C Db Eb F Gb Ab'],
    ['naturalMinor', 'F', 'F G Ab Bb C Db Eb'],
    ['naturalMinor', 'C', 'C D Eb F G Ab Bb'],
    ['naturalMinor', 'G', 'G A Bb C D Eb F'],
    ['naturalMinor', 'D', 'D E F G A Bb C'],
    ['harmonicMinor', 'A', 'A B C D E F G#'],
    ['harmonicMinor', 'E', 'E F# G A B C D#'],
    ['harmonicMinor', 'B', 'B C# D E F# G A#'],
    ['harmonicMinor', 'F#', 'F# G# A B C# D E#'],
    ['harmonicMinor', 'C#', 'C# D# E F# G# A B#'],
    ['harmonicMinor', 'G#', 'G# A# B C# D# E Fx'],
    ['harmonicMinor', 'Eb', 'Eb F Gb Ab Bb Cb D'],
    ['harmonicMinor', 'Bb', 'Bb C Db Eb F Gb A'],
    ['harmonicMinor', 'F', 'F G Ab Bb C Db E'],
    ['harmonicMinor', 'C', 'C D Eb F G Ab B'],
    ['harmonicMinor', 'G', 'G A Bb C D Eb F#'],
    ['harmonicMinor', 'D', 'D E F G A Bb C#'],
    ['melodicMinor', 'A', 'A B C D E F# G#', 'A B C D E F G'],
    ['melodicMinor', 'E', 'E F# G A B C# D#', 'E F# G A B C D'],
    ['melodicMinor', 'B', 'B C# D E F# G# A#', 'B C# D E F# G A'],
    ['melodicMinor', 'F#', 'F# G# A B C# D# E#', 'F# G# A B C# D E'],
    ['melodicMinor', 'C#', 'C# D# E F# G# A# B#', 'C# D# E F# G# A B'],
    ['melodicMinor', 'G#', 'G# A# B C# D# E# Fx', 'G# A# B C# D# E F#'],
    ['melodicMinor', 'Eb', 'Eb F Gb Ab Bb C D', 'Eb F Gb Ab Bb Cb Db'],
    ['melodicMinor', 'Bb', 'Bb C Db Eb F G A', 'Bb C Db Eb F Gb Ab'],
    ['melodicMinor', 'F', 'F G Ab Bb C D E', 'F G Ab Bb C Db Eb'],
    ['melodicMinor', 'C', 'C D Eb F G A B', 'C D Eb F G Ab Bb'],
    ['melodicMinor', 'G', 'G A Bb C D E F#', 'G A Bb C D Eb F'],
    ['melodicMinor', 'D', 'D E F G A B C#', 'D E F G A Bb C'],
    // Sharps going up, flats going down; the tonic as named in every octave.
    ['chromatic', 'C', 'C C# D D# E F F# G G# A A# B', 'C Db D Eb E F Gb G Ab A Bb B'],
    ['chromatic', 'C#', 'C# D D# E F F# G G# A A# B C', 'C# D Eb E F Gb G Ab A Bb B C'],
    ['chromatic', 'D', 'D D# E F F# G G# A A# B C C#', 'D Eb E F Gb G Ab A Bb B C Db'],
    ['chromatic', 'Eb', 'Eb E F F# G G# A A# B C C# D', 'Eb E F Gb G Ab A Bb B C Db D'],
    ['chromatic', 'E', 'E F F# G G# A A# B C C# D D#', 'E F Gb G Ab A Bb B C Db D Eb'],
    ['chromatic', 'F', 'F F# G G# A A# B C C# D D# E', 'F Gb G Ab A Bb B C Db D Eb E'],
    ['chromatic', 'F#', 'F# G G# A A# B C C# D D# E F', 'F# G Ab A Bb B C Db D Eb E F'],
    ['chromatic', 'G', 'G G# A A# B C C# D D# E F F#', 'G Ab A Bb B C Db D Eb E F Gb'],
    ['chromatic', 'Ab', 'Ab A A# B C C# D D# E F F# G', 'Ab A Bb B C Db D Eb E F Gb G'],
    ['chromatic', 'A', 'A A# B C C# D D# E F F# G G#', 'A Bb B C Db D Eb E F Gb G Ab'],
    ['chromatic', 'Bb', 'Bb B C C# D D# E F F# G G# A', 'Bb B C Db D Eb E F Gb G Ab A'],
    ['chromatic', 'B', 'B C C# D D# E F F# G G# A A#', 'B C Db D Eb E F Gb G Ab A Bb'],
  ] as [ScaleType, string, string, string?][])('%s %s', (type, tonic, up, down = up) => {
    const run = scaleNotes({ type, tonic, octaves: 1, hands: 'right' }).right;
    const period = type === 'chromatic' ? 12 : 7;
    expect(
      run
        .slice(0, period)
        .map((n) => name(n.pitch))
        .join(' '),
    ).toBe(up);
    expect(
      run
        .slice(period + 1)
        .reverse()
        .slice(0, period)
        .map((n) => name(n.pitch))
        .join(' '),
    ).toBe(down);
  });

  it('spells seven letters in order, with the key signature for major and natural minor', () => {
    for (const e of exercises(['major', 'naturalMinor', 'harmonicMinor', 'melodicMinor'])) {
      if (e.hands !== 'both') continue;
      const alters = keyAlters(keySignature(e.type, e.tonic).fifths);
      for (const run of Object.values(scaleNotes(e)))
        run.forEach((n, i) => {
          expect(n.midi).toBe(
            (n.pitch.octave + 1) * 12 +
              [0, 2, 4, 5, 7, 9, 11]['CDEFGAB'.indexOf(n.pitch.step)]! +
              n.pitch.alter,
          );
          expect(Math.abs(n.pitch.alter)).toBeLessThanOrEqual(2);
          if (i > 0) {
            const prev = run[i - 1]!;
            const step = 'CDEFGAB'.indexOf(n.pitch.step) + 7 * n.pitch.octave;
            const prevStep = 'CDEFGAB'.indexOf(prev.pitch.step) + 7 * prev.pitch.octave;
            expect(step - prevStep).toBe(n.direction === 'up' ? 1 : -1);
          }
          if (e.type === 'major' || e.type === 'naturalMinor')
            expect(n.pitch.alter).toBe(alters[n.pitch.step]);
        });
    }
  });

  it('writes G♯ harmonic minor with F𝄪', () => {
    const { right } = scaleNotes({
      type: 'harmonicMinor',
      tonic: 'G#',
      octaves: 2,
      hands: 'right',
    });
    const fx = right.filter((n) => n.pitch.step === 'F');
    expect(fx.map((n) => n.pitch.alter)).toEqual([2, 2, 2, 2]);
    expect(fx.map((n) => n.midi)).toEqual([79, 91, 91, 79]);
  });

  it('has key signatures for every key', () => {
    expect(keySignature('major', 'C')).toEqual({ fifths: 0, mode: 'major' });
    expect(keySignature('major', 'F#')).toEqual({ fifths: 6, mode: 'major' });
    expect(keySignature('major', 'Db')).toEqual({ fifths: -5, mode: 'major' });
    expect(keySignature('harmonicMinor', 'G#')).toEqual({ fifths: 5, mode: 'minor' });
    expect(keySignature('melodicMinor', 'Eb')).toEqual({ fifths: -6, mode: 'minor' });
    expect(keySignature('naturalMinor', 'D')).toEqual({ fifths: -1, mode: 'minor' });
    expect(keySignature('chromatic', 'Eb')).toEqual({ fifths: 0, mode: 'major' });
    expect(keyAlters(-2)).toEqual({ C: 0, D: 0, E: -1, F: 0, G: 0, A: 0, B: -1 });
    expect(keyAlters(3)).toEqual({ C: 1, D: 0, E: 0, F: 1, G: 1, A: 0, B: 0 });
  });

  it('names the tonic of every signature, major and minor, and keySignature undoes it', () => {
    const majors = SIGNATURE_FIFTHS.map((f) => signatureTonic(f, 'major'));
    const minors = SIGNATURE_FIFTHS.map((f) => signatureTonic(f, 'minor'));
    expect(majors).toEqual([
      'Cb',
      'Gb',
      'Db',
      'Ab',
      'Eb',
      'Bb',
      'F',
      'C',
      'G',
      'D',
      'A',
      'E',
      'B',
      'F#',
      'C#',
    ]);
    expect(minors).toEqual([
      'Ab',
      'Eb',
      'Bb',
      'F',
      'C',
      'G',
      'D',
      'A',
      'E',
      'B',
      'F#',
      'C#',
      'G#',
      'D#',
      'A#',
    ]);
    for (const f of SIGNATURE_FIFTHS) {
      expect(keySignature('major', signatureTonic(f, 'major')).fifths).toBe(f);
      expect(keySignature('naturalMinor', signatureTonic(f, 'minor')).fifths).toBe(f);
    }
    expect(() => signatureTonic(8, 'major')).toThrow(RangeError);
  });
});

describe('range', () => {
  it('starts the right hand on the lowest tonic from C4 (1–2 octaves) or C3 (3–4)', () => {
    const at = (tonic: string, octaves: 1 | 2 | 3 | 4) => {
      const { right, left } = startingTonics({ tonic, octaves });
      return `${name(right)}${right.octave} ${name(left)}${left.octave}`;
    };
    expect(at('C', 1)).toBe('C4 C3');
    expect(at('B', 1)).toBe('B4 B3');
    expect(at('Bb', 2)).toBe('Bb4 Bb3');
    expect(at('C', 3)).toBe('C3 C2');
    expect(at('G#', 3)).toBe('G#3 G#2');
    // Hanon's octaves: C3–C7, D3–D7.
    expect(at('C', 4)).toBe('C3 C2');
    expect(at('D', 4)).toBe('D3 D2');
    expect(at('B', 4)).toBe('B3 B2');
    for (const tonic of MAJOR_TONICS)
      for (const octaves of SCALE_OCTAVES)
        expect(startingTonics({ tonic, octaves }).right.octave).toBe(octaves <= 2 ? 4 : 3);
  });

  it('keeps both hands within A0–C8, an octave apart, hands separate where together', () => {
    for (const e of exercises()) {
      const { right, left } = scaleNotes(e);
      const { right: r, left: l } = startingTonics(e);
      const floor = rightHandFloor(e.octaves);
      for (const n of [...right, ...left]) {
        expect(n.midi).toBeGreaterThanOrEqual(21);
        expect(n.midi).toBeLessThanOrEqual(108);
      }
      if (e.hands !== 'left') {
        expect(right[0]!.pitch).toEqual(r);
        expect(right[0]!.midi).toBeGreaterThanOrEqual(floor);
        expect(right[0]!.midi).toBeLessThan(floor + 12);
      }
      if (e.hands !== 'right') expect(left[0]!.pitch).toEqual(l);
      if (e.hands === 'both')
        expect(right.map((n) => n.midi - 12)).toEqual(left.map((n) => n.midi));
    }
  });
});

describe('scaleNotes', () => {
  it('runs up and back down, the top note once, for the hands played', () => {
    for (const e of exercises()) {
      const period = notesPerOctave(e.type);
      const top = period * e.octaves;
      const { right, left } = scaleNotes(e);
      expect(right.length).toBe(e.hands === 'left' ? 0 : 2 * top + 1);
      expect(left.length).toBe(e.hands === 'right' ? 0 : 2 * top + 1);
      for (const [hand, run] of [
        ['right', right],
        ['left', left],
      ] as const)
        run.forEach((n, i) => {
          expect(n.hand).toBe(hand);
          expect(n.index).toBe(i);
          expect(n.turn).toBe(i === top);
          expect(n.direction).toBe(i <= top ? 'up' : 'down');
          const position = i <= top ? i : 2 * top - i;
          expect(n.degree).toBe(position % period);
          if (i > 0) expect(Math.sign(n.midi - run[i - 1]!.midi)).toBe(i <= top ? 1 : -1);
        });
      if (right.length && left.length) expect(left.at(-1)!.midi).toBe(right[0]!.midi - 12);
    }
  });

  it('places hands separate where they are in hands together', () => {
    for (const e of exercises()) {
      if (e.hands !== 'both') continue;
      const both = scaleNotes(e);
      expect(scaleNotes({ ...e, hands: 'right' }).right).toEqual(both.right);
      expect(scaleNotes({ ...e, hands: 'left' }).left).toEqual(both.left);
    }
  });

  it('marks crossings from the fingers', () => {
    const { right, left } = scaleNotes({ type: 'major', tonic: 'C', octaves: 1, hands: 'both' });
    const show = (run: ScaleNote[]) =>
      run
        .map(
          (n) =>
            `${n.finger}${n.crossing === 'thumbUnder' ? 'u' : n.crossing === 'fingerOver' ? 'o' : ''}`,
        )
        .join(' ');
    // C D E F G A B C B A G F E D C
    expect(show(right)).toBe('1 2 3 1u 2 3 4 5 4 3 2 1 3o 2 1');
    expect(show(left)).toBe('5 4 3 2 1 3o 2 1 2 3 1u 2 3 4 5');
  });

  it('has no fingering and no crossings for natural minor', () => {
    for (const e of exercises(['naturalMinor'])) {
      expect(scaleFingering(e, 'right')).toBeNull();
      for (const n of [...scaleNotes(e).right, ...scaleNotes(e).left]) {
        expect(n.finger).toBeNull();
        expect(n.crossing).toBeNull();
      }
    }
  });

  it('throws on an exercise that is not one', () => {
    expect(() => scaleNotes({ type: 'major', tonic: 'G#', octaves: 1, hands: 'both' })).toThrow();
  });
});

describe('fingering (Hanon)', () => {
  const fingered = [...exercises(FINGERED)].filter((e) => e.hands === 'both');

  it('plays Hanon on the keys Hanon prints (F♯ major on G♭ major’s keys)', () => {
    for (const e of fingered.filter((x) => x.octaves === 4)) {
      const h = hanonOf(e.type, e.tonic);
      const notes = scaleNotes(e);
      for (const hand of ['right', 'left'] as const) {
        const { up, down } = halves(notes[hand]);
        const [upNames, downNames] =
          hand === 'right' ? [h.notes, h.notesDown] : [h.notesLeft, h.notesLeftDown];
        expect(up.map((n) => n.midi % 12)).toEqual(upNames.map((x) => hanonMidi(x) % 12));
        expect(down.map((n) => n.midi % 12)).toEqual(downNames.map((x) => hanonMidi(x) % 12));
      }
    }
  });

  it('gives F♯ major the finger of G♭ major on every key', () => {
    for (const octaves of SCALE_OCTAVES)
      for (const hand of ['right', 'left'] as const) {
        const fsharp = scaleNotes({ type: 'major', tonic: 'F#', octaves, hands: hand })[hand];
        const gflat = hanonOf('major', 'F#');
        const [upRun, downRun] = runsOf(hand);
        const sharpFingers = fsharp.map((n) => `${n.midi % 12}:${n.finger}`);
        const expected = [
          ...shortenRun(gflat[upRun], 7, octaves),
          ...shortenRun(gflat[downRun], 7, octaves).slice(1),
        ];
        const names = hand === 'right' ? gflat.notes : gflat.notesLeft;
        expect(fsharp[0]!.midi % 12).toBe(hanonMidi(names[0]!) % 12);
        expect(sharpFingers.map((x) => Number(x.split(':')[1]))).toEqual(expected);
      }
  });

  it('is Hanon exactly at four octaves', () => {
    for (const e of fingered.filter((x) => x.octaves === 4)) {
      const h = hanonOf(e.type, e.tonic);
      const notes = scaleNotes(e);
      for (const hand of ['right', 'left'] as const) {
        const { up, down } = halves(notes[hand]);
        const [upRun, downRun] = runsOf(hand);
        expect(up.map((n) => n.finger)).toEqual(h[upRun]);
        expect(down.map((n) => n.finger)).toEqual(h[downRun]);
      }
    }
  });

  it('keeps Hanon’s start, turn and close and cuts only where his octaves repeat', () => {
    for (const e of fingered) {
      const h = hanonOf(e.type, e.tonic);
      const notes = scaleNotes(e);
      for (const hand of ['right', 'left'] as const) {
        const { up, down } = halves(notes[hand]);
        const [upRun, downRun] = runsOf(hand);
        for (const [ours, his] of [
          [up.map((n) => n.finger!), h[upRun]],
          [down.map((n) => n.finger!), h[downRun]],
        ] as const) {
          // Every pair of neighbours is a pair he prints on the same degrees.
          const cut = 7 * (4 - e.octaves);
          ours.forEach((f, i) => {
            if (i === 0) return;
            const pairs = [i, i + cut].map((j) => `${his[j - 1]}${his[j]}`);
            expect(pairs).toContain(`${ours[i - 1]}${f}`);
          });
          // His first two and last six fingers (start, approach to the top, close) stay.
          expect(ours.slice(0, 2)).toEqual(his.slice(0, 2));
          expect(ours.slice(-6)).toEqual(his.slice(-6));
        }
      }
    }
  });

  it('never puts the thumb on a black key', () => {
    for (const e of exercises(['major', 'harmonicMinor', 'melodicMinor', 'chromatic'])) {
      if (e.hands !== 'both') continue;
      const notes = scaleNotes(e);
      for (const n of [...notes.right, ...notes.left])
        if (n.finger === 1)
          expect(isBlack(n.midi), `${exerciseKey(e)} ${n.hand} ${n.index}`).toBe(false);
    }
  });

  it('puts the thumb every 3 or 4 notes within each direction, as Hanon does', () => {
    for (const e of fingered) {
      const notes = scaleNotes(e);
      for (const hand of ['right', 'left'] as const)
        for (const half of Object.values(halves(notes[hand]))) {
          const thumbs = half.flatMap((n, i) => (n.finger === 1 ? [i] : []));
          const gaps = thumbs.slice(1).map((t, i) => t - thumbs[i]!);
          for (const gap of gaps) expect([3, 4], exerciseKey(e)).toContain(gap);
        }
    }
    // Hanon himself, for the record: the same holds in every one of his runs.
    for (const h of HANON.values()) {
      if (h.mode === 'chromatic') continue;
      for (const run of ['rightUp', 'rightDown', 'leftUp', 'leftDown'] as const) {
        const thumbs = h[run].flatMap((f, i) => (f === 1 ? [i] : []));
        for (let i = 1; i < thumbs.length; i++)
          expect([3, 4]).toContain(thumbs[i]! - thumbs[i - 1]!);
      }
    }
  });

  it('never repeats a finger on neighbouring keys (nor does Hanon)', () => {
    for (const e of exercises(['major', 'harmonicMinor', 'melodicMinor', 'chromatic'])) {
      if (e.hands !== 'both') continue;
      const notes = scaleNotes(e);
      for (const run of [notes.right, notes.left])
        for (let i = 1; i < run.length; i++)
          expect(run[i]!.finger, `${exerciseKey(e)} ${run[i]!.hand} ${i}`).not.toBe(
            run[i - 1]!.finger,
          );
    }
  });

  it('refuses a run too short to cut', () => {
    expect(() => shortenRun([1, 2, 3], 7, 2)).toThrow();
    expect(() => shortenRun([...'12345123451234512345123451234'].map(Number), 7, 1)).toThrow();
  });
});

describe('chromatic fingering (Hanon No. 40, at the octave)', () => {
  it('derives one finger per key from his middle octaves', () => {
    expect(CHROMATIC_FINGERS).toEqual({
      //        C  C# D  D# E  F  F# G  G# A  A# B
      rightUp: [2, 3, 1, 3, 1, 2, 3, 1, 3, 1, 3, 1],
      rightDown: [2, 3, 1, 3, 1, 2, 3, 1, 3, 1, 3, 1],
      leftUp: [1, 3, 1, 3, 2, 1, 3, 1, 3, 1, 3, 2],
      leftDown: [1, 3, 1, 3, 2, 1, 3, 1, 3, 1, 3, 2],
    });
  });

  it('is Hanon exactly from C at four octaves, his start and turn kept at fewer', () => {
    const h = hanonOf('chromatic', 'C');
    for (const octaves of SCALE_OCTAVES) {
      const notes = scaleNotes({ type: 'chromatic', tonic: 'C', octaves, hands: 'both' });
      for (const hand of ['right', 'left'] as const) {
        const { up, down } = halves(notes[hand]);
        const [upRun, downRun] = runsOf(hand);
        const upF = up.map((n) => n.finger);
        const downF = down.map((n) => n.finger);
        if (octaves === 4) {
          expect(upF).toEqual(h[upRun]);
          expect(downF).toEqual(h[downRun]);
        }
        expect(upF.slice(0, 1)).toEqual(h[upRun].slice(0, 1));
        expect(upF.slice(-12)).toEqual(h[upRun].slice(-12));
        expect(downF.slice(0, 12)).toEqual(h[downRun].slice(0, 12));
        expect(downF.slice(-1)).toEqual(h[downRun].slice(-1));
      }
    }
    // Right hand, one octave: his start on the thumb and his turn 3 4 5 4 3.
    const one = scaleNotes({ type: 'chromatic', tonic: 'C', octaves: 1, hands: 'right' }).right;
    expect(one.map((n) => n.finger).join('')).toBe('1313123131345431313213131');
  });

  it('uses the per-key table elsewhere, start, top and close included', () => {
    for (const tonic of CHROMATIC_TONICS.filter((t) => t !== 'C'))
      for (const octaves of SCALE_OCTAVES) {
        const notes = scaleNotes({ type: 'chromatic', tonic, octaves, hands: 'both' });
        for (const hand of ['right', 'left'] as const)
          for (const n of notes[hand]) {
            const [upRun, downRun] = runsOf(hand);
            const table = CHROMATIC_FINGERS[n.direction === 'up' ? upRun : downRun];
            expect(n.finger).toBe(table[n.midi % 12]);
          }
      }
  });
});

describe('arpeggios', () => {
  const spelled = (e: ScaleExercise) =>
    scaleNotes(e)
      .right.map((n) => name(n.pitch))
      .join(' ');
  const one = (type: ScaleType, tonic: string): ScaleExercise => ({
    type,
    tonic,
    octaves: 1,
    hands: 'right',
  });

  it('spells the root-position triad from the key', () => {
    expect(spelled(one('majorArpeggio', 'C'))).toBe('C E G C G E C');
    expect(spelled(one('majorArpeggio', 'F#'))).toBe('F# A# C# F# C# A# F#');
    expect(spelled(one('majorArpeggio', 'Db'))).toBe('Db F Ab Db Ab F Db');
    expect(spelled(one('minorArpeggio', 'G#'))).toBe('G# B D# G# D# B G#');
    expect(spelled(one('minorArpeggio', 'Eb'))).toBe('Eb Gb Bb Eb Bb Gb Eb');
    expect(spelled(one('minorArpeggio', 'D'))).toBe('D F A D A F D');
    expect(keySignature('majorArpeggio', 'Eb')).toEqual({ fifths: -3, mode: 'major' });
    expect(keySignature('minorArpeggio', 'F#')).toEqual({ fifths: 3, mode: 'minor' });
    const two = scaleNotes({ type: 'minorArpeggio', tonic: 'A', octaves: 2, hands: 'right' });
    expect(two.right.map((n) => n.midi)).toEqual([
      69, 72, 76, 81, 84, 88, 93, 88, 84, 81, 76, 72, 69,
    ]);
    expect(two.right.map((n) => n.degree)).toEqual([0, 1, 2, 0, 1, 2, 0, 2, 1, 0, 2, 1, 0]);
  });

  it('is Hanon No. 41 exactly at four octaves, on his keys (F♯ major on G♭’s)', () => {
    const digits = (run: string) => [...run.replace(/ /g, '')].map(Number);
    for (const type of ['majorArpeggio', 'minorArpeggio'] as const)
      for (const tonic of tonicsOf(type)) {
        const key = type === 'majorArpeggio' && tonic === 'F#' ? 'Gb' : tonic;
        const mode = type === 'majorArpeggio' ? 'major' : 'minor';
        const h = HANON_ARPEGGIOS.find((a) => a.key === key && a.mode === mode)!;
        const notes = scaleNotes({ type, tonic, octaves: 4, hands: 'both' });
        for (const hand of ['right', 'left'] as const) {
          const { up, down } = halves(notes[hand]);
          const [upRun, downRun] = runsOf(hand);
          expect(up.map((n) => n.finger)).toEqual(digits(h[upRun]));
          expect(down.map((n) => n.finger)).toEqual(digits(h[downRun]));
        }
      }
  });

  it('cuts only where his octaves repeat, every pair of neighbours one he prints', () => {
    for (const type of ['majorArpeggio', 'minorArpeggio'] as const)
      for (const tonic of tonicsOf(type))
        for (const octaves of SCALE_OCTAVES) {
          const four = scaleNotes({ type, tonic, octaves: 4, hands: 'both' });
          const notes = scaleNotes({ type, tonic, octaves, hands: 'both' });
          for (const hand of ['right', 'left'] as const) {
            const his = halves(four[hand]);
            const ours = halves(notes[hand]);
            for (const half of ['up', 'down'] as const) {
              const run = his[half];
              const pairs = new Set(
                run.slice(1).map((n, i) => `${run[i]!.degree}:${run[i]!.finger}${n.finger}`),
              );
              const mine = ours[half];
              mine.slice(1).forEach((n, i) => {
                const pair = `${mine[i]!.degree}:${mine[i]!.finger}${n.finger}`;
                expect(pairs, `${type} ${tonic} ${octaves} ${hand} ${half} ${i}`).toContain(pair);
                expect(n.finger).not.toBe(mine[i]!.finger);
              });
              expect(mine[0]!.finger).toBe(run[0]!.finger);
              expect(mine.at(-1)!.finger).toBe(run.at(-1)!.finger);
            }
          }
        }
  });

  it('marks crossings: the thumb under going up, a finger over coming down', () => {
    const { right } = scaleNotes({ ...one('majorArpeggio', 'C'), octaves: 2 });
    expect(right.map(fingerMark).join(' ')).toBe('1 2 3 1u 2 3 5 3 2 1 3o 2 1');
  });
});

describe('contrary motion', () => {
  const contrary = (type: ScaleType, tonic: string, octaves: ScaleExercise['octaves']) =>
    scaleNotes({ type, tonic, octaves, hands: 'contrary' });
  const CONTRARY = ['major', 'harmonicMinor', 'chromatic'] as const;

  it('is offered for majors, harmonic minors and chromatic scales, up to three octaves', () => {
    for (const type of SCALE_TYPES)
      for (const octaves of SCALE_OCTAVES) {
        const e: ScaleExercise = { type, tonic: tonicsOf(type)[0]!, octaves, hands: 'contrary' };
        expect(isScaleExercise(e), exerciseKey(e)).toBe(
          (CONTRARY as readonly string[]).includes(type) && octaves <= 3,
        );
      }
    expect(parseExerciseKey('major:D:2:contrary')).toEqual({
      type: 'major',
      tonic: 'D',
      octaves: 2,
      hands: 'contrary',
    });
    expect(parseExerciseKey('majorArpeggio:D:2:contrary')).toBeNull();
    expect(parseExerciseKey('melodicMinor:D:2:contrary')).toBeNull();
    expect(parseExerciseKey('major:D:4:contrary')).toBeNull();
  });

  it('starts both hands on one tonic near middle C, out and back', () => {
    const { right, left } = contrary('major', 'C', 2);
    const alone = scaleNotes({ type: 'major', tonic: 'C', octaves: 2, hands: 'right' }).right;
    expect(right.map((n) => n.midi)).toEqual(alone.map((n) => n.midi));
    expect([right[0]!.midi, left[0]!.midi, left[14]!.midi, left.at(-1)!.midi]).toEqual([
      60, 60, 36, 60,
    ]);
    left.forEach((n, i) => {
      expect(n.direction).toBe(i <= 14 ? 'down' : 'up');
      expect(n.turn).toBe(i === 14);
      if (i > 0) expect(Math.sign(n.midi - left[i - 1]!.midi)).toBe(i <= 14 ? -1 : 1);
    });
    expect(
      left
        .map((n) => name(n.pitch))
        .slice(0, 8)
        .join(' '),
    ).toBe('C B A G F E D C');
  });

  it('takes the unison tonic from A3 to G♯4 and stays within A0–C8', () => {
    for (const type of CONTRARY)
      for (const tonic of tonicsOf(type))
        for (const octaves of [1, 2, 3] as const) {
          const { right, left } = contrary(type, tonic, octaves);
          expect(right.length).toBe(left.length);
          expect(right[0]!.midi).toBe(left[0]!.midi);
          expect(right.at(-1)!.midi).toBe(left.at(-1)!.midi);
          expect(right[0]!.midi).toBeGreaterThanOrEqual(57);
          expect(right[0]!.midi).toBeLessThanOrEqual(68);
          expect(startingTonics({ tonic, octaves, hands: 'contrary' }).left).toEqual(
            right[0]!.pitch,
          );
          for (const n of [...right, ...left]) {
            expect(n.midi).toBeGreaterThanOrEqual(21);
            expect(n.midi).toBeLessThanOrEqual(108);
          }
        }
  });

  it('fingers each hand as it plays that way in parallel: the left hand down, then up', () => {
    for (const type of CONTRARY)
      for (const tonic of tonicsOf(type))
        for (const octaves of [1, 2, 3] as const) {
          const { right, left } = contrary(type, tonic, octaves);
          const parallel = scaleNotes({ type, tonic, octaves, hands: 'both' });
          expect(right.map((n) => n.finger)).toEqual(parallel.right.map((n) => n.finger));
          const { up, down } = halves(parallel.left);
          const both = [...down, ...up.slice(1)];
          expect(left.map((n) => n.finger)).toEqual(both.map((n) => n.finger));
          expect(left.map((n) => n.midi % 12)).toEqual(both.map((n) => n.midi % 12));
          expect(left.map((n) => n.degree)).toEqual(both.map((n) => n.degree));
        }
  });

  it('marks the left hand’s crossings by its own direction', () => {
    const { left } = contrary('major', 'C', 1);
    expect(left.map(fingerMark).join(' ')).toBe('1 2 3 1u 2 3 4 5 4 3 2 1 3o 2 1');
  });

  it('spells the chromatic scale with flats going down and sharps going up, either hand', () => {
    const { right, left } = contrary('chromatic', 'D', 1);
    expect(right.slice(0, 3).map((n) => name(n.pitch))).toEqual(['D', 'D#', 'E']);
    expect(left.slice(0, 3).map((n) => name(n.pitch))).toEqual(['D', 'Db', 'C']);
    expect(left.slice(-3).map((n) => name(n.pitch))).toEqual(['C', 'C#', 'D']);
  });
});

function fingerMark(n: ScaleNote): string {
  return `${n.finger}${n.crossing === 'thumbUnder' ? 'u' : n.crossing === 'fingerOver' ? 'o' : ''}`;
}
