// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseMusicXml } from './musicxml.ts';
import { isScaleExercise, keyAlters, keySignature, scaleNotes, tonicsOf } from './scales.ts';
import {
  clefs,
  octaveShifts,
  scaleHands,
  scaleMusicXml,
  type ScaleXmlOptions,
} from './scaleXml.ts';
import { SCALE_OCTAVES, SCALE_TYPES, type ScaleExercise } from './scaleTypes.ts';
import { TICKS_PER_QUARTER, type Hand } from './score.ts';

const Q = TICKS_PER_QUARTER;
const domParse = (s: string) => new DOMParser().parseFromString(s, 'application/xml');

const SAMPLES: [ScaleExercise, ScaleXmlOptions?][] = [
  [{ type: 'harmonicMinor', tonic: 'G#', octaves: 2, hands: 'both' }],
  [{ type: 'major', tonic: 'F#', octaves: 4, hands: 'both' }],
  [{ type: 'chromatic', tonic: 'Eb', octaves: 2, hands: 'both' }],
  [{ type: 'melodicMinor', tonic: 'Bb', octaves: 3, hands: 'both' }],
  [{ type: 'major', tonic: 'D', octaves: 4, hands: 'both' }],
  [{ type: 'naturalMinor', tonic: 'E', octaves: 1, hands: 'right' }],
  [{ type: 'melodicMinor', tonic: 'A', octaves: 1, hands: 'left' }, { notesPerBeat: 2 }],
  [{ type: 'major', tonic: 'C', octaves: 1, hands: 'both' }, { notesPerBeat: 3 }],
  [{ type: 'harmonicMinor', tonic: 'C#', octaves: 2, hands: 'both' }, { notesPerBeat: 3 }],
  [{ type: 'chromatic', tonic: 'C', octaves: 3, hands: 'right' }, { notesPerBeat: 3 }],
];

/** 4 notes to the beat always; 2 and 3 hands together at two and four octaves. */
const perBeatFor = (e: ScaleExercise): readonly (2 | 3 | 4)[] =>
  e.hands === 'both' && (e.octaves === 2 || e.octaves === 4) ? [2, 3, 4] : [4];

function* allExercises(hands: ScaleExercise['hands'][] = ['both']): Generator<ScaleExercise> {
  for (const type of SCALE_TYPES)
    for (const tonic of tonicsOf(type))
      for (const octaves of SCALE_OCTAVES)
        for (const h of hands) {
          const e: ScaleExercise = { type, tonic, octaves, hands: h };
          if (isScaleExercise(e)) yield e;
        }
}

const label = (e: ScaleExercise, o?: ScaleXmlOptions) =>
  `${e.type} ${e.tonic} ${e.octaves} ${e.hands} ${o?.notesPerBeat ?? 4}`;

const child = (el: Element, name: string) => [...el.children].find((c) => c.localName === name);
const text = (el: Element | undefined) => el?.textContent?.trim() ?? '';

/** A note as drawn: what the file asks Verovio for, walked the way a reader reads it. */
interface Drawn {
  staff: number;
  hand: Hand;
  measure: number;
  step: string;
  alter: number;
  /** Sounding octave, as in `<pitch>`. */
  octave: number;
  midi: number;
  accidental: string | null;
  clef: 'G' | 'F';
  /** Octaves written below the sound: 1 under 8va, 2 under 15ma, −1 under 8vb. */
  shift: number;
  fingering: string | null;
  placement: string | null;
  type: string;
  duration: number;
  beams: string[];
  tuplet: string | null;
}

