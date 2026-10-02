import { describe, expect, it } from 'vitest';
import { nextRung, scaleLadder } from './curriculum.ts';
import { askedKeys, type EarSessionState } from './earSession.ts';
import {
  answersKey,
  beyondKeys,
  canDraw,
  capturedKeys,
  FEW_NOTES,
  fitsKeys,
  FULL_KEYS,
  hasKey,
  isFullKeys,
  keyAnswered,
  KEYBOARD_SIZES,
  keyboardChoice,
  KEYBOARDS,
  levelOnKeys,
  notesOnKeys,
  parseKeyRange,
  reachBeyond,
  readKeyRange,
  scaleFits,
  scaleKeys,
  type KeyRange,
} from './instrument.ts';
import { SMALL } from './keyboardFixture.ts';
import { getLevel, LEVELS } from './levels.ts';
import { weakestLately, type ExerciseProgress } from './scaleRanking.ts';
import {
  exerciseKey,
  exerciseSpan,
  handsAllowed,
  SCALE_HANDS,
  scaleNotes,
  tonicsOf,
} from './scales.ts';
import { SCALE_OCTAVES, SCALE_TYPES, type ScaleExercise } from './scaleTypes.ts';

describe('the keyboards to choose from', () => {
  it('have the keys their size says: A0–C8, E1–G7, E1–E7, C2–C7, C2–C6', () => {
    expect(KEYBOARD_SIZES).toEqual([88, 76, 73, 61, 49]);
    for (const size of KEYBOARD_SIZES) {
      const { low, high } = KEYBOARDS[size];
      expect(high - low + 1).toBe(size);
    }
    expect(KEYBOARDS[88]).toEqual({ low: 21, high: 108 });
    expect(KEYBOARDS[76]).toEqual({ low: 28, high: 103 });
    expect(KEYBOARDS[73]).toEqual({ low: 28, high: 100 });
    expect(KEYBOARDS[61]).toEqual({ low: 36, high: 96 });
    expect(KEYBOARDS[49]).toEqual({ low: 36, high: 84 });
  });

  it('names the choice a keyboard is: its size, or other', () => {
    for (const size of KEYBOARD_SIZES) expect(keyboardChoice({ ...KEYBOARDS[size] })).toBe(size);
    expect(keyboardChoice(SMALL)).toBe('other');
    expect(isFullKeys(FULL_KEYS)).toBe(true);
    expect(isFullKeys(KEYBOARDS[76])).toBe(false);
    expect(hasKey(SMALL, 48)).toBe(true);
    expect(hasKey(SMALL, 72)).toBe(true);
    expect(hasKey(SMALL, 47)).toBe(false);
    expect(hasKey(SMALL, 73)).toBe(false);
  });
});

describe('the preference', () => {
  it('is read field by field', () => {
    expect(parseKeyRange({ low: 36, high: 84 })).toEqual({ low: 36, high: 84 });
    // What it has besides is left.
    expect(parseKeyRange({ low: 48, high: 72, name: 'mine' })).toEqual({ low: 48, high: 72 });
  });

  it.each([
    ['nothing kept', null],
    ['a text', '36-84'],
    ['a list', [36, 84]],
    ['a key missing', { low: 36 }],
    ['keys as text', { low: '36', high: '84' }],
    ['a key that is no whole number', { low: 36.5, high: 84 }],
    ['a key under the piano', { low: 20, high: 84 }],
    ['a key over the piano', { low: 36, high: 109 }],
    ['the highest under the lowest', { low: 84, high: 36 }],
    ['less than an octave', { low: 60, high: 71 }],
    ['not a number', { low: Number.NaN, high: 84 }],
  ])('takes %s for 88 keys', (_, value) => {
    expect(parseKeyRange(value)).toBeNull();
    expect(readKeyRange(value)).toBe(FULL_KEYS);
  });

  it('keeps a keyboard of an octave', () => {
    expect(readKeyRange({ low: 60, high: 72 })).toEqual({ low: 60, high: 72 });
  });
});

describe('press the lowest key, then the highest', () => {
  it('takes the two keys in whichever order they came', () => {
    expect(capturedKeys(48, 72)).toEqual(SMALL);
    expect(capturedKeys(72, 48)).toEqual(SMALL);
  });

  it('is no keyboard under an octave: the second key is asked for again', () => {
    expect(capturedKeys(60, 60)).toBeNull();
    expect(capturedKeys(60, 71)).toBeNull();
    expect(capturedKeys(60, 72)).toEqual({ low: 60, high: 72 });
  });

  it('keeps within the piano', () => {
    expect(capturedKeys(12, 120)).toEqual(FULL_KEYS);
  });
});

