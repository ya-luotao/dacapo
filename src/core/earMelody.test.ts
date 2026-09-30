import { describe, expect, it } from 'vitest';
import {
  accidentalMarks,
  BEAT_MS,
  ECHO_LEVEL_IDS,
  ECHO_RULES,
  echoMistake,
  judgeEchoAnswer,
  judgeEchoKey,
  keepsMotionRules,
  makeMelody,
  MELODY_HIGHEST,
  MELODY_LOWEST,
  MELODY_NOTE_MS,
  melodyFits,
  melodyTiming,
  spellInKey,
  stepSemitones,
  TONIC_CHORD_MS,
  type EchoLevelId,
  type Melody,
} from './earMelody.ts';
import { midiOf } from './musicxml.ts';
import { pitchClass } from './note.ts';
import { seededRng } from './random.ts';
import { scaleDegree, tonicPitch } from './scales.ts';

const SEEDS = 600;

/** Many melodies of a level, each from its own seed. */
function melodies(level: EchoLevelId, count = SEEDS): Melody[] {
  return Array.from({ length: count }, (_, seed) => makeMelody(level, seededRng(seed + 1)));
}

const mod7 = (n: number) => ((n % 7) + 7) % 7;
const TONIC_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, Bb: 10 };

/** The line without its passing notes: the scale steps the leap rules speak of. */
function skeleton(m: Melody): number[] {
  return m.line
    .filter(
      (note, i) =>
        note.chromatic === 0 ||
        // A neighbour stands for its scale step, a passing note between two.
        m.line[i - 1]?.step === m.line[i + 1]?.step,
    )
    .map((note) => note.step);
}

describe('echo levels', () => {
  it('grow as the clarifications of E2 list them', () => {
    expect(ECHO_LEVEL_IDS).toEqual(['EC1', 'EC2', 'EC3', 'EC4', 'EC5', 'EC6', 'EC7']);
    expect(ECHO_LEVEL_IDS.map((id) => ECHO_RULES[id].notes)).toEqual([
      [3, 3],
      [4, 4],
      [5, 5],
      [6, 6],
      [8, 8],
      [5, 6],
      [6, 8],
    ]);
    const tonics = (id: EchoLevelId) => ECHO_RULES[id].keys.map((k) => `${k.tonic} ${k.mode}`);
    expect(tonics('EC1')).toEqual(['C major', 'G major', 'F major']);
    expect(tonics('EC4')).toEqual(['C major', 'G major', 'D major', 'F major', 'Bb major']);
    expect(tonics('EC6')).toEqual(['A minor', 'E minor', 'D minor']);
  });

  it('knows steps, skips and leaps', () => {
    // Anything to begin with, and a step or a skip after a step or a skip.
    expect(keepsMotionRules([], 4)).toBe(true);
    expect(keepsMotionRules([1], 2)).toBe(true);
    expect(keepsMotionRules([2], -2)).toBe(true);
    // Two skips the same way outline a triad (1–3–5, 5–3–1); a third one does not follow.
    expect(keepsMotionRules([2], 2)).toBe(true);
    expect(keepsMotionRules([-2], -2)).toBe(true);
    expect(keepsMotionRules([2, 2], 2)).toBe(false);
    expect(keepsMotionRules([-2, -2], -2)).toBe(false);
    expect(keepsMotionRules([2, -2], -2)).toBe(true);
    expect(keepsMotionRules([1, 2, 2], -2)).toBe(true);
    // A skip may run into a leap; never two leaps the same way.
    expect(keepsMotionRules([2], 3)).toBe(true);
    expect(keepsMotionRules([-3], -4)).toBe(false);
    // After a leap: back, or on by step, not on by a skip.
    expect(keepsMotionRules([4], 1)).toBe(true);
    expect(keepsMotionRules([4], -1)).toBe(true);
    expect(keepsMotionRules([4], -5)).toBe(true);
    expect(keepsMotionRules([3], 2)).toBe(false);
    expect(keepsMotionRules([7], 2)).toBe(false);
    // Never the same note twice.
    expect(keepsMotionRules([1], 0)).toBe(false);
  });
});