const SEMIS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function drawn(xml: string | Document): {
  notes: Drawn[];
  rests: { staff: number; duration: number }[];
} {
  const doc = typeof xml === 'string' ? domParse(xml) : xml;
  const notes: Drawn[] = [];
  const rests: { staff: number; duration: number }[] = [];
  const leftAlone = /left hand/.test(text(doc.querySelector('part-name') ?? undefined));
  const handOf = (staff: number): Hand => (staff === 2 || leftAlone ? 'left' : 'right');
  const clef: Record<number, 'G' | 'F'> = {};
  const shift: Record<number, number> = { 1: 0, 2: 0 };
  const part = child(doc.documentElement, 'part')!;
  [...part.children].forEach((m, measure) => {
    for (const el of m.children) {
      if (el.localName === 'attributes')
        for (const c of el.children)
          if (c.localName === 'clef')
            clef[Number(c.getAttribute('number'))] = text(child(c, 'sign')) as 'G' | 'F';
      if (el.localName === 'direction') {
        const os = child(child(el, 'direction-type')!, 'octave-shift');
        const type = os?.getAttribute('type');
        const octaves = os?.getAttribute('size') === '15' ? 2 : 1;
        if (os)
          shift[Number(text(child(el, 'staff')))] =
            type === 'down' ? octaves : type === 'up' ? -octaves : 0;
      }
      if (el.localName !== 'note') continue;
      const staff = Number(text(child(el, 'staff')));
      const duration = Number(text(child(el, 'duration')));
      if (child(el, 'rest')) {
        rests.push({ staff, duration });
        continue;
      }
      const pitch = child(el, 'pitch')!;
      const step = text(child(pitch, 'step'));
      const alter = Number(text(child(pitch, 'alter')) || 0);
      const octave = Number(text(child(pitch, 'octave')));
      const notations = child(el, 'notations');
      const technical = notations && child(notations, 'technical');
      const fingering = technical && child(technical, 'fingering');
      notes.push({
        staff,
        hand: handOf(staff),
        measure,
        step,
        alter,
        octave,
        midi: (octave + 1) * 12 + SEMIS[step]! + alter,
        accidental: child(el, 'accidental') ? text(child(el, 'accidental')) : null,
        clef: clef[staff]!,
        shift: shift[staff]!,
        fingering: fingering ? text(fingering) : null,
        placement: fingering?.getAttribute('placement') ?? null,
        type: text(child(el, 'type')),
        duration,
        beams: [...el.children]
          .filter((b) => b.localName === 'beam')
          .map((b) => `${b.getAttribute('number')}${text(b)}`),
        tuplet: (notations && child(notations, 'tuplet')?.getAttribute('type')) ?? null,
      });
    }
  });
  return { notes, rests };
}

const ALTER: Record<string, number> = {
  'flat-flat': -2,
  flat: -1,
  natural: 0,
  sharp: 1,
  'double-sharp': 2,
};

/**
 * Reads the alterations back as a player would: the key signature, and each accidental holding
 * for its letter and written octave until the bar line. Every note must come out as written.
 */
function readAccidentals(e: ScaleExercise, notes: readonly Drawn[]): string[] {
  const inKey = keyAlters(keySignature(e.type, e.tonic).fifths) as Record<string, number>;
  const wrong: string[] = [];
  const inForce = new Map<string, number>();
  let bar = -1;
  for (const n of notes) {
    if (n.measure !== bar) {
      inForce.clear();
      bar = n.measure;
    }
    const place = `${n.staff}${n.step}${n.octave - n.shift}`;
    const read = n.accidental ? ALTER[n.accidental]! : (inForce.get(place) ?? inKey[n.step]!);
    if (read !== n.alter) wrong.push(`${n.step}${n.alter}/${n.octave} in bar ${n.measure + 1}`);
    if (n.accidental) inForce.set(place, read);
  }
  return wrong;
}

