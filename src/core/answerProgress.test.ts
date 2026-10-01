import { describe, expect, it } from 'vitest';
import type { FamilyAnswer as Answer } from './answerProgress.ts';
import {
  sampleCadenceAnswer,
  sampleChordSymbolAnswers,
  sampleEchoAnswer,
  sampleRhythmAnswers,
} from '../storage/fixtures.ts';
import {
  ALL_ANSWERS,
  cellCount,
  compareLabels,
  CONFUSION_MIN_ASKED,
  confusionMatrix,
  confusionsOf,
  familyLevelIds,
  familyLevels,
  filterAnswers,
  isFamilyAnswer,
  isFamilyLevel,
  itemFigures,
  keyOfTonic,
  OTHER,
  shareBucket,
  SHARE_EDGES,
  topConfusions,
  weakestItems,
} from './answerProgress.ts';
import { makePrompt } from './earItems.ts';
import type { EarAnswer } from './earSession.ts';
import type { ChordSymbolAnswer } from './harmonySession.ts';
import { SPEED_BUCKETS } from './heatmap.ts';
import { seededRng } from './random.ts';
import type { TheoryAnswer } from './theorySession.ts';

const T = 1_700_000_000_000;
let ids = 0;

function ear(patch: Partial<EarAnswer> & Pick<EarAnswer, 'item' | 'prompt' | 'answer'>): EarAnswer {
  const n = ++ids;
  return {
    id: `e${n}`,
    sessionId: 's1',
    family: 'interval',
    level: 'I4',
    by: 'play',
    correct: false,
    ms: 1500,
    replays: 0,
    at: T + n * 1000,
    ...patch,
  };
}

function theory(
  patch: Partial<TheoryAnswer> &
    Pick<TheoryAnswer, 'family' | 'level' | 'item' | 'prompt' | 'answer'>,
): TheoryAnswer {
  const n = ++ids;
  return {
    id: `t${n}`,
    sessionId: 's2',
    by: 'name',
    correct: false,
    ms: 1800,
    hinted: false,
    at: T + n * 1000,
    ...patch,
  };
}

/** A right answer to an interval played up from C4. */
const rightInterval = (name: string, semitones: number, patch: Partial<EarAnswer> = {}) =>
  ear({
    item: `int:${name}:up`,
    prompt: [60, 60 + semitones],
    answer: [60 + semitones],
    correct: true,
    ...patch,
  });

describe('levels', () => {
  it('lists each family’s levels in order', () => {
    expect(familyLevelIds('interval')).toEqual(['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7']);
    expect(familyLevelIds('echo')[0]).toBe('EC1');
    expect(familyLevelIds('keySignature')).toEqual(['KS1', 'KS2', 'KS3', 'KS4', 'KS5']);
    expect(isFamilyLevel('readChord', 'RC3')).toBe(true);
    expect(isFamilyLevel('readChord', 'C3')).toBe(false);
  });

  it('gives Ear’s mastery over answers without a replay, and Read’s without the hint', () => {
    const earAnswers = Array.from({ length: 40 }, (_, i) =>
      rightInterval('P5', 7, { level: 'I1', item: 'int:P5:up', replays: i === 0 ? 1 : 0 }),
    );
    const [i1, i2] = familyLevels('interval', earAnswers);
    expect(i1).toMatchObject({ level: 'I1', total: 40, counted: 39, window: 40, mastered: false });
    expect(i2).toMatchObject({ level: 'I2', total: 0, counted: 0, accuracy: null });

    const cards = Array.from({ length: 41 }, (_, i) =>
      theory({
        family: 'keySignature',
        level: 'KS1',
        item: 'ks:0:major',
        by: 'play',
        prompt: '0',
        answer: [60],
        correct: true,
        hinted: i === 0,
      }),
    );
    const [ks1] = familyLevels('keySignature', cards);
    expect(ks1).toMatchObject({ total: 41, counted: 40, window: 40, accuracy: 1, mastered: true });
    // Another family's answers are not counted.
    expect(familyLevels('readChord', cards).every((l) => l.total === 0)).toBe(true);
  });
});

