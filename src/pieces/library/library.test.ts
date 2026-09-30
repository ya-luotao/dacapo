// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseMusicXml } from '../../core/musicxml.ts';
import { isBlack } from '../../core/note.ts';
import { performanceOrder } from '../../core/repeats.ts';
import { demoIncludes, performedNotes } from '../../core/playback.ts';
import { pieceChecksum, pieceFacts } from '../../core/pieceRecords.ts';
import { buildSteps, TICKS_PER_QUARTER, type Score } from '../../core/score.ts';
import { builtInPiece } from './index.ts';
import bachMusetteInD from './bach-musette-in-d.musicxml?raw';
import bachPreludeInC from './bach-prelude-in-c.musicxml?raw';
import beethovenFurElise from './beethoven-fur-elise.musicxml?raw';
import beethovenOdeToJoy from './beethoven-ode-to-joy.musicxml?raw';
import burgmullerArabesque from './burgmuller-arabesque.musicxml?raw';
import burgmullerCandeur from './burgmuller-candeur.musicxml?raw';
import chopinPreludeInCMinor from './chopin-prelude-in-c-minor.musicxml?raw';
import petzoldMinuetInG from './petzold-minuet-in-g.musicxml?raw';
import petzoldMinuetInGMinor from './petzold-minuet-in-g-minor.musicxml?raw';
import satieGymnopedie1 from './satie-gymnopedie-1.musicxml?raw';
import schumannSoldiersMarch from './schumann-soldiers-march.musicxml?raw';
import tchaikovskyMorningPrayer from './tchaikovsky-morning-prayer.musicxml?raw';
import tchaikovskyOldFrenchSong from './tchaikovsky-old-french-song.musicxml?raw';

const Q = TICKS_PER_QUARTER;

const FILES: Record<string, string> = {
  'petzold-minuet-in-g': petzoldMinuetInG,
  'beethoven-fur-elise': beethovenFurElise,
  'beethoven-ode-to-joy': beethovenOdeToJoy,
  'burgmuller-arabesque': burgmullerArabesque,
  'schumann-soldiers-march': schumannSoldiersMarch,
  'bach-prelude-in-c': bachPreludeInC,
  'petzold-minuet-in-g-minor': petzoldMinuetInGMinor,
  'bach-musette-in-d': bachMusetteInD,
  'burgmuller-candeur': burgmullerCandeur,
  'tchaikovsky-old-french-song': tchaikovskyOldFrenchSong,
  'tchaikovsky-morning-prayer': tchaikovskyMorningPrayer,
  'chopin-prelude-in-c-minor': chopinPreludeInCMinor,
  'satie-gymnopedie-1': satieGymnopedie1,
};

function parse(id: string): Score {
  return parseMusicXml(new DOMParser().parseFromString(FILES[id]!, 'application/xml'));
}

/** The written measure runs of the performance order, e.g. "0-15,0-31". */
function runs(score: Score): string {
  const out: string[] = [];
  let first = -1;
  let last = -2;
  for (const { measure } of performanceOrder(score.measures)) {
    if (measure === last + 1) {
      last = measure;
      continue;
    }
    if (first >= 0) out.push(`${first}-${last}`);
    first = last = measure;
  }
  out.push(`${first}-${last}`);
  return out.join(',');
}

/**
 * Locks every note of every built-in piece: a deliberate edit to a file must update its line here.
 * The sequence is (written onset, MIDI pitch, duration, hand) in the parser's note order.
 */
const LOCKED: Record<string, { notes: number; checksum: string }> = {
  'petzold-minuet-in-g': { notes: 203, checksum: 'b80fe0e1' },
  'beethoven-fur-elise': { notes: 157, checksum: '2718f11a' },
  'beethoven-ode-to-joy': { notes: 85, checksum: '7a47ee21' },
  'burgmuller-arabesque': { notes: 285, checksum: '7db61cc9' },
  'schumann-soldiers-march': { notes: 212, checksum: '3deaa5fc' },
  'bach-prelude-in-c': { notes: 619, checksum: 'aaa8934c' },
  'petzold-minuet-in-g-minor': { notes: 199, checksum: '1bd02b28' },
  'bach-musette-in-d': { notes: 173, checksum: '57131154' },
  'burgmuller-candeur': { notes: 245, checksum: '77bc647c' },
  'tchaikovsky-old-french-song': { notes: 212, checksum: 'f8a3c552' },
  'tchaikovsky-morning-prayer': { notes: 252, checksum: '9e16a928' },
  'chopin-prelude-in-c-minor': { notes: 286, checksum: '842bdcd3' },
  'satie-gymnopedie-1': { notes: 289, checksum: 'db34d100' },
};

