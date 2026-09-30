import { describe, expect, it } from 'vitest';
import {
  answerNames,
  BLOCK_MS,
  BROKEN_GAP_MS,
  BROKEN_STEP_MS,
  CHORD_LEVELS,
  chordItem,
  directionsOf,
  EAR_LEVELS,
  getEarLevel,
  givenKey,
  HARMONIC_MS,
  INTERVAL_LEVELS,
  INTERVAL_NAMES,
  INTERVAL_SEMITONES,
  intervalItem,
  intervalOfSemitones,
  isEarLevelId,
  itemInLevel,
  judgeChordKeys,
  judgeIntervalKey,
  levelItems,
  makePrompt,
  MELODIC_NOTE_MS,
  MELODIC_STEP_MS,
  nextEarLevel,
  parseItem,
  promptMatches,
  promptPlan,
  spellPrompt,
  voicing,
  type Prompt,
} from './earItems.ts';
import { formatPitch, pitchToMidi } from './note.ts';
import { seededRng } from './random.ts';

const spelled = (prompt: Prompt) => spellPrompt(prompt)?.map(formatPitch);

describe('ear items', () => {
  it('keys intervals by name and direction, chords by quality and position', () => {
    expect(intervalItem('M3', 'up')).toBe('int:M3:up');
    expect(chordItem('min', '1st')).toBe('chord:min:1st');
    expect(parseItem('int:TT:harm')).toEqual({ family: 'interval', name: 'TT', direction: 'harm' });
    expect(parseItem('chord:hdim7:root')).toEqual({
      family: 'chord',
      quality: 'hdim7',
      inversion: 'root',
    });
    for (const bad of ['int:M3', 'int:A4:up', 'int:M3:sideways', 'chord:sus4:root', 'x:M3:up']) {
      expect(parseItem(bad)).toBeNull();
    }
    expect(parseItem('int:M3:up:extra')).toBeNull();
  });

  it('knows every interval by its size', () => {
    expect(INTERVAL_NAMES).toHaveLength(18);
    for (const name of INTERVAL_NAMES) {
      expect(intervalOfSemitones(INTERVAL_SEMITONES[name])).toBe(name);
    }
    expect(intervalOfSemitones(18)).toBeNull();
    expect(intervalOfSemitones(0)).toBeNull();
  });

  it('defines the interval levels I1–I7 as the clarifications list them', () => {
    expect(INTERVAL_LEVELS.map((l) => l.names.join(' '))).toEqual([
      'P8 P5 M3',
      'P8 P5 M3 P4 m3',
      'P8 P5 M3 P4 m3 M2 m2',
      'P8 P5 M3 P4 m3 M2 m2 M6 m6',
      'P8 P5 M3 P4 m3 M2 m2 M6 m6 M7 m7',
      'P8 P5 M3 P4 m3 M2 m2 M6 m6 M7 m7 TT',
      'P8 P5 M3 P4 m3 M2 m2 M6 m6 M7 m7 TT m9 M9 m10 M10 P11 P12',
    ]);
    // I6: every simple interval but the unison.
    expect(new Set(INTERVAL_LEVELS[5]!.names.map((n) => INTERVAL_SEMITONES[n]))).toEqual(
      new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
    );
  });

  it('defines the chord levels C1–C5', () => {
    expect(CHORD_LEVELS.map((l) => answerNames(l).join(' '))).toEqual([
      'maj:root min:root',
      'maj:root min:root dim:root aug:root',
      'maj:root min:root maj:1st min:1st maj:2nd min:2nd',
      'dom7:root maj7:root min7:root hdim7:root',
      'maj:root min:root dim:root aug:root dom7:root maj7:root min7:root hdim7:root',
    ]);
    expect(CHORD_LEVELS.map((l) => l.bassMatters)).toEqual([false, false, true, false, false]);
  });

  it('draws the items of a level in each direction asked for', () => {
    const i1 = getEarLevel('I1');
    expect(levelItems(i1, directionsOf('up'))).toEqual(['int:P8:up', 'int:P5:up', 'int:M3:up']);
    expect(levelItems(i1, directionsOf('mixed'))).toHaveLength(9);
    expect(levelItems(getEarLevel('C3'), [])).toContain('chord:min:2nd');
    expect(itemInLevel(parseItem('int:M3:down')!, i1)).toBe(true);
    expect(itemInLevel(parseItem('int:P4:up')!, i1)).toBe(false);
    expect(itemInLevel(parseItem('chord:maj:1st')!, getEarLevel('C1'))).toBe(false);
    expect(itemInLevel(parseItem('chord:maj:root')!, i1)).toBe(false);
  });

  it('names and orders the levels', () => {
    expect(EAR_LEVELS.map((l) => l.id)).toEqual([
      'I1',
      'I2',
      'I3',
      'I4',
      'I5',
      'I6',
      'I7',
      'C1',
      'C2',
      'C3',
      'C4',
      'C5',
    ]);
    expect(isEarLevelId('C3')).toBe(true);
    expect(isEarLevelId('L3')).toBe(false);
    expect(nextEarLevel('I6')).toBe('I7');
    expect(nextEarLevel('I7')).toBeNull();
    expect(nextEarLevel('C5')).toBeNull();
  });
});

