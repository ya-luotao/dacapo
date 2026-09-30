import { describe, expect, it } from 'vitest';
import { midiOf } from './musicxml.ts';
import { ledgerLineCount } from './note.ts';
import { seededRng } from './random.ts';
import type { SpelledPitch } from './score.ts';
import {
  chordAnswerName,
  chordCandidates,
  chordRoots,
  diatonic,
  getTheoryLevel,
  INTERVAL_NAMES,
  intervalAbove,
  intervalAnswerName,
  intervalBetween,
  intervalCandidates,
  isChordAnswer,
  isIntervalAnswer,
  isTonicKey,
  judgeWrittenChord,
  KEY_SIGNATURE_LEVELS,
  makeTheoryPrompt,
  nextTheoryLevel,
  parseChordName,
  parseIntervalName,
  parseSignature,
  parseSpelled,
  parseTheoryItem,
  positionOn,
  promptFits,
  READ_CHORD_LEVELS,
  READ_INTERVAL_LEVELS,
  rootOf,
  signatureAccidentals,
  signatureId,
  spellChord,
  spelledId,
  THEORY_LEVELS,
  theoryLevelItems,
  type ReadChordQuality,
} from './theoryItems.ts';

const p = (text: string): SpelledPitch => parseSpelled(text)!;
const ids = (pitches: readonly SpelledPitch[]) => pitches.map(spelledId).join(' ');

describe('spelled pitches', () => {
  it('reads and writes double sharps and flats', () => {
    for (const text of ['C4', 'D#4', 'Ebb5', 'F##3', 'Bb0', 'B#3', 'Cb4']) {
      expect(spelledId(p(text))).toBe(text);
    }
    expect(p('F##3')).toEqual({ step: 'F', alter: 2, octave: 3 });
    expect(midiOf(p('B#3'))).toBe(60);
    expect(midiOf(p('Cb4'))).toBe(59);
    for (const bad of ['H4', 'C###4', 'C', 'c4', 'Cb-1', 'C10', '', 4, null]) {
      expect(parseSpelled(bad)).toBeNull();
    }
  });
});