describe('item figures', () => {
  it('counts the last 10 answers of each item, in the order of the levels', () => {
    const answers: Answer[] = [
      ...Array.from({ length: 12 }, (_, i) =>
        rightInterval('m6', 8, { correct: i < 4, ms: 1000 + i * 100, replays: i === 11 ? 2 : 0 }),
      ),
      rightInterval('P8', 12),
    ];
    const [p8, m6] = itemFigures('interval', answers);
    expect(p8!.item).toBe('int:P8:up');
    expect(m6).toMatchObject({
      item: 'int:m6:up',
      answers: 12,
      recentCount: 10,
      // Answers 3 to 12: two right (the 3rd and 4th).
      recentCorrect: 2,
      medianMs: 1250,
      aids: 2,
    });
    expect(m6!.weight).toBeGreaterThan(p8!.weight);
  });

  it('counts hinted theory cards as aids, and leaves them out of the median', () => {
    const cards = [1000, 2000, 3000].map((ms, i) =>
      theory({
        family: 'readInterval',
        level: 'RI2',
        item: 'ri:m3:up',
        prompt: ['E4', 'G4'],
        clef: 'treble',
        answer: 'm3',
        correct: true,
        ms,
        hinted: i === 2,
      }),
    );
    expect(itemFigures('readInterval', cards)[0]).toMatchObject({ aids: 1, medianMs: 1500 });
  });

  it('ranks the weakest items with at least three answers', () => {
    const answers: Answer[] = [
      // Always right and quick.
      ...Array.from({ length: 5 }, () => rightInterval('P8', 12, { ms: 800 })),
      // Right but slow.
      ...Array.from({ length: 5 }, () => rightInterval('P5', 7, { ms: 3000 })),
      // Often wrong.
      ...Array.from({ length: 5 }, (_, i) => rightInterval('M3', 4, { correct: i % 2 === 0 })),
      // Wrong, but only twice: not ranked yet.
      ...Array.from({ length: 2 }, () => rightInterval('m2', 1, { correct: false })),
    ];
    const weakest = weakestItems(itemFigures('interval', answers));
    expect(weakest.map((i) => i.item)).toEqual(['int:M3:up', 'int:P5:up', 'int:P8:up']);
    expect(weakestItems(itemFigures('interval', answers), 1)).toHaveLength(1);
  });
});