describe('ear prompts', () => {
  it('keeps an interval in C3–C5 with the upper note at most C6, in its direction', () => {
    const rng = seededRng(3);
    const lows = new Set<number>();
    for (const name of INTERVAL_NAMES) {
      for (const direction of ['up', 'down', 'harm'] as const) {
        for (let i = 0; i < 200; i++) {
          const prompt = makePrompt(intervalItem(name, direction), rng);
          const [first, second] = prompt.notes as [number, number];
          const lower = Math.min(first, second);
          const upper = Math.max(first, second);
          lows.add(lower);
          expect(upper - lower).toBe(INTERVAL_SEMITONES[name]);
          expect(lower).toBeGreaterThanOrEqual(48);
          expect(lower).toBeLessThanOrEqual(72);
          expect(upper).toBeLessThanOrEqual(84);
          expect(first === lower).toBe(direction !== 'down');
          expect(promptMatches(parseItem(prompt.item)!, prompt.notes)).toBe(true);
        }
      }
    }
    // Every lower note of the range comes up.
    expect(lows).toEqual(new Set(Array.from({ length: 25 }, (_, i) => 48 + i)));
  });

  it('builds chords in close position inside the range, sevenths up to C6', () => {
    const rng = seededRng(5);
    for (const level of CHORD_LEVELS) {
      for (const { quality, inversion } of level.chords) {
        const offsets = voicing(quality, inversion);
        for (let i = 0; i < 100; i++) {
          const prompt = makePrompt(chordItem(quality, inversion), rng);
          const notes = prompt.notes;
          expect(notes[0]).toBeGreaterThanOrEqual(48);
          expect(notes.at(-1)).toBeLessThanOrEqual(offsets.length === 4 ? 84 : 72);
          expect(notes.map((n) => n - notes[0]!)).toEqual(offsets.map((o) => o - offsets[0]!));
        }
      }
    }
    expect(voicing('maj', 'root')).toEqual([0, 4, 7]);
    expect(voicing('maj', '1st')).toEqual([4, 7, 12]);
    expect(voicing('min', '2nd')).toEqual([7, 12, 15]);
    expect(voicing('hdim7', 'root')).toEqual([0, 3, 6, 10]);
  });

  it('shows the first note of an interval and the root of a chord', () => {
    expect(givenKey({ item: 'int:M3:up', notes: [60, 64] })).toBe(60);
    expect(givenKey({ item: 'int:M3:down', notes: [64, 60] })).toBe(64);
    expect(givenKey({ item: 'int:M3:harm', notes: [60, 64] })).toBe(60);
    expect(givenKey({ item: 'chord:maj:root', notes: [60, 64, 67] })).toBe(60);
    expect(givenKey({ item: 'chord:maj:1st', notes: [64, 67, 72] })).toBe(72);
    expect(givenKey({ item: 'chord:min:2nd', notes: [67, 72, 75] })).toBe(72);
  });

  it('checks that a stored prompt belongs to its item', () => {
    const m3 = parseItem('int:M3:down')!;
    expect(promptMatches(m3, [64, 60])).toBe(true);
    expect(promptMatches(m3, [60, 64])).toBe(false);
    expect(promptMatches(m3, [64, 61])).toBe(false);
    expect(promptMatches(m3, [64])).toBe(false);
    const inverted = parseItem('chord:maj:1st')!;
    expect(promptMatches(inverted, [64, 67, 72])).toBe(true);
    expect(promptMatches(inverted, [60, 64, 67])).toBe(false);
  });
});

