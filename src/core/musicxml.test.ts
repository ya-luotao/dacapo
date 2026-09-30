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

  it('reads the printed finger, not an alternative or a substitution', () => {
    const fingering = (...marks: string[]) =>
      `<staff>1</staff><notations><technical>${marks.join('')}</technical></notations>`;
    const s = parse(
      piano([
        note('C5', 1, fingering('<fingering>1</fingering>')) +
          note(
            'D5',
            1,
            fingering('<fingering alternate="yes">4</fingering><fingering>2</fingering>'),
          ) +
          note('E5', 1, fingering('<fingering>3-1</fingering>')) +
          note('F5', 1, fingering('<fingering substitution="yes">2</fingering>')) +
          note('G5', 1, '<staff>1</staff>') +
          note('A5', 1, fingering('<fingering>x</fingering>')) +
          note(
            'B5',
            1,
            '<staff>1</staff><notations><slur type="start"/></notations>' +
              '<notations><technical><fingering>5</fingering></technical></notations>',
          ),
      ]),
    );
    // A note may carry several <notations>; the fingering can be in any of them.
    expect(s.notes.map((n) => n.finger)).toEqual([1, 2, 3, null, null, null, 5]);
  });

  it('keeps grace notes off the steps, skips rests and cue notes without losing time', () => {
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
    expect(midis(s)).toEqual([[69]]);
    // Grace notes and ornaments are kept (docs/EXPRESSION.md): no warning.
    expect(s.warnings).toEqual([]);
    expect(s.notes[0]!.graces).toEqual([
      {
        id: 'g0.0.0',
        midi: 71,
        pitch: { step: 'B', alter: 0, octave: 4 },
        slash: false,
        chord: false,
      },
    ]);
    expect(s.notes[0]!.ornaments).toEqual([{ kind: 'trill', upper: 71, lower: 67 }]);
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

describe('markings', () => {
  const staff = (n: number) => `<staff>${n}</staff>`;
  const grace = (pitch: string, extra = '') => {
    const [, step, octave] = /^([A-G])(\d)$/.exec(pitch)!;
    return `<note>${extra.includes('<chord/>') ? '<chord/>' : ''}<grace${extra.includes('slash') ? ' slash="yes"' : ''}/><pitch><step>${step}</step><octave>${octave}</octave></pitch>${extra.includes('voice2') ? '<voice>2</voice>' : ''}<staff>1</staff></note>`;
  };
  const direction = (types: string, extra = '') =>
    `<direction><direction-type>${types}</direction-type>${extra}</direction>`;
  const withKey = (fifths: number) =>
    `<divisions>2</divisions><key><fifths>${fifths}</fifths></key><staves>2</staves>`;

  it('attaches grace notes to the next note of their voice, across a barline, chords too', () => {
    const s = parse(
      piano([
        note('C5', 6, staff(1)) + grace('D5', 'slash') + grace('F5', 'slash <chord/>'),
        note('E5', 8, staff(1)),
      ]),
    );
    expect(s.notes.map((n) => n.midi)).toEqual([72, 76]);
    expect(s.notes[1]!.graces?.map((g) => [g.midi, g.slash, g.chord])).toEqual([
      [74, true, false],
      [77, true, true],
    ]);
    // Only the principal notes are steps.
    expect(midis(s)).toEqual([[72], [76]]);
  });

  it('keeps grace notes out of the checksum and the steps', async () => {
    const { pieceChecksum } = await import('./pieceRecords.ts');
    const plain = parse(piano([note('C5', 4, staff(1)) + note('D5', 4, staff(1))]));
    const marked = parse(
      piano([
        direction('<dynamics><p/></dynamics>', staff(1)) +
          note(
            'C5',
            4,
            `${staff(1)}<notations><slur type="start"/><articulations><staccato/></articulations></notations>`,
          ) +
          grace('E5', 'slash') +
          note(
            'D5',
            4,
            `${staff(1)}<notations><slur type="stop"/><ornaments><trill-mark/></ornaments><fermata/></notations>`,
          ),
      ]),
    );
    expect(pieceChecksum(marked)).toBe(pieceChecksum(plain));
    const shape = (x: Score) => buildSteps(x, 'both').map((st) => [st.tick, st.midis]);
    expect(shape(marked)).toEqual(shape(plain));
  });

  it('reads dynamics from directions and notations, at their offset and staff', () => {
    const s = parse(
      piano([
        direction('<dynamics><p/></dynamics>', staff(1)) +
          note('C5', 4, staff(1)) +
          direction('<dynamics><mf/></dynamics>', `<offset>1</offset>${staff(1)}`) +
          note('D5', 4, `${staff(1)}<notations><dynamics><sfz/></dynamics></notations>`) +
          '<backup><duration>8</duration></backup>' +
          direction('<dynamics><other-dynamics>molto</other-dynamics><pp/></dynamics>', staff(2)) +
          note('C3', 8, staff(2)),
      ]),
    );
    expect(s.markings.dynamics.map((d) => [d.tick, d.staff, d.dynamic])).toEqual([
      [0, 1, 'p'],
      [0, 2, 'pp'],
      [2 * Q, 1, 'sfz'],
      [2 * Q + Q / 2, 1, 'mf'],
    ]);
  });

  it('reads hairpins, and cresc./dim. words to their dashes or the next dynamic', () => {
    const s = parse(
      piano([
        direction('<wedge type="crescendo"/>', staff(1)) +
          note('C5', 4, staff(1)) +
          direction('<wedge type="stop"/>', staff(1)) +
          direction('<words>poco cresc.</words>', staff(1)) +
          note('D5', 4, staff(1)),
        direction('<dynamics><f/></dynamics>', staff(2)) +
          note('E5', 2, staff(1)) +
          direction('<dynamics><ff/></dynamics>', staff(1)) +
          direction('<words>dim.</words>') +
          direction('<dashes type="start"/>') +
          note('F5', 2, staff(1)) +
          direction('<dashes type="stop"/>') +
          note('G5', 4, staff(1)),
      ]),
    );
    expect(s.markings.hairpins.map((h) => [h.kind, h.written, h.tick, h.end.tick])).toEqual([
      ['crescendo', 'wedge', 0, 2 * Q],
      // The next dynamic on its own staff, not the one below it.
      ['crescendo', 'words', 2 * Q, 5 * Q],
      ['diminuendo', 'words', 5 * Q, 6 * Q],
    ]);
    expect(s.markings.hairpins[1]!.end.measure).toBe(1);
  });

  it('reads slurs by number and voice, never ties, and moves a grace note’s end to its note', () => {
    const slur = (type: string, n = 1) => `<slur type="${type}" number="${n}"/>`;
    const s = parse(
      piano([
        note('C5', 2, `<voice>1</voice>${staff(1)}<notations>${slur('start')}</notations>`) +
          note(
            'D5',
            2,
            `<voice>1</voice>${staff(1)}<tie type="start"/><notations><tied type="start"/></notations>`,
          ) +
          note(
            'D5',
            2,
            `<voice>1</voice>${staff(1)}<tie type="stop"/><notations><tied type="stop"/>${slur('stop')}${slur('start')}</notations>`,
          ) +
          grace('A4', 'slash').replace(
            '</staff>',
            `</staff><notations>${slur('stop')}</notations>`,
          ) +
          note('B4', 2, `<voice>1</voice>${staff(1)}`) +
          '<backup><duration>8</duration></backup>' +
          note('C3', 4, `<voice>5</voice>${staff(2)}<notations>${slur('start')}</notations>`) +
          note('D3', 4, `<voice>5</voice>${staff(2)}<notations>${slur('stop')}</notations>`),
      ]),
    );
    const id = (midi: number) => s.notes.find((n) => n.midi === midi)!.id;
    const d5 = s.notes.filter((n) => n.midi === 74);
    expect(s.markings.slurs).toEqual([
      { part: 0, staff: 1, voice: '1', from: id(72), to: d5[1]!.id },
      { part: 0, staff: 1, voice: '1', from: d5[1]!.id, to: id(71) },
      { part: 0, staff: 2, voice: '5', from: id(48), to: id(50) },
    ]);
  });

  it('reads articulations, and fermatas on notes and rests', () => {
    const s = parse(
      piano([
        note(
          'C5',
          2,
          `${staff(1)}<notations><articulations><staccato/><accent/><breath-mark/></articulations></notations>`,
        ) +
          note(
            'D5',
            2,
            `${staff(1)}<notations><articulations><tenuto/></articulations><fermata/></notations>`,
          ) +
          `<note><rest/><duration>4</duration>${staff(1)}<notations><fermata type="inverted"/></notations></note>`,
      ]),
    );
    expect(s.notes.map((n) => n.articulations)).toEqual([['staccato', 'accent'], ['tenuto']]);
    expect(s.markings.fermatas.map((f) => [f.tick, f.staff])).toEqual([
      [Q, 1],
      [2 * Q, 1],
    ]);
  });

  it('reads the pedal marks, the sostenuto apart, and una corda / tre corde', () => {
    const pedal = (attrs: string) => direction(`<pedal ${attrs}/>`, staff(2));
    const s = parse(
      piano([
        pedal('type="start" line="yes"') +
          direction('<words>una corda</words>', staff(2)) +
          note('C5', 2, staff(1)) +
          pedal('type="sostenuto" number="2"') +
          pedal('type="change" line="yes"') +
          note('D5', 2, staff(1)) +
          pedal('type="stop" number="2"') +
          pedal('type="stop" line="yes"') +
          direction('<words>tre corde</words>', staff(2)) +
          note('E5', 4, staff(1)),
      ]),
    );
    expect(s.markings.pedals.map((p) => [p.tick, p.pedal, p.type, p.line])).toEqual([
      [0, 'sustain', 'start', true],
      [0, 'una-corda', 'start', false],
      [Q, 'sostenuto', 'start', false],
      [Q, 'sustain', 'change', true],
      [2 * Q, 'sostenuto', 'stop', false],
      [2 * Q, 'sustain', 'stop', true],
      [2 * Q, 'una-corda', 'stop', false],
    ]);
  });

  it('gives ornaments their neighbours from the key, the bar and the accidentals shown', () => {
    const ornament = (inner: string) => `<notations><ornaments>${inner}</ornaments></notations>`;
    const s = parse(
      piano(
        [
          // G major: a mordent on G5 goes down to F♯5.
          note('G5', 1, `${staff(1)}${ornament('<mordent/>')}`) +
            // An F natural earlier in the bar (octave 4) holds for a turn on E4 …
            note('F4', 1, staff(1)) +
            note('E4', 1, `${staff(1)}${ornament('<turn/>')}`) +
            // … but not for a trill on E5, an octave higher.
            note('E5', 1, `${staff(1)}${ornament('<trill-mark/><wavy-line type="start"/>')}`) +
            // A sharp printed above the trill; a long inverted mordent.
            note(
              'B4',
              2,
              `${staff(1)}${ornament('<trill-mark/><accidental-mark placement="above">sharp</accidental-mark>')}`,
            ) +
            note('D5', 2, `${staff(1)}${ornament('<inverted-mordent long="yes"/>')}`),
        ],
        withKey(1),
      ),
    );
    expect(s.notes.map((n) => n.ornaments)).toEqual([
      [{ kind: 'mordent', upper: 81, lower: 78 }],
      undefined,
      [{ kind: 'turn', upper: 65, lower: 62 }],
      [{ kind: 'trill', upper: 78, lower: 74, wavyLine: true }],
      [{ kind: 'trill', upper: 73, lower: 69 }],
      [{ kind: 'inverted-mordent', upper: 76, lower: 72, long: true }],
    ]);
  });

  it('transposes grace notes and ornaments with their part', () => {
    const s = parse(
      piano(
        [
          grace('D5') +
            note('C5', 4, `${staff(1)}<notations><ornaments><mordent/></ornaments></notations>`),
        ],
        '<divisions>2</divisions><transpose><chromatic>-2</chromatic></transpose>',
      ),
    );
    expect(s.notes[0]).toMatchObject({
      midi: 70,
      graces: [{ midi: 72 }],
      ornaments: [{ kind: 'mordent', upper: 72, lower: 69 }],
    });
  });

  it('lays markings out through the repeats, a hairpin ending where the order jumps', async () => {
    const { performedMarks, performedSpans } = await import('./markings.ts');
    const { performanceOrder } = await import('./repeats.ts');
    const s = parse(
      piano([
        '<barline location="left"><repeat direction="forward"/></barline>' +
          direction('<dynamics><p/></dynamics>', staff(1)) +
          note('C5', 4, staff(1)) +
          direction('<wedge type="crescendo"/>', staff(1)) +
          note('D5', 4, staff(1)),
        note('E5', 4, staff(1)) +
          direction('<wedge type="stop"/>', staff(1)) +
          note('F5', 4, staff(1)) +
          '<barline location="right"><repeat direction="backward"/></barline>',
      ]),
    );
    const order = performanceOrder(s.measures);
    const bar = 4 * Q;
    expect(performedMarks(s.markings.dynamics, s.measures, order).map((d) => d.at)).toEqual([
      0,
      2 * bar,
    ]);
    expect(
      performedSpans(s.markings.hairpins, s.measures, order).map((h) => [h.at, h.end]),
    ).toEqual([
      [2 * Q, bar + 2 * Q],
      [2 * bar + 2 * Q, 3 * bar + 2 * Q],
    ]);
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
