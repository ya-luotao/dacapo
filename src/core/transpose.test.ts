// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseMusicXml } from './musicxml.ts';
import type { SpelledPitch } from './score.ts';
import {
  isTransposition,
  keyTonic,
  pieceKey,
  respelled,
  transposedFifths,
  transposedKey,
  transposeInterval,
  transposePitch,
  transposeRoot,
  TRANSPOSITIONS,
} from './transpose.ts';
import { transposeDocument } from './transposeXml.ts';

const domParse = (s: string) => new DOMParser().parseFromString(s, 'application/xml');

const SIGN: Record<number, string> = { [-2]: 'bb', [-1]: 'b', 0: '', 1: '#', 2: '##', 3: '###' };
const name = (p: { step: string; alter: number; octave?: number }) =>
  `${p.step}${SIGN[p.alter] ?? `(${p.alter})`}${p.octave ?? ''}`;
const pitch = (text: string): SpelledPitch => {
  const [, step, sign, octave] = /^([A-G])(#{1,2}|b{1,2})?(\d)$/.exec(text)!;
  const alter = sign ? (sign[0] === '#' ? sign.length : -sign.length) : 0;
  return { step: step as SpelledPitch['step'], alter, octave: Number(octave) };
};
const tonic = (fifths: number, mode: 'major' | 'minor') => name(keyTonic(fifths, mode));

describe('the key a piece is moved to', () => {
  it('is the one with fewer signs, six sharps where both have six', () => {
    const keys = (fifths: number, mode: 'major' | 'minor') =>
      TRANSPOSITIONS.map((n) => tonic(n === 0 ? fifths : transposedFifths(fifths, n), mode));
    // From 6 down to 6 up.
    expect(keys(0, 'major')).toEqual('F# G Ab A Bb B C Db D Eb E F F#'.split(' '));
    expect(keys(0, 'minor')).toEqual('D# E F F# G G# A Bb B C C# D D#'.split(' '));
    expect(keys(1, 'major')).toEqual('Db D Eb E F F# G Ab A Bb B C Db'.split(' '));
    expect(keys(-3, 'minor')).toEqual('F# G G# A Bb B C C# D D# E F F#'.split(' '));
    // Seven sharps are never kept: C♯ major a semitone up is D, down is C.
    expect([transposedFifths(7, 1), transposedFifths(7, -1), transposedFifths(-7, 1)]).toEqual([
      2, 0, 0,
    ]);
    for (let fifths = -7; fifths <= 7; fifths++)
      for (const n of TRANSPOSITIONS) {
        const moved = transposedFifths(fifths, n);
        expect(moved).toBeGreaterThanOrEqual(-5);
        expect(moved).toBeLessThanOrEqual(6);
      }
  });

  it('is reached by the interval between the two keys', () => {
    expect(transposeInterval(0, 2)).toEqual({ steps: 1, semitones: 2 });
    expect(transposeInterval(0, -3)).toEqual({ steps: -2, semitones: -3 });
    expect(transposeInterval(0, 1)).toEqual({ steps: 1, semitones: 1 });
    expect(transposeInterval(0, -1)).toEqual({ steps: -1, semitones: -1 });
    // C to F♯: an augmented fourth up, an diminished fifth down.
    expect(transposeInterval(0, 6)).toEqual({ steps: 3, semitones: 6 });
    expect(transposeInterval(0, -6)).toEqual({ steps: -4, semitones: -6 });
    // E♭ to D: a minor second down; B to C: a minor second up.
    expect(transposeInterval(-3, -1)).toEqual({ steps: -1, semitones: -1 });
    expect(transposeInterval(5, 1)).toEqual({ steps: 1, semitones: 1 });
    // The tonic of every key lands on the tonic of its new key, in both modes.
    for (let fifths = -7; fifths <= 7; fifths++)
      for (const n of TRANSPOSITIONS.filter((x) => x !== 0))
        for (const mode of ['major', 'minor'] as const) {
          const moved = transposeRoot(keyTonic(fifths, mode), transposeInterval(fifths, n));
          expect(moved).toEqual(keyTonic(transposedFifths(fifths, n), mode));
        }
  });

  it('names its tonic', () => {
    expect([-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6].map((f) => tonic(f, 'major'))).toEqual(
      'Db Ab Eb Bb F C G D A E B F#'.split(' '),
    );
    expect([-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6].map((f) => tonic(f, 'minor'))).toEqual(
      'Bb F C G D A E B F# C# G# D#'.split(' '),
    );
    expect(transposedKey({ fifths: 0, mode: 'minor' }, 2)).toEqual({ fifths: 2, mode: 'minor' });
    expect(transposedKey({ fifths: 7, mode: null }, 0)).toEqual({ fifths: 7, mode: null });
  });
});

describe('a pitch moved', () => {
  const move = (text: string, fifths: number, n: number) =>
    name(transposePitch(pitch(text), transposeInterval(fifths, n)));

  it('keeps its place in the key', () => {
    // A minor up a tone: the leading note G♯ becomes A♯, Für Elise's D♯ becomes E♯.
    expect(['E5', 'D#5', 'G#4', 'A3'].map((p) => move(p, 0, 2))).toEqual([
      'F#5',
      'E#5',
      'A#4',
      'B3',
    ]);
    // C major down a minor third, to A: B♭ (the flat seventh) becomes G natural.
    expect(['C4', 'Bb3', 'F#4', 'B3'].map((p) => move(p, 0, -3))).toEqual([
      'A3',
      'G3',
      'D#4',
      'G#3',
    ]);
    // Across the octave, both ways.
    expect(move('B4', 0, 1)).toBe('C5');
    expect(move('C4', 0, -1)).toBe('B3');
    expect(move('C4', 0, 6)).toBe('F#4');
    expect(move('C4', 0, -6)).toBe('F#3');
  });

  it('takes a double sign where the new key asks for one', () => {
    // G♯ minor to A minor: F𝄪 is G♯. E minor to G♯ minor (four up): D♯ is F𝄪.
    expect(move('F##4', 5, 1)).toBe('G#4');
    expect(move('D#5', 1, 4)).toBe('F##5');
    // D♭ major's flat sixth, B𝄫, a tone down in B major (not C♭ major) is G.
    expect(move('Bbb3', -5, -2)).toBe('G3');
  });

  it('is spelled on the next letter where it would need more', () => {
    const exact = transposePitch(pitch('B##3'), transposeInterval(0, -5));
    expect(name(exact)).toBe('F###3');
    expect(name(respelled(exact))).toBe('G#3');
    expect(name(respelled(pitch('C4')))).toBe('C4');
    expect(name(respelled({ step: 'C', alter: -3, octave: 4 }))).toBe('Bbb3');
  });
});

describe('transpositions a record may carry', () => {
  it('are whole semitones up to a tritone, never none', () => {
    expect([-6, -1, 1, 6].every(isTransposition)).toBe(true);
    expect([0, 7, -7, 1.5, '2', null, undefined, NaN].some(isTransposition)).toBe(false);
    expect(TRANSPOSITIONS).toEqual([-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6]);
  });
});

// --- The document ----------------------------------------------------------------------------

interface NoteSpec {
  pitch: string;
  sign?: string;
  extra?: string;
}

function noteXml({ pitch: text, sign, extra = '' }: NoteSpec, staff = 1): string {
  const p = pitch(text);
  return (
    `<note><pitch><step>${p.step}</step>${p.alter ? `<alter>${p.alter}</alter>` : ''}<octave>${p.octave}</octave></pitch>` +
    `<duration>2</duration><voice>${staff}</voice><type>quarter</type>${sign ? `<accidental>${sign}</accidental>` : ''}` +
    `<stem>up</stem><staff>${staff}</staff>${extra}</note>`
  );
}

function sheet(measures: string[], fifths = 0, mode = ''): string {
  const attributes =
    `<attributes><divisions>2</divisions><key><fifths>${fifths}</fifths>${mode ? `<mode>${mode}</mode>` : ''}</key>` +
    '<time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves></attributes>';
  const body = measures
    .map((m, i) => `<measure number="${i + 1}">${i === 0 ? attributes : ''}${m}</measure>`)
    .join('');
  return `<?xml version="1.0"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">${body}</part></score-partwise>`;
}

function transposeXml(xml: string, n: number) {
  const doc = domParse(xml);
  transposeDocument(doc, n);
  const notes = [...doc.getElementsByTagName('note')].map((note) => {
    const get = (tag: string) => note.getElementsByTagName(tag)[0]?.textContent ?? '';
    return `${name({ step: get('step'), alter: Number(get('alter') || 0), octave: Number(get('octave')) })}${get('accidental') ? `:${get('accidental')}` : ''}`;
  });
  return { doc, notes, score: parseMusicXml(doc) };
}

describe('a document transposed', () => {
  it('moves the signature, the notes and the signs printed with them', () => {
    // A minor: E, D♯ (sharp), D (natural again), G♯ (sharp).
    const xml = sheet(
      [
        noteXml({ pitch: 'E5' }) +
          noteXml({ pitch: 'D#5', sign: 'sharp' }) +
          noteXml({ pitch: 'D5', sign: 'natural' }) +
          noteXml({ pitch: 'G#4', sign: 'sharp' }),
      ],
      0,
    );
    const up = transposeXml(xml, 2);
    expect(up.score.keys).toEqual([{ measure: 0, fifths: 2, mode: null }]);
    expect(up.notes).toEqual(['F#5', 'E#5:sharp', 'E5:natural', 'A#4:sharp']);
    const down = transposeXml(xml, -3);
    expect(down.score.keys![0]!.fifths).toBe(3);
    expect(down.notes).toEqual(['C#5', 'B#4:sharp', 'B4:natural', 'E#4:sharp']);
    const flat = transposeXml(xml, 1);
    expect(flat.score.keys![0]!.fifths).toBe(-5);
    // B♭ minor: its leading note A natural, the raised fourth E natural.
    expect(flat.notes).toEqual(['F5', 'E5:natural', 'Eb5:flat', 'A4:natural']);
  });

  it('writes a double sign, and takes one away, as the new key asks', () => {
    const xml = sheet([noteXml({ pitch: 'D#5', sign: 'sharp' }) + noteXml({ pitch: 'E5' })], 1);
    expect(transposeXml(xml, 4).notes).toEqual(['F##5:double-sharp', 'G#5']);
    const sharp = sheet([noteXml({ pitch: 'F##4', sign: 'double-sharp' })], 5);
    expect(transposeXml(sharp, 1).notes).toEqual(['G#4:sharp']);
  });

  it('respells a note that would need three signs, and shows its sign', () => {
    const xml = sheet([
      noteXml({ pitch: 'B##3', sign: 'double-sharp' }) + noteXml({ pitch: 'B##3' }),
    ]);
    expect(transposeXml(xml, -5).notes).toEqual(['G#3:sharp', 'G#3:sharp']);
  });

  it('keeps a courtesy sign and its brackets, and leaves the stems to the engraver', () => {
    const xml = sheet([noteXml({ pitch: 'F4', sign: 'natural' })]).replace(
      '<accidental>',
      '<accidental parentheses="yes">',
    );
    const { doc, notes } = transposeXml(xml, 2);
    expect(notes).toEqual(['G4:natural']);
    expect(doc.getElementsByTagName('accidental')[0]!.getAttribute('parentheses')).toBe('yes');
    expect(doc.getElementsByTagName('stem')).toHaveLength(0);
  });

  it('moves each section of a piece that changes key to its simpler signature', () => {
    const change = '<attributes><key><cancel>-4</cancel><fifths>4</fifths></key></attributes>';
    // A♭ major, then E major: a semitone up they are A major and F major.
    const xml = sheet([noteXml({ pitch: 'Ab4' }), change + noteXml({ pitch: 'E4' })], -4);
    const { score, notes, doc } = transposeXml(xml, 1);
    expect(score.keys!.map((k) => k.fifths)).toEqual([3, -1]);
    expect(notes).toEqual(['A4', 'F4']);
    expect(doc.getElementsByTagName('cancel')).toHaveLength(0);
  });

  it('moves a staff with a signature of its own by that signature', () => {
    const keys =
      '<attributes><key number="1"><fifths>0</fifths></key><key number="2"><fifths>6</fifths></key></attributes>';
    const xml = sheet([keys + noteXml({ pitch: 'C5' }) + noteXml({ pitch: 'F#3' }, 2)]);
    // C major to D♭ major; F♯ major to G major.
    expect(transposeXml(xml, 1).notes).toEqual(['Db5', 'G3']);
  });

  it('moves the chord symbols: root and bass', () => {
    const harmony =
      '<harmony><root><root-step>B</root-step><root-alter>-1</root-alter></root><kind>major</kind>' +
      '<bass><bass-step>D</bass-step></bass><staff>1</staff></harmony>';
    const xml = sheet([harmony + noteXml({ pitch: 'F4' })], -1);
    const text = (n: number) => transposeXml(xml, n).score.harmonies![0]!.text;
    expect([text(2), text(-1), text(6), text(-6)]).toEqual(['C/E', 'A/C♯', 'E/G♯', 'E/G♯']);
    const alters = transposeXml(xml, 2).doc.getElementsByTagName('root-alter');
    expect(alters).toHaveLength(0);
  });

  it('moves the sign printed with an ornament to the note it stands for', () => {
    // A trill on B with a sharp above it: its upper note is C♯.
    const trill =
      '<notations><ornaments><trill-mark/><accidental-mark placement="above">sharp</accidental-mark></ornaments></notations>';
    const xml = sheet([noteXml({ pitch: 'B4', extra: trill })]);
    const before = parseMusicXml(domParse(xml)).notes[0]!.ornaments![0]!;
    for (const n of TRANSPOSITIONS.filter((x) => x !== 0)) {
      const after = transposeXml(xml, n).score.notes[0]!.ornaments![0]!;
      expect([after.upper, after.lower]).toEqual([before.upper + n, before.lower + n]);
    }
    // B with C♯ above: in D major, C♯ with D♯ above, so the sign stays a sharp; in B♭ major, A
    // with B natural above: a natural.
    const mark = (n: number) =>
      transposeXml(xml, n).doc.getElementsByTagName('accidental-mark')[0]!.textContent;
    expect([mark(2), mark(-2)]).toEqual(['sharp', 'natural']);
  });

  it('does nothing for no semitones', () => {
    const xml = sheet([noteXml({ pitch: 'Eb4', sign: 'flat' })], -3, 'minor');
    const doc = domParse(xml);
    const before = new XMLSerializer().serializeToString(doc);
    transposeDocument(doc, 0);
    expect(new XMLSerializer().serializeToString(doc)).toBe(before);
  });
});

describe('the key a piece is in', () => {
  const key = (xml: string) => pieceKey(parseMusicXml(domParse(xml)));

  it('is the file’s, with the mode it names', () => {
    expect(key(sheet([noteXml({ pitch: 'G4' })], -3, 'minor'))).toEqual({
      fifths: -3,
      mode: 'minor',
    });
    expect(key(sheet([noteXml({ pitch: 'G4' })], -3, 'major'))).toEqual({
      fifths: -3,
      mode: 'major',
    });
  });

  it('is read from the ending where the file names no mode', () => {
    const ends = (last: string, fifths: number) =>
      key(
        sheet(
          [
            noteXml({ pitch: 'G4' }),
            noteXml({ pitch: 'E5' }) +
              '<backup><duration>2</duration></backup>' +
              noteXml({ pitch: last }, 2),
          ],
          fifths,
        ),
      ).mode;
    expect(ends('C3', 0)).toBe('major');
    expect(ends('A2', 0)).toBe('minor');
    // The dominant tells nothing: both keys are named.
    expect(ends('G2', 0)).toBeNull();
    expect(ends('Eb3', -3)).toBe('major');
    expect(ends('C3', -3)).toBe('minor');
    // A dorian file is not major or minor by name: its ending decides, or nothing does.
    expect(key(sheet([noteXml({ pitch: 'D4' })], 0, 'dorian'))).toEqual({ fifths: 0, mode: null });
  });

  it('is read from the last chord symbol before the notes', () => {
    const harmony = (step: string) =>
      `<harmony><root><root-step>${step}</root-step></root><kind>major</kind><staff>1</staff></harmony>`;
    expect(key(sheet([harmony('E') + noteXml({ pitch: 'B4' })], 4))).toEqual({
      fifths: 4,
      mode: 'major',
    });
  });

  it('is left open for a piece that changes its signature, and is C or A minor without one', () => {
    const change = '<attributes><key><fifths>3</fifths></key></attributes>';
    expect(key(sheet([noteXml({ pitch: 'C4' }), change + noteXml({ pitch: 'A3' })], 0))).toEqual({
      fifths: 0,
      mode: null,
    });
    const bare = sheet([noteXml({ pitch: 'A3' })]).replace('<key><fifths>0</fifths></key>', '');
    expect(key(bare)).toEqual({ fifths: 0, mode: 'minor' });
  });
});