describe('what was answered', () => {
  it('reads an interval named, or played from the key shown in the direction asked', () => {
    expect(
      confusionsOf(ear({ item: 'int:m6:up', prompt: [60, 68], answer: 'P5', by: 'name' })),
    ).toEqual([{ asked: 'm6', answered: 'P5' }]);
    // Played: G4 above C4 is a perfect 5th.
    expect(confusionsOf(ear({ item: 'int:m6:up', prompt: [60, 68], answer: [67] }))).toEqual([
      { asked: 'm6', answered: 'P5' },
    ]);
    // Down from C5: played F4 is a perfect 5th down.
    expect(confusionsOf(ear({ item: 'int:m6:down', prompt: [72, 64], answer: [65] }))).toEqual([
      { asked: 'm6', answered: 'P5' },
    ]);
    // Together: the lower note is shown; a key below it makes no interval up.
    expect(confusionsOf(ear({ item: 'int:M3:harm', prompt: [60, 64], answer: [59] }))).toEqual([
      { asked: 'M3', answered: OTHER },
    ]);
    // An augmented 11th has no name here.
    expect(confusionsOf(ear({ item: 'int:P12:up', prompt: [48, 67], answer: [66] }))).toEqual([
      { asked: 'P12', answered: OTHER },
    ]);
    // Right: on the diagonal.
    expect(confusionsOf(rightInterval('M3', 4))).toEqual([{ asked: 'M3', answered: 'M3' }]);
  });

  it('reads a chord named, or the chord the keys held make on the root asked', () => {
    const chord = (patch: Partial<EarAnswer> & Pick<EarAnswer, 'item' | 'prompt' | 'answer'>) =>
      confusionsOf(ear({ family: 'chord', level: 'C1', ...patch }));
    expect(
      chord({ item: 'chord:maj:root', prompt: [60, 64, 67], answer: 'min:root', by: 'name' }),
    ).toEqual([{ asked: 'maj:root', answered: 'min:root' }]);
    // C and E♭ over the root C: a minor triad.
    expect(chord({ item: 'chord:maj:root', prompt: [60, 64, 67], answer: [60, 63] })).toEqual([
      { asked: 'maj:root', answered: 'min:root' },
    ]);
    // C2: E♭ fits minor and diminished; minor shares more with the major asked.
    expect(
      chord({ level: 'C2', item: 'chord:maj:root', prompt: [60, 64, 67], answer: [60, 63] }),
    ).toEqual([{ asked: 'maj:root', answered: 'min:root' }]);
    // G♯ over C and E: augmented in C2, nothing of C1.
    expect(
      chord({ level: 'C2', item: 'chord:maj:root', prompt: [60, 64, 67], answer: [60, 64, 68] }),
    ).toEqual([{ asked: 'maj:root', answered: 'aug:root' }]);
    expect(chord({ item: 'chord:maj:root', prompt: [60, 64, 67], answer: [60, 64, 70] })).toEqual([
      { asked: 'maj:root', answered: OTHER },
    ]);
    // C3: the right notes over the wrong bass are another position of the chord.
    expect(
      chord({ level: 'C3', item: 'chord:maj:root', prompt: [60, 64, 67], answer: [64, 67, 72] }),
    ).toEqual([{ asked: 'maj:root', answered: 'maj:1st' }]);
    // C3, first inversion asked (E G C): the root is found under the voicing.
    expect(
      chord({ level: 'C3', item: 'chord:maj:1st', prompt: [64, 67, 72], answer: [63, 67] }),
    ).toEqual([{ asked: 'maj:1st', answered: 'min:1st' }]);
  });

  it('reads a melody by every step reached, the step into the wrong note as played', () => {
    const melody = [60, 62, 64, 65, 67];
    expect(
      confusionsOf(
        ear({
          family: 'echo',
          level: 'EC3',
          item: 'echo:EC3',
          prompt: melody,
          answer: [60, 62, 64, 67],
        }),
      ),
    ).toEqual([
      { asked: '+2', answered: '+2' },
      { asked: '+2', answered: '+2' },
      // Up a 2nd (E–F) played as up a 3rd (E–G).
      { asked: '+1', answered: '+3' },
    ]);
    expect(
      confusionsOf(
        ear({
          family: 'echo',
          level: 'EC3',
          item: 'echo:EC3',
          prompt: melody,
          answer: melody,
          correct: true,
        }),
      ),
    ).toHaveLength(4);
    // The same key again, or a wrong first note (no step into it).
    expect(
      confusionsOf(
        ear({ family: 'echo', level: 'EC3', item: 'echo:EC3', prompt: melody, answer: [60, 60] }),
      ),
    ).toEqual([{ asked: '+2', answered: OTHER }]);
    expect(
      confusionsOf(
        ear({ family: 'echo', level: 'EC3', item: 'echo:EC3', prompt: melody, answer: [61] }),
      ),
    ).toEqual([]);
    // Keys that cannot be an answer to the melody are left out.
    expect(
      confusionsOf(
        ear({ family: 'echo', level: 'EC3', item: 'echo:EC3', prompt: melody, answer: [61, 62] }),
      ),
    ).toEqual([]);
  });

  it('reads a written interval by quality and number, RI1 by its number', () => {
    const interval = (level: 'RI1' | 'RI3', answer: string, correct = false) =>
      confusionsOf(
        theory({
          family: 'readInterval',
          level,
          item: 'ri:m3:up',
          prompt: ['E4', 'G4'],
          clef: 'treble',
          answer,
          correct,
        }),
      );
    expect(interval('RI3', 'M3')).toEqual([{ asked: 'm3', answered: 'M3' }]);
    expect(interval('RI1', '4')).toEqual([{ asked: '3', answered: '4' }]);
    expect(interval('RI1', '3', true)).toEqual([{ asked: '3', answered: '3' }]);
    expect(interval('RI3', 'x9')).toEqual([{ asked: 'm3', answered: OTHER }]);
  });

  it('reads a tonic played as the key whose tonic it is, in the mode asked', () => {
    const key = (item: string, midi: number) =>
      confusionsOf(
        theory({
          family: 'keySignature',
          level: 'KS5',
          item,
          by: 'play',
          prompt: item.split(':')[1]!,
          answer: [midi],
        }),
      );
    // B♭ major asked, F played: F major.
    expect(key('ks:2f:major', 65)).toEqual([{ asked: '2f:major', answered: '1f:major' }]);
    // E minor asked, G played: G minor.
    expect(key('ks:1s:minor', 55)).toEqual([{ asked: '1s:minor', answered: '2f:minor' }]);
    // C♯ played: D♭ major (five flats), not C♯ major (seven sharps).
    expect(key('ks:0:major', 61)).toEqual([{ asked: '0:major', answered: '5f:major' }]);
  });

  it('breaks the F♯/G♭ tie on the side asked', () => {
    expect(keyOfTonic(66, 'major', 3)).toBe(6);
    expect(keyOfTonic(66, 'major', -3)).toBe(-6);
    expect(keyOfTonic(66, 'major', 0)).toBe(6);
    // D♯ or E♭ minor.
    expect(keyOfTonic(63, 'minor', -1)).toBe(-6);
    expect(keyOfTonic(60, 'major', -4)).toBe(0);
  });

  it('reads a written chord named, or the chord the keys make on its written root', () => {
    const chord = (patch: Partial<TheoryAnswer> & Pick<TheoryAnswer, 'answer'>) =>
      confusionsOf(
        theory({
          family: 'readChord',
          level: 'RC3',
          item: 'rc:min:1st',
          prompt: ['A3', 'C#4', 'F#4'],
          clef: 'bass',
          ...patch,
        }),
      );
    expect(chord({ answer: 'F#:maj:1st' })).toEqual([{ asked: 'min:1st', answered: 'maj:1st' }]);
    // The right chord on the wrong root is not a right answer.
    expect(chord({ answer: 'Gb:min:1st' })).toEqual([{ asked: 'min:1st', answered: OTHER }]);
    // A♯ over the root F♯: major, its third in the bass.
    expect(chord({ by: 'play', answer: [58, 61] })).toEqual([
      { asked: 'min:1st', answered: 'maj:1st' },
    ]);
    // The written notes, one an octave off, with the same bass: other.
    expect(chord({ by: 'play', answer: [57, 61, 78] })).toEqual([
      { asked: 'min:1st', answered: OTHER },
    ]);
    // The same notes in root position: the position read wrong.
    expect(chord({ by: 'play', answer: [54, 57, 61] })).toEqual([
      { asked: 'min:1st', answered: 'min:root' },
    ]);
  });

  it('reads nothing from an item it does not know', () => {
    expect(confusionsOf(ear({ item: 'int:X:up', prompt: [60, 64], answer: [64] }))).toEqual([]);
    expect(
      confusionsOf(
        theory({
          family: 'readInterval',
          level: 'KS1',
          item: 'ri:m3:up',
          prompt: ['E4', 'G4'],
          answer: 'm3',
        }),
      ),
    ).toEqual([]);
  });
});

