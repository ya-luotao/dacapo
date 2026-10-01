import { describe, expect, it } from 'vitest';
import { noteLetter, rootPc } from './chordSymbols.ts';
import {
  BACKING_IDS,
  BACKINGS,
  backingBar,
  backingChecksum,
  CALL_HIGH,
  CALL_LOW,
  CALL_RHYTHMS,
  callNotes,
  chordOfBar,
  classifyNote,
  eighthTime,
  improvPieceId,
  improvPlan,
  isCallBar,
  isImprovSpec,
  isStrongBeat,
  loopBars,
  noteBar,
  scaleTones,
  type BackingNote,
  type ImprovSpec,
} from './improv.ts';

const spec = (patch: Partial<ImprovSpec> = {}): ImprovSpec => ({
  backing: 'blues',
  key: 'C',
  scale: 'blues',
  pattern: 'shuffle',
  feel: 'swing',
  bpm: 120,
  call: false,
  seed: 7,
  ...patch,
});

/** Every combination the setup can make, at one tempo. */
const everySpec = (patch: Partial<ImprovSpec> = {}): ImprovSpec[] =>
  BACKING_IDS.flatMap((backing) => {
    const b = BACKINGS[backing];
    return b.keys.flatMap((key) =>
      b.patterns.flatMap((pattern) =>
        (['straight', 'swing'] as const).map((feel) =>
          spec({ backing, key, pattern, feel, scale: b.scales[0]!, ...patch }),
        ),
      ),
    );
  });

const symbols = (s: ImprovSpec) => improvPlan(s).chords.map((c) => c.text);

describe('backings', () => {
  it('loops the 12-bar blues with a V7 turnaround in its last bar', () => {
    expect(symbols(spec())).toEqual([
      'C7',
      'C7',
      'C7',
      'C7',
      'F7',
      'F7',
      'C7',
      'C7',
      'G7',
      'F7',
      'C7',
      'G7',
    ]);
    expect(symbols(spec({ key: 'F' }))).toContain('B♭7');
  });

  it('spells every backing from its key', () => {
    expect(symbols(spec({ backing: 'I-vi-IV-V', key: 'D', pattern: 'arpeggio' }))).toEqual([
      'D',
      'Bm',
      'G',
      'A',
    ]);
    expect(
      symbols(spec({ backing: 'ii-V-I', key: 'Bb', pattern: 'stride', scale: 'major' })),
    ).toEqual(['Cm7', 'F7', 'B♭maj7', 'B♭maj7']);
    expect(
      symbols(spec({ backing: 'vamp', key: 'D', pattern: 'arpeggio', scale: 'dorian' })),
    ).toEqual(['Dm7', 'G7']);
  });

  it('offers only the shuffle over the blues, and the keys, scales and patterns of each', () => {
    for (const id of BACKING_IDS) {
      const b = BACKINGS[id];
      expect(b.patterns.includes('shuffle')).toBe(id === 'blues');
      expect(
        isImprovSpec({
          ...spec(),
          backing: id,
          key: b.keys[0]!,
          scale: b.scales[0]!,
          pattern: b.patterns[0]!,
        }),
      ).toBe(true);
    }
    expect(BACKINGS.blues.keys).toEqual(['C', 'G', 'F']);
    expect(isImprovSpec({ ...spec(), key: 'D' })).toBe(false);
    expect(
      isImprovSpec({ ...spec(), backing: 'vamp', key: 'D', scale: 'major', pattern: 'arpeggio' }),
    ).toBe(false);
  });

  it('names the scales from the key by letter, the blues scale with its ♭5', () => {
    const names = (tonic: string, scale: Parameters<typeof scaleTones>[1]) =>
      scaleTones(tonic, scale).map(noteLetter).join(' ');
    expect(names('C', 'blues')).toBe('C E♭ F G♭ G B♭');
    expect(names('F', 'blues')).toBe('F A♭ B♭ C♭ C E♭');
    expect(names('G', 'majorPentatonic')).toBe('G A B D E');
    expect(names('Bb', 'major')).toBe('B♭ C D E♭ F G A');
    expect(names('D', 'dorian')).toBe('D E F G A B C');
    expect(names('E', 'minorPentatonic')).toBe('E G A B D');
  });
});

