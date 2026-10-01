import { describe, expect, it } from 'vitest';
import { midiName } from './note.ts';
import { seededRng } from './random.ts';
import { TICKS_PER_QUARTER } from './score.ts';
import { TUNE_IDS, TUNE_PHRASES, tuneItem, tuneItems } from './tuneList.ts';
import {
  barTicks,
  beatTicks,
  drawTransposition,
  getTune,
  promptPhrase,
  tuneChord,
  tuneFifths,
  tuneFits,
  tuneKey,
  tuneKeys,
  tunePitch,
  tunePrompt,
  tuneSemitones,
  TUNE_TRANSPOSITIONS,
} from './tunes.ts';

const Q = TICKS_PER_QUARTER;
const names = (keys: readonly number[]) => keys.map((m) => midiName(m).replace('♯', '#')).join(' ');

describe('the tunes', () => {
  it('are read from the table: keys, bars and phrases', () => {
    const twinkle = getTune('trad-twinkle-twinkle');
    expect(twinkle).toMatchObject({ fifths: 1, beats: 2, beatType: 4, bpm: 96 });
    expect(twinkle.notes).toHaveLength(42);
    expect(twinkle.bars).toHaveLength(24);
    expect(twinkle.phrases).toHaveLength(6);
    expect(names(tuneKeys(twinkle, 1, 0))).toBe('G4 G4 D5 D5 E5 E5 D5');
    // The last note of a line is a half note: two quarters after six.
    expect(twinkle.notes[6]).toMatchObject({ onset: 6 * Q, duration: 2 * Q });
    expect(twinkle.notes[7]!.onset).toBe(8 * Q);
  });

  it.each(TUNE_IDS)(
    '%s: every phrase begins on a note and the phrases are the whole tune',
    (id) => {
      const tune = getTune(id);
      expect(tune.phrases).toHaveLength(TUNE_PHRASES[id]);
      expect(tune.phrases[0]!.from).toBe(0);
      expect(tune.phrases.at(-1)!.to).toBe(tune.notes.length);
      tune.phrases.forEach((phrase, i) => {
        expect(phrase.to).toBeGreaterThan(phrase.from);
        if (i > 0) expect(phrase.from).toBe(tune.phrases[i - 1]!.to);
        // A phrase is short enough to keep in the ear: up to fifteen keys.
        expect(phrase.to - phrase.from).toBeGreaterThanOrEqual(5);
        expect(phrase.to - phrase.from).toBeLessThanOrEqual(15);
      });
      // The keys follow each other, none before the last has begun.
      tune.notes.forEach((note, i) => {
        if (i > 0) expect(note.onset).toBeGreaterThan(tune.notes[i - 1]!.onset);
      });
      // Its bars are full, but for an upbeat and what completes one.
      const full = barTicks(tune);
      for (const bar of tune.bars) {
        expect(bar.duration).toBeLessThanOrEqual(full);
        expect(bar.offset + bar.duration).toBeLessThanOrEqual(full);
      }
    },
  );

  it('start a phrase on its upbeat: Amazing Grace’s lines of four and three bars', () => {
    const grace = getTune('trad-amazing-grace');
    expect(grace.phrases.map((p) => p.to - p.from)).toEqual([9, 7, 12, 7]);
    expect(names(tuneKeys(grace, 2, 0))).toBe('D4 G4 B4 G4 B4 A4 D5');
    expect(names(tuneKeys(grace, 3, 0))).toBe('B4 D5 B4 D5 B4 G4 D4 E4 G4 G4 E4 D4');
    // The upbeat bar ends on the barline: a quarter, on the third beat of 3/4.
    expect(grace.bars[0]).toEqual({ start: 0, duration: Q, offset: 2 * Q });
    // The last bar completes it, and starts on its 1.
    expect(grace.bars.at(-1)).toMatchObject({ duration: 2 * Q, offset: 0 });
    // Each line begins a quarter before a barline.
    const starts = grace.phrases.map((p) => grace.notes[p.from]!.onset);
    expect(starts.map((tick) => (tick % (3 * Q)) / Q)).toEqual([0, 0, 0, 0]);
  });

  it('join tied notes into one key', () => {
    const row = getTune('lyte-row-your-boat');
    // "Gently down the stream": the last note is two dotted quarters tied.
    expect(names(tuneKeys(row, 2, 0))).toBe('F#4 F#4 F#4 G4 A4');
    const stream = row.notes[row.phrases[1]!.to - 1]!;
    expect(stream.duration).toBe(3 * Q);
    expect(row.marks.filter((m) => m.tieStop)).toHaveLength(2);
    expect(row.notes).toHaveLength(27);
    expect(beatTicks(row)).toBe(1.5 * Q);
    expect(beatTicks(getTune('trad-amazing-grace'))).toBe(Q);
  });

  it('sing a repeated section twice, a divided bar in two parts', () => {
    const auld = getTune('trad-auld-lang-syne');
    // The verse's last bar is cut short by the chorus's upbeat, in a bar of its own.
    expect(auld.bars[8]).toMatchObject({ duration: 1.5 * Q, offset: 0 });
    expect(auld.bars[9]).toMatchObject({ duration: 0.5 * Q, offset: 1.5 * Q });
    // The chorus comes twice: its four phrases again.
    expect(tuneKeys(auld, 9, 0)).toEqual(tuneKeys(auld, 5, 0));
    expect(tuneKeys(auld, 12, 0)).toEqual(tuneKeys(auld, 8, 0));
    expect(names(tuneKeys(auld, 6, 0))).toBe('B4 D5 B4 B4 D5 E5');
    const susanna = getTune('foster-oh-susanna');
    expect(susanna.notes).toHaveLength(110);
    expect(tuneKeys(susanna, 7, 0)).toEqual(tuneKeys(susanna, 5, 0));
  });
});