describe('the confusion table', () => {
  const answers: Answer[] = [
    ...Array.from({ length: 8 }, () => rightInterval('m6', 8)),
    ...Array.from({ length: 4 }, () =>
      ear({ item: 'int:m6:up', prompt: [60, 68], answer: 'P5', by: 'name' }),
    ),
    ...Array.from({ length: 3 }, () => rightInterval('P5', 7)),
    ear({ item: 'int:P5:up', prompt: [60, 67], answer: [80] }),
    ear({ item: 'int:m2:up', prompt: [60, 61], answer: 'M2', by: 'name' }),
  ];

  it('counts what was asked against what was answered, in order of size', () => {
    const matrix = confusionMatrix('interval', answers);
    expect(matrix.rows).toEqual(['m2', 'P5', 'm6']);
    expect(matrix.columns).toEqual(['m2', 'M2', 'P5', 'm6', OTHER]);
    expect(cellCount(matrix, 'm6', 'P5')).toBe(4);
    expect(cellCount(matrix, 'm6', 'm6')).toBe(8);
    expect(cellCount(matrix, 'P5', OTHER)).toBe(1);
    expect(cellCount(matrix, 'P5', 'm6')).toBe(0);
    expect(matrix.totals.get('m6')).toBe(12);
  });

  it('lists the confusions, the most frequent first', () => {
    const top = topConfusions('interval', confusionMatrix('interval', answers));
    expect(top).toEqual([
      { asked: 'm6', answered: 'P5', count: 4, total: 12 },
      // Once each: the larger share first.
      { asked: 'm2', answered: 'M2', count: 1, total: 1 },
      { asked: 'P5', answered: OTHER, count: 1, total: 4 },
    ]);
  });

  it('filters by level and by how it was answered', () => {
    const named = filterAnswers(answers, { level: 'all', by: 'name' });
    expect(confusionMatrix('interval', named).rows).toEqual(['m2', 'm6']);
    expect(filterAnswers(answers, { level: 'I1', by: 'all' })).toEqual([]);
    expect(filterAnswers(answers, ALL_ANSWERS)).toHaveLength(answers.length);
  });

  it('keeps every right answer on the diagonal, and only them', () => {
    const rng = seededRng(3);
    const mixed: Answer[] = [];
    for (let i = 0; i < 200; i++) {
      const item = ['chord:maj:root', 'chord:min:root', 'chord:dim:root', 'chord:aug:root'][i % 4]!;
      const prompt = makePrompt(item, rng).notes;
      const correct = rng() < 0.5;
      const keys = correct ? [...prompt] : [prompt[0]!, prompt[0]! + 1 + Math.floor(rng() * 10)];
      mixed.push(
        ear({ family: 'chord', level: 'C2', item, prompt: [...prompt], answer: keys, correct }),
      );
    }
    for (const answer of mixed) {
      for (const { asked, answered } of confusionsOf(answer)) {
        expect(answered === asked).toBe(answer.correct);
      }
    }
  });

  it('orders keys round the circle of fifths, majors first, and melodic steps from down to up', () => {
    const keys = ['1s:minor', '2f:major', '0:major', '3s:major'];
    expect([...keys].sort((a, b) => compareLabels('keySignature', a, b))).toEqual([
      '2f:major',
      '0:major',
      '3s:major',
      '1s:minor',
    ]);
    const steps = ['+3', OTHER, '-2', '+1', '-12'];
    expect([...steps].sort((a, b) => compareLabels('echo', a, b))).toEqual([
      '-12',
      '-2',
      '+1',
      '+3',
      OTHER,
    ]);
    const written = ['M3', '3', 'A2', 'd3', 'P8'];
    expect([...written].sort((a, b) => compareLabels('readInterval', a, b))).toEqual([
      'A2',
      '3',
      'd3',
      'M3',
      'P8',
    ]);
  });

  it('colours a cell by its share of the row, in as many buckets as the note heatmap', () => {
    expect(SHARE_EDGES.length + 1).toBe(SPEED_BUCKETS);
    expect(shareBucket(0)).toBe(0);
    expect(shareBucket(0.05)).toBe(1);
    expect(shareBucket(1 / 3)).toBe(4);
    expect(shareBucket(1)).toBe(6);
    expect(CONFUSION_MIN_ASKED).toBeGreaterThanOrEqual(3);
  });
});