describe('intervals', () => {
  it('names an interval by its letters, then its quality', () => {
    expect(intervalBetween(p('C4'), p('D#4'))).toBe('A2');
    expect(intervalBetween(p('C4'), p('Eb4'))).toBe('m3');
    expect(intervalBetween(p('B3'), p('F4'))).toBe('d5');
    expect(intervalBetween(p('F4'), p('B4'))).toBe('A4');
    expect(intervalBetween(p('E4'), p('Fb4'))).toBe('d2');
    expect(intervalBetween(p('C#4'), p('Bb4'))).toBe('d7');
    expect(intervalBetween(p('C4'), p('C5'))).toBe('P8');
    expect(intervalBetween(p('D4'), p('F##4'))).toBe('A3');
    expect(intervalBetween(p('Db4'), p('F#4'))).toBe('A3');
    // Either order: from the lower letter.
    expect(intervalBetween(p('Eb4'), p('C4'))).toBe('m3');
    // A unison, past the octave, and doubly augmented are not named here.
    expect(intervalBetween(p('C4'), p('C#4'))).toBeNull();
    expect(intervalBetween(p('C4'), p('D5'))).toBeNull();
    expect(intervalBetween(p('Cb4'), p('D#4'))).toBeNull();
    expect(intervalBetween(p('C4'), p('Cb5'))).toBeNull();
  });

  it('spells the note above by letters, then quality', () => {
    for (const name of INTERVAL_NAMES) {
      for (const lower of ['C4', 'F#3', 'Bb4', 'E##2', 'Abb5']) {
        const upper = intervalAbove(p(lower), parseIntervalName(name)!);
        if (Math.abs(upper.alter) > 2) continue;
        expect(intervalBetween(p(lower), upper), `${name} above ${lower}`).toBe(name);
      }
    }
    expect(spelledId(intervalAbove(p('C4'), parseIntervalName('A2')!))).toBe('D#4');
    expect(spelledId(intervalAbove(p('D#4'), parseIntervalName('M3')!))).toBe('F##4');
    expect(spelledId(intervalAbove(p('E4'), parseIntervalName('d2')!))).toBe('Fb4');
  });

  it('names the qualities each number can have', () => {
    expect(INTERVAL_NAMES).toEqual(
      ['d2', 'm2', 'M2', 'A2', 'd3', 'm3', 'M3', 'A3', 'd4', 'P4', 'A4', 'd5', 'P5', 'A5'].concat([
        'd6',
        'm6',
        'M6',
        'A6',
        'd7',
        'm7',
        'M7',
        'A7',
        'P8',
      ]),
    );
    expect(parseIntervalName('P3')).toBeNull();
    expect(parseIntervalName('M5')).toBeNull();
    expect(parseIntervalName('A8')).toBeNull();
  });

  it('has natural intervals in RI1–RI2, every quality in RI3–RI4', () => {
    const [ri1, ri2, ri3, ri4] = READ_INTERVAL_LEVELS;
    const natural = ['m2', 'M2', 'm3', 'M3', 'P4', 'A4', 'd5', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'];
    expect(ri1!.names).toEqual(natural);
    expect(ri2!.names).toEqual(natural);
    expect(ri3!.names).toEqual(INTERVAL_NAMES);
    expect(ri4!.names).toEqual(INTERVAL_NAMES);
    expect(theoryLevelItems(ri2!)).toHaveLength(13 * 3);
    expect(theoryLevelItems(ri2!)).toContain('ri:d5:harm');
  });

  // The discriminating check: a pool must never be empty on any staff of its level.
  it.each(READ_INTERVAL_LEVELS.map((l) => [l.id, l] as const))(
    '%s writes every interval on every staff of the level, within its signs and ledger lines',
    (_, level) => {
      for (const name of level.names) {
        for (const clef of level.clefs) {
          const pairs = intervalCandidates(level, parseIntervalName(name)!, clef);
          expect(pairs.length, `${name} on ${clef}`).toBeGreaterThan(0);
          for (const [lower, upper] of pairs) {
            expect(intervalBetween(lower, upper)).toBe(name);
            expect(diatonic(upper)).toBeGreaterThan(diatonic(lower));
            for (const note of [lower, upper]) {
              expect(Math.abs(note.alter)).toBeLessThanOrEqual(level.maxAlter);
              expect(ledgerLineCount(positionOn(note, clef))).toBeLessThanOrEqual(level.maxLedger);
            }
          }
        }
      }
    },
  );

  it('uses double sharps and flats and two ledger lines only in RI4', () => {
    const ri4 = getTheoryLevel('RI4');
    if (ri4.family !== 'readInterval') throw new Error('RI4');
    const all = ri4.clefs.flatMap((clef) =>
      ri4.names.flatMap((name) => intervalCandidates(ri4, parseIntervalName(name)!, clef)),
    );
    expect(all.some(([l, u]) => Math.abs(l.alter) === 2 || Math.abs(u.alter) === 2)).toBe(true);
    const ri3 = getTheoryLevel('RI3');
    if (ri3.family !== 'readInterval') throw new Error('RI3');
    const rng = seededRng(3);
    for (let i = 0; i < 300; i++) {
      const items = theoryLevelItems(ri3);
      const prompt = makeTheoryPrompt(ri3, items[i % items.length]!, rng);
      if (prompt.family !== 'readInterval') throw new Error('interval');
      expect(prompt.notes.every((n) => Math.abs(n.alter) <= 1)).toBe(true);
    }
  });

  it('draws melodic intervals in the order played and harmonic ones low to high', () => {
    const level = getTheoryLevel('RI3');
    const rng = seededRng(11);
    for (let i = 0; i < 200; i++) {
      for (const direction of ['up', 'down', 'harm'] as const) {
        const item = `ri:A2:${direction}`;
        const prompt = makeTheoryPrompt(level, item, rng);
        if (prompt.family !== 'readInterval') throw new Error('interval');
        const [first, second] = prompt.notes as [SpelledPitch, SpelledPitch];
        expect(intervalBetween(first, second)).toBe('A2');
        expect(diatonic(second) > diatonic(first)).toBe(direction !== 'down');
        expect(promptFits(level, item, prompt.notes, prompt.clef)).toBe(true);
        // The same notes written the other way round are another item's card.
        expect(promptFits(level, item, [second, first], prompt.clef)).toBe(false);
      }
    }
  });

  it('draws each staff of a level about as often', () => {
    const level = getTheoryLevel('RI2');
    const rng = seededRng(5);
    let bass = 0;
    for (let i = 0; i < 1000; i++) {
      const prompt = makeTheoryPrompt(level, 'ri:M3:up', rng);
      if (prompt.family === 'readInterval' && prompt.clef === 'bass') bass++;
    }
    expect(bass).toBeGreaterThan(420);
    expect(bass).toBeLessThan(580);
  });

  it('answers RI1 by the number and the other levels by the name', () => {
    const ri1 = READ_INTERVAL_LEVELS[0]!;
    const ri2 = READ_INTERVAL_LEVELS[1]!;
    expect(intervalAnswerName(ri1, 'ri:m3:up')).toBe('3');
    expect(intervalAnswerName(ri2, 'ri:m3:up')).toBe('m3');
    expect(isIntervalAnswer(ri1, '8')).toBe(true);
    expect(isIntervalAnswer(ri1, '1')).toBe(false);
    expect(isIntervalAnswer(ri1, 'm3')).toBe(false);
    expect(isIntervalAnswer(ri2, 'd2')).toBe(true);
    expect(isIntervalAnswer(ri2, 'P3')).toBe(false);
    expect(isIntervalAnswer(ri2, '3')).toBe(false);
  });
});

describe('key signatures', () => {
  it('has majors up to two, four and seven signs, then the minors', () => {
    const counts = KEY_SIGNATURE_LEVELS.map((l) => theoryLevelItems(l).length);
    expect(counts).toEqual([5, 9, 15, 9, 15]);
    expect(theoryLevelItems(KEY_SIGNATURE_LEVELS[0]!)).toEqual([
      'ks:2f:major',
      'ks:1f:major',
      'ks:0:major',
      'ks:1s:major',
      'ks:2s:major',
    ]);
    expect(theoryLevelItems(KEY_SIGNATURE_LEVELS[4]!)).toContain('ks:7s:minor');
  });

  it('writes signatures as 0, 3s, 4f', () => {
    for (let f = -7; f <= 7; f++) expect(parseSignature(signatureId(f))).toBe(f);
    expect(signatureId(-3)).toBe('3f');
    expect(parseSignature('8s')).toBeNull();
    expect(parseSignature('0s')).toBeNull();
    expect(parseTheoryItem('ks:3f:minor')).toEqual({
      family: 'keySignature',
      fifths: -3,
      mode: 'minor',
    });
  });

  it('takes the tonic in any octave, by its sound', () => {
    // E♭ major: any E♭.
    expect(isTonicKey(-3, 'major', 63)).toBe(true);
    expect(isTonicKey(-3, 'major', 39)).toBe(true);
    expect(isTonicKey(-3, 'major', 60)).toBe(false);
    // C minor, its relative.
    expect(isTonicKey(-3, 'minor', 48)).toBe(true);
    // C♭ major sounds as B; A♯ minor as B♭.
    expect(isTonicKey(-7, 'major', 71)).toBe(true);
    expect(isTonicKey(7, 'minor', 70)).toBe(true);
  });

  it('lists the signs in the order they are written', () => {
    const names = (f: number) => signatureAccidentals(f).map((r) => `${r.step}${r.alter}`);
    expect(names(3)).toEqual(['F1', 'C1', 'G1']);
    expect(names(-4)).toEqual(['B-1', 'E-1', 'A-1', 'D-1']);
    expect(names(0)).toEqual([]);
  });
});

describe('chords', () => {
  it('spells chords in thirds, the inversions moving the lower tones up', () => {
    expect(ids(spellChord({ step: 'F', alter: 1 }, 3, 'min', 'root'))).toBe('F#3 A3 C#4');
    expect(ids(spellChord({ step: 'F', alter: 1 }, 3, 'min', '1st'))).toBe('A3 C#4 F#4');
    expect(ids(spellChord({ step: 'F', alter: 1 }, 3, 'min', '2nd'))).toBe('C#4 F#4 A4');
    expect(ids(spellChord({ step: 'B', alter: 0 }, 4, 'dim', 'root'))).toBe('B4 D5 F5');
    expect(ids(spellChord({ step: 'D', alter: -1 }, 4, 'hdim7', 'root'))).toBe('Db4 Fb4 Abb4 Cb5');
    expect(ids(spellChord({ step: 'G', alter: 0 }, 3, 'dom7', 'root'))).toBe('G3 B3 D4 F4');
  });

  it('writes RC1 on the triads of C major, the others on roots without a double sign', () => {
    const rc1 = READ_CHORD_LEVELS[0]!;
    expect(chordRoots(rc1, 'maj').map((r) => r.step)).toEqual(['C', 'F', 'G']);
    expect(chordRoots(rc1, 'min').map((r) => r.step)).toEqual(['D', 'E', 'A']);
    expect(chordRoots(rc1, 'dim').map((r) => r.step)).toEqual(['B']);
    const rc2 = READ_CHORD_LEVELS[1]!;
    const roots = (q: ReadChordQuality) =>
      chordRoots(rc2, q)
        .map((r) => spelledId({ ...r, octave: 4 }).slice(0, -1))
        .sort();
    expect(roots('maj')).toContain('C#');
    expect(roots('maj')).toContain('Cb');
    expect(roots('maj')).not.toContain('D#');
    expect(roots('min')).toContain('A#');
    expect(roots('min')).not.toContain('Cb');
    for (const quality of ['maj', 'min', 'dom7', 'maj7', 'min7', 'hdim7'] as const) {
      for (const root of chordRoots(rc2, quality)) {
        expect(spellChord(root, 4, quality, 'root').every((n) => Math.abs(n.alter) <= 1)).toBe(
          true,
        );
      }
    }
  });

  it.each(READ_CHORD_LEVELS.map((l) => [l.id, l] as const))(
    '%s writes every chord on every staff of the level within a ledger line',
    (_, level) => {
      for (const { quality, inversion } of level.chords) {
        for (const clef of level.clefs) {
          const found = chordCandidates(level, quality, inversion, clef);
          expect(found.length, `${quality} ${inversion} on ${clef}`).toBeGreaterThan(0);
          for (const { root, notes } of found) {
            expect(rootOf(`rc:${quality}:${inversion}`, notes)).toEqual(root);
            for (const note of notes) {
              expect(ledgerLineCount(positionOn(note, clef))).toBeLessThanOrEqual(1);
            }
          }
        }
      }
    },
  );

  it('has the levels of the draft', () => {
    const names = (id: string) =>
      theoryLevelItems(getTheoryLevel(id as 'RC1')).map((item) => item.slice(3));
    expect(names('RC1')).toEqual(['maj:root', 'min:root', 'dim:root']);
    expect(names('RC2')).toEqual(['maj:root', 'min:root']);
    expect(names('RC3')).toEqual([
      'maj:root',
      'min:root',
      'maj:1st',
      'min:1st',
      'maj:2nd',
      'min:2nd',
    ]);
    expect(names('RC4')).toEqual(['dom7:root', 'maj7:root', 'min7:root', 'hdim7:root']);
    expect(names('RC5')).toHaveLength(10);
  });

  it('judges a played chord by its written keys, octave included', () => {
    const notes = spellChord({ step: 'C', alter: 0 }, 4, 'maj', 'root');
    expect(judgeWrittenChord(notes, [60, 64])).toBe('pending');
    expect(judgeWrittenChord(notes, [60, 64, 67])).toBe('right');
    expect(judgeWrittenChord(notes, [60, 64, 79])).toBe('wrong');
    expect(judgeWrittenChord(notes, [48])).toBe('wrong');
  });

  it('names a chord by its root as written, its quality and position', () => {
    const rc3 = READ_CHORD_LEVELS[2]!;
    const name = chordAnswerName({ step: 'F', alter: 1 }, 'min', '1st');
    expect(name).toBe('F#:min:1st');
    expect(parseChordName(name)).toEqual({
      root: { step: 'F', alter: 1 },
      quality: 'min',
      inversion: '1st',
    });
    expect(isChordAnswer(rc3, name)).toBe(true);
    expect(isChordAnswer(rc3, 'F#:dom7:root')).toBe(false);
    expect(parseChordName('F##:min:root')).toBeNull();
    expect(parseChordName('F#:aug:root')).toBeNull();
  });

  it('checks a stored chord card against its level', () => {
    const rc1 = getTheoryLevel('RC1');
    const c = spellChord({ step: 'C', alter: 0 }, 4, 'maj', 'root');
    expect(promptFits(rc1, 'rc:maj:root', c, 'treble')).toBe(true);
    expect(promptFits(rc1, 'rc:maj:root', c, 'bass')).toBe(false);
    const d = spellChord({ step: 'D', alter: 0 }, 4, 'maj', 'root');
    expect(promptFits(rc1, 'rc:maj:root', d, 'treble')).toBe(false);
    expect(promptFits(getTheoryLevel('RC2'), 'rc:maj:root', d, 'treble')).toBe(true);
  });
});

describe('levels', () => {
  it('has four interval levels, five of key signatures and five of chords', () => {
    expect(THEORY_LEVELS.map((l) => l.id)).toEqual([
      'RI1',
      'RI2',
      'RI3',
      'RI4',
      'KS1',
      'KS2',
      'KS3',
      'KS4',
      'KS5',
      'RC1',
      'RC2',
      'RC3',
      'RC4',
      'RC5',
    ]);
    expect(nextTheoryLevel('RI3')).toBe('RI4');
    expect(nextTheoryLevel('RI4')).toBeNull();
    expect(nextTheoryLevel('KS5')).toBeNull();
  });

  it('parses only the keys it writes', () => {
    for (const level of THEORY_LEVELS) {
      for (const item of theoryLevelItems(level))
        expect(parseTheoryItem(item), item).not.toBeNull();
    }
    for (const bad of ['ri:P3:up', 'ri:M3:sideways', 'ks:8s:major', 'rc:aug:root', 'rc:dom7:3rd']) {
      expect(parseTheoryItem(bad)).toBeNull();
    }
  });

  it('draws every item of every level (600 seeds)', () => {
    for (const level of THEORY_LEVELS) {
      const items = theoryLevelItems(level);
      for (let seed = 0; seed < 600; seed++) {
        const item = items[seed % items.length]!;
        const prompt = makeTheoryPrompt(level, item, seededRng(seed));
        expect(prompt.item).toBe(item);
        if (prompt.family !== 'keySignature') {
          expect(promptFits(level, item, prompt.notes, prompt.clef), `${level.id} ${item}`).toBe(
            true,
          );
        }
      }
    }
    expect(() => makeTheoryPrompt(getTheoryLevel('RI1'), 'ri:A2:up', seededRng(1))).toThrow();
  });
});