describe('a tune in another key', () => {
  const grace = getTune('trad-amazing-grace');

  it('is moved by one to six semitones up or down, never by none', () => {
    expect(TUNE_TRANSPOSITIONS).toEqual([-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6]);
    const rng = seededRng(3);
    const drawn = new Set(Array.from({ length: 400 }, () => drawTransposition(rng)));
    expect([...drawn].sort((a, b) => a - b)).toEqual([...TUNE_TRANSPOSITIONS]);
    expect(drawTransposition(() => 0)).toBe(-6);
    expect(drawTransposition(() => 0.999999)).toBe(6);
  });

  it('is as likely to be in any of the eleven other keys: six up and six down are one', () => {
    // Every lot of the draw, once each.
    const drawn = Array.from({ length: 22 }, (_, lot) => drawTransposition(() => (lot + 0.5) / 22));
    const times = (semitones: number) => drawn.filter((s) => s === semitones).length;
    expect(times(-6)).toBe(1);
    expect(times(6)).toBe(1);
    for (const semitones of [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5]) expect(times(semitones)).toBe(2);
    const keys = new Map<string, number>();
    for (const semitones of drawn) {
      const { tonic } = tuneKey(grace, semitones);
      keys.set(tonic, (keys.get(tonic) ?? 0) + 1);
    }
    expect(keys.size).toBe(11);
    expect([...keys.values()].every((count) => count === 2)).toBe(true);
  });

  it('is named by the simpler signature, as a piece’s key is', () => {
    expect(tuneKey(grace, 0)).toEqual({ tonic: 'G', scale: 'major' });
    expect(tuneKey(grace, 2)).toEqual({ tonic: 'A', scale: 'major' });
    expect(tuneKey(grace, -2)).toEqual({ tonic: 'F', scale: 'major' });
    // Six semitones either way are the same key, an octave apart: D♭, not C♯.
    expect(tuneKey(grace, 6)).toEqual({ tonic: 'Db', scale: 'major' });
    expect(tuneKey(grace, -6)).toEqual({ tonic: 'Db', scale: 'major' });
    expect(tuneFifths(grace, 6)).toBe(-5);
    // Every key a tune can be in is one of the twelve.
    for (const id of TUNE_IDS) {
      const keys = new Set(TUNE_TRANSPOSITIONS.map((s) => tuneKey(getTune(id), s).tonic));
      expect(keys.size).toBe(11);
      expect(keys.has(tuneKey(getTune(id), 0).tonic)).toBe(false);
    }
  });

  it('moves every key, and writes each note in the new key', () => {
    expect(tuneKeys(grace, 2, 2)).toEqual(tuneKeys(grace, 2, 0).map((m) => m + 2));
    // B in G major is C sharp in A major, and D flat's third in D flat major is F.
    expect(tunePitch(grace, { step: 'B', alter: 0, octave: 4 }, 2)).toEqual({
      step: 'C',
      alter: 1,
      octave: 5,
    });
    expect(tunePitch(grace, { step: 'B', alter: 0, octave: 4 }, 6)).toEqual({
      step: 'F',
      alter: 0,
      octave: 5,
    });
    expect(tunePitch(grace, { step: 'B', alter: 0, octave: 4 }, 0)).toEqual({
      step: 'B',
      alter: 0,
      octave: 4,
    });
  });

  it('stays between F♯3 and B5', () => {
    for (const id of TUNE_IDS) {
      const tune = getTune(id);
      for (const semitones of TUNE_TRANSPOSITIONS) {
        const keys = tuneKeys(tune, 'whole', semitones);
        expect(Math.min(...keys)).toBeGreaterThanOrEqual(54);
        expect(Math.max(...keys)).toBeLessThanOrEqual(83);
      }
    }
  });

  it('sets the key with the tonic triad under the tune', () => {
    // Twinkle starts on its tonic, G4; Amazing Grace goes down to D4, so its chord is on G3.
    expect(names(tuneChord(getTune('trad-twinkle-twinkle'), 0))).toBe('G4 B4 D5');
    expect(names(tuneChord(grace, 0))).toBe('G3 B3 D4');
    expect(names(tuneChord(grace, 2))).toBe('A3 C#4 E4');
    expect(names(tuneChord(getTune('trad-frere-jacques'), 0))).toBe('F3 A3 C4');
    for (const id of TUNE_IDS) {
      const tune = getTune(id);
      const [root] = tuneChord(tune, 0) as [number, number, number];
      const lowest = Math.min(...tune.notes.map((n) => n.midi));
      expect(root).toBeLessThanOrEqual(lowest);
      expect(lowest - root).toBeLessThan(12);
    }
  });
});