describe('echo melodies', () => {
  it.each(ECHO_LEVEL_IDS)('%s keeps every rule of its level', (level) => {
    const rules = ECHO_RULES[level];
    for (const m of melodies(level)) {
      const where = `${level} ${m.tonic} ${m.scale}: ${m.notes.join(' ')}`;
      // Length and range.
      expect(m.notes.length, where).toBeGreaterThanOrEqual(rules.notes[0]);
      expect(m.notes.length, where).toBeLessThanOrEqual(rules.notes[1]);
      for (const midi of m.notes) {
        expect(midi, where).toBeGreaterThanOrEqual(MELODY_LOWEST);
        expect(midi, where).toBeLessThanOrEqual(MELODY_HIGHEST);
      }
      // Never the same key twice in a row, never more than an octave from one to the next.
      m.notes.slice(1).forEach((midi, i) => {
        expect(midi, where).not.toBe(m.notes[i]);
        expect(Math.abs(midi - m.notes[i]!), where).toBeLessThanOrEqual(12);
      });
      // Starts on 1, 3 or 5; ends on 1, or on a note of the tonic chord.
      const first = m.line[0]!;
      const last = m.line.at(-1)!;
      expect(first.chromatic, where).toBe(0);
      expect([0, 2, 4], where).toContain(mod7(first.step));
      expect(last.chromatic, where).toBe(0);
      expect(rules.end === 'tonic' ? [0] : [0, 2, 4], where).toContain(mod7(last.step));
      // The steps, their sizes and the leap rules.
      const steps = skeleton(m);
      steps.forEach((step, i) => {
        expect(step, where).toBeGreaterThanOrEqual(rules.span[0]);
        expect(step, where).toBeLessThanOrEqual(rules.span[1]);
        if (i === 0) return;
        const move = step - steps[i - 1]!;
        expect(rules.moves, where).toContain(Math.abs(move));
        const before = steps.slice(1, i).map((s, j) => s - steps[j]!);
        expect(keepsMotionRules(before, move), where).toBe(true);
      });
      if (rules.leadingTone) {
        steps.forEach((step, i) => {
          if (mod7(step) === 6) expect(steps[i + 1], where).toBe(step + 1);
        });
      }
      // Written in the key, sounding as played, never with a double sign.
      expect(m.written.map(midiOf), where).toEqual(m.notes);
      for (const pitch of m.written) expect(Math.abs(pitch.alter), where).toBeLessThanOrEqual(1);
      // The tonic chord in root position on the tonic.
      const [root, third, fifth] = m.chord as [number, number, number];
      expect(pitchClass(root), where).toBe(TONIC_PC[m.tonic]);
      expect([third - root, fifth - root], where).toEqual(m.scale === 'major' ? [4, 7] : [3, 7]);
    }
  });

  it('outlines triads with two skips the same way, never three', () => {
    const skipRuns = (m: Melody) => {
      const steps = skeleton(m);
      const moves = steps.slice(1).map((s, i) => s - steps[i]!);
      let longest = 0;
      let run = 0;
      moves.forEach((move, i) => {
        const skip = Math.abs(move) === 2;
        run =
          skip &&
          i > 0 &&
          Math.abs(moves[i - 1]!) === 2 &&
          Math.sign(moves[i - 1]!) === Math.sign(move)
            ? run + 1
            : skip
              ? 1
              : 0;
        longest = Math.max(longest, run);
      });
      return longest;
    };
    for (const level of ECHO_LEVEL_IDS.slice(1)) {
      const runs = melodies(level).map(skipRuns);
      expect(Math.max(...runs), level).toBe(2);
    }
    expect(Math.max(...melodies('EC1').map(skipRuns))).toBe(0);
  });

  it('leaps a tritone only where any leap within the octave is', () => {
    const tritones = (level: EchoLevelId) =>
      melodies(level).filter((m) =>
        m.notes.some((midi, i) => i > 0 && Math.abs(midi - m.notes[i - 1]!) === 6),
      ).length;
    for (const level of ['EC1', 'EC2', 'EC3', 'EC4', 'EC6'] as const)
      expect(tritones(level)).toBe(0);
    expect(tritones('EC5')).toBeGreaterThan(0);
  });

  it('plays only the levels’ keys, and each of them', () => {
    for (const level of ECHO_LEVEL_IDS) {
      const seen = new Set(melodies(level, 200).map((m) => m.tonic));
      expect([...seen].sort(), level).toEqual(ECHO_RULES[level].keys.map((k) => k.tonic).sort());
    }
  });

  it('gives each key its signature', () => {
    const fifths = new Map<string, number>();
    for (const level of ['EC4', 'EC6'] as const) {
      for (const m of melodies(level, 200)) fifths.set(`${m.tonic} ${m.scale}`, m.fifths);
    }
    expect(Object.fromEntries(fifths)).toMatchObject({
      'C major': 0,
      'G major': 1,
      'D major': 2,
      'F major': -1,
      'Bb major': -2,
      'A naturalMinor': 0,
      'A harmonicMinor': 0,
      'E harmonicMinor': 1,
      'D naturalMinor': -1,
    });
  });

  it('draws the only two lines EC1 allows: 1–2–1 and 3–2–1', () => {
    const lines = new Set(melodies('EC1').map((m) => m.line.map((n) => n.step).join(' ')));
    expect([...lines].sort()).toEqual(['0 1 0', '2 1 0']);
  });

  it('draws varied melodies from EC2 on', () => {
    for (const level of ECHO_LEVEL_IDS.slice(1)) {
      const lines = new Set(melodies(level, 200).map((m) => m.line.map((n) => n.step).join(' ')));
      expect(lines.size, level).toBeGreaterThan(level === 'EC2' ? 5 : 40);
    }
  });

  it('writes minor melodies in the natural or harmonic form, with the raised 7th in the latter', () => {
    const all = melodies('EC6');
    expect(new Set(all.map((m) => m.scale))).toEqual(new Set(['naturalMinor', 'harmonicMinor']));
    let sevenths = 0;
    for (const m of all) {
      m.line.forEach((note, i) => {
        if (mod7(note.step) !== 6) return;
        sevenths++;
        const aboveTonic = pitchClass(m.notes[i]! - TONIC_PC[m.tonic]!);
        expect(aboveTonic).toBe(m.scale === 'harmonicMinor' ? 11 : 10);
        if (m.scale === 'harmonicMinor') {
          // G♯ in A minor, D♯ in E minor, C♯ in D minor: written with its sharp.
          expect(m.written[i]!.alter).toBe(1);
        }
      });
    }
    expect(sevenths).toBeGreaterThan(50);
  });

  it('keeps chromatic notes to EC7: one or two, each a neighbour or a passing note', () => {
    for (const level of ECHO_LEVEL_IDS.slice(0, 6)) {
      for (const m of melodies(level, 200))
        expect(m.line.every((n) => n.chromatic === 0)).toBe(true);
    }
    const kinds = { neighbour: 0, passing: 0 };
    for (const m of melodies('EC7')) {
      const where = `${m.tonic}: ${m.notes.join(' ')}`;
      const chromatic = m.line.flatMap((n, i) => (n.chromatic === 0 ? [] : [i]));
      expect(chromatic.length, where).toBeGreaterThanOrEqual(1);
      expect(chromatic.length, where).toBeLessThanOrEqual(2);
      for (const i of chromatic) {
        expect(i, where).toBeGreaterThan(0);
        expect(i, where).toBeLessThan(m.notes.length - 1);
        expect(chromatic, where).not.toContain(i + 1);
        const [before, note, after] = [m.notes[i - 1]!, m.notes[i]!, m.notes[i + 1]!];
        // Not a note of the scale.
        const degrees = [0, 1, 2, 3, 4, 5, 6].map((d) => stepSemitones('major', d));
        expect(degrees, where).not.toContain(pitchClass(note - TONIC_PC[m.tonic]!));
        if (before === after) {
          kinds.neighbour++;
          expect(Math.abs(note - before), where).toBe(1);
        } else {
          kinds.passing++;
          expect(Math.abs(after - before), where).toBe(2);
          expect((note - before) * (after - note), where).toBe(1);
        }
      }
    }
    expect(kinds.neighbour).toBeGreaterThan(50);
    expect(kinds.passing).toBeGreaterThan(50);
  });

  it('writes chromatic notes raised going up and lowered going down, white keys plain', () => {
    const seen = new Set<string>();
    for (const m of melodies('EC7')) {
      m.line.forEach((n, i) => {
        if (n.chromatic === 0) return;
        const w = m.written[i]!;
        const name = `${w.step}${w.alter}`;
        // Never B♯, E♯, C♭ or F♭.
        expect(['B1', 'E1', 'C-1', 'F-1']).not.toContain(name);
        seen.add(name);
      });
    }
    expect(seen).toContain('C1');
    expect(seen).toContain('A-1');
  });

  it('starts on 1, 3 and 5, and ends on 3 and 5 too where the tonic chord may end it', () => {
    const starts = new Set(melodies('EC4').map((m) => mod7(m.line[0]!.step)));
    expect([...starts].sort()).toEqual([0, 2, 4]);
    const ends = new Set(melodies('EC7').map((m) => mod7(m.line.at(-1)!.step)));
    expect([...ends].sort()).toEqual([0, 2, 4]);
  });

  it('checks stored keys against the level', () => {
    expect(melodyFits('EC1', [64, 62, 60])).toBe(true);
    expect(melodyFits('EC1', [64, 62, 60, 62])).toBe(false);
    expect(melodyFits('EC6', [69, 71, 72, 71, 69])).toBe(true);
    expect(melodyFits('EC6', [69, 71, 72, 71, 69, 64])).toBe(true);
    expect(melodyFits('EC2', [60, 60, 62, 60])).toBe(false);
  });
});