describe('the timing of a prompt', () => {
  it('plays a melodic interval note after note and opens at the second', () => {
    const plan = promptPlan({ item: 'int:P5:down', notes: [67, 60] }, 'broken');
    expect(plan.notes).toEqual([
      { midi: 67, on: 0, off: MELODIC_NOTE_MS },
      { midi: 60, on: MELODIC_STEP_MS, off: MELODIC_STEP_MS + MELODIC_NOTE_MS },
    ]);
    expect(plan.lastOn).toBe(MELODIC_STEP_MS);
    expect(plan.length).toBe(MELODIC_STEP_MS + MELODIC_NOTE_MS);
  });

  it('plays a harmonic interval together and opens at once', () => {
    const plan = promptPlan({ item: 'int:P5:harm', notes: [60, 67] }, 'block');
    expect(plan.notes.map((n) => [n.on, n.off])).toEqual([
      [0, HARMONIC_MS],
      [0, HARMONIC_MS],
    ]);
    expect(plan.lastOn).toBe(0);
  });

  it('plays a chord broken, then block, and opens at the block chord', () => {
    const prompt = { item: 'chord:dom7:root', notes: [55, 59, 62, 65] };
    const plan = promptPlan(prompt, 'broken');
    const blockOn = 4 * BROKEN_STEP_MS + BROKEN_GAP_MS;
    expect(plan.notes.slice(0, 4).map((n) => n.on)).toEqual([0, 450, 900, 1350]);
    // Each broken note ends before its key sounds again in the block chord.
    expect(Math.max(...plan.notes.slice(0, 4).map((n) => n.off))).toBeLessThan(blockOn);
    expect(plan.notes.slice(4).every((n) => n.on === blockOn && n.off === blockOn + BLOCK_MS)).toBe(
      true,
    );
    expect(plan.lastOn).toBe(blockOn);
    const block = promptPlan(prompt, 'block');
    expect(block.notes).toHaveLength(4);
    expect(block.lastOn).toBe(0);
    expect(block.length).toBe(BLOCK_MS);
  });
});