describe('the backing in time', () => {
  it('swings its eighths 2:1 and plays them even when straight', () => {
    const swing = improvPlan(spec({ bpm: 120 }));
    expect(swing.beatMs).toBe(500);
    expect(swing.barMs).toBe(2000);
    // The long eighth is twice the short one.
    const long = eighthTime(swing, 1) - eighthTime(swing, 0);
    const short = eighthTime(swing, 2) - eighthTime(swing, 1);
    expect(long / short).toBeCloseTo(2, 10);
    expect(eighthTime(swing, 7)).toBeCloseTo(1500 + 1000 / 3, 6);
    const straight = improvPlan(spec({ bpm: 120, feel: 'straight' }));
    expect(eighthTime(straight, 1)).toBe(250);
    expect(eighthTime(straight, 8)).toBe(2000);
  });

  it('plays the shuffle long–short on every beat, swung, the off-beat lighter', () => {
    const plan = improvPlan(spec({ bpm: 90 }));
    const notes = backingBar(plan, 0, 60);
    const onsets = [...new Set(notes.map((n) => Math.round(n.on)))];
    const beat = 60_000 / 90;
    expect(onsets).toEqual(
      [0, 1, 2, 3].flatMap((b) => [Math.round(b * beat), Math.round(b * beat + (2 * beat) / 3)]),
    );
    // C3 with G3, A3, B♭3, A3: the root and the fifth, sixth, seventh, sixth.
    const dyads = onsets
      .filter((_, n) => n % 2 === 0)
      .map((at) => notes.filter((n) => Math.round(n.on) === at).map((n) => n.midi));
    expect(dyads).toEqual([
      [48, 55],
      [48, 57],
      [48, 58],
      [48, 57],
    ]);
    const on = notes.filter((n) => Math.round(n.on) === 0)[0]!;
    const off = notes.filter((n) => Math.round(n.on) === Math.round((2 * beat) / 3))[0]!;
    expect(on.velocity).toBe(60);
    expect(off.velocity).toBeLessThan(on.velocity);
    // Each ends before the next strike of its key.
    for (const n of notes) expect(n.off).toBeGreaterThan(n.on);
    const c3 = notes.filter((n) => n.midi === 48).sort((a, b) => a.on - b.on);
    for (let i = 1; i < c3.length; i++) expect(c3[i]!.on).toBeGreaterThan(c3[i - 1]!.off);
  });

  it('plays the stride’s bass on 1 and 3 and short chords on 2 and 4, below the player', () => {
    const plan = improvPlan(spec({ backing: 'ii-V-I', pattern: 'stride', scale: 'major' }));
    const notes = backingBar(plan, 0, 60);
    const bass = notes.filter((n) => n.part === 'bass');
    const chords = notes.filter((n) => n.part === 'chord');
    expect(bass.map((n) => n.on)).toEqual([0, 1000]);
    expect([...new Set(chords.map((n) => n.on))]).toEqual([500, 1500]);
    for (const n of chords) {
      expect(n.off - n.on).toBeCloseTo(0.55 * 500, 6);
      expect(n.velocity).toBeLessThan(60);
      expect(n.midi).toBeLessThanOrEqual(59);
    }
    // Dm7 in the tenor without its root: F A C.
    expect(
      chords
        .filter((n) => n.on === 500)
        .map((n) => n.midi % 12)
        .sort(),
    ).toEqual([0, 5, 9]);
  });

  it('keeps every backing below the player’s register, in tones of its chords', () => {
    for (const s of everySpec()) {
      const plan = improvPlan(s);
      for (let bar = 0; bar < loopBars(plan); bar++) {
        const pcs = chordOfBar(plan, bar).pcs;
        const root = rootPc(chordOfBar(plan, bar).symbol.root);
        for (const n of backingBar(plan, bar, 72)) {
          // C2 to D♯4 at the most (the arpeggio's tenth); the shuffle and the stride lower.
          expect(n.midi).toBeGreaterThanOrEqual(36);
          expect(n.midi).toBeLessThanOrEqual(63);
          if (s.pattern === 'shuffle' || s.pattern === 'stride')
            expect(n.midi).toBeLessThanOrEqual(59);
          const sixth = s.pattern === 'shuffle' && n.midi % 12 === (root + 9) % 12;
          expect(pcs.includes(n.midi % 12) || sixth).toBe(true);
          expect(n.on).toBeGreaterThanOrEqual(bar * plan.barMs);
          expect(n.off).toBeLessThanOrEqual((bar + 1) * plan.barMs + 1e-6);
          expect(n.velocity).toBeGreaterThan(0);
          expect(n.velocity).toBeLessThanOrEqual(72);
        }
      }
    }
  });

  it('goes round the loop: a bar plays as the same bar one loop earlier', () => {
    const plan = improvPlan(spec({ feel: 'straight', pattern: 'stride' }));
    const shift = (notes: BackingNote[], ms: number) =>
      notes.map((n) => ({ ...n, on: n.on + ms, off: n.off + ms }));
    expect(backingBar(plan, 14, 60)).toEqual(shift(backingBar(plan, 2, 60), 12 * plan.barMs));
  });

  it('has a checksum of its left hand and feel, not of its tempo or calls', () => {
    const base = backingChecksum(improvPlan(spec()));
    expect(base).toMatch(/^[0-9a-f]{8}$/);
    expect(backingChecksum(improvPlan(spec({ bpm: 60, call: true, seed: 3 })))).toBe(base);
    expect(backingChecksum(improvPlan(spec({ feel: 'straight' })))).not.toBe(base);
    expect(backingChecksum(improvPlan(spec({ pattern: 'stride' })))).not.toBe(base);
    expect(improvPieceId(spec({ key: 'F' }))).toBe('improv:blues:F');
  });
});

