// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  defaultLeftHand,
  leftHandFor,
  leftHandFromSymbols,
  leftHandPatterns,
  meterOf,
  meterPatterns,
} from './leadSheet.ts';
import { leftHandStaff, noteValues, writeLeftHand } from './leadSheetXml.ts';
import { parseMusicXml } from './musicxml.ts';
import { midiName } from './note.ts';
import type { PatternId } from './progressions.ts';
import { TICKS_PER_QUARTER, type Score } from './score.ts';

const Q = TICKS_PER_QUARTER;
const domParse = (s: string) => new DOMParser().parseFromString(s, 'application/xml');

interface Options {
  time?: string;
  divisions?: number;
  staves?: number;
  fifths?: number;
}

/** One piano part; `measures` are the inner XML of each `<measure>`. */
function sheet(
  measures: string[],
  { time = '4/4', divisions = 2, staves = 2, fifths = 0 }: Options = {},
) {
  const [beats, beatType] = time.split('/');
  const attributes =
    `<attributes><divisions>${divisions}</divisions><key><fifths>${fifths}</fifths></key>` +
    `<time><beats>${beats}</beats><beat-type>${beatType}</beat-type></time>` +
    (staves > 1 ? `<staves>${staves}</staves>` : '') +
    '<clef number="1"><sign>G</sign><line>2</line></clef>' +
    (staves > 1 ? '<clef number="2"><sign>F</sign><line>4</line></clef>' : '') +
    '</attributes>';
  const body = measures
    .map((m, i) => `<measure number="${i + 1}">${i === 0 ? attributes : ''}${m}</measure>`)
    .join('');
  return `<?xml version="1.0"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">${body}</part></score-partwise>`;
}

