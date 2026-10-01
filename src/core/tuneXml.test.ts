// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseMusicXml } from './musicxml.ts';
import { TUNE_IDS } from './tuneList.ts';
import { getTune, tuneKeys, tuneSpan, TUNE_TRANSPOSITIONS } from './tunes.ts';
import { tuneHands, tuneInk, tunePhraseXml, type WrongKey } from './tuneXml.ts';

const parse = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');
const read = (xml: string) => parseMusicXml(parse(xml), { hands: tuneHands() });

const text = (el: Element, tag: string) => el.querySelector(tag)?.textContent ?? null;
const measuresOf = (xml: string) => [...parse(xml).querySelectorAll('measure')];
const notesOf = (el: Element | Document) => [...el.querySelectorAll('note')];
/** `F#4`, `Bb4`, `r` for a rest; a note of a chord after a `+`. */
function nameOf(note: Element): string {
  if (note.querySelector('rest')) return 'r';
  const alter = Number(text(note, 'alter') ?? 0);
  const sign = alter === 1 ? '#' : alter === -1 ? 'b' : alter === 0 ? '' : `(${alter})`;
  const chord = note.querySelector('chord') ? '+' : '';
  return `${chord}${text(note, 'step')}${sign}${text(note, 'octave')}`;
}
const beamsOf = (note: Element) => [...note.querySelectorAll('beam')].map((b) => b.textContent);