describe('call and response', () => {
  it('calls in the first two bars of every four and leaves the next two to the player', () => {
    const plan = improvPlan(spec({ call: true }));
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((bar) => isCallBar(plan, bar))).toEqual([
      true,
      true,
      false,
      false,
      true,
      true,
      false,
      false,
    ]);
    const calls = (bar: number) => backingBar(plan, bar, 60).filter((n) => n.part === 'call');
    expect(calls(0).length).toBeGreaterThan(3);
    expect(calls(1)).toEqual([]);
    expect(calls(2)).toEqual([]);
    expect(calls(4).length).toBeGreaterThan(3);
    // Every call is over before the answer begins, louder than the backing.
    for (const n of calls(0)) {
      expect(n.off).toBeLessThan(2 * plan.barMs);
      expect(n.velocity).toBeGreaterThan(60);
    }
    expect(improvPlan(spec()).spec.call).toBe(false);
    expect(backingBar(improvPlan(spec()), 0, 60).some((n) => n.part === 'call')).toBe(false);
  });

  it('makes motifs of the scale that land on chord tones and end on one', () => {
    for (const s of everySpec({ call: true })) {
      for (const seed of [1, 2, 3, 42]) {
        const plan = improvPlan({ ...s, seed });
        for (const phrase of [0, 2, 4]) {
          const notes = callNotes(plan, phrase);
          expect(notes.length).toBeGreaterThanOrEqual(5);
          const chordAt = (onset: number) => chordOfBar(plan, phrase * 2 + Math.floor(onset / 8));
          notes.forEach((n, i) => {
            expect(n.midi).toBeGreaterThanOrEqual(CALL_LOW);
            expect(n.midi).toBeLessThanOrEqual(CALL_HIGH);
            const pcs = chordAt(n.onset).pcs;
            const pc = n.midi % 12;
            if (i === notes.length - 1 || n.onset % 4 === 0) expect(pcs).toContain(pc);
            else expect(plan.scalePcs.has(pc) || pcs.includes(pc)).toBe(true);
            if (i > 0) expect(Math.abs(n.midi - notes[i - 1]!.midi)).toBeLessThanOrEqual(9);
          });
          const last = notes.at(-1)!;
          expect(last.onset + last.duration).toBeLessThanOrEqual(15);
        }
      }
    }
  });

  it('varies its calls from phrase to phrase and plays the same ones again from the seed', () => {
    const plan = improvPlan(spec({ call: true, seed: 11 }));
    const phrases = [0, 2, 4, 6, 8, 10].map((p) => callNotes(plan, p));
    const rhythms = new Set(phrases.map((p) => p.map((n) => `${n.onset}+${n.duration}`).join()));
    const melodies = new Set(phrases.map((p) => p.map((n) => n.midi).join()));
    expect(rhythms.size).toBeGreaterThan(2);
    expect(melodies.size).toBe(6);
    expect(callNotes(improvPlan(spec({ call: true, seed: 11 })), 4)).toEqual(phrases[2]);
    expect(callNotes(improvPlan(spec({ call: true, seed: 12 })), 4)).not.toEqual(phrases[2]);
    // Each rhythm has a breath before the answer.
    for (const rhythm of CALL_RHYTHMS) {
      const [onset, duration] = rhythm.at(-1)!;
      expect(onset + duration).toBeLessThanOrEqual(15);
    }
  });
});

describe('how a note is heard', () => {
  const plan = improvPlan(spec({ bpm: 120 }));

  it('is a chord tone, a tone of the scale, or outside', () => {
    expect(classifyNote(plan, 64, 100)).toBe('chord'); // E over C7
    expect(classifyNote(plan, 63, 100)).toBe('scale'); // E♭, the blue third
    expect(classifyNote(plan, 66, 100)).toBe('scale'); // G♭, the ♭5
    expect(classifyNote(plan, 69, 100)).toBe('outside'); // A
    expect(classifyNote(plan, 61, 100)).toBe('outside'); // D♭
    // Over F7 (bar 5), A is its third.
    expect(classifyNote(plan, 69, 4 * 2000 + 100)).toBe('chord');
  });

  it('hears a note a sixteenth before the bar with the chord it leads into', () => {
    const before = 4 * 2000 - 100; // a sixteenth is 125 ms at 120
    expect(noteBar(plan, before)).toBe(4);
    expect(classifyNote(plan, 69, before)).toBe('chord');
    expect(noteBar(plan, 4 * 2000 - 200)).toBe(3);
    expect(classifyNote(plan, 69, 4 * 2000 - 200)).toBe('outside');
    // In the count-in, with the first chord.
    expect(classifyNote(plan, 64, -1500)).toBe('chord');
  });

  it('takes the 1 and the 3 as strong beats, a sixteenth either side', () => {
    expect(isStrongBeat(plan, 0)).toBe(true);
    expect(isStrongBeat(plan, 1000 + 120)).toBe(true);
    expect(isStrongBeat(plan, 2000 - 100)).toBe(true);
    expect(isStrongBeat(plan, 500)).toBe(false);
    expect(isStrongBeat(plan, 1000 + 333)).toBe(false);
  });
});