/** `C`, `F#`, `Bb` with a MusicXML kind, and a bass after a slash: `C:major/E`. */
function symbol(text: string, offset = 0): string {
  const [, step, sign, kind = 'major', bassStep, bassSign] =
    /^([A-G])([#b]?)(?::([a-z0-9-]+))?(?:\/([A-G])([#b]?))?$/.exec(text)!;
  const alter = (s: string | undefined, name: string) =>
    s ? `<${name}-alter>${s === '#' ? 1 : -1}</${name}-alter>` : '';
  return (
    `<harmony><root><root-step>${step}</root-step>${alter(sign, 'root')}</root><kind>${kind}</kind>` +
    (bassStep ? `<bass><bass-step>${bassStep}</bass-step>${alter(bassSign, 'bass')}</bass>` : '') +
    (offset ? `<offset>${offset}</offset>` : '') +
    '<staff>1</staff></harmony>'
  );
}

/** A right-hand note of `duration` divisions; `C5`, `F#4`, `Bb3`. */
function note(pitch: string, duration: number, staff = 1): string {
  const [, step, sign, octave] = /^([A-G])([#b]?)(\d)$/.exec(pitch)!;
  const alter = sign ? `<alter>${sign === '#' ? 1 : -1}</alter>` : '';
  return `<note><pitch><step>${step}</step>${alter}<octave>${octave}</octave></pitch><duration>${duration}</duration><voice>${staff}</voice><staff>${staff}</staff></note>`;
}

const backup = (duration: number) => `<backup><duration>${duration}</duration></backup>`;

/** The written score, and the score with the pattern's left hand written in. */
function practise(xml: string, pattern: PatternId) {
  const before = parseMusicXml(domParse(xml));
  const doc = domParse(xml);
  const hands = writeLeftHand(doc, before, pattern);
  return { before, doc, hands, score: parseMusicXml(doc, { hands }) };
}

/** A bar's left hand: `0:G2 1:B2+D3+G3`, onsets in quarters. */
function leftOf(score: Score, bar: number): string {
  const m = score.measures[bar]!;
  const at = new Map<number, string[]>();
  for (const n of score.notes) {
    if (n.measure !== bar || n.hand !== 'left' || n.tieStop) continue;
    at.set(n.onset, [...(at.get(n.onset) ?? []), midiName(n.midi)]);
  }
  return [...at].map(([onset, keys]) => `${(onset - m.start) / Q}:${keys.join('+')}`).join(' ');
}

const left = (xml: string, pattern: PatternId, bar = 0) =>
  leftOf(practise(xml, pattern).score, bar);

describe('meters', () => {
  it('counts two, three and four beats, and dotted beats in a compound meter', () => {
    const meter = (beats: number, beatType: number) => meterOf({ beats, beatType });
    expect(meter(2, 4)).toEqual({ kind: 'simple', beats: 2, beat: Q, bar: 2 * Q });
    expect(meter(3, 4)).toMatchObject({ kind: 'simple', beats: 3, beat: Q });
    expect(meter(4, 4)).toMatchObject({ kind: 'simple', beats: 4, beat: Q });
    expect(meter(2, 2)).toMatchObject({ kind: 'simple', beats: 2, beat: 2 * Q });
    expect(meter(3, 8)).toMatchObject({ kind: 'simple', beats: 3, beat: Q / 2 });
    expect(meter(6, 8)).toEqual({ kind: 'compound', beats: 2, beat: (3 * Q) / 2, bar: 3 * Q });
    expect(meter(9, 8)).toMatchObject({ kind: 'compound', beats: 3 });
    expect(meter(12, 8)).toMatchObject({ kind: 'compound', beats: 4 });
    expect(meter(5, 4)).toMatchObject({ kind: 'other', beats: 5, beat: Q });
    expect(meter(7, 8)).toMatchObject({ kind: 'other' });
    expect(meter(6, 4)).toMatchObject({ kind: 'other' });
  });

  it('offers the patterns that fit', () => {
    const offered = (beats: number, beatType: number) =>
      meterPatterns(meterOf({ beats, beatType })).join(' ');
    expect(offered(4, 4)).toBe('block rootFifth alberti arpeggio stride');
    expect(offered(2, 4)).toBe('block rootFifth alberti arpeggio stride');
    expect(offered(3, 4)).toBe('block rootFifth waltz alberti arpeggio');
    expect(offered(6, 8)).toBe('block rootFifth waltz alberti arpeggio');
    expect(offered(5, 4)).toBe('block rootFifth');
  });

  it('offers a score what every one of its bars takes', () => {
    const change = '<attributes><time><beats>3</beats><beat-type>4</beat-type></time></attributes>';
    const mixed = parseMusicXml(
      domParse(sheet([symbol('C') + note('C5', 8), change + note('C5', 6)])),
    );
    expect(leftHandPatterns(mixed)).toEqual(['block', 'rootFifth', 'alberti', 'arpeggio']);
    const five = parseMusicXml(domParse(sheet([symbol('C') + note('C5', 10)], { time: '5/4' })));
    expect(leftHandPatterns(five)).toEqual(['block', 'rootFifth']);
    const none = parseMusicXml(domParse(sheet([note('C5', 8)])));
    expect(leftHandPatterns(none)).toEqual([]);
  });

  it('chooses block chords for an empty left hand, the written one otherwise', () => {
    const empty = parseMusicXml(domParse(sheet([symbol('C') + note('C5', 8)])));
    const full = parseMusicXml(
      domParse(sheet([symbol('C') + note('C5', 8) + backup(8) + note('C3', 8, 2)])),
    );
    expect(defaultLeftHand(empty)).toBe('block');
    expect(defaultLeftHand(full)).toBe('written');
    expect(leftHandFor(empty, undefined)).toBe('block');
    expect(leftHandFor(empty, 'written')).toBe('written');
    expect(leftHandFor(empty, 'stride')).toBe('stride');
    // The waltz does not fit 4/4: the piece's own choice stands in.
    expect(leftHandFor(empty, 'waltz')).toBe('block');
    expect(leftHandFor(full, 'waltz')).toBe('written');
    expect(leftHandFor(full, 'alberti')).toBe('alberti');
  });
});

describe('the patterns', () => {
  const bar = (symbols: string, time = '4/4', length = 8) =>
    sheet([symbols + note('C6', length)], { time });

  it('in 4/4 are those of the progressions', () => {
    const c = bar(symbol('C'));
    expect(left(c, 'block')).toBe('0:C3+E3+G3');
    expect(left(c, 'rootFifth')).toBe('0:C2+G2');
    expect(left(c, 'alberti')).toBe('0:C3 0.5:G3 1:E3 1.5:G3 2:C3 2.5:G3 3:E3 3.5:G3');
    expect(left(c, 'arpeggio')).toBe('0:C2 1:G2 2:C3 3:E3');
    expect(left(c, 'stride')).toBe('0:C2 1:C3+E3+G3 2:G2 3:C3+E3+G3');
    // A seventh chord: root, third and seventh; the arpeggio 1–5–7–10; the off-beats without the root.
    const g7 = bar(symbol('G:dominant'));
    expect(left(g7, 'block')).toBe('0:G2+B2+F3');
    expect(left(g7, 'arpeggio')).toBe('0:G2 1:D3 2:F3 3:B3');
    expect(left(g7, 'stride')).toBe('0:G2 1:D3+F3+B3 2:D2 3:D3+F3+B3');
  });

  it('in 2/4 run by the half beat, or by the beat', () => {
    const c = bar(symbol('C'), '2/4', 4);
    expect(left(c, 'alberti')).toBe('0:C3 0.5:G3 1:E3 1.5:G3');
    expect(left(c, 'arpeggio')).toBe('0:C2 0.5:G2 1:C3 1.5:E3');
    expect(left(c, 'stride')).toBe('0:C2 1:C3+E3+G3');
  });

  it('in 3/4: the waltz, Alberti with its last beat on middle and high, the arpeggio to the octave', () => {
    const c = bar(symbol('C'), '3/4', 6);
    expect(left(c, 'waltz')).toBe('0:C2 1:C3+E3+G3 2:C3+E3+G3');
    expect(left(c, 'alberti')).toBe('0:C3 0.5:G3 1:E3 1.5:G3 2:E3 2.5:G3');
    expect(left(c, 'arpeggio')).toBe('0:C2 1:G2 2:C3');
  });

  it('in 6/8 run in eighths: bass, chord, chord; low, middle, high; up and down', () => {
    const c = bar(symbol('C'), '6/8', 6);
    expect(left(c, 'waltz')).toBe('0:C2 0.5:C3+E3+G3 1:C3+E3+G3 1.5:G2 2:C3+E3+G3 2.5:C3+E3+G3');
    expect(left(c, 'alberti')).toBe('0:C3 0.5:E3 1:G3 1.5:C3 2:E3 2.5:G3');
    expect(left(c, 'arpeggio')).toBe('0:C2 0.5:G2 1:C3 1.5:E3 2:C3 2.5:G2');
    expect(left(c, 'block')).toBe('0:C3+E3+G3');
  });

  it('start over where the chord changes, and go on where the same symbol stands again', () => {
    const two = bar(symbol('C') + symbol('G', 4));
    expect(left(two, 'stride')).toBe('0:C2 1:C3+E3+G3 2:G2 3:B2+D3+G3');
    expect(left(two, 'arpeggio')).toBe('0:C2 1:G2 2:G2 3:D3');
    expect(left(two, 'block')).toBe('0:C3+E3+G3 2:G2+B2+D3');
    const same = bar(symbol('C') + symbol('C', 4));
    expect(left(same, 'stride')).toBe('0:C2 1:C3+E3+G3 2:G2 3:C3+E3+G3');
    expect(left(same, 'block')).toBe('0:C3+E3+G3');
  });

  it('carry a symbol through the bars that follow, struck again in each', () => {
    const xml = sheet([symbol('F') + note('C6', 8), note('C6', 8), symbol('C') + note('C6', 8)]);
    const { score } = practise(xml, 'block');
    expect([0, 1, 2].map((n) => leftOf(score, n))).toEqual([
      '0:F2+A2+C3',
      '0:F2+A2+C3',
      '0:C3+E3+G3',
    ]);
  });

  it('rest before the first symbol, in an upbeat, and under a symbol with no chord', () => {
    const upbeat =
      '<measure number="0" implicit="yes"><attributes><divisions>2</divisions><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves></attributes>' +
      `${note('G5', 2)}</measure>`;
    const xml = sheet([symbol('C') + note('C6', 8), symbol('C:none') + note('C6', 8)]).replace(
      '<measure number="1">',
      `${upbeat}<measure number="1">`,
    );
    const { score } = practise(xml, 'stride');
    expect([0, 1, 2].map((n) => leftOf(score, n))).toEqual([
      '',
      '0:C2 1:C3+E3+G3 2:G2 3:C3+E3+G3',
      '',
    ]);
    // A power chord has no third to play: the left hand rests there too.
    expect(left(bar(symbol('C:power')), 'block')).toBe('');
  });

  it('read a ninth as its seventh chord', () => {
    expect(left(bar(symbol('G:dominant-ninth')), 'block')).toBe('0:G2+B2+F3');
    expect(left(bar(symbol('D:minor-11th')), 'block')).toBe('0:D3+F3+C4');
  });

  it('put a slash chord’s bass at the bottom', () => {
    const c = bar(symbol('C/E'));
    expect(left(c, 'block')).toBe('0:E3+G3+C4');
    expect(left(c, 'rootFifth')).toBe('0:E2+C3');
    expect(left(c, 'alberti')).toBe('0:E3 0.5:C4 1:G3 1.5:C4 2:E3 2.5:C4 3:G3 3.5:C4');
    expect(left(c, 'arpeggio')).toBe('0:E2 1:G2 2:C3 3:E3');
    expect(left(c, 'stride')).toBe('0:E2 1:C3+E3+G3 2:G2 3:C3+E3+G3');
    // A bass outside the chord.
    expect(left(bar(symbol('A:minor/G')), 'block')).toBe('0:G2+A2+C3+E3');
  });

  it('spell their tones from the symbol', () => {
    const xml = bar(symbol('Eb:minor'));
    const pitches = practise(xml, 'block').score.notes.filter((n) => n.hand === 'left');
    expect(pitches.map((n) => `${n.pitch.step}${n.pitch.alter}`)).toEqual(['E-1', 'G-1', 'B-1']);
  });
});

describe('under the melody', () => {
  const under = (melody: string, pattern: PatternId, chord = 'C') =>
    left(sheet([symbol(chord) + note(melody, 8)]), pattern);

  it('the chord goes an octave down where it would reach the melody', () => {
    expect(under('C5', 'block')).toBe('0:C3+E3+G3');
    expect(under('G3', 'block')).toBe('0:C2+E2+G2');
    expect(under('C3', 'block')).toBe('0:C2+E2+G2');
  });

  it('or leaves out the keys that would, down to none', () => {
    expect(under('G2', 'block')).toBe('0:C2+E2');
    expect(under('E2', 'block')).toBe('0:C2');
    expect(under('C2', 'block')).toBe('');
    // The arpeggio's tenth takes the highest chord tone under the melody.
    expect(under('C3', 'arpeggio')).toBe('0:C2 1:G2 2:G2 3:G2');
    // The stride keeps its bass; a chord that has no place under the melody is left out.
    expect(under('C3', 'stride')).toBe('0:C2 2:G2');
  });

  it('holds for every pattern whatever the melody', () => {
    for (const melody of ['C6', 'C4', 'A3', 'E3', 'C3', 'G2'])
      for (const chord of ['C', 'F#:dominant', 'Bb:minor-seventh', 'E:major/G#'])
        for (const pattern of ['block', 'rootFifth', 'alberti', 'arpeggio', 'stride'] as const) {
          const { score } = practise(sheet([symbol(chord) + note(melody, 8)]), pattern);
          const top = score.notes.find((n) => n.hand === 'right')!.midi;
          for (const n of score.notes.filter((x) => x.hand === 'left')) {
            expect(n.midi, `${melody} ${chord} ${pattern}`).toBeLessThan(top);
            expect(n.midi).toBeGreaterThanOrEqual(36);
          }
        }
  });
});

describe('writing it into the score', () => {
  it('fills durations with note values, tied where one cannot say it', () => {
    const simple = meterOf({ beats: 2, beatType: 4 });
    const names = (position: number, length: number, meter = simple) =>
      noteValues(position, length, meter).map((v) => `${v.type}${v.dot ? '.' : ''}`);
    expect(names(0, 2 * Q)).toEqual(['half']);
    expect(names(0, (5 * Q) / 4)).toEqual(['quarter', '16th']);
    expect(names((5 * Q) / 4, (3 * Q) / 4)).toEqual(['eighth.']);
    expect(names(0, (3 * Q) / 2)).toEqual(['quarter.']);
    expect(names(Q / 2, Q)).toEqual(['eighth', 'eighth']);
    const compound = meterOf({ beats: 6, beatType: 8 });
    expect(names(0, 3 * Q, compound)).toEqual(['half.']);
    expect(names(0, (9 * Q) / 4, compound)).toEqual(['quarter.', 'eighth.']);
    expect(names(0, 5 * Q, meterOf({ beats: 5, beatType: 4 }))).toEqual(['whole', 'quarter']);
  });

  it('takes the place of a written left hand, and leaves the right hand as it is', () => {
    const xml = sheet([
      symbol('C') + note('E5', 4) + note('G5', 4) + backup(8) + note('C3', 2, 2) + note('G3', 6, 2),
      note('C6', 8) + backup(8) + note('C3', 8, 2),
    ]);
    const { before, score, doc } = practise(xml, 'rootFifth');
    expect(score.notes.filter((n) => n.hand === 'right')).toEqual(
      before.notes.filter((n) => n.hand === 'right'),
    );
    expect([leftOf(score, 0), leftOf(score, 1)]).toEqual(['0:C2+G2', '0:C2+G2']);
    expect(score.measures).toEqual(before.measures);
    // The measure is tidy: the right hand, one way back, the left hand.
    const first = doc.getElementsByTagName('measure')[0]!;
    expect([...first.children].map((c) => c.localName)).toEqual([
      'attributes',
      'harmony',
      'note',
      'note',
      'backup',
      'note',
      'note',
    ]);
  });

  it('gives a part of one staff a bass staff for it', () => {
    const xml = sheet([symbol('F') + note('A4', 8)], { staves: 1 });
    const before = parseMusicXml(domParse(xml));
    expect(leftHandStaff(before)).toEqual({ part: 0, staff: 2, added: true });
    const { score, hands, doc } = practise(xml, 'block');
    expect(hands).toMatchObject({ '0.1': 'right', '0.2': 'left' });
    expect(score.parts[0]!.staves).toBe(2);
    expect(leftOf(score, 0)).toBe('0:F2+A2+C3');
    expect(score.notes.filter((n) => n.hand === 'right')).toHaveLength(1);
    const clefs = [...doc.getElementsByTagName('clef')].map(
      (c) => `${c.getAttribute('number')}${c.getElementsByTagName('sign')[0]!.textContent}`,
    );
    expect(clefs).toEqual(['1G', '2F']);
    expect(doc.getElementsByTagName('staves')[0]!.textContent).toBe('2');
  });

  it('keeps the left hand’s staff in the bass clef', () => {
    const treble = '<attributes><clef number="2"><sign>G</sign><line>2</line></clef></attributes>';
    const xml = sheet([symbol('C') + note('C6', 8), treble + note('C6', 8)]);
    const { doc } = practise(xml, 'block');
    const clefs = [...doc.getElementsByTagName('clef')].map(
      (c) => `${c.getAttribute('number')}${c.getElementsByTagName('sign')[0]!.textContent}`,
    );
    expect(clefs).toEqual(['1G', '2F']);
  });

  it('makes the divisions finer when the pattern needs it', () => {
    const xml = sheet([symbol('C') + note('C6', 4)], { divisions: 1 });
    const { before, score, doc } = practise(xml, 'alberti');
    expect(doc.getElementsByTagName('divisions')[0]!.textContent).toBe('2');
    expect(score.notes.filter((n) => n.hand === 'right')).toEqual(before.notes);
    expect(leftOf(score, 0)).toBe('0:C3 0.5:G3 1:E3 1.5:G3 2:C3 2.5:G3 3:E3 3.5:G3');
  });

  it('writes the signs a note needs, once in a bar, and beams the eighths', () => {
    const xml = sheet([symbol('D') + note('C6', 8), symbol('D') + note('C6', 8)], { fifths: 0 });
    const { doc } = practise(xml, 'alberti');
    const bars = [...doc.getElementsByTagName('measure')].map((m) =>
      [...m.getElementsByTagName('note')]
        .filter((n) => n.getElementsByTagName('staff')[0]!.textContent === '2')
        .map(
          (n) =>
            `${n.getElementsByTagName('step')[0]!.textContent}${n.getElementsByTagName('accidental')[0]?.textContent ?? ''}:${n.getElementsByTagName('beam')[0]?.textContent ?? ''}`,
        ),
    );
    // D A F♯ A, twice a bar: the sharp once in each bar.
    const half = ['D:begin', 'A:continue', 'Fsharp:continue', 'A:end'];
    expect(bars[0]).toEqual([...half, 'D:begin', 'A:continue', 'F:continue', 'A:end']);
    expect(bars[1]).toEqual(bars[0]);
    // In G major the F♯ is in the signature.
    const inG = practise(sheet([symbol('D') + note('C6', 8)], { fifths: 1 }), 'block').doc;
    expect(inG.getElementsByTagName('accidental')).toHaveLength(0);
  });

  it('ties a held chord across the beat it cannot be written over', () => {
    // F, and C on the last sixteenth of the first beat's second half: 4/4, at 1¼ beats.
    const xml = sheet([symbol('F') + symbol('C', 5) + note('C6', 16)], { divisions: 4 });
    const { score } = practise(xml, 'rootFifth');
    const notes = score.notes.filter((n) => n.hand === 'left');
    expect(notes.map((n) => [n.onset, n.duration, n.midi, n.tieStart, n.tieStop])).toEqual([
      [0, Q, 41, true, false],
      [0, Q, 48, true, false],
      [Q, Q / 4, 41, false, true],
      [Q, Q / 4, 48, false, true],
      [(5 * Q) / 4, (3 * Q) / 4, 36, true, false],
      [(5 * Q) / 4, (3 * Q) / 4, 43, true, false],
      [2 * Q, 2 * Q, 36, false, true],
      [2 * Q, 2 * Q, 43, false, true],
    ]);
  });

  it('makes one bar for each written bar, whatever the pattern', () => {
    const score = parseMusicXml(domParse(sheet([symbol('C') + note('C6', 8), note('C6', 8)])));
    for (const pattern of leftHandPatterns(score))
      expect(leftHandFromSymbols(score, pattern)).toHaveLength(2);
  });
});