describe('a phrase of a tune as MusicXML', () => {
  it('is one treble staff with the key, the meter and the phrase in its values', () => {
    const twinkle = getTune('trad-twinkle-twinkle');
    const xml = tunePhraseXml(twinkle, 0, 0);
    const doc = parse(xml);
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(text(doc.documentElement, 'fifths')).toBe('1');
    expect(text(doc.documentElement, 'mode')).toBe('major');
    expect([text(doc.documentElement, 'beats'), text(doc.documentElement, 'beat-type')]).toEqual([
      '2',
      '4',
    ]);
    expect(text(doc.documentElement, 'clef > sign')).toBe('G');
    // The signatures stand in the first bar only.
    expect(doc.querySelectorAll('attributes')).toHaveLength(1);
    const measures = measuresOf(xml);
    expect(measures.map((m) => notesOf(m).map(nameOf).join(' '))).toEqual([
      'G4 G4',
      'D5 D5',
      'E5 E5',
      'D5',
    ]);
    expect(measures.map((m) => m.getAttribute('implicit'))).toEqual([null, null, null, null]);
    expect(notesOf(doc).map((n) => text(n, 'type'))).toEqual([
      'quarter',
      'quarter',
      'quarter',
      'quarter',
      'quarter',
      'quarter',
      'half',
    ]);
    // Nothing of G major needs a sign, and quarters have no beams.
    expect(doc.querySelectorAll('accidental, beam')).toHaveLength(0);
    expect(() => tunePhraseXml(twinkle, 6, 0)).toThrow(RangeError);
  });

  it('writes an upbeat and a last bar cut short as short bars', () => {
    // Amazing Grace's first line: a quarter's upbeat, three bars, and a half note of the fourth.
    const grace = getTune('trad-amazing-grace');
    const measures = measuresOf(tunePhraseXml(grace, 0, 0));
    expect(measures.map((m) => notesOf(m).map(nameOf).join(' '))).toEqual([
      'D4',
      'G4 B4 G4',
      'B4 A4',
      'G4 E4',
      'D4',
    ]);
    expect(measures.map((m) => m.getAttribute('implicit'))).toEqual([
      'yes',
      null,
      null,
      null,
      'yes',
    ]);
    // "-zing": two eighths under one beam.
    expect(notesOf(measures[1]!).map(beamsOf)).toEqual([[], ['begin'], ['end']]);
    // The second line starts on the upbeat the first line's last bar left.
    expect(notesOf(measuresOf(tunePhraseXml(grace, 1, 0))[0]!).map(nameOf)).toEqual(['D4']);
  });

  it('keeps a rest within the phrase, and leaves out the one after its last note', () => {
    // Frère Jacques' "Ding, dang, dong": F C F, a quarter's rest, F C F (and a rest not drawn).
    const frere = getTune('trad-frere-jacques');
    const measures = measuresOf(tunePhraseXml(frere, 3, 0));
    expect(measures.map((m) => notesOf(m).map(nameOf).join(' '))).toEqual([
      'F4 C4',
      'F4 r',
      'F4 C4',
      'F4',
    ]);
    expect(measures.at(-1)!.getAttribute('implicit')).toBe('yes');
  });

  it('ties what the tune ties, and beams by the beat: a dotted quarter in 6/8', () => {
    const row = getTune('lyte-row-your-boat');
    // "Gently down the stream": a quarter and an eighth to each beat, then two bars' halves tied.
    const stream = notesOf(parse(tunePhraseXml(row, 1, 0)));
    expect(stream.map(nameOf)).toEqual(['F#4', 'F#4', 'F#4', 'G4', 'A4', 'A4']);
    expect(stream.map((n) => text(n, 'type'))).toEqual([
      'quarter',
      'eighth',
      'quarter',
      'eighth',
      'quarter',
      'quarter',
    ]);
    expect(stream.slice(4).map((n) => n.querySelectorAll('dot').length)).toEqual([1, 1]);
    expect(
      stream.map((n) => [...n.querySelectorAll('tie')].map((t) => t.getAttribute('type'))),
    ).toEqual([[], [], [], [], ['start'], ['stop']]);
    expect(
      stream.map((n) => [...n.querySelectorAll('tied')].map((t) => t.getAttribute('type'))),
    ).toEqual([[], [], [], [], ['start'], ['stop']]);
    // An eighth alone in its beat has no beam.
    expect(stream.flatMap(beamsOf)).toEqual([]);
    // "Merrily, merrily": six eighths to the bar, three to a beam.
    const merrily = notesOf(measuresOf(tunePhraseXml(row, 2, 0))[0]!);
    expect(merrily.map(beamsOf)).toEqual([
      ['begin'],
      ['continue'],
      ['end'],
      ['begin'],
      ['continue'],
      ['end'],
    ]);
  });

  it('gives a sixteenth beside a dotted eighth its hook', () => {
    const auld = getTune('trad-auld-lang-syne');
    // "Should auld acquaintance": a dotted eighth and a sixteenth, then two eighths.
    const [, first] = measuresOf(tunePhraseXml(auld, 0, 0));
    expect(notesOf(first!).map(nameOf)).toEqual(['G4', 'G4', 'G4', 'B4']);
    expect(notesOf(first!).map(beamsOf)).toEqual([
      ['begin'],
      ['end', 'backward hook'],
      ['begin'],
      ['end'],
    ]);
    // "and never": the sixteenth first.
    const [, second] = measuresOf(tunePhraseXml(auld, 1, 0));
    expect(notesOf(second!).slice(0, 2).map(beamsOf)).toEqual([['begin', 'forward hook'], ['end']]);
    // Jingle Bells: two sixteenths at the end of a beat share the second beam.
    const fun = notesOf(measuresOf(tunePhraseXml(getTune('pierpont-jingle-bells'), 5, 0))[0]!);
    expect(fun.slice(-3).map(beamsOf)).toEqual([['begin'], ['continue', 'begin'], ['end', 'end']]);
  });

  it('is written in the key it was played in', () => {
    const grace = getTune('trad-amazing-grace');
    // Two semitones up, A major: C sharp is the signature's, so no sign is printed.
    const inA = parse(tunePhraseXml(grace, 1, 2));
    expect(text(inA.documentElement, 'fifths')).toBe('3');
    expect(notesOf(inA).map(nameOf)).toEqual(['E4', 'A4', 'C#5', 'A4', 'C#5', 'B4', 'E5']);
    expect(inA.querySelectorAll('accidental')).toHaveLength(0);
    // Six up or six down: D flat major, never C sharp.
    const up = parse(tunePhraseXml(grace, 1, 6));
    expect(text(up.documentElement, 'fifths')).toBe('-5');
    expect(notesOf(up).map(nameOf)).toEqual(['Ab4', 'Db5', 'F5', 'Db5', 'F5', 'Eb5', 'Ab5']);
    expect(notesOf(parse(tunePhraseXml(grace, 1, -6))).map(nameOf)).toEqual([
      'Ab3',
      'Db4',
      'F4',
      'Db4',
      'F4',
      'Eb4',
      'Ab4',
    ]);
  });

  it.each(TUNE_IDS)('%s: every phrase in every key reads back as the keys asked', (id) => {
    const tune = getTune(id);
    for (const semitones of [0, ...TUNE_TRANSPOSITIONS]) {
      tune.phrases.forEach((_, phrase) => {
        const score = read(tunePhraseXml(tune, phrase, semitones));
        const struck = score.notes.filter((n) => !n.tieStop);
        expect(struck.map((n) => n.midi)).toEqual(tuneKeys(tune, phrase + 1, semitones));
        // In its own rhythm: each key as far from the phrase's first as it is in the tune.
        const { from } = tuneSpan(tune, phrase + 1);
        const start = tune.notes[from]!.onset;
        expect(struck.map((n) => n.onset)).toEqual(
          tune.notes.slice(from, from + struck.length).map((n) => n.onset - start),
        );
      });
    }
  });
});