describe('a piece beyond the keyboard', () => {
  it('counts the notes under and over it and names how far they go', () => {
    expect(beyondKeys([60, 64, 48, 72], SMALL)).toBeNull();
    expect(beyondKeys([43, 60, 40, 43], SMALL)).toEqual({
      below: { notes: 3, lowest: 40 },
      above: null,
    });
    expect(beyondKeys([60, 76, 84], SMALL)).toEqual({
      below: null,
      above: { notes: 2, highest: 84 },
    });
    expect(beyondKeys([33, 60, 88], KEYBOARDS[49])).toEqual({
      below: { notes: 1, lowest: 33 },
      above: { notes: 1, highest: 88 },
    });
  });

  it('is told from its two ends where only they are known (a card)', () => {
    // Für Elise, A1 to E6.
    expect(reachBeyond([33, 88], KEYBOARDS[49])).toEqual({ below: 33, above: 88 });
    expect(reachBeyond([33, 88], KEYBOARDS[61])).toEqual({ below: 33, above: null });
    expect(reachBeyond([33, 88], KEYBOARDS[76])).toBeNull();
    expect(reachBeyond([33, 88], FULL_KEYS)).toBeNull();
    expect(reachBeyond([60, 72], SMALL)).toBeNull();
  });
});

describe('the scales that fit', () => {
  const exercises = SCALE_TYPES.flatMap((type) =>
    tonicsOf(type).flatMap((tonic) =>
      SCALE_OCTAVES.flatMap((octaves) =>
        SCALE_HANDS.flatMap((hands): ScaleExercise[] =>
          handsAllowed({ type, octaves }, hands) ? [{ type, tonic, octaves, hands }] : [],
        ),
      ),
    ),
  );

  it('knows the keys of every scale and arpeggio without its notes', () => {
    expect(exercises.length).toBeGreaterThan(1000);
    for (const e of exercises) {
      const { right, left } = scaleNotes(e);
      const midis = [...right, ...left].map((n) => n.midi);
      const span = [Math.min(...midis), Math.max(...midis)];
      expect([exerciseKey(e), scaleKeys(exerciseKey(e))]).toEqual([exerciseKey(e), span]);
      expect(exerciseSpan(e)).toEqual(span);
    }
  });

  it('does not judge a technique exercise, nor what is no exercise', () => {
    expect(scaleKeys('hanon:C:2:both:12')).toBeNull();
    expect(scaleKeys('majorFiveFinger:C:1:both')).toBeNull();
    expect(scaleKeys('major:H:1:right')).toBeNull();
    expect(scaleKeys('nonsense')).toBeNull();
    expect(scaleFits('hanon:C:2:both:12', SMALL)).toBe(true);
  });

  it('marks four octaves of B major beyond every keyboard but the piano’s', () => {
    // B3–B7 with the right hand, B2–B6 with the left.
    expect(scaleKeys('major:B:4:both')).toEqual([47, 107]);
    for (const size of [76, 73, 61, 49] as const)
      expect(fitsKeys([47, 107], KEYBOARDS[size])).toBe(false);
    expect(fitsKeys([47, 107], FULL_KEYS)).toBe(true);
    // Two octaves of it stay on 61 keys (B4–B6, B3–B5) and run over 49.
    expect(scaleFits('major:B:2:both', KEYBOARDS[61])).toBe(true);
    expect(scaleFits('major:B:2:both', KEYBOARDS[49])).toBe(false);
    expect(scaleFits('major:B:1:right', KEYBOARDS[49])).toBe(true);
    expect(scaleFits('major:B:4:both', KEYBOARDS[49])).toBe(false);
  });

  it('skips in the ladder the rungs that run beyond the keyboard, and nothing else', () => {
    const none = new Set<string>();
    const lessons = new Set<string>();
    const on = (keys: KeyRange) => (rung: string) => scaleFits(rung, keys);
    // With 49 keys (C2–C6) two octaves hands together fit in C only: D4–D6 is beyond it.
    const ladder = scaleLadder(false);
    const fitting = ladder.filter(on(KEYBOARDS[49]));
    expect(fitting).toEqual(
      ladder.filter((rung) => !rung.endsWith(':2:both') || rung.includes(':C:')),
    );
    expect(nextRung(none, lessons, on(KEYBOARDS[49]))).toBe('major:C:1:right');
    const played = new Set(['major:C:1:right', 'major:C:1:left', 'major:C:2:both']);
    expect(nextRung(played, lessons)).toBe('major:G:1:right');
    const upToG = new Set([...played, 'major:G:1:right', 'major:G:1:left']);
    expect(nextRung(upToG, lessons)).toBe('major:G:2:both');
    expect(nextRung(upToG, lessons, on(KEYBOARDS[49]))).toBe('major:F:1:right');
    // 61 keys and more have every rung.
    for (const size of [88, 76, 73, 61] as const)
      expect(ladder.every(on(KEYBOARDS[size]))).toBe(true);
    // When no rung is left that fits, there is none.
    expect(nextRung(new Set(fitting), lessons, on(KEYBOARDS[49]))).toBeNull();
  });

  it('does not propose the weakest scale when it runs beyond the keyboard', () => {
    const at = Date.UTC(2026, 9, 2, 12);
    const progress = (exercise: string, recentShare: number): ExerciseProgress => ({
      exercise,
      runs: 5,
      lastAt: at,
      latest: null,
      best: null,
      days: [],
      recentShare,
    });
    const list = [progress('major:G:2:both', 0.4), progress('major:C:1:right', 0.2)];
    expect(weakestLately(list, '2026-10-02', 'UTC')).toBe('major:G:2:both');
    expect(weakestLately(list, '2026-10-02', 'UTC', (e) => scaleFits(e, KEYBOARDS[49]))).toBe(
      'major:C:1:right',
    );
  });
});