describe('a tune’s prompt', () => {
  it('is a phrase in its own rhythm, at the tune’s pace', () => {
    const prompt = tunePrompt(tuneItem('trad-twinkle-twinkle', 1), 0);
    expect(names(prompt.notes)).toBe('G4 G4 D5 D5 E5 E5 D5');
    expect(prompt.tune).toMatchObject({
      tune: 'trad-twinkle-twinkle',
      part: 1,
      semitones: 0,
      key: { tonic: 'G', scale: 'major' },
      // A quarter at 96.
      restMs: 625,
      starts: [0],
    });
    expect(prompt.tune.events.map((e) => e.on)).toEqual([0, 625, 1250, 1875, 2500, 3125, 3750]);
    // Each note sounds nine tenths of its length: a key that comes twice is heard twice.
    expect(prompt.tune.events[0]!.off).toBe(563);
    expect(prompt.tune.events[6]!.off).toBe(3750 + 1125);
  });

  it('keeps sixteenths, dotted notes and rests: Auld Lang Syne at 60', () => {
    // "For auld lang syne, my dear": an eighth, a dotted eighth, a sixteenth …
    const { tune, notes } = tunePrompt(tuneItem('trad-auld-lang-syne', 5), 0);
    expect(names(notes)).toBe('E5 D5 B4 B4 G4 A4 G4 A4');
    expect(tune.events.map((e) => e.on)).toEqual([0, 500, 1250, 1500, 2250, 2500, 3250, 3500]);
    expect(tune.restMs).toBe(1000);
    // A dotted quarter is the beat in 6/8.
    expect(tunePrompt(tuneItem('lyte-row-your-boat', 1), 0).tune.restMs).toBe(1000);
  });

  it('of the whole tune holds where each phrase begins', () => {
    const tune = getTune('trad-amazing-grace');
    const prompt = tunePrompt(tuneItem(tune.id, 'whole'), -3);
    expect(prompt.notes).toEqual(tune.notes.map((n) => n.midi - 3));
    expect(prompt.tune.starts).toEqual([0, 9, 16, 28]);
    expect(prompt.tune.key).toEqual({ tonic: 'E', scale: 'major' });
    expect(promptPhrase(prompt.tune, 0)).toBe(0);
    expect(promptPhrase(prompt.tune, 15)).toBe(1);
    expect(promptPhrase(prompt.tune, 16)).toBe(2);
    expect(promptPhrase(prompt.tune, 34)).toBe(3);
    expect(promptPhrase(tunePrompt(tuneItem(tune.id, 3), 0).tune, 5)).toBe(2);
  });

  it('is of the tune’s own items only', () => {
    expect(tuneItems('trad-amazing-grace')).toEqual([
      'tune:trad-amazing-grace:1',
      'tune:trad-amazing-grace:2',
      'tune:trad-amazing-grace:3',
      'tune:trad-amazing-grace:4',
      'tune:trad-amazing-grace:whole',
    ]);
    for (const bad of ['tune:trad-amazing-grace:5', 'tune:nothing:1', 'echo:EC1', 'tune:x']) {
      expect(() => tunePrompt(bad, 0)).toThrow(RangeError);
    }
  });
});