describe('built-in pieces', () => {
  it.each(Object.keys(FILES))('%s: notes are locked by checksum', (id) => {
    const score = parse(id);
    expect({ notes: score.notes.length, checksum: pieceChecksum(score) }).toEqual(LOCKED[id]);
  });

  it.each(Object.keys(FILES))('%s: the library facts match the file', (id) => {
    // Step records made on an older encoding are told apart by this checksum.
    expect(builtInPiece(id)!.facts).toEqual(pieceFacts(parse(id)));
  });

  it.each(Object.keys(FILES))('%s: provenance, no fingering, both hands', (id) => {
    const xml = FILES[id]!;
    expect(xml).not.toMatch(/<fingering\b/);
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const identification = doc.querySelector('score-partwise > identification')!;
    expect(identification.querySelector('creator[type="composer"]')?.textContent).toBeTruthy();
    expect(identification.querySelector('rights')?.textContent).toMatch(/public domain/i);
    expect(identification.querySelector('source')?.textContent).toMatch(/https:\/\//);
    expect(identification.querySelector('encoding > encoder')?.textContent).toBeTruthy();
    const score = parse(id);
    expect(score.title).not.toBe('');
    expect(score.hands).toEqual({ '0.1': 'right', '0.2': 'left' });
    expect(buildSteps(score, 'right').length).toBeGreaterThan(0);
    expect(buildSteps(score, 'left').length).toBeGreaterThan(0);
  });

  it('Minuet in G: 32 bars of 3/4, both halves repeated', () => {
    const score = parse('petzold-minuet-in-g');
    expect(score.title).toBe('Minuet in G major');
    expect(score.measures).toHaveLength(32);
    expect(score.measures.every((m) => m.duration === 3 * Q)).toBe(true);
    expect(score.notes.filter((n) => n.hand === 'right')).toHaveLength(128);
    expect(score.notes.filter((n) => n.hand === 'left')).toHaveLength(75);
    // Grace notes and ornaments are kept since X0: no warning.
    expect(score.warnings).toEqual([]);
    expect(score.tempos).toEqual([]);
    // Bar 8: the slashed B4 leads to the right hand's A4, and is no step of its own.
    const graced = score.notes.filter((n) => n.graces);
    expect(graced.map((n) => [n.measure, n.midi, n.graces])).toEqual([
      [7, 69, [expect.objectContaining({ midi: 71, slash: true, chord: false })]],
    ]);
    // Bar 3: a mordent on C5 goes down to B4, in G major.
    const bar3 = score.notes.find((n) => n.measure === 2 && n.ornaments)!;
    expect(bar3).toMatchObject({ midi: 72, ornaments: [{ kind: 'mordent', lower: 71 }] });
    expect(runs(score)).toBe('0-15,0-31,16-31');
    const right = buildSteps(score, 'right');
    expect(right.slice(0, 6).map((s) => s.midis)).toEqual([[74], [67], [69], [71], [72], [74]]);
    expect(right[1]).toMatchObject({ measure: 0, beat: 2, tick: Q });
    // Bar 1 starts with the right hand's D5 over the left hand's G3–B3–D4.
    expect(buildSteps(score, 'both')[0]!.midis).toEqual([55, 59, 62, 74]);
    // Bar 32: the right hand's two voices make one chord.
    expect(right.at(-1)).toMatchObject({ measure: 31, pass: 2, midis: [59, 62, 67] });
    // Bar 30, left hand: E3 G3 F♯3 (see the file's comment).
    const bar30 = score.notes.filter((n) => n.measure === 29 && n.hand === 'left');
    expect(bar30.map((n) => n.midi)).toEqual([52, 55, 54]);
  });

  it('Für Elise: the A section with both repeats, closing on its cadence', () => {
    const score = parse('beethoven-fur-elise');
    expect(score.measures).toHaveLength(25);
    expect(score.measures[0]).toMatchObject({ number: '0', duration: Q / 2 });
    expect(score.measures[8]!.repeat).toMatchObject({ ending: [1], backwardTimes: 2 });
    expect(score.measures[24]!.repeat.ending).toEqual([2]);
    expect(runs(score)).toBe('0-8,0-7,9-23,10-22,24-24');
    const right = buildSteps(score, 'right');
    expect(right.slice(0, 4).map((s) => s.midis)).toEqual([[76], [75], [76], [75]]);
    // Hands alternate in the episode: the left hand takes E5 and D♯5.
    const left = buildSteps(score, 'left').filter((s) => s.measure === 14 && s.pass === 1);
    expect(left.map((s) => s.midis)).toEqual([[76], [75], [76]]);
    // It ends as the piece does: A4 over octave As; with the pickup, the last bar is a full bar.
    expect(buildSteps(score, 'both').at(-1)!.midis).toEqual([33, 45, 69]);
    expect(score.measures[0]!.duration + score.measures[24]!.duration).toBe(3 * (Q / 2));
    expect(score.tempos).toEqual([{ tick: 0, bpm: 72 }]);
  });

  it('Ode to Joy: 16 bars in C, the right hand on white keys from G3 to G4', () => {
    const score = parse('beethoven-ode-to-joy');
    expect(score.measures).toHaveLength(16);
    expect(score.measures.every((m) => m.beats === 4 && m.beatType === 4)).toBe(true);
    const right = score.notes.filter((n) => n.hand === 'right');
    expect(right.every((n) => !isBlack(n.midi) && n.midi >= 55 && n.midi <= 67)).toBe(true);
    const left = new Set(score.notes.filter((n) => n.hand === 'left').map((n) => n.midi));
    expect([...left].sort((a, b) => a - b)).toEqual([43, 48, 52, 55]);
    expect(
      buildSteps(score, 'right')
        .slice(0, 4)
        .map((s) => s.midis),
    ).toEqual([[64], [64], [65], [67]]);
    expect(buildSteps(score, 'both').at(-1)!.midis).toEqual([48, 52, 55, 60]);
  });

  it('Arabesque: the first ending without its repeat sign still goes back', () => {
    const score = parse('burgmuller-arabesque');
    expect(score.measures).toHaveLength(33);
    expect(score.measures[0]).toMatchObject({ beats: 2, beatType: 4 });
    expect(runs(score)).toBe('0-9,2-8,10-26,11-25,27-32');
    expect(score.notes.filter((n) => n.tieStop)).toHaveLength(2);
  });

  it("Soldiers' March: the second half repeated", () => {
    const score = parse('schumann-soldiers-march');
    expect(score.measures).toHaveLength(32);
    expect(runs(score)).toBe('0-31,16-31');
  });

  it('Prelude in C: the prelude alone, 35 bars without repeats', () => {
    const score = parse('bach-prelude-in-c');
    expect(score.measures).toHaveLength(35);
    expect(score.measures.at(-1)!.number).toBe('35');
    expect(runs(score)).toBe('0-34');
    expect(score.notes.filter((n) => !n.tieStop)).toHaveLength(549);
    // Bar 1: C major broken upwards, C4 E4 held under G4 C5 E5.
    expect(
      buildSteps(score, 'both')
        .slice(0, 5)
        .map((s) => s.midis),
    ).toEqual([[60], [64], [67], [72], [76]]);
  });

  it('Minuet in G minor: 32 bars of 3/4, both halves repeated', () => {
    const score = parse('petzold-minuet-in-g-minor');
    expect(score.measures).toHaveLength(32);
    expect(score.measures.every((m) => m.duration === 3 * Q)).toBe(true);
    expect(runs(score)).toBe('0-15,0-31,16-31');
    expect(score.warnings).toEqual([]);
    // Bar 13: the mordent on F5 goes down to E♭5, in the key of G minor.
    const bar13 = score.notes.find((n) => n.measure === 12 && n.ornaments)!;
    expect(bar13).toMatchObject({ midi: 77, ornaments: [{ kind: 'mordent', lower: 75 }] });
    // B♭5 A5 G5, then A5 D5 D5.
    expect(
      buildSteps(score, 'right')
        .slice(0, 6)
        .map((s) => s.midis),
    ).toEqual([[82], [81], [79], [81], [74], [74]]);
  });

  it('Musette: octave leaps in the left hand, both halves repeated', () => {
    const score = parse('bach-musette-in-d');
    expect(score.measures).toHaveLength(20);
    expect(score.measures[0]).toMatchObject({ beats: 2, beatType: 4 });
    expect(runs(score)).toBe('0-7,0-19,8-19');
    expect(
      buildSteps(score, 'left')
        .slice(0, 4)
        .map((s) => s.midis),
    ).toEqual([[38], [50], [38], [50]]);
    // It closes in A, the hands an octave apart.
    expect(buildSteps(score, 'both').at(-1)!.midis).toEqual([45, 57]);
  });

  it('La Candeur: the second half repeated with two endings, then the coda', () => {
    const score = parse('burgmuller-candeur');
    expect(score.measures).toHaveLength(23);
    expect(score.measures[15]!.repeat).toMatchObject({ ending: [1], backwardTimes: 2 });
    expect(score.measures[16]!.repeat.ending).toEqual([2]);
    expect(runs(score)).toBe('0-7,0-15,8-14,16-22');
    expect(score.warnings).toEqual([]);
    expect(score.tempos).toEqual([{ tick: 0, bpm: 152 }]);
    // The chord tied into the last bar keeps its G3; its C3 is struck again.
    expect(buildSteps(score, 'left').at(-1)!.midis).toEqual([48]);
  });

  it('Old French Song: an eighth-note pickup, the second A section written out', () => {
    const score = parse('tchaikovsky-old-french-song');
    expect(score.measures).toHaveLength(33);
    expect(score.measures[0]).toMatchObject({ number: '0', duration: Q / 2 });
    expect(runs(score)).toBe('0-32');
    expect(
      buildSteps(score, 'right')
        .slice(0, 6)
        .map((s) => s.midis),
    ).toEqual([[62], [67], [69], [70], [72], [74]]);
    // Where both left-hand voices have G3, it is one key to press.
    const bar4 = buildSteps(score, 'left').filter((s) => s.measure === 4);
    expect(bar4.every((s) => new Set(s.midis).size === s.midis.length)).toBe(true);
    expect(buildSteps(score, 'both').at(-1)!.midis).toEqual([43, 50, 58, 67]);
  });

  it('Morning Prayer: 24 bars of chords in G, no repeats', () => {
    const score = parse('tchaikovsky-morning-prayer');
    expect(score.measures).toHaveLength(24);
    expect(runs(score)).toBe('0-23');
    expect(buildSteps(score, 'both')[0]!.midis).toEqual([55, 62, 67, 71]);
    expect(buildSteps(score, 'both').at(-1)!.midis).toEqual([43, 50, 67, 71, 74]);
  });

  it('Prelude in C minor: 13 bars, the right hand starting in the bass clef', () => {
    const score = parse('chopin-prelude-in-c-minor');
    expect(score.measures).toHaveLength(13);
    expect(runs(score)).toBe('0-12');
    expect(score.tempos).toEqual([{ tick: 0, bpm: 42 }]);
    expect(buildSteps(score, 'both')[0]!.midis).toEqual([36, 48, 55, 60, 63, 67]);
    // Bars 9–12 repeat bars 5–8 note for note.
    const bars = (from: number) =>
      score.notes
        .filter((n) => n.measure >= from && n.measure < from + 4)
        .map((n) => [n.onset - score.measures[from]!.start, n.midi, n.duration, n.hand]);
    expect(bars(8)).toEqual(bars(4));
    expect(FILES['chopin-prelude-in-c-minor']).toMatch(
      /<clef number="1"><sign>F<\/sign><line>4<\/line><\/clef><clef number="2">/,
    );
  });

  it('Gymnopédie No. 1: 31 bars repeated, with endings of 8 bars each', () => {
    const score = parse('satie-gymnopedie-1');
    expect(score.measures).toHaveLength(47);
    expect(score.measures[0]!.repeat.forward).toBe(true);
    expect(score.measures[38]!.repeat).toMatchObject({ ending: [1], backwardTimes: 2 });
    expect(score.measures[39]!.repeat.ending).toEqual([2]);
    expect(runs(score)).toBe('0-38,0-30,39-46');
    // The left hand: a low G, then B3 D4 F♯4; a low D, then A3 C♯4 F♯4.
    expect(
      buildSteps(score, 'left')
        .slice(0, 4)
        .map((s) => s.midis),
    ).toEqual([[43], [59, 62, 66], [38], [57, 61, 66]]);
    expect(
      buildSteps(score, 'right')
        .slice(0, 6)
        .map((s) => s.midis),
    ).toEqual([[78], [81], [79], [78], [73], [71]]);
  });

  it.each(Object.keys(FILES))(
    '%s: the demo strikes exactly the keys wait mode asks for, for each hand selection',
    (id) => {
      const score = parse(id);
      const order = performanceOrder(score.measures);
      for (const hands of ['right', 'left', 'both'] as const) {
        const keys = buildSteps(score, hands, order).reduce((n, s) => n + s.midis.length, 0);
        expect(performedNotes(score, order, demoIncludes(hands)), hands).toHaveLength(keys);
      }
    },
  );
});
