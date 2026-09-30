// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseMusicXml } from './musicxml.ts';
import { LETTERS } from './note.ts';
import { keyAlters, tonicPitch } from './scales.ts';
import { buildSteps, TICKS_PER_QUARTER, type Hand, type SpelledPitch } from './score.ts';
import { generateFragment, type SightFragment, type SightNote } from './sightFragment.ts';
import {
  barTicks,
  getSightLevel,
  levelCells,
  SIGHT_GENERATOR_VERSION,
  SIGHT_LEVEL_IDS,
  SIGHT_LEVELS,
} from './sightLevels.ts';
import { sightHands, sightMusicXml } from './sightXml.ts';

const SEEDS = Array.from({ length: 120 }, (_, i) => i * 7919 + 1);
const each = (fn: (f: SightFragment) => void) => {
  for (const id of SIGHT_LEVEL_IDS) for (const seed of SEEDS) fn(generateFragment(id, seed));
};

/** Diatonic position: letters from C0, so a second is 1 and an octave 7. */
const place = (p: SpelledPitch) => p.octave * 7 + LETTERS.indexOf(p.step);
const name = (n: SightNote) =>
  `${n.pitch.step}${n.pitch.alter > 0 ? '#'.repeat(n.pitch.alter) : 'b'.repeat(-n.pitch.alter)}${n.pitch.octave}`;
const label = (f: SightFragment) => `${f.level}:${f.seed}`;

/** The melody: the right hand's notes, the left hand's in F2 and in its bars of F3. */
function melody(f: SightFragment): SightNote[] {
  if (f.level === 'F2') return f.notes.filter((n) => n.hand === 'left');
  if (f.level === 'F3') return f.notes;
  return f.notes.filter((n) => n.hand === 'right');
}
const accompaniment = (f: SightFragment) =>
  f.level === 'F1' || f.level === 'F2' || f.level === 'F3'
    ? []
    : f.notes.filter((n) => n.hand === 'left');

/** The scale degree of a note (0: the tonic), by its letter. */
function degreeOf(f: SightFragment, p: SpelledPitch): number {
  const tonic = tonicPitch(f.key.tonic, 4).step;
  return (((LETTERS.indexOf(p.step) - LETTERS.indexOf(tonic)) % 7) + 7) % 7;
}

const ROOTS = { I: 0, ii: 1, IV: 3, V: 4, vi: 5 } as const;
function chordAt(f: SightFragment, onset: number) {
  const bar = Math.floor(onset / barTicks(f.meter));
  const beat = (onset % barTicks(f.meter)) / TICKS_PER_QUARTER;
  return f.harmony[bar]!.findLast((s) => s.beat <= beat)!.chord;
}
const isChordTone = (f: SightFragment, n: SightNote) => {
  const offset = (((degreeOf(f, n.pitch) - ROOTS[chordAt(f, n.onset)]) % 7) + 7) % 7;
  return offset === 0 || offset === 2 || offset === 4;
};