describe('scaleMusicXml', () => {
  it.each(SAMPLES)('parses back to the scale: %j %j', (e, options) => {
    const xml = scaleMusicXml(e, options);
    const score = parseMusicXml(domParse(xml), { hands: scaleHands(e) });
    const perBeat = options?.notesPerBeat ?? 4;
    expect(score.warnings).toEqual([]);
    expect(score.hands).toEqual(
      e.hands === 'both' ? { '0.1': 'right', '0.2': 'left' } : { '0.1': e.hands },
    );
    expect(score.notes.every((n) => n.hand !== null)).toBe(true);
    const expected = scaleNotes(e);
    for (const hand of ['right', 'left'] as Hand[]) {
      const ours = score.notes.filter((n) => n.hand === hand);
      const run = expected[hand];
      expect(ours.map((n) => n.midi)).toEqual(run.map((n) => n.midi));
      expect(ours.map((n) => n.pitch)).toEqual(run.map((n) => n.pitch));
      expect(ours.map((n) => n.staff)).toEqual(
        run.map(() => (hand === 'right' || e.hands === 'left' ? 1 : 2)),
      );
      // Evenly spaced, perBeat to the beat.
      expect(ours.map((n) => n.onset)).toEqual(run.map((_, i) => (i * Q) / perBeat));
    }
  });

  // Every key and length of each scale type at 4 notes to the beat, hands together and each hand,
  // and at 2 and 3 to the beat hands together at two and four octaves (the bars, and with them the
  // accidentals within a bar, change with the notes to the beat): the file parses back to the
  // scale, and reads as written (accidentals, octave signs, clefs). One test per type, as a parse
  // is slow (jsdom).
  it.each(SCALE_TYPES)('holds for every %s exercise', { timeout: 60_000 }, (type) => {
    for (const e of allExercises(['both', 'right', 'left', 'contrary']))
      for (const notesPerBeat of perBeatFor(e)) {
        if (e.type !== type) continue;
        const where = label(e, { notesPerBeat });
        const doc = domParse(scaleMusicXml(e, { notesPerBeat }));
        const score = parseMusicXml(doc, { hands: scaleHands(e) });
        const { right, left } = scaleNotes(e);
        expect(score.warnings, where).toEqual([]);
        expect(score.notes.filter((n) => n.hand === 'right').map((n) => n.midi)).toEqual(
          right.map((n) => n.midi),
        );
        expect(score.notes.filter((n) => n.hand === 'left').map((n) => n.midi)).toEqual(
          left.map((n) => n.midi),
        );
        // The fingering reads back too (the keyboard shows it from the score's notes).
        expect(score.notes.filter((n) => n.hand === 'right').map((n) => n.finger)).toEqual(
          right.map((n) => n.finger),
        );
        expect(score.notes.filter((n) => n.hand === 'left').map((n) => n.finger)).toEqual(
          left.map((n) => n.finger),
        );
        // Bars of whole beats in quarter notes, four to the bar but the last, ending with the run.
        const last = score.notes.at(-1)!;
        const end = score.measures.at(-1)!;
        expect(end.start + end.duration, where).toBe(last.onset + last.duration);
        score.measures.forEach((m, i) => {
          expect(m.beatType).toBe(4);
          expect(m.duration).toBe(m.beats * Q);
          if (i < score.measures.length - 1) expect(m.beats).toBe(4);
        });
        // The last note ends on a beat, and lasts one when the run ends on one.
        expect((last.onset + last.duration) % Q).toBe(0);
        if (last.onset % Q === 0) expect(last.duration).toBe(Q);

        const { notes } = drawn(doc);
        // Accidentals: read back as a player reads them, every note comes out as written.
        expect(readAccidentals(e, notes), where).toEqual([]);
        for (const hand of ['right', 'left'] as const) {
          const ours = notes.filter((n) => n.hand === hand);
          expect(ours.length).toBe(scaleNotes(e)[hand].length);
          const groups: Drawn[][] = [];
          ours.forEach((n, i) => (groups[Math.floor(i / notesPerBeat)] ??= []).push(n));
          // The clef and the octave sign per beat group, as clefs() and octaveShifts() choose
          // them (their rules are tested on their own below).
          const clef = clefs(groups, hand);
          const shift = octaveShifts(groups);
          groups.forEach((g, i) => {
            for (const n of g) {
              expect(n.clef, where).toBe(clef[i]);
              expect(n.shift, where).toBe(shift[i]);
            }
          });
        }
      }
  });

  it('writes F𝄪 as a double sharp in G♯ harmonic minor', () => {
    const e: ScaleExercise = { type: 'harmonicMinor', tonic: 'G#', octaves: 2, hands: 'both' };
    const { notes } = drawn(scaleMusicXml(e));
    const fx = notes.filter((n) => n.step === 'F');
    expect(fx.length).toBe(8);
    for (const n of fx) expect(n.alter).toBe(2);
    // Once per letter and octave in each bar.
    const marked = fx.filter((n) => n.accidental === 'double-sharp');
    expect(new Set(marked.map((n) => `${n.staff}${n.measure}${n.octave}`)).size).toBe(
      marked.length,
    );
    expect(marked.length).toBeGreaterThanOrEqual(6);
    const doc = domParse(scaleMusicXml(e));
    expect(text(doc.querySelector('key > fifths') ?? undefined)).toBe('5');
    expect(text(doc.querySelector('key > mode') ?? undefined)).toBe('minor');
  });

  it('writes courtesy naturals after a bar that altered the note (melodic minor down)', () => {
    const e: ScaleExercise = { type: 'melodicMinor', tonic: 'A', octaves: 1, hands: 'right' };
    const { notes } = drawn(scaleMusicXml(e, { notesPerBeat: 2 }));
    // A B C D E F# G# A | G F E D C B A: G and F come back natural in the next bar.
    const secondBar = notes.filter((n) => n.measure === 1).slice(0, 2);
    expect(secondBar.map((n) => `${n.step}${n.accidental}`)).toEqual(['Gnatural', 'Fnatural']);
  });

  it('has no key signature for the chromatic scale', () => {
    const doc = domParse(
      scaleMusicXml({ type: 'chromatic', tonic: 'Eb', octaves: 1, hands: 'both' }),
    );
    expect(text(doc.querySelector('key > fifths') ?? undefined)).toBe('0');
  });

  it('hides the part name and the time signature', () => {
    const doc = domParse(scaleMusicXml(SAMPLES[0]![0]));
    expect(doc.querySelector('part-name')?.getAttribute('print-object')).toBe('no');
    const times = [...doc.querySelectorAll('time')];
    expect(times.length).toBeGreaterThan(0);
    for (const t of times) expect(t.getAttribute('print-object')).toBe('no');
  });

  it('puts the fingering above the right hand and below the left', () => {
    for (const [e, options] of SAMPLES) {
      const { notes } = drawn(scaleMusicXml(e, options));
      const expected = scaleNotes(e);
      for (const [hand, placement] of [
        ['right', 'above'],
        ['left', 'below'],
      ] as const) {
        const ours = notes.filter((n) => n.hand === hand);
        expect(ours.map((n) => n.fingering)).toEqual(
          expected[hand].map((n) => (n.finger === null ? null : String(n.finger))),
        );
        for (const n of ours) if (n.fingering) expect(n.placement).toBe(placement);
      }
    }
  });

  it('draws one hand on one staff, treble or bass, and parses it back to that hand', () => {
    for (const hands of ['right', 'left'] as const) {
      const e: ScaleExercise = { type: 'major', tonic: 'D', octaves: 2, hands };
      const xml = scaleMusicXml(e);
      const score = parseMusicXml(domParse(xml), { hands: scaleHands(e) });
      expect(score.parts[0]!.staves).toBe(1);
      expect(score.hands).toEqual({ '0.1': hands });
      expect(score.warnings).toEqual([]);
      expect(score.notes.map((n) => [n.hand, n.midi])).toEqual(
        scaleNotes(e)[hands].map((n) => [hands, n.midi]),
      );
      expect(xml).not.toMatch(/<rest|<staves>|<backup>/);
      expect(drawn(xml).notes[0]!.clef).toBe(hands === 'right' ? 'G' : 'F');
    }
  });

  it('beams each beat and ends on a quarter, or on the rest of a beat', () => {
    const beamsOf = (e: ScaleExercise, o?: ScaleXmlOptions) =>
      drawn(scaleMusicXml(e, o))
        .notes.filter((n) => n.staff === 1)
        .map((n) => `${n.type}:${n.beams.join(',')}`);
    // Two octaves in sixteenths: 28 + a quarter.
    const two = beamsOf({ type: 'major', tonic: 'C', octaves: 2, hands: 'right' });
    expect(two.slice(0, 4)).toEqual([
      '16th:1begin,2begin',
      '16th:1continue,2continue',
      '16th:1continue,2continue',
      '16th:1end,2end',
    ]);
    expect(two.at(-1)).toBe('quarter:');
    // One octave: 14 + the last note, which completes the beat as an eighth.
    const one = beamsOf({ type: 'major', tonic: 'C', octaves: 1, hands: 'right' });
    expect(one.slice(-3)).toEqual(['16th:1begin,2begin', '16th:1continue,2end', 'eighth:1end']);
    // Eighths beamed in pairs.
    const eighths = beamsOf(
      { type: 'major', tonic: 'C', octaves: 1, hands: 'right' },
      { notesPerBeat: 2 },
    );
    expect(eighths.slice(0, 2)).toEqual(['eighth:1begin', 'eighth:1end']);
    expect(eighths.at(-1)).toBe('quarter:');
  });

  it('writes triplets as triplets, the last note completing the last one', () => {
    const e: ScaleExercise = { type: 'major', tonic: 'C', octaves: 1, hands: 'right' };
    const xml = scaleMusicXml(e, { notesPerBeat: 3 });
    const { notes } = drawn(xml);
    expect(notes.slice(0, 3).map((n) => n.tuplet)).toEqual(['start', null, 'stop']);
    expect(notes.slice(0, 3).map((n) => n.beams.join())).toEqual(['1begin', '1continue', '1end']);
    // 14 notes and the last: 4 triplets, then two notes and the tonic as the third.
    expect(notes.slice(-3).map((n) => `${n.type}/${n.duration}/${n.tuplet}`)).toEqual([
      'eighth/1/start',
      'eighth/1/null',
      'eighth/1/stop',
    ]);
    expect(xml.match(/<time-modification>/g)).toHaveLength(15);
    // Two octaves: 28 notes, one short of a triplet; the tonic takes the rest of it.
    const two = drawn(scaleMusicXml({ ...e, octaves: 2 }, { notesPerBeat: 3 })).notes;
    expect(two.slice(-2).map((n) => `${n.type}/${n.duration}/${n.tuplet}`)).toEqual([
      'eighth/1/start',
      'quarter/2/stop',
    ]);
  });

  it('marks the 8va in B♭ melodic minor, three octaves, and not in G♯ minor, two', () => {
    const bb = scaleMusicXml({ type: 'melodicMinor', tonic: 'Bb', octaves: 3, hands: 'right' });
    expect(bb.match(/<octave-shift type="down" size="8"/g)).toHaveLength(1);
    expect(bb.match(/<octave-shift type="stop"/g)).toHaveLength(1);
    const shifted = drawn(bb).notes.filter((n) => n.shift === 1);
    expect(shifted.length).toBe(12);
    const gs = scaleMusicXml({ type: 'harmonicMinor', tonic: 'G#', octaves: 2, hands: 'both' });
    expect(gs).not.toMatch(/octave-shift/);
    // Its top group (E6 F𝄪6 G♯6 F𝄪6) lies above C6, but alone.
    const right = drawn(gs).notes.filter((n) => n.staff === 1);
    expect(right.slice(12, 16).every((n) => n.midi >= 84)).toBe(true);
    expect(right.slice(8, 12).some((n) => n.midi < 84)).toBe(true);
    expect(right.slice(16, 20).some((n) => n.midi < 84)).toBe(true);
  });

  it('takes 15ma and 8va at four octaves, and an 8va in the left hand', () => {
    // B major: right hand B3–B7, left B2–B6.
    const xml = scaleMusicXml({ type: 'major', tonic: 'B', octaves: 4, hands: 'both' });
    const { notes } = drawn(xml);
    const right = notes.filter((n) => n.hand === 'right');
    expect(right.filter((n) => n.shift === 2).map((n) => n.midi >= 96)).not.toContain(false);
    expect(right.some((n) => n.shift === 2)).toBe(true);
    expect(right.some((n) => n.shift === 1)).toBe(true);
    expect(xml).toMatch(/<octave-shift type="down" size="15"/);
    expect(notes.filter((n) => n.hand === 'left').some((n) => n.shift === 1)).toBe(true);
  });

  it('chooses clefs per beat group: left hand treble from C4, right hand bass below it', () => {
    const g = (...midis: number[]) => midis.map((midi) => ({ midi }));
    expect(clefs([g(55, 57, 59, 60), g(62, 64, 65, 67), g(59, 60, 62, 64)], 'left')).toEqual([
      'F',
      'G',
      'F',
    ]);
    expect(clefs([g(55, 57, 59, 60), g(48, 50, 52, 53), g(59, 60)], 'right')).toEqual([
      'G',
      'F',
      'G',
    ]);
    // A last note alone keeps the clef before it.
    expect(clefs([g(62, 64, 65, 67), g(55)], 'left')).toEqual(['G', 'G']);
    expect(clefs([g(62, 64, 65, 67), g(55)], 'right')).toEqual(['G', 'G']);
    expect(clefs([g(55)], 'left')).toEqual(['F']);
  });

  it('puts octave signs over two or more beat groups wholly beyond C6, C7 or C2', () => {
    const at = (...lows: number[]) => octaveShifts(lows.map((m) => [{ midi: m }, { midi: m + 2 }]));
    expect(at(80, 84, 86, 80)).toEqual([0, 1, 1, 0]);
    expect(at(80, 84, 80, 84)).toEqual([0, 0, 0, 0]); // one group alone: none
    expect(at(84, 90, 96, 98, 90, 86, 80)).toEqual([1, 1, 2, 2, 1, 1, 0]);
    // What is left of the 8va beside a 15ma, if one group, goes under the 15ma.
    expect(at(80, 90, 96, 98, 90, 86, 80)).toEqual([0, 2, 2, 2, 1, 1, 0]);
    expect(at(96, 98, 80)).toEqual([2, 2, 0]);
    expect(at(40, 34, 30, 34, 40)).toEqual([0, -1, -1, -1, 0]);
    expect(at(34, 40)).toEqual([0, 0]);
  });

  it('draws a focus loop: the span of each hand between repeat signs, notes keeping their ids', () => {
    const e: ScaleExercise = { type: 'major', tonic: 'C', octaves: 2, hands: 'both' };
    const xml = scaleMusicXml(e, { loop: { from: 11, to: 17 } });
    const score = parseMusicXml(domParse(xml), { hands: scaleHands(e) });
    const { right, left } = scaleNotes(e);
    for (const [hand, run] of [
      ['right', right],
      ['left', left],
    ] as const) {
      const notes = score.notes.filter((n) => n.hand === hand).sort((a, b) => a.onset - b.onset);
      expect(notes.map((n) => n.midi)).toEqual(run.slice(11, 18).map((n) => n.midi));
      for (const n of run.slice(11, 18)) expect(xml).toContain(`<note id="${hand[0]}${n.index}">`);
    }
    expect(xml).not.toContain('<note id="r10">');
    expect(xml.match(/<repeat direction="forward"\/>/g)).toHaveLength(1);
    expect(xml.match(/<repeat direction="backward"\/>/g)).toHaveLength(1);
    expect(score.measures.at(-1)!.repeat.backwardTimes).not.toBeNull();
  });
});