describe('the timing of a melody', () => {
  it('sets the key with the tonic chord, rests a quarter, then plays quarters at 100', () => {
    const timed = melodyTiming([64, 62, 60], [60, 64, 67]);
    expect(timed).toEqual([
      { midi: 60, on: 0, off: TONIC_CHORD_MS },
      { midi: 64, on: 0, off: TONIC_CHORD_MS },
      { midi: 67, on: 0, off: TONIC_CHORD_MS },
      { midi: 64, on: 1500, off: 1500 + MELODY_NOTE_MS },
      { midi: 62, on: 2100, off: 2100 + MELODY_NOTE_MS },
      { midi: 60, on: 2700, off: 2700 + MELODY_NOTE_MS },
    ]);
    expect(BEAT_MS).toBe(600);
    expect(MELODY_NOTE_MS).toBe(540);
  });

  it('plays the melody alone at once without the chord', () => {
    expect(melodyTiming([64, 62], null)).toEqual([
      { midi: 64, on: 0, off: 540 },
      { midi: 62, on: 600, off: 1140 },
    ]);
  });
});

describe('judging a melody played back', () => {
  const melody = [64, 62, 60];

  it('takes the keys one by one, in order', () => {
    expect(judgeEchoKey(melody, [], 64)).toBe('next');
    expect(judgeEchoKey(melody, [64], 62)).toBe('next');
    expect(judgeEchoKey(melody, [64, 62], 60)).toBe('right');
    expect(judgeEchoKey(melody, [], 62)).toBe('wrong');
    expect(judgeEchoKey(melody, [64], 60)).toBe('wrong');
  });

  it('judges a stored answer again from its keys', () => {
    expect(judgeEchoAnswer(melody, [64, 62, 60])).toBe(true);
    expect(judgeEchoAnswer(melody, [64, 62, 59])).toBe(false);
    expect(judgeEchoAnswer(melody, [65])).toBe(false);
    // Not answers the session records: unfinished, a wrong key before the last, too long, none.
    expect(judgeEchoAnswer(melody, [64, 62])).toBeNull();
    expect(judgeEchoAnswer(melody, [64, 61, 60])).toBeNull();
    expect(judgeEchoAnswer(melody, [64, 62, 60, 59])).toBeNull();
    expect(judgeEchoAnswer(melody, [])).toBeNull();
  });

  it('tells where it went wrong, by the interval into the wrong note', () => {
    expect(echoMistake([60, 65, 64, 60], [60, 67])).toEqual({
      note: 2,
      expected: 65,
      played: 67,
      asked: 5,
      answered: 7,
    });
    expect(echoMistake([64, 62, 60], [65])).toEqual({
      note: 1,
      expected: 64,
      played: 65,
      asked: null,
      answered: null,
    });
    expect(echoMistake([64, 62, 60], [64, 62, 60])).toBeNull();
  });
});