describe('sight-reading fragments', () => {
  it('are the same again from the same level, seed and version', () => {
    for (const id of SIGHT_LEVEL_IDS)
      for (const seed of [1, 99, 123_456_789]) {
        const a = generateFragment(id, seed);
        expect(generateFragment(id, seed, SIGHT_GENERATOR_VERSION)).toEqual(a);
        expect(sightMusicXml(generateFragment(id, seed))).toBe(sightMusicXml(a));
      }
    expect(() => generateFragment('F1', 1, 99)).toThrow(RangeError);
  });

  it('keep to what version 1 made (a change of output needs a new version)', () => {
    const line = (f: SightFragment, hand: Hand) =>
      f.notes
        .filter((n) => n.hand === hand)
        .map(name)
        .join(' ');
    const f1 = generateFragment('F1', 2026);
    const f6 = generateFragment('F6', 2026);
    expect([f1.key, f1.meter, line(f1, 'right')]).toMatchInlineSnapshot(`
      [
        {
          "mode": "major",
          "tonic": "C",
        },
        "4/4",
        "E4 F4 E4 E4 D4 C4 D4 D4 C4 D4 D4 C4",
      ]
    `);
    expect([f6.key, f6.meter, line(f6, 'right'), line(f6, 'left')]).toMatchInlineSnapshot(`
      [
        {
          "mode": "major",
          "tonic": "D",
        },
        "4/4",
        "D4 F#4 E4 F#4 G4 F#4 D4 E4 F#4 B4 A4 G4 A4 A4 B4 A4 E4 F#4 G4 A4 G4 G4 B4 A4 G4 F#4 D4 E4 F#4 E4 D4",
        "D3 A3 D3 A3 D3 B3 D3 F#3 A3 F#3 A3 D3 A3 D3 A3 D3 B3 D3 B3 D3 F#3 E3 C#3 D3",
      ]
    `);
  });

  it('take a key, a meter and a length of their level, and seldom need a second attempt', () => {
    let attempts = 0;
    let most = 0;
    let count = 0;
    each((f) => {
      const level = getSightLevel(f.level);
      expect(level.keys, label(f)).toContainEqual(f.key);
      expect(
        level.meters.map(([m]) => m),
        label(f),
      ).toContain(f.meter);
      expect(f.bars, label(f)).toBe(level.bars);
      expect(f.harmony, label(f)).toHaveLength(f.bars);
      const end = f.bars * barTicks(f.meter);
      for (const n of f.notes) expect(n.onset + n.duration, label(f)).toBeLessThanOrEqual(end);
      attempts += f.attempts;
      most = Math.max(most, f.attempts);
      count++;
    });
    expect(attempts / count).toBeLessThan(3);
    expect(most).toBeLessThan(60);
  });

  it('end on a cadence to the tonic, the last bar one downbeat held by both hands', () => {
    each((f) => {
      const last = barTicks(f.meter) * (f.bars - 1);
      expect(f.harmony.at(-1), label(f)).toEqual([{ beat: 0, chord: 'I' }]);
      expect(f.harmony.at(-2)!.at(-1)!.chord, label(f)).toBe('V');
      if (f.bars === 8) expect(f.harmony[3]!.at(-1)!.chord, label(f)).toBe('V');
      const final = f.notes.filter((n) => n.onset + n.duration > last);
      expect(final.length, label(f)).toBeGreaterThan(0);
      for (const n of final) {
        expect(n.onset, label(f)).toBe(last);
        expect(n.duration, label(f)).toBe(barTicks(f.meter));
      }
      const top = melody(f).at(-1)!;
      expect(top.onset, label(f)).toBe(last);
      expect(degreeOf(f, top.pitch), label(f)).toBe(0);
      expect(chordAt(f, top.onset)).toBe('I');
    });
  });

  it('use chords of the level: ii and vi from F6, and no ii in minor', () => {
    each((f) => {
      const chords = new Set(f.harmony.flat().map((s) => s.chord));
      if (!getSightLevel(f.level).secondary) {
        expect(chords.has('ii') || chords.has('vi'), label(f)).toBe(false);
      }
      if (f.key.mode === 'minor') expect(chords.has('ii'), label(f)).toBe(false);
    });
  });

  it('move by step until F4, with leaps up to a fifth in F5 and a sixth from F6', () => {
    each((f) => {
      const level = getSightLevel(f.level);
      const line = melody(f);
      line.forEach((n, i) => {
        const prev = line[i - 1];
        if (!prev || prev.hand !== n.hand) return;
        const steps = Math.abs(place(n.pitch) - place(prev.pitch));
        const semis = Math.abs(n.midi - prev.midi);
        // Between the phrases the hand may move to a new position.
        const newPhrase = f.phrases.slice(1).some((p) => n.onset === p * barTicks(f.meter));
        if (!newPhrase || !level.shifts)
          expect(steps, `${label(f)} ${name(prev)}-${name(n)}`).toBeLessThanOrEqual(level.maxLeap);
        // No melodic tritone and no augmented second (a chromatic neighbour's semitone aside).
        if (!newPhrase) {
          expect(semis, `${label(f)} ${name(prev)}-${name(n)}`).not.toBe(6);
          if (steps === 1) expect([1, 2], `${label(f)} ${name(prev)}-${name(n)}`).toContain(semis);
        }
        // After a leap of a fourth or more, back the other way.
        const before = line[i - 2];
        if (before && before.hand === n.hand && !newPhrase) {
          const leap = place(prev.pitch) - place(before.pitch);
          const next = place(n.pitch) - place(prev.pitch);
          if (Math.abs(leap) >= 3) expect(Math.sign(next), label(f)).not.toBe(Math.sign(leap));
        }
      });
    });
  });

  it('keep each hand in a position: five fingers until F4, a sixth for a phrase from F5', () => {
    each((f) => {
      const level = getSightLevel(f.level);
      for (const hand of ['right', 'left'] as const) {
        const own = f.notes.filter((n) => n.hand === hand);
        if (own.length === 0) continue;
        const phrases = level.shifts
          ? f.phrases.map((p, i) => [p, f.phrases[i + 1] ?? f.bars] as const)
          : [[0, f.bars] as const];
        for (const [from, to] of phrases) {
          const inside = own.filter(
            (n) => n.onset >= from * barTicks(f.meter) && n.onset < to * barTicks(f.meter),
          );
          if (inside.length === 0) continue;
          const places = inside.map((n) => place(n.pitch));
          const span = Math.max(...places) - Math.min(...places);
          const widest =
            hand === 'right' || f.level === 'F2' || f.level === 'F3'
              ? level.extended
                ? 5
                : 4
              : level.texture === 'moving' || level.texture === 'chords'
                ? 6
                : 4;
          expect(span, `${label(f)} ${hand}`).toBeLessThanOrEqual(widest);
        }
      }
    });
  });

  it('put a chord tone on every strong beat and long note, and step into and out of the others', () => {
    each((f) => {
      const line = melody(f);
      line.forEach((n, i) => {
        const beat = (n.onset % barTicks(f.meter)) / TICKS_PER_QUARTER;
        const strong = beat === 0 || (f.meter === '4/4' && beat === 2);
        if (strong || n.duration >= 2 * TICKS_PER_QUARTER)
          expect(isChordTone(f, n), `${label(f)} ${name(n)} at ${n.onset}`).toBe(true);
        // A passing or neighbour note, or one tied over into the next chord (an anticipation).
        if (isChordTone(f, n) || n.tieStop || n.tieStart) return;
        for (const other of [line[i - 1], line[i + 1]])
          if (other && other.hand === n.hand)
            expect(Math.abs(place(other.pitch) - place(n.pitch)), `${label(f)} ${name(n)}`).toBe(1);
      });
    });
  });

  it('write accidentals only for the leading tone in minor and, from F7, raised neighbours', () => {
    each((f) => {
      const inKey = keyAlters(f.fifths);
      const level = getSightLevel(f.level);
      for (const n of f.notes) {
        const off = n.pitch.alter - inKey[n.pitch.step];
        if (off === 0) continue;
        expect(off, `${label(f)} ${name(n)}`).toBe(1);
        const leading = f.key.mode === 'minor' && degreeOf(f, n.pitch) === 6;
        if (!leading) expect(level.chromatic, `${label(f)} ${name(n)}`).toBe(true);
        expect(Math.abs(n.pitch.alter), `${label(f)} ${name(n)}`).toBeLessThanOrEqual(1);
      }
    });
  });

  it('keep the melody above the left hand, never in unison with it or in parallel fifths or octaves', () => {
    each((f) => {
      const left = accompaniment(f);
      if (left.length === 0) return;
      const line = melody(f);
      let before: { top: number; bass: number } | null = null;
      for (const n of line) {
        const under = left.filter(
          (l) => l.onset < n.onset + n.duration && l.onset + l.duration > n.onset,
        );
        for (const l of under) expect(n.midi, `${label(f)} ${name(n)}`).toBeGreaterThan(l.midi);
        if (n.tieStop) continue;
        const struck = left.filter((l) => l.onset === n.onset);
        if (struck.length === 0) continue;
        const bass = Math.min(...struck.map((l) => l.midi));
        if (before) {
          const ic = (((n.midi - bass) % 12) + 12) % 12;
          const icBefore = (((before.top - before.bass) % 12) + 12) % 12;
          const similar =
            n.midi !== before.top &&
            bass !== before.bass &&
            Math.sign(n.midi - before.top) === Math.sign(bass - before.bass);
          if (similar && (ic === 0 || ic === 7))
            expect(icBefore, `${label(f)} ${name(n)} parallel`).not.toBe(ic);
        }
        before = { top: n.midi, bass };
      }
    });
  });

  it('are made of the cells of the level’s rhythm levels', () => {
    each((f) => {
      const cells = levelCells(getSightLevel(f.level));
      const last = barTicks(f.meter) * (f.bars - 1);
      for (const n of f.notes) {
        // The last bar's note is the final note (a dotted half in 3/4 before R3).
        if (n.onset === last) continue;
        expect(cells, `${label(f)} ${n.cell}`).toContain(n.cell);
      }
    });
  });

  it('finger each hand’s first note or chord, and nothing else', () => {
    each((f) => {
      for (const hand of ['right', 'left'] as const) {
        const own = f.notes.filter((n) => n.hand === hand);
        if (own.length === 0) continue;
        const first = own.filter((n) => n.onset === own[0]!.onset);
        for (const n of own) {
          if (first.includes(n)) {
            expect(n.finger, label(f)).toBeGreaterThanOrEqual(1);
            expect(n.finger, label(f)).toBeLessThanOrEqual(5);
          } else expect(n.finger, label(f)).toBeNull();
        }
        if (first.length > 1) expect(new Set(first.map((n) => n.finger)).size).toBe(first.length);
      }
    });
  });

  it('read back from their MusicXML as the same notes, with a step to play in every bar', () => {
    for (const level of SIGHT_LEVELS)
      for (const seed of SEEDS.slice(0, 30)) {
        const f = generateFragment(level.id, seed);
        const xml = sightMusicXml(f);
        const score = parseMusicXml(new DOMParser().parseFromString(xml, 'application/xml'), {
          hands: sightHands(),
        });
        expect(score.warnings, label(f)).toEqual([]);
        expect(score.measures, label(f)).toHaveLength(f.bars);
        for (const m of score.measures) expect(m.duration, label(f)).toBe(barTicks(f.meter));
        const ours = f.notes
          .map((n) => ({
            midi: n.midi,
            onset: n.onset,
            duration: n.duration,
            hand: n.hand,
            tieStart: n.tieStart,
            tieStop: n.tieStop,
            finger: n.finger,
          }))
          .sort((a, b) => a.onset - b.onset || a.midi - b.midi);
        const theirs = score.notes
          .map((n) => ({
            midi: n.midi,
            onset: n.onset,
            duration: n.duration,
            hand: n.hand,
            tieStart: n.tieStart,
            tieStop: n.tieStop,
            finger: n.finger,
          }))
          .sort((a, b) => a.onset - b.onset || a.midi - b.midi);
        expect(theirs, label(f)).toEqual(ours);
        const steps = buildSteps(score, 'both');
        for (let bar = 0; bar < f.bars; bar++)
          expect(
            steps.some((s) => s.measure === bar),
            `${label(f)} bar ${bar}`,
          ).toBe(true);
        // One key per hand per step: no key asked of both hands at once.
        for (const s of steps) expect(new Set(s.midis).size).toBe(s.noteIds.length);
      }
  });
});