describe('the key played wrong', () => {
  const row = getTune('lyte-row-your-boat');
  // "Row, row, row your boat": D D D E F♯, the keys 0–4 of the tune.
  const drawn = (wrong: WrongKey, phrase = 0, semitones = 0, tune = row) =>
    notesOf(parse(tunePhraseXml(tune, phrase, semitones, wrong)));

  it('stands with the note it was played for, as a chord', () => {
    const notes = drawn({ key: 3, midi: 67 });
    expect(notes.map(nameOf)).toEqual(['D4', 'D4', 'D4', 'E4', '+G4', 'F#4']);
    // The same value as the note asked, and no sign: G is a note of D major.
    expect(text(notes[4]!, 'type')).toBe(text(notes[3]!, 'type'));
    expect(text(notes[4]!, 'duration')).toBe(text(notes[3]!, 'duration'));
    expect(notes[4]!.querySelector('accidental')).toBeNull();
  });

  it('gets its own sign when it is not the key’s note', () => {
    // F natural for F sharp, on the same line: both get their sign, or one could not tell them.
    const clash = drawn({ key: 4, midi: 65 });
    expect(clash.map(nameOf)).toEqual(['D4', 'D4', 'D4', 'E4', 'F#4', '+F4']);
    expect(text(clash[4]!, 'accidental')).toBe('sharp');
    expect(text(clash[5]!, 'accidental')).toBe('natural');
    // E flat for E: a black key, written with its sign.
    const flat = drawn({ key: 3, midi: 63 });
    expect(['+Eb4', '+D#4']).toContain(nameOf(flat[4]!));
    expect(flat[4]!.querySelector('accidental')).not.toBeNull();
    // A semitone down, in D flat major: G for the F asked is not the key's G flat.
    const inDb = drawn({ key: 4, midi: 67 }, 0, -1);
    expect(inDb.slice(4).map(nameOf)).toEqual(['F4', '+G4']);
    expect(text(inDb[5]!, 'accidental')).toBe('natural');
  });

  it('is written once, with the first of two tied notes', () => {
    // "stream": the A of keys 9, two dotted quarters tied.
    const notes = drawn({ key: 9, midi: 71 }, 1);
    expect(notes.map(nameOf)).toEqual(['F#4', 'F#4', 'F#4', 'G4', 'A4', '+B4', 'A4']);
    expect(notes[5]!.querySelector('tie, tied')).toBeNull();
  });

  it('of another phrase is not drawn', () => {
    expect(drawn({ key: 20, midi: 60 }).map(nameOf)).toEqual(['D4', 'D4', 'D4', 'E4', 'F#4']);
  });

  it('is inked red, the keys played right before it green, nothing after it', () => {
    const wrong = { key: 3, midi: 67 };
    const score = read(tunePhraseXml(row, 0, 0, wrong));
    const ink = tuneInk(score, row, 0, 0, wrong);
    expect(score.notes.map((n) => [n.midi, ink.get(n.id) ?? null])).toEqual([
      [62, 'is-pressed'],
      [62, 'is-pressed'],
      [62, 'is-pressed'],
      [64, null],
      [67, 'is-missed'],
      [66, null],
    ]);
  });

  it('is inked in the phrase of the whole tune it went wrong in, and in its key', () => {
    // The third phrase, three semitones up, at its fifth key (key 14 of the tune: A for D).
    const wrong = { key: 14, midi: 72 + 3 };
    const score = read(tunePhraseXml(row, 2, 3, wrong));
    const ink = tuneInk(score, row, 2, 3, wrong);
    const inked = score.notes.map((n) => ink.get(n.id) ?? null);
    expect(inked.slice(0, 4)).toEqual(Array(4).fill('is-pressed'));
    expect(inked.filter((mark) => mark === 'is-missed')).toHaveLength(1);
    expect(score.notes[inked.indexOf('is-missed')]!.midi).toBe(75);
    expect(inked.filter((mark) => mark === null)).toHaveLength(score.notes.length - 5);
  });

  it('inks neither note of a tied key that was not reached, or that went wrong', () => {
    // "Gently down the stream": the G goes wrong, the tied A after it is not inked.
    const early = { key: 8, midi: 68 };
    const score = read(tunePhraseXml(row, 1, 0, early));
    const ink = tuneInk(score, row, 1, 0, early);
    expect(score.notes.map((n) => [n.midi, ink.get(n.id) ?? null])).toEqual([
      [66, 'is-pressed'],
      [66, 'is-pressed'],
      [66, 'is-pressed'],
      [67, null],
      [68, 'is-missed'],
      [69, null],
      [69, null],
    ]);
    // The A itself goes wrong: the key played is red once, with the first of the tied notes.
    const late = { key: 9, midi: 71 };
    const tied = read(tunePhraseXml(row, 1, 0, late));
    const marks = tuneInk(tied, row, 1, 0, late);
    expect(tied.notes.map((n) => [n.midi, marks.get(n.id) ?? null]).slice(3)).toEqual([
      [67, 'is-pressed'],
      [69, null],
      [71, 'is-missed'],
      [69, null],
    ]);
  });
});