describe('judging an answer played', () => {
  it('takes the exact key for an interval, and passes over the key shown', () => {
    const prompt = { item: 'int:M3:up', notes: [60, 64] };
    expect(judgeIntervalKey(prompt, 64)).toBe('right');
    expect(judgeIntervalKey(prompt, 76)).toBe('wrong');
    expect(judgeIntervalKey(prompt, 63)).toBe('wrong');
    expect(judgeIntervalKey(prompt, 60)).toBe('ignored');
    const down = { item: 'int:M3:down', notes: [64, 60] };
    expect(judgeIntervalKey(down, 60)).toBe('right');
    expect(judgeIntervalKey(down, 64)).toBe('ignored');
    expect(judgeIntervalKey(down, 68)).toBe('wrong');
  });

  it('takes a chord in any voicing and octave with exactly its pitch classes', () => {
    const prompt = { item: 'chord:maj:root', notes: [60, 64, 67] };
    expect(judgeChordKeys(prompt, [60], false)).toBe('pending');
    expect(judgeChordKeys(prompt, [60, 64], false)).toBe('pending');
    expect(judgeChordKeys(prompt, [60, 64, 67], false)).toBe('right');
    expect(judgeChordKeys(prompt, [52, 67, 72], false)).toBe('right');
    expect(judgeChordKeys(prompt, [48, 60, 64, 67, 76], false)).toBe('right');
    expect(judgeChordKeys(prompt, [60, 63], false)).toBe('wrong');
    expect(judgeChordKeys(prompt, [61], false)).toBe('wrong');
  });

  it('wants the right bass in the inversion level', () => {
    const first = { item: 'chord:maj:1st', notes: [64, 67, 72] };
    expect(judgeChordKeys(first, [64, 67, 72], true)).toBe('right');
    expect(judgeChordKeys(first, [52, 60, 67], true)).toBe('right');
    expect(judgeChordKeys(first, [60, 64, 67], true)).toBe('wrong');
    expect(judgeChordKeys(first, [60, 64, 67], false)).toBe('right');
    expect(judgeChordKeys(first, [60, 64], true)).toBe('pending');
  });
});

describe('spelling a prompt for the staff', () => {
  it('spells intervals by their letters with the fewest accidentals', () => {
    expect(spelled({ item: 'int:M3:up', notes: [60, 64] })).toEqual(['C4', 'E4']);
    expect(spelled({ item: 'int:m3:up', notes: [61, 64] })).toEqual(['C♯4', 'E4']);
    expect(spelled({ item: 'int:M3:down', notes: [65, 61] })).toEqual(['D♭4', 'F4']);
    expect(spelled({ item: 'int:m6:up', notes: [64, 72] })).toEqual(['E4', 'C5']);
    expect(spelled({ item: 'int:TT:up', notes: [65, 71] })).toEqual(['F4', 'B4']);
    expect(spelled({ item: 'int:TT:up', notes: [59, 65] })).toEqual(['B3', 'F4']);
    expect(spelled({ item: 'int:P12:up', notes: [48, 67] })).toEqual(['C3', 'G4']);
    expect(spelled({ item: 'int:m10:harm', notes: [57, 72] })).toEqual(['A3', 'C5']);
  });

  it('spells chords in thirds from the root', () => {
    expect(spelled({ item: 'chord:maj:root', notes: [61, 65, 68] })).toEqual(['D♭4', 'F4', 'A♭4']);
    expect(spelled({ item: 'chord:min:root', notes: [61, 64, 68] })).toEqual(['C♯4', 'E4', 'G♯4']);
    expect(spelled({ item: 'chord:dim:root', notes: [59, 62, 65] })).toEqual(['B3', 'D4', 'F4']);
    expect(spelled({ item: 'chord:aug:root', notes: [60, 64, 68] })).toEqual(['C4', 'E4', 'G♯4']);
    expect(spelled({ item: 'chord:maj:1st', notes: [64, 67, 72] })).toEqual(['E4', 'G4', 'C5']);
    expect(spelled({ item: 'chord:min:2nd', notes: [58, 63, 66] })).toEqual(['B♭3', 'E♭4', 'G♭4']);
    expect(spelled({ item: 'chord:dom7:root', notes: [55, 59, 62, 65] })).toEqual([
      'G3',
      'B3',
      'D4',
      'F4',
    ]);
  });

  it('never needs a double accidental, and always sounds as played', () => {
    const rng = seededRng(11);
    for (const level of EAR_LEVELS) {
      for (const item of levelItems(level, ['up', 'down', 'harm'])) {
        for (let i = 0; i < 40; i++) {
          const prompt = makePrompt(item, rng);
          const pitches = spellPrompt(prompt);
          expect(pitches, item).not.toBeNull();
          expect(pitches!.map(pitchToMidi)).toEqual([...prompt.notes].sort((a, b) => a - b));
        }
      }
    }
  });
});