describe('Read on a keyboard with fewer keys', () => {
  it('has every card of every level on 49 keys: the levels lie within C2–C6', () => {
    for (const level of LEVELS) {
      expect(notesOnKeys(level.notes, KEYBOARDS[49])).toEqual(level.notes);
      expect(levelOnKeys(level, KEYBOARDS[49])).toBe(level);
    }
  });

  it('draws no card for a note beyond the keyboard', () => {
    // C3–C5: L1 and L2 whole, and of L6 (C2–C6) only what is within.
    expect(levelOnKeys(getLevel('L1'), SMALL)).toBe(getLevel('L1'));
    expect(levelOnKeys(getLevel('L2'), SMALL)).toBe(getLevel('L2'));
    const l6 = levelOnKeys(getLevel('L6'), SMALL);
    expect(l6.notes.length).toBeLessThan(getLevel('L6').notes.length);
    expect(l6.notes.every((note) => hasKey(SMALL, note.midi))).toBe(true);
    expect(l6.id).toBe('L6');
  });

  it('leaves a level with fewer than five notes, which says so, or with none to draw', () => {
    // C5–C7: of L2 (C4–C5) only C5; of L1 (C4–G4) nothing.
    const high = { low: 72, high: 96 };
    expect(notesOnKeys(getLevel('L2').notes, high).map((n) => n.key)).toEqual(['C5@treble']);
    expect(notesOnKeys(getLevel('L1').notes, high)).toEqual([]);
    expect(FEW_NOTES).toBe(5);
    // One note left is drawn again and again, as a session of one note is; none cannot be.
    expect(canDraw(notesOnKeys(getLevel('L2').notes, high))).toBe(true);
    expect(canDraw(notesOnKeys(getLevel('L1').notes, high))).toBe(false);
    expect(canDraw(notesOnKeys(getLevel('L1').notes, SMALL))).toBe(true);
  });
});

describe('an answer asked for beyond the keyboard', () => {
  it('is right in any octave, and only then', () => {
    // E5 is beyond C3–C5: any E answers it. D4 is on it: only D4 does.
    expect(answersKey(76, 76, SMALL)).toBe(true);
    expect(answersKey(64, 76, SMALL)).toBe(true);
    expect(answersKey(52, 76, SMALL)).toBe(true);
    expect(answersKey(65, 76, SMALL)).toBe(false);
    expect(answersKey(62, 62, SMALL)).toBe(true);
    expect(answersKey(50, 62, SMALL)).toBe(false);
    expect(answersKey(64, 76, FULL_KEYS)).toBe(false);
  });

  it('stands for the key asked for, so the answer is recorded as on any keyboard', () => {
    expect(keyAnswered(64, [76], SMALL)).toBe(76);
    expect(keyAnswered(76, [76], SMALL)).toBe(76);
    expect(keyAnswered(65, [76], SMALL)).toBe(65);
    // Of a chord, the key on the keyboard is itself; the same note an octave off is the one beyond.
    expect(keyAnswered(60, [60, 84], SMALL)).toBe(60);
    expect(keyAnswered(48, [60, 84], SMALL)).toBe(84);
    expect(keyAnswered(64, [76], FULL_KEYS)).toBe(64);
    expect(keyAnswered(64, [], SMALL)).toBe(64);
  });

  it('is, on the Ear page, a melody’s next key or an interval’s note to find', () => {
    const state = (family: string, by: string, notes: number[], played: number[]) =>
      ({ family, by, card: { prompt: { notes }, played } }) as unknown as EarSessionState;
    expect(askedKeys(state('echo', 'play', [67, 76, 72], [67]))).toEqual([76]);
    expect(askedKeys(state('tune', 'play', [67, 76, 72], [67, 76, 72]))).toEqual([]);
    expect(askedKeys(state('interval', 'play', [60, 76], []))).toEqual([76]);
    // A chord is right in any octave already; by name nothing is played.
    expect(askedKeys(state('chord', 'play', [60, 64, 67], []))).toEqual([]);
    expect(askedKeys(state('interval', 'name', [60, 76], []))).toEqual([]);
  });
});