describe('writing a melody', () => {
  const key = (tonic: string, scale: Melody['scale'], fifths: number) => ({ tonic, scale, fifths });

  it('spells a key as the scale does, and others with the key’s kind of sign', () => {
    const name = (p: { step: string; alter: number; octave: number }) =>
      `${p.step}${['b', '', '#'][p.alter + 1]}${p.octave}`;
    const d = key('D', 'major', 2);
    expect(name(spellInKey(66, d))).toBe('F#4');
    expect(name(spellInKey(65, d))).toBe('F4');
    expect(name(spellInKey(63, d))).toBe('D#4');
    const f = key('F', 'major', -1);
    expect(name(spellInKey(70, f))).toBe('Bb4');
    expect(name(spellInKey(66, f))).toBe('Gb4');
    expect(name(spellInKey(71, f))).toBe('B4');
    expect(name(spellInKey(68, key('A', 'harmonicMinor', 0)))).toBe('G#4');
    expect(name(spellInKey(68, key('A', 'naturalMinor', 0)))).toBe('G#4');
    expect(name(spellInKey(59, key('C', 'major', 0)))).toBe('B3');
    expect(name(spellInKey(83, key('Bb', 'major', -2)))).toBe('B5');
  });

  it('marks accidentals as within one bar', () => {
    const p = (step: 'F' | 'G' | 'C', alter: number, octave = 4) => ({ step, alter, octave });
    // G major: F♯ is in the key; F♮ needs its sign, and F♯ after it its sharp again.
    expect(accidentalMarks([p('F', 1), p('F', 0), p('F', 1), p('G', 0)], 1).line).toEqual([
      null,
      0,
      1,
      null,
    ]);
    // Another octave is another place.
    expect(accidentalMarks([p('F', 0), p('F', 0, 5)], 1).line).toEqual([0, 0]);
    // C major: C♯ then C♯ again needs its sign once.
    expect(accidentalMarks([p('C', 1), p('C', 1)], 0).line).toEqual([1, null]);
  });

  it('marks a wrong note against the line so far, without changing what follows', () => {
    const line = [
      { step: 'G' as const, alter: 0, octave: 4 },
      { step: 'F' as const, alter: 1, octave: 4 },
      { step: 'G' as const, alter: 0, octave: 4 },
    ];
    // C major: F♮ played for F♯, on the same line: its natural is shown.
    expect(
      accidentalMarks(line, 0, { index: 1, pitch: { step: 'F', alter: 0, octave: 4 } }),
    ).toEqual({
      line: [null, 1, null],
      extra: 0,
    });
    // A♭ played for G: its flat.
    expect(
      accidentalMarks(line, 0, { index: 2, pitch: { step: 'A', alter: -1, octave: 4 } }).extra,
    ).toBe(-1);
    // G played for F♯ in G major: nothing to show.
    expect(
      accidentalMarks(line, 1, { index: 1, pitch: { step: 'G', alter: 0, octave: 4 } }),
    ).toEqual({
      line: [null, null, null],
      extra: null,
    });
  });
});

describe('scale degrees below and above the tonic', () => {
  it('counts steps down from the tonic as well as up', () => {
    const d4 = tonicPitch('D', 4);
    expect(scaleDegree('major', d4, -3)).toEqual({ step: 'A', alter: 0, octave: 3 });
    expect(scaleDegree('major', d4, -1)).toEqual({ step: 'C', alter: 1, octave: 4 });
    expect(scaleDegree('major', d4, 9)).toEqual({ step: 'F', alter: 1, octave: 5 });
    expect(scaleDegree('harmonicMinor', tonicPitch('A', 4), -1)).toEqual({
      step: 'G',
      alter: 1,
      octave: 4,
    });
    expect(scaleDegree('major', tonicPitch('Bb', 3), 2)).toEqual({
      step: 'D',
      alter: 0,
      octave: 4,
    });
  });
});
