// @vitest-environment jsdom
import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  decodeXml,
  musicXmlFromBytes,
  parseMusicXml,
  ScoreError,
  type ParseOptions,
} from './musicxml.ts';
import { buildSteps, TICKS_PER_QUARTER, type Score } from './score.ts';

const Q = TICKS_PER_QUARTER;
const domParse = (s: string) => new DOMParser().parseFromString(s, 'application/xml');

function parse(xml: string, options?: ParseOptions): Score {
  return parseMusicXml(domParse(xml), options);
}

/** One piano part; `measures` are the inner XML of each `<measure>`. */
function piano(measures: string[], attrs = '<divisions>2</divisions><staves>2</staves>'): string {
  const body = measures
    .map(
      (m, i) =>
        `<measure number="${i + 1}">${i === 0 ? `<attributes>${attrs}</attributes>` : ''}${m}</measure>`,
    )
    .join('');
  return `<?xml version="1.0"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">${body}</part></score-partwise>`;
}

function note(pitch: string, duration: number, extra = ''): string {
  const [, step, alter, octave] = /^([A-G])(#|b)?(\d)$/.exec(pitch)!;
  const alterXml = alter ? `<alter>${alter === '#' ? 1 : -1}</alter>` : '';
  return `<note>${extra.includes('<chord/>') ? '<chord/>' : ''}<pitch><step>${step}</step>${alterXml}<octave>${octave}</octave></pitch><duration>${duration}</duration>${extra.replace('<chord/>', '')}</note>`;
}

/** Several parts, each `[name, staves, measure XML]`, one measure each. */
function score(parts: [name: string, staves: number, body: string, extra?: string][]): string {
  const list = parts
    .map(
      ([name, , , extra], i) =>
        `<score-part id="P${i + 1}"><part-name>${name}</part-name>${extra ?? ''}</score-part>`,
    )
    .join('');
  const body = parts
    .map(
      ([, staves, m], i) =>
        `<part id="P${i + 1}"><measure number="1"><attributes><divisions>1</divisions><staves>${staves}</staves></attributes>${m}</measure></part>`,
    )
    .join('');
  return `<score-partwise><part-list>${list}</part-list>${body}</score-partwise>`;
}

const midis = (s: Score, hands: 'right' | 'left' | 'both' = 'both') =>
  buildSteps(s, hands).map((step) => step.midis);

describe('parseMusicXml', () => {
  it('reads onsets in ticks, chords, and staves as hands', () => {
    const s = parse(
      piano([
        note('C5', 2, '<staff>1</staff>') +
          note('D5', 2, '<staff>1</staff>') +
          `<backup><duration>4</duration></backup>` +
          note('C3', 4, '<staff>2</staff>') +
          note('E3', 4, '<chord/><staff>2</staff>') +
          note('G3', 4, '<chord/><staff>2</staff>'),
      ]),
    );
    expect(s.measures).toHaveLength(1);
    expect(s.measures[0]).toMatchObject({ start: 0, duration: 2 * Q, beats: 4, beatType: 4 });
    expect(s.notes.map((n) => [n.onset, n.midi, n.hand])).toEqual([
      [0, 72, 'right'],
      [0, 48, 'left'],
      [0, 52, 'left'],
      [0, 55, 'left'],
      [Q, 74, 'right'],
    ]);
    expect(midis(s)).toEqual([[48, 52, 55, 72], [74]]);
    expect(midis(s, 'right')).toEqual([[72], [74]]);
    expect(midis(s, 'left')).toEqual([[48, 52, 55]]);
    expect(s.parts).toEqual([
      { index: 0, id: 'P1', name: 'Piano', instrument: '', program: null, staves: 2 },
    ]);
  });

  it('keeps voices apart with backup and forward', () => {
    const s = parse(
      piano([
        note('E5', 4, '<voice>1</voice><staff>1</staff>') +
          `<backup><duration>4</duration></backup>` +
          `<forward><duration>2</duration><voice>2</voice><staff>1</staff></forward>` +
          note('C5', 2, '<voice>2</voice><staff>1</staff>'),
      ]),
    );
    expect(s.notes.map((n) => [n.onset, n.midi, n.voice])).toEqual([
      [0, 76, '1'],
      [Q, 72, '2'],
    ]);
  });

  it('does not ask for a tied continuation again, but reports it as held', () => {
    const s = parse(
      piano([
        note('G4', 8, '<tie type="start"/><staff>1</staff>'),
        note('G4', 4, '<tie type="stop"/><staff>1</staff>') +
          note('B4', 4, '<chord/><staff>1</staff>') +
          note('A4', 4, '<staff>1</staff>'),
      ]),
    );
    const steps = buildSteps(s, 'right');
    expect(steps.map((step) => step.midis)).toEqual([[67], [71], [69]]);
    expect(steps[1]!.heldIds).toHaveLength(1);
    expect(s.notes.filter((n) => n.tieStop)).toHaveLength(1);
  });

  it('accepts ties written only as <tied> notations', () => {
    const s = parse(
      piano([
        note('G4', 8, '<staff>1</staff><notations><tied type="start"/></notations>'),
        note('G4', 8, '<staff>1</staff><notations><tied type="stop"/></notations>'),
      ]),
    );
    expect(midis(s)).toEqual([[67]]);
  });

  it('plays a tie that ends on a note it did not start from, with a warning', () => {
    const s = parse(piano([note('G4', 4, '<tie type="stop"/><staff>1</staff>')]));
    expect(midis(s)).toEqual([[67]]);
    expect(s.warnings).toContain('tie-mismatch');
  });

  it('skips grace notes, rests and cue notes without losing time', () => {
    const s = parse(
      piano([
        `<note><grace/><pitch><step>B</step><octave>4</octave></pitch><staff>1</staff></note>` +
          `<note><rest/><duration>2</duration><staff>1</staff></note>` +
          `<note><cue/><pitch><step>D</step><octave>5</octave></pitch><duration>2</duration><staff>1</staff></note>` +
          note(
            'A4',
            4,
            '<staff>1</staff><notations><ornaments><trill-mark/></ornaments></notations>',
          ),
      ]),
    );
    expect(s.notes.map((n) => [n.onset, n.midi])).toEqual([[2 * Q, 69]]);
    expect(s.warnings).toEqual(expect.arrayContaining(['grace-notes', 'ornaments']));
  });

  it('converts durations when divisions change, and handles triplets', () => {
    const s = parse(
      piano(
        [
          note('C4', 1) + note('D4', 1) + note('E4', 1) + note('F4', 9),
          `<attributes><divisions>1</divisions></attributes>` + note('G4', 4),
        ],
        '<divisions>3</divisions>',
      ),
    );
    // Three divisions per quarter: triplet eighths are a third of a quarter each.
    expect(s.notes.map((n) => n.onset)).toEqual([0, Q / 3, (2 * Q) / 3, Q, 4 * Q]);
    expect(s.measures[1]!.start).toBe(4 * Q);
    expect(s.warnings).toEqual([]);
  });

  it('rounds durations finer than the tick resolution, with a warning', () => {
    const s = parse(piano([note('C4', 1) + note('D4', 1)], '<divisions>7</divisions>'));
    expect(s.notes.map((n) => n.onset)).toEqual([0, Math.round(Q / 7)]);
    expect(s.warnings).toContain('finer-than-ticks');
  });

  it('lets the longest part decide the length of a measure', () => {
    const s = parse(
      score([
        ['Piano', 2, note('C5', 2, '<staff>1</staff>')],
        ['Violin', 1, note('G4', 4)],
      ]),
    );
    expect(s.measures[0]!.duration).toBe(4 * Q);
  });

  it('applies <transpose> to reach sounding pitch', () => {
    const s = parse(
      piano(
        [note('C4', 4)],
        '<divisions>1</divisions><transpose><chromatic>-2</chromatic></transpose>',
      ),
    );
    expect(s.notes[0]!.midi).toBe(58);
  });

  it('reads metadata and tempo', () => {
    const xml = piano([
      `<direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>96</per-minute></metronome></direction-type><sound tempo="96"/></direction>` +
        note('C4', 2),
    ]).replace(
      '<part-list>',
      '<work><work-title>Piece</work-title></work><identification><creator type="composer">Someone</creator></identification><part-list>',
    );
    expect(parse(xml)).toMatchObject({
      title: 'Piece',
      composer: 'Someone',
      tempos: [{ tick: 0, bpm: 96 }],
    });
    // A song from a collection: the movement title names it.
    const song = xml.replace(
      '<identification>',
      '<movement-title>Volkslied</movement-title><identification>',
    );
    expect(parse(song).title).toBe('Volkslied');
  });

  it('rejects what it cannot read', () => {
    const kind = (xml: string) => {
      try {
        parse(xml);
      } catch (error) {
        return error instanceof ScoreError ? error.kind : 'other';
      }
      return 'parsed';
    };
    expect(kind('<score-timewise/>')).toBe('timewise');
    expect(kind('<html/>')).toBe('not-musicxml');
    expect(kind('<score-partwise><part')).toBe('not-xml');
    expect(kind('<score-partwise><part-list/></score-partwise>')).toBe('no-parts');
  });

  it('warns about D.C./D.S. and reads the score as written', () => {
    const s = parse(piano([note('C4', 4) + `<sound dacapo="yes"/>`]));
    expect(s.measures[0]!.jumps).toEqual(['dacapo']);
    expect(s.warnings).toContain('jumps');
  });
});

describe('piano part detection', () => {
  const hands = (s: Score) => s.notes.map((n) => [n.midi, n.hand]);

  it('practises the two-staff part and leaves a voice above it as accompaniment', () => {
    const s = parse(
      score([
        ['Voice', 1, note('A4', 4)],
        [
          'Pianoforte',
          2,
          note('E5', 4, '<staff>1</staff>') +
            '<backup><duration>4</duration></backup>' +
            note('C3', 4, '<staff>2</staff>'),
        ],
      ]),
    );
    expect(s.hands).toEqual({ '0.1': null, '1.1': 'right', '1.2': 'left' });
    expect(hands(s)).toEqual([
      [69, null],
      [76, 'right'],
      [48, 'left'],
    ]);
    expect(midis(s)).toEqual([[48, 76]]);
    expect(s.warnings).toEqual([]);
  });

  it('prefers a piano-like part among several two-staff parts', () => {
    const s = parse(
      score([
        ['Harp', 2, note('C4', 4, '<staff>1</staff>')],
        ['Pno.', 2, note('D4', 4, '<staff>1</staff>')],
      ]),
    );
    expect(s.hands).toMatchObject({ '0.1': null, '0.2': null, '1.1': 'right', '1.2': 'left' });
  });

  it('takes two single-staff piano parts as right and left hand', () => {
    const program = (n: number) =>
      `<score-instrument id="I"><instrument-name>Acoustic Grand</instrument-name></score-instrument><midi-instrument id="I"><midi-program>${n}</midi-program></midi-instrument>`;
    const s = parse(
      score([
        ['Flute', 1, note('G5', 4), program(74)],
        ['Right', 1, note('E5', 4), program(1)],
        ['Left', 1, note('C3', 4), program(1)],
      ]),
    );
    expect(s.hands).toEqual({ '0.1': null, '1.1': 'right', '2.1': 'left' });
    expect(s.parts[1]).toMatchObject({ instrument: 'Acoustic Grand', program: 1 });
  });

  it('guesses the first two parts when nothing looks like a piano, and says so', () => {
    const s = parse(
      score([
        ['A', 1, note('E5', 4)],
        ['B', 1, note('C3', 4)],
        ['C', 1, ''],
      ]),
    );
    expect(s.hands).toEqual({ '0.1': 'right', '1.1': 'left', '2.1': null });
    expect(s.warnings).toContain('hands-guessed');
  });

  it('reads a one-staff piece as the right hand, without a warning', () => {
    const s = parse(score([['Melody', 1, note('E5', 4)]]));
    expect(s.hands).toEqual({ '0.1': 'right' });
    expect(s.warnings).toEqual([]);
  });

  it('applies a hand override per staff and drops the guess warning', () => {
    const xml = score([
      ['A', 1, note('E5', 4)],
      ['B', 1, note('C3', 4)],
    ]);
    const s = parse(xml, { hands: { '0.1': 'left', '1.1': 'right', '9.1': 'left' } });
    expect(s.hands).toEqual({ '0.1': 'left', '1.1': 'right' });
    expect(hands(s)).toEqual([
      [76, 'left'],
      [48, 'right'],
    ]);
    expect(s.warnings).not.toContain('hands-guessed');
    const none = parse(xml, { hands: { '1.1': null } });
    expect(midis(none)).toEqual([[76]]);
  });
});

describe('file handling', () => {
  const xml = piano([note('C4', 4)], '<divisions>1</divisions>');

  it('reads a compressed .mxl through its container', () => {
    const container = `<?xml version="1.0"?><container><rootfiles><rootfile full-path="score/piece.xml"/></rootfiles></container>`;
    const zip = zipSync({
      mimetype: strToU8('application/vnd.recordare.musicxml'),
      'META-INF/container.xml': strToU8(container),
      'score/piece.xml': strToU8(xml),
    });
    expect(musicXmlFromBytes(zip, domParse)).toBe(xml);
  });

  it('falls back to the first score file without a container', () => {
    const zip = zipSync({ 'piece.musicxml': strToU8(xml) });
    expect(musicXmlFromBytes(zip, domParse)).toBe(xml);
  });

  it('rejects a damaged or empty archive', () => {
    expect(() => musicXmlFromBytes(new Uint8Array([0x50, 0x4b, 1, 2]), domParse)).toThrow(
      ScoreError,
    );
    expect(() => musicXmlFromBytes(zipSync({ 'a.txt': strToU8('x') }), domParse)).toThrow(
      /no-score-in-zip/,
    );
  });

  it('decodes UTF-16 with a byte-order mark', () => {
    const text = '<a>é</a>';
    const le = new Uint8Array(2 + text.length * 2);
    le.set([0xff, 0xfe]);
    for (let i = 0; i < text.length; i++) le[2 + i * 2] = text.charCodeAt(i);
    expect(decodeXml(le)).toBe(text);
    expect(decodeXml(strToU8(text))).toBe(text);
  });
});