describe('stored keys of a tune', () => {
  const item = tuneItem('trad-amazing-grace', 2);
  const keys = [62, 67, 71, 67, 71, 69, 74];

  it('are the phrase in a key up to six semitones away', () => {
    expect(tuneSemitones(item, keys)).toBe(0);
    expect(
      tuneSemitones(
        item,
        keys.map((m) => m + 5),
      ),
    ).toBe(5);
    expect(
      tuneSemitones(
        item,
        keys.map((m) => m - 6),
      ),
    ).toBe(-6);
    expect(
      tuneSemitones(
        item,
        keys.map((m) => m + 7),
      ),
    ).toBeNull();
    expect(tuneSemitones(item, keys.slice(0, 6))).toBeNull();
    expect(tuneSemitones(item, [...keys.slice(0, 6), 73])).toBeNull();
    expect(tuneSemitones(tuneItem('trad-amazing-grace', 1), keys)).toBeNull();
    expect(tuneSemitones('tune:trad-amazing-grace:9', keys)).toBeNull();
    expect(tuneSemitones(item, [])).toBeNull();
  });

  it('fit only with the key they are in, named as the session names it', () => {
    expect(tuneFits(item, keys, { tonic: 'G', scale: 'major' })).toBe(true);
    expect(
      tuneFits(
        item,
        keys.map((m) => m + 2),
        { tonic: 'A', scale: 'major' },
      ),
    ).toBe(true);
    expect(
      tuneFits(
        item,
        keys.map((m) => m + 2),
        { tonic: 'G', scale: 'major' },
      ),
    ).toBe(false);
    expect(
      tuneFits(
        item,
        keys.map((m) => m + 6),
        { tonic: 'Db', scale: 'major' },
      ),
    ).toBe(true);
    expect(
      tuneFits(
        item,
        keys.map((m) => m + 6),
        { tonic: 'C#', scale: 'major' },
      ),
    ).toBe(false);
    expect(tuneFits(item, keys, { tonic: 'G', scale: 'naturalMinor' })).toBe(false);
    expect(tuneFits(item, keys, { tonic: 'G', scale: 'major', mode: 'major' })).toBe(false);
    expect(tuneFits(item, keys, undefined)).toBe(false);
    expect(tuneFits(item, keys, ['G', 'major'])).toBe(false);
  });
});
