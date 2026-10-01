// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { symbolPitchClasses } from '../../core/chordSymbols.ts';
import { defaultLeftHand, leftHandFromSymbols, leftHandPatterns } from '../../core/leadSheet.ts';
import { parseMusicXml } from '../../core/musicxml.ts';
import { midiName } from '../../core/note.ts';
import { pieceChecksum } from '../../core/pieceRecords.ts';
import { PATTERN_IDS, type PatternId } from '../../core/progressions.ts';
import { TICKS_PER_QUARTER, type Score } from '../../core/score.ts';
import { withLeftHand } from '../derive.ts';
import { BUILT_IN } from './index.ts';

// The left hand from the symbols on the library's lead sheets (docs/HARMONY.md, "Lead sheets
// (H3)"): every pattern each takes, written into its score and read back.

const FILES = import.meta.glob<string>('./*.musicxml', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const Q = TICKS_PER_QUARTER;
const domParse = (s: string) => new DOMParser().parseFromString(s, 'application/xml');
const LEAD_SHEETS = BUILT_IN.filter((p) => p.leadSheet).map((p) => p.id);
const xmlOf = (id: string) => FILES[`./${id}.musicxml`]!;
const written = (id: string) => parseMusicXml(domParse(xmlOf(id)));
const practised = (id: string, pattern: PatternId) => withLeftHand(xmlOf(id), written(id), pattern);

/** A bar's left hand as text: `0:G2 1:B2+D3+G3`, onsets in quarters. */
function leftOf(score: Score, bar: number): string {
  const m = score.measures[bar]!;
  const at = new Map<number, string[]>();
  for (const n of score.notes) {
    if (n.measure !== bar || n.hand !== 'left' || n.tieStop) continue;
    at.set(n.onset, [...(at.get(n.onset) ?? []), midiName(n.midi)]);
  }
  return [...at].map(([onset, keys]) => `${(onset - m.start) / Q}:${keys.join('+')}`).join(' ');
}

const all = LEAD_SHEETS.flatMap((id) =>
  leftHandPatterns(written(id)).map((pattern) => [id, pattern] as const),
);

describe('the patterns a lead sheet takes', () => {
  it('follow its meter: stride in 2/4 and 4/4, the waltz in 3/4 and 6/8', () => {
    const offered = Object.fromEntries(
      LEAD_SHEETS.map((id) => [id, leftHandPatterns(written(id)).join(' ')]),
    );
    const duple = 'block rootFifth alberti arpeggio stride';
    const triple = 'block rootFifth waltz alberti arpeggio';
    expect(offered).toEqual({
      'trad-twinkle-twinkle': duple,
      'trad-frere-jacques': duple,
      'lyte-row-your-boat': triple,
      'trad-amazing-grace': triple,
      'pierpont-jingle-bells': duple,
      'foster-oh-susanna': duple,
      'trad-auld-lang-syne': duple,
      'trad-swing-low': duple,
    });
  });

  it('start from block chords: the bass staff is empty', () => {
    for (const id of LEAD_SHEETS) expect(defaultLeftHand(written(id))).toBe('block');
  });

  it('are none for a piece without chord symbols, whose left hand stays as written', () => {
    const score = parseMusicXml(domParse(xmlOf('beethoven-fur-elise')));
    expect(leftHandPatterns(score)).toEqual([]);
    expect(defaultLeftHand(score)).toBe('written');
  });
});

describe('the left hand from the symbols, written into the score', () => {
  it.each(all)('%s, %s: reads back without a warning, the melody untouched', (id, pattern) => {
    const before = written(id);
    const { xml, score } = practised(id, pattern);
    expect(score.warnings).toEqual([]);
    expect(score.measures).toEqual(before.measures);
    expect(score.harmonies).toEqual(before.harmonies);
    expect(score.notes.filter((n) => n.hand === 'right')).toEqual(before.notes);
    expect(score.notes.every((n) => n.hand === 'right' || n.hand === 'left')).toBe(true);
    // What Verovio draws is what the parser reads: the text is the document.
    const again = parseMusicXml(domParse(xml), { hands: score.hands });
    expect(again).toEqual(score);
  });

  it.each(all)('%s, %s: stays under the melody, from C2 up, within its bars', (id, pattern) => {
    const { score } = practised(id, pattern);
    const left = score.notes.filter((n) => n.hand === 'left');
    const lowestMelody = Math.min(
      ...score.notes.filter((n) => n.hand === 'right').map((n) => n.midi),
    );
    expect(left.length).toBeGreaterThan(0);
    for (const n of left) {
      const m = score.measures[n.measure]!;
      expect(n.midi).toBeLessThan(lowestMelody);
      expect(n.midi).toBeGreaterThanOrEqual(36);
      expect(n.onset).toBeGreaterThanOrEqual(m.start);
      expect(n.onset + n.duration).toBeLessThanOrEqual(m.start + m.duration);
    }
  });

  it.each(all)('%s, %s: plays the tones of the symbols of its bar', (id, pattern) => {
    const { score } = practised(id, pattern);
    let carried = new Set<number>();
    for (const m of score.measures) {
      const here = (score.harmonies ?? []).filter((h) => h.measure === m.index);
      const allowed = new Set([
        ...carried,
        ...here.flatMap((h) => [...symbolPitchClasses(h.symbol!)]),
      ]);
      for (const n of score.notes.filter((x) => x.measure === m.index && x.hand === 'left'))
        expect(allowed.has(n.midi % 12), `${id} ${pattern} bar ${m.number}`).toBe(true);
      const last = here.at(-1);
      if (last) carried = symbolPitchClasses(last.symbol!);
    }
  });

  it.each(all)('%s, %s: writes every note with its value, and fills each bar', (id, pattern) => {
    const doc = domParse(practised(id, pattern).xml);
    const before = written(id);
    const divisions = Number(doc.getElementsByTagName('divisions')[0]!.textContent);
    [...doc.getElementsByTagName('measure')].forEach((measure, index) => {
      const notes = [...measure.getElementsByTagName('note')].filter(
        (n) => n.getElementsByTagName('staff')[0]?.textContent === '2',
      );
      let filled = 0;
      for (const note of notes) {
        const rest = note.getElementsByTagName('rest')[0];
        if (rest?.getAttribute('measure') !== 'yes')
          expect(note.getElementsByTagName('type')).toHaveLength(1);
        if (note.getElementsByTagName('chord').length === 0)
          filled += Number(note.getElementsByTagName('duration')[0]!.textContent);
      }
      expect((filled * Q) / divisions).toBe(before.measures[index]!.duration);
    });
  });

  it('is the same every time, and another piece of notes for each pattern', () => {
    const checksums = Object.fromEntries(
      LEAD_SHEETS.map((id) => [
        id,
        Object.fromEntries(
          leftHandPatterns(written(id)).map((p) => [p, pieceChecksum(practised(id, p).score)]),
        ),
      ]),
    );
    // Records are kept by these: a change here strands the runs practised with the pattern.
    expect(checksums).toEqual(CHECKSUMS);
    const every = Object.values(checksums).flatMap((c) => Object.values(c));
    expect(new Set(every).size).toBe(every.length);
    for (const id of LEAD_SHEETS) expect(every).not.toContain(pieceChecksum(written(id)));
  });
});

describe('what each pattern plays', () => {
  it('Amazing Grace in 3/4: a bar to a chord, and the bar with two', () => {
    const bars = (pattern: PatternId, ...numbers: number[]) => {
      const { score } = practised('trad-amazing-grace', pattern);
      return numbers.map((n) => leftOf(score, n));
    };
    // The upbeat is left to the melody; bar 6 has E minor, then D on the 3.
    expect(bars('block', 0, 1, 6)).toEqual(['', '0:G2+B2+D3', '0:E3+G3+B3 2:D3+F♯3+A3']);
    expect(bars('rootFifth', 1, 6)).toEqual(['0:G2+D3', '0:E2+B2 2:D2+A2']);
    expect(bars('waltz', 1, 6)).toEqual(['0:G2 1:B2+D3+G3 2:B2+D3+G3', '0:E2 1:B2+E3+G3 2:D2']);
    expect(bars('alberti', 1, 6)).toEqual([
      '0:G2 0.5:D3 1:B2 1.5:D3 2:B2 2.5:D3',
      '0:E3 0.5:B3 1:G3 1.5:B3 2:D3 2.5:A3',
    ]);
    expect(bars('arpeggio', 1, 6)).toEqual(['0:G2 1:D3 2:G3', '0:E2 1:B2 2:D2']);
    // The last bar is two beats long: the pattern's beginning.
    expect(bars('waltz', 14)).toEqual(['0:G2 1:B2+D3+G3']);
  });

  it('Row Your Boat in 6/8: the dotted beat in three', () => {
    const bars = (pattern: PatternId, ...numbers: number[]) => {
      const { score } = practised('lyte-row-your-boat', pattern);
      return numbers.map((n) => leftOf(score, n));
    };
    expect(bars('block', 0, 6)).toEqual(['0:D3+F♯3+A3', '0:A2+C♯3+G3']);
    expect(bars('waltz', 0)).toEqual([
      '0:D2 0.5:D3+F♯3+A3 1:D3+F♯3+A3 1.5:A2 2:D3+F♯3+A3 2.5:D3+F♯3+A3',
    ]);
    expect(bars('alberti', 6)).toEqual(['0:A2 0.5:C♯3 1:G3 1.5:A2 2:C♯3 2.5:G3']);
    expect(bars('arpeggio', 0)).toEqual(['0:D2 0.5:A2 1:D3 1.5:F♯3 2:D3 2.5:A2']);
  });

  it('Jingle Bells in 4/4: stride starts over where the chord changes', () => {
    const { score } = practised('pierpont-jingle-bells', 'stride');
    expect(leftOf(score, 0)).toBe('0:G2 1:B2+D3+G3 2:D2 3:B2+D3+G3');
    // A minor, then D7 on the 3.
    expect(leftOf(score, 2)).toBe('0:A2 1:C3+E3+A3 2:D2 3:C3+F♯3+A3');
  });

  it('a symbol between two notes of the pattern is played from the next one', () => {
    // Auld Lang Syne, bar 7: C, and D7 on the last eighth.
    const bar = (pattern: PatternId) => leftOf(practised('trad-auld-lang-syne', pattern).score, 7);
    expect(bar('block')).toBe('0:C3+E3+G3 1.5:D3+F♯3+C4');
    expect(bar('alberti')).toBe('0:C3 0.5:G3 1:E3 1.5:D3');
    // Stride moves in quarters: the D7 would start with the next bar, which has its own symbol.
    expect(bar('stride')).toBe('0:C2 1:C3+E3+G3');
  });

  it('an upbeat inside the piece rests, and a held chord is tied where one note cannot say it', () => {
    const auld = practised('trad-auld-lang-syne', 'block').score;
    // Bar 8 is cut in two by the repeat: its second part is the chorus's upbeat.
    expect([leftOf(auld, 8), leftOf(auld, 9)]).toEqual(['0:G2+B2+D3', '']);
    // Swing Low, bar 2: B♭ for a quarter and a sixteenth, then F.
    const swing = practised('trad-swing-low', 'block').score;
    const bar = swing.notes.filter((n) => n.measure === 1 && n.hand === 'left');
    expect(
      bar.map((n) => [n.onset - swing.measures[1]!.start, n.duration, n.tieStart, n.tieStop]),
    ).toEqual([
      [0, Q, true, false],
      [0, Q, true, false],
      [0, Q, true, false],
      [Q, Q / 4, false, true],
      [Q, Q / 4, false, true],
      [Q, Q / 4, false, true],
      [(5 * Q) / 4, (3 * Q) / 4, false, false],
      [(5 * Q) / 4, (3 * Q) / 4, false, false],
      [(5 * Q) / 4, (3 * Q) / 4, false, false],
    ]);
    expect(
      bar.map((n) => `${n.pitch.step}${n.pitch.alter || ''}${n.pitch.octave}`).slice(0, 3),
    ).toEqual(['B-12', 'D3', 'F3']);
  });

  it('every pattern has its bars for every lead sheet', () => {
    for (const [id, pattern] of all) {
      const bars = leftHandFromSymbols(written(id), pattern);
      expect(bars).toHaveLength(written(id).measures.length);
      expect(PATTERN_IDS).toContain(pattern);
    }
  });
});

const CHECKSUMS: Record<string, Record<string, string>> = {
  'trad-twinkle-twinkle': {
    block: '8bfe243f',
    rootFifth: '55105cd1',
    alberti: '7ecd6837',
    arpeggio: '9653a141',
    stride: '99948af0',
  },
  'trad-frere-jacques': {
    block: '0e0a4f2f',
    rootFifth: '6de6d12c',
    alberti: 'd8b52de2',
    arpeggio: 'dbfd205c',
    stride: 'fffd3afd',
  },
  'lyte-row-your-boat': {
    block: '1c5d5599',
    rootFifth: '58e0a346',
    waltz: 'd5d387eb',
    alberti: 'e9b571d6',
    arpeggio: 'a18a945a',
  },
  'trad-amazing-grace': {
    block: '99e544b2',
    rootFifth: 'bce6851a',
    waltz: '26882500',
    alberti: '553b80d8',
    arpeggio: '0191781f',
  },
  'pierpont-jingle-bells': {
    block: 'dc647587',
    rootFifth: 'd8185177',
    alberti: 'eb8d6dc2',
    arpeggio: 'fdb851c3',
    stride: 'e13e29f5',
  },
  'foster-oh-susanna': {
    block: '392f3dee',
    rootFifth: '563576ad',
    alberti: '8b4d6136',
    arpeggio: '70ad951c',
    stride: 'b326be7c',
  },
  'trad-auld-lang-syne': {
    block: '378abab2',
    rootFifth: '43ffadfb',
    alberti: '3172cec3',
    arpeggio: 'a4e1f02d',
    stride: '4158f14c',
  },
  'trad-swing-low': {
    block: '4a899328',
    rootFifth: '6a0073d3',
    alberti: '1bec04f1',
    arpeggio: '93939f35',
    stride: 'e3ba130c',
  },
};