describe('which answers the families are made of', () => {
  it('leaves out rhythm answers, which have figures of their own, and keeps chord symbols', () => {
    const echo = sampleEchoAnswer(0);
    const rhythm = sampleRhythmAnswers(0);
    const symbols = sampleChordSymbolAnswers(0);
    expect([echo, ...rhythm, ...symbols].filter(isFamilyAnswer)).toEqual([echo, ...symbols]);
  });
});

describe('chord symbols', () => {
  function symbolAnswer(
    item: string,
    answer: number[],
    patch: Partial<ChordSymbolAnswer> = {},
  ): ChordSymbolAnswer {
    const n = ++ids;
    return {
      id: `h${n}`,
      sessionId: 's3',
      family: 'chordSymbol',
      level: 'H3',
      item,
      by: 'play',
      prompt: item.slice(4),
      answer,
      correct: false,
      ms: 2200,
      hinted: false,
      at: T + n * 1000,
      ...patch,
    };
  }

  it('has Harmony’s levels and its mastery', () => {
    expect(familyLevelIds('chordSymbol')).toEqual(['H1', 'H2', 'H3', 'H4', 'H5']);
    expect(isFamilyLevel('chordSymbol', 'H4')).toBe(true);
    expect(isFamilyLevel('chordSymbol', 'RC4')).toBe(false);
    const answers = Array.from({ length: 40 }, () =>
      symbolAnswer('sym:Dm7', [62, 65, 69, 72], { correct: true }),
    );
    const h3 = familyLevels('chordSymbol', answers).find((l) => l.level === 'H3')!;
    expect(h3).toMatchObject({ total: 40, counted: 40, window: 40, accuracy: 1, mastered: true });
  });

  it('reads the keys held as a symbol on the root asked', () => {
    // Dm7 asked; D F♯ held: D7 shares most with it.
    expect(confusionsOf(symbolAnswer('sym:Dm7', [62, 66]))).toEqual([
      { asked: 'Dm7', answered: 'D7' },
    ]);
    // C asked; C E♭ held: a minor triad on C.
    expect(confusionsOf(symbolAnswer('sym:C', [60, 63], { level: 'H2' }))).toEqual([
      { asked: 'C', answered: 'Cm' },
    ]);
    // B♭maj7 asked; B♭ D F A♭ held.
    expect(confusionsOf(symbolAnswer('sym:B♭maj7', [58, 62, 65, 68]))).toEqual([
      { asked: 'B♭maj7', answered: 'B♭7' },
    ]);
    // Nothing on the root holds a minor 2nd and a major 3rd.
    expect(confusionsOf(symbolAnswer('sym:C7', [60, 61, 64]))).toEqual([
      { asked: 'C7', answered: OTHER },
    ]);
    expect(confusionsOf(symbolAnswer('sym:C7', [60, 64, 67, 70], { correct: true }))).toEqual([
      { asked: 'C7', answered: 'C7' },
    ]);
  });

  it('reads a slash chord with the lowest key as its bass', () => {
    // C/E asked; G B♭ over E: C7 over E.
    expect(confusionsOf(symbolAnswer('sym:C/E', [52, 67, 70], { level: 'H4' }))).toEqual([
      { asked: 'C/E', answered: 'C7/E' },
    ]);
    // Am/G asked; A C F♯ over G: Am6 shares most with Am (A°7 holds them too).
    expect(confusionsOf(symbolAnswer('sym:Am/G', [55, 57, 60, 66], { level: 'H4' }))).toEqual([
      { asked: 'Am/G', answered: 'Am6/G' },
    ]);
    // A C F over G: no chord on A holds C and F.
    expect(confusionsOf(symbolAnswer('sym:Am/G', [55, 57, 60, 65], { level: 'H4' }))).toEqual([
      { asked: 'Am/G', answered: OTHER },
    ]);
    // Am/G asked; A C E♭ with A lowest: a diminished triad on A, no bass named.
    expect(confusionsOf(symbolAnswer('sym:Am/G', [57, 60, 63], { level: 'H4' }))).toEqual([
      { asked: 'Am/G', answered: 'A°' },
    ]);
  });

  it('orders the symbols by root, then chord, then bass', () => {
    const labels = ['D7', 'C/E', 'Cm', 'C', 'B♭', OTHER, 'C/G', 'D♭'];
    expect([...labels].sort((a, b) => compareLabels('chordSymbol', a, b))).toEqual([
      'C',
      'C/E',
      'C/G',
      'Cm',
      'D♭',
      'D7',
      'B♭',
      OTHER,
    ]);
  });

  it('keeps the items in the order of the levels, and counts a hinted card as an aid', () => {
    const answers = [
      symbolAnswer('sym:Dm7', [62, 65, 69, 72], { correct: true }),
      symbolAnswer('sym:C7', [60, 64, 67, 70], { correct: true, hinted: true }),
    ];
    const items = itemFigures('chordSymbol', answers);
    expect(items.map((i) => i.item)).toEqual(['sym:C7', 'sym:Dm7']);
    expect(items[0]).toMatchObject({ aids: 1, medianMs: null });
    expect(items[1]).toMatchObject({ aids: 0, medianMs: 2200 });
  });
});

describe('cadences', () => {
  const cadences = Array.from({ length: 6 }, (_, i) => sampleCadenceAnswer(i));

  it('has the Cadences levels, mastered over 20', () => {
    expect(familyLevelIds('cadence')).toEqual(['CA1', 'CA2', 'CA3', 'CA4']);
    const ca3 = familyLevels('cadence', cadences).find((l) => l.level === 'CA3');
    // Two of the six were replayed.
    expect(ca3).toMatchObject({ total: 6, counted: 4, window: 20, mastered: false });
  });

  it('reads the cadence named against the one asked, in the order of the levels', () => {
    expect(confusionsOf(cadences[0]!)).toEqual([{ asked: 'deceptive', answered: 'deceptive' }]);
    expect(confusionsOf(cadences[1]!)).toEqual([{ asked: 'deceptive', answered: 'authentic' }]);
    const matrix = confusionMatrix('cadence', cadences);
    expect(matrix.rows).toEqual(['deceptive']);
    expect(matrix.columns).toEqual(['authentic', 'deceptive']);
    expect(cellCount(matrix, 'deceptive', 'authentic')).toBe(3);
    expect(compareLabels('cadence', 'half', 'plagal')).toBeGreaterThan(0);
  });
});
