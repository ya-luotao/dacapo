// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { formatSymbol, parseSymbol, symbolPitchClasses } from '../../core/chordSymbols.ts';
import { performedMarks } from '../../core/markings.ts';
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
import beyerAbendlied from './beyer-abendlied.musicxml?raw';
import beyerKinderlied from './beyer-kinderlied.musicxml?raw';
import beyerOp101No66 from './beyer-op101-no66.musicxml?raw';
import burgmullerArabesque from './burgmuller-arabesque.musicxml?raw';
import burgmullerCandeur from './burgmuller-candeur.musicxml?raw';
import chopinPreludeInCMinor from './chopin-prelude-in-c-minor.musicxml?raw';
import czernyOp599No11 from './czerny-op599-no11.musicxml?raw';
import petzoldMinuetInG from './petzold-minuet-in-g.musicxml?raw';
import petzoldMinuetInGMinor from './petzold-minuet-in-g-minor.musicxml?raw';
import satieGymnopedie1 from './satie-gymnopedie-1.musicxml?raw';
import schumannMelodie from './schumann-melodie.musicxml?raw';
import schumannSoldiersMarch from './schumann-soldiers-march.musicxml?raw';
import tchaikovskyMorningPrayer from './tchaikovsky-morning-prayer.musicxml?raw';
import tchaikovskyOldFrenchSong from './tchaikovsky-old-french-song.musicxml?raw';
import fosterOhSusanna from './foster-oh-susanna.musicxml?raw';
import lyteRowYourBoat from './lyte-row-your-boat.musicxml?raw';
import pierpontJingleBells from './pierpont-jingle-bells.musicxml?raw';
import tradAmazingGrace from './trad-amazing-grace.musicxml?raw';
import tradAuldLangSyne from './trad-auld-lang-syne.musicxml?raw';
import tradFrereJacques from './trad-frere-jacques.musicxml?raw';
import tradSwingLow from './trad-swing-low.musicxml?raw';
import tradTwinkleTwinkle from './trad-twinkle-twinkle.musicxml?raw';
import turkAllerAnfang from './turk-aller-anfang.musicxml?raw';
import turkBeyDerWiege from './turk-bey-der-wiege.musicxml?raw';
import turkHansOhneSorgen from './turk-hans-ohne-sorgen.musicxml?raw';
import turkMattUndKrank from './turk-matt-und-krank.musicxml?raw';
import turkMuntereKnabe from './turk-muntere-knabe.musicxml?raw';

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
  'turk-aller-anfang': turkAllerAnfang,
  'czerny-op599-no11': czernyOp599No11,
  'turk-muntere-knabe': turkMuntereKnabe,
  'beyer-kinderlied': beyerKinderlied,
  'turk-hans-ohne-sorgen': turkHansOhneSorgen,
  'turk-matt-und-krank': turkMattUndKrank,
  'turk-bey-der-wiege': turkBeyDerWiege,
  'beyer-abendlied': beyerAbendlied,
  'beyer-op101-no66': beyerOp101No66,
  'schumann-melodie': schumannMelodie,
  'trad-twinkle-twinkle': tradTwinkleTwinkle,
  'trad-frere-jacques': tradFrereJacques,
  'lyte-row-your-boat': lyteRowYourBoat,
  'trad-amazing-grace': tradAmazingGrace,
  'pierpont-jingle-bells': pierpontJingleBells,
  'foster-oh-susanna': fosterOhSusanna,
  'trad-auld-lang-syne': tradAuldLangSyne,
  'trad-swing-low': tradSwingLow,
};

/** The lead sheets (docs/HARMONY.md, "Lead sheets (H3)"): a melody and chord symbols. */
const LEAD_SHEETS = Object.keys(FILES).filter((id) => builtInPiece(id)!.leadSheet);

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
  'turk-aller-anfang': { notes: 35, checksum: '09efdf72' },
  'czerny-op599-no11': { notes: 116, checksum: 'a2c6a2a0' },
  'turk-muntere-knabe': { notes: 42, checksum: '6be48d2b' },
  'beyer-kinderlied': { notes: 79, checksum: '12d399be' },
  'turk-hans-ohne-sorgen': { notes: 52, checksum: 'b8164335' },
  'turk-matt-und-krank': { notes: 32, checksum: '7c04d493' },
  'turk-bey-der-wiege': { notes: 55, checksum: 'a0ae966d' },
  'beyer-abendlied': { notes: 98, checksum: 'b1609557' },
  'beyer-op101-no66': { notes: 175, checksum: 'a4109d0e' },
  'schumann-melodie': { notes: 256, checksum: 'b99b28f6' },
  'trad-twinkle-twinkle': { notes: 42, checksum: 'eeb5c6ad' },
  'trad-frere-jacques': { notes: 44, checksum: '778fec8a' },
  'lyte-row-your-boat': { notes: 29, checksum: 'f8cdf8f2' },
  'trad-amazing-grace': { notes: 35, checksum: '45518e37' },
  'pierpont-jingle-bells': { notes: 98, checksum: '19fc9bb3' },
  'foster-oh-susanna': { notes: 85, checksum: 'f1e65c83' },
  'trad-auld-lang-syne': { notes: 56, checksum: '1fc67ba5' },
  'trad-swing-low': { notes: 100, checksum: 'ec992a8e' },
};

/** What a piece marks besides its notes, counted: locked like the notes. */
function markings(score: Score): string {
  const { dynamics, hairpins, pedals, slurs, fermatas } = score.markings;
  const count = (items: string[]) => {
    const out = new Map<string, number>();
    for (const item of items) out.set(item, (out.get(item) ?? 0) + 1);
    return [...out].map(([item, n]) => (n > 1 ? `${item}×${n}` : item)).join(' ');
  };
  return [
    `dynamics: ${dynamics.map((d) => d.dynamic).join(' ')}`,
    `hairpins: ${count(hairpins.map((h) => `${h.kind === 'crescendo' ? '<' : '>'}${h.written === 'words' ? '(words)' : ''}`))}`,
    `pedal: ${count(pedals.map((p) => `${p.pedal === 'sustain' ? '' : `${p.pedal} `}${p.type}`))}`,
    `slurs: ${slurs.length}`,
    `fermatas: ${fermatas.length}`,
    `articulations: ${count(score.notes.flatMap((n) => n.articulations ?? []))}`,
    `ornaments: ${count(score.notes.flatMap((n) => n.ornaments ?? []).map((o) => o.kind))}`,
    `graces: ${score.notes.flatMap((n) => n.graces ?? []).length}`,
  ].join('; ');
}

/**
 * The markings of every built-in piece, as its source edition prints them (the source files and
 * the PDMX manifests say which). A deliberate edit to a file updates its line here.
 */
const MARKINGS: Record<string, string> = {
  'petzold-minuet-in-g':
    'dynamics: ; hairpins: ; pedal: ; slurs: 0; fermatas: 0; articulations: ; ornaments: mordent×4 inverted-mordent; graces: 1',
  'beethoven-fur-elise':
    'dynamics: pp pp; hairpins: ; pedal: start×12 stop×12; slurs: 1; fermatas: 0; articulations: ; ornaments: ; graces: 0',
  'beethoven-ode-to-joy':
    'dynamics: ; hairpins: ; pedal: ; slurs: 0; fermatas: 0; articulations: ; ornaments: ; graces: 0',
  'burgmuller-arabesque':
    'dynamics: p f mf sfz mf f p f f sfz; hairpins: <(words) > <; pedal: ; slurs: 30; fermatas: 2; articulations: staccato×69 accent×2; ornaments: ; graces: 0',
  'schumann-soldiers-march':
    'dynamics: f f f f f f f f f f f; hairpins: ; pedal: ; slurs: 0; fermatas: 0; articulations: ; ornaments: ; graces: 0',
  'bach-prelude-in-c':
    'dynamics: ; hairpins: ; pedal: ; slurs: 0; fermatas: 0; articulations: ; ornaments: ; graces: 0',
  'petzold-minuet-in-g-minor':
    'dynamics: ; hairpins: ; pedal: ; slurs: 0; fermatas: 0; articulations: ; ornaments: inverted-mordent×4 mordent×2; graces: 0',
  'bach-musette-in-d':
    'dynamics: ; hairpins: ; pedal: ; slurs: 0; fermatas: 2; articulations: ; ornaments: ; graces: 0',
  'burgmuller-candeur':
    'dynamics: p p sf p p pp; hairpins: >×8 <(words) <×2 >(words); pedal: ; slurs: 30; fermatas: 0; articulations: ; ornaments: ; graces: 0',
  'tchaikovsky-old-french-song':
    'dynamics: p pp p mf p; hairpins: < >; pedal: ; slurs: 26; fermatas: 0; articulations: staccato×17; ornaments: ; graces: 0',
  'tchaikovsky-morning-prayer':
    'dynamics: p mf p f f mf pp; hairpins: <×3 >×4 >(words); pedal: start stop; slurs: 29; fermatas: 0; articulations: accent×5 tenuto; ornaments: ; graces: 0',
  'chopin-prelude-in-c-minor':
    'dynamics: ff p pp; hairpins: < <(words); pedal: start×2 change×4 stop×2; slurs: 7; fermatas: 2; articulations: accent×2; ornaments: ; graces: 0',
  'satie-gymnopedie-1':
    'dynamics: pp f pp p; hairpins: <×6 >×6; pedal: ; slurs: 6; fermatas: 0; articulations: ; ornaments: ; graces: 0',
  'turk-aller-anfang':
    'dynamics: ; hairpins: ; pedal: ; slurs: 0; fermatas: 0; articulations: ; ornaments: ; graces: 0',
  'czerny-op599-no11':
    'dynamics: ; hairpins: ; pedal: ; slurs: 2; fermatas: 0; articulations: ; ornaments: ; graces: 0',
  'turk-muntere-knabe':
    'dynamics: ; hairpins: ; pedal: ; slurs: 5; fermatas: 0; articulations: staccatissimo×6; ornaments: ; graces: 0',
  'beyer-kinderlied':
    'dynamics: ; hairpins: ; pedal: ; slurs: 6; fermatas: 0; articulations: ; ornaments: ; graces: 0',
  'turk-hans-ohne-sorgen':
    'dynamics: ; hairpins: ; pedal: ; slurs: 0; fermatas: 0; articulations: ; ornaments: ; graces: 0',
  'turk-matt-und-krank':
    'dynamics: pp pp; hairpins: ; pedal: ; slurs: 0; fermatas: 0; articulations: ; ornaments: ; graces: 0',
  'turk-bey-der-wiege':
    'dynamics: p; hairpins: ; pedal: ; slurs: 5; fermatas: 0; articulations: ; ornaments: ; graces: 0',
  'beyer-abendlied':
    'dynamics: p; hairpins: <×4 >×4; pedal: ; slurs: 10; fermatas: 2; articulations: ; ornaments: ; graces: 0',
  'beyer-op101-no66':
    'dynamics: ; hairpins: <×4 >×4; pedal: ; slurs: 6; fermatas: 0; articulations: ; ornaments: ; graces: 0',
  'schumann-melodie':
    'dynamics: p sf p sf p; hairpins: >×5; pedal: ; slurs: 24; fermatas: 0; articulations: ; ornaments: ; graces: 0',
  'trad-twinkle-twinkle':
    'dynamics: ; hairpins: ; pedal: ; slurs: 0; fermatas: 0; articulations: ; ornaments: ; graces: 0',
  'trad-frere-jacques':
    'dynamics: ; hairpins: ; pedal: ; slurs: 0; fermatas: 0; articulations: ; ornaments: ; graces: 0',
  'lyte-row-your-boat':
    'dynamics: ; hairpins: ; pedal: ; slurs: 0; fermatas: 0; articulations: ; ornaments: ; graces: 0',
  'trad-amazing-grace':
    'dynamics: ; hairpins: ; pedal: ; slurs: 0; fermatas: 0; articulations: ; ornaments: ; graces: 0',
  'pierpont-jingle-bells':
    'dynamics: ; hairpins: ; pedal: ; slurs: 0; fermatas: 0; articulations: ; ornaments: ; graces: 0',
  'foster-oh-susanna':
    'dynamics: ; hairpins: ; pedal: ; slurs: 0; fermatas: 0; articulations: ; ornaments: ; graces: 0',
  'trad-auld-lang-syne':
    'dynamics: ; hairpins: ; pedal: ; slurs: 0; fermatas: 0; articulations: ; ornaments: ; graces: 0',
  'trad-swing-low':
    'dynamics: ; hairpins: ; pedal: ; slurs: 0; fermatas: 4; articulations: ; ornaments: ; graces: 0',
};

/**
 * The fingering of the pieces that carry their edition's (G5a; the source files name the edition
 * and its editor): the fingers of each hand's notes in the file's order, a note without one left
 * out. The checksum leaves fingers out, so they are locked here. The other pieces have none.
 */
const FINGERING: Record<string, { right: string; left: string }> = {
  'turk-aller-anfang': { right: '153125423125321', left: '12415' },
  'czerny-op599-no11': { right: '1313525423254212353542125421', left: '421531421521421531421521' },
  'turk-muntere-knabe': { right: '25', left: '41' },
  'beyer-kinderlied': { right: '5', left: '35' },
  'turk-hans-ohne-sorgen': { right: '33', left: '14' },
  'turk-matt-und-krank': { right: '5211', left: '112' },
  'turk-bey-der-wiege': { right: '13', left: '321' },
  'beyer-abendlied': { right: '12323', left: '412311' },
  'beyer-op101-no66': { right: '1514415315', left: '531212131535' },
  'schumann-melodie': {
    right: '5151433451435421324125414132413234543241254',
    left: '52341323243252345151314153234333',
  },
};

function fingering(score: Score, hand: 'right' | 'left'): string {
  return score.notes
    .filter((n) => n.hand === hand && n.finger != null)
    .map((n) => n.finger)
    .join('');
}

describe('built-in pieces', () => {
  it.each(Object.keys(FILES))('%s: the markings are locked too', (id) => {
    expect(markings(parse(id))).toBe(MARKINGS[id]);
  });

  it.each(Object.keys(FILES))('%s: notes are locked by checksum', (id) => {
    const score = parse(id);
    expect({ notes: score.notes.length, checksum: pieceChecksum(score) }).toEqual(LOCKED[id]);
  });

  it.each(Object.keys(FILES))('%s: the library facts match the file', (id) => {
    // Step records made on an older encoding are told apart by this checksum.
    expect(builtInPiece(id)!.facts).toEqual(pieceFacts(parse(id)));
  });

  it.each(Object.keys(FILES))('%s: provenance, the fingering locked, both hands', (id) => {
    const xml = FILES[id]!;
    // Fingering only where an edition's was read and checked; then every figure is locked.
    const fingers = FINGERING[id] ?? { right: '', left: '' };
    expect(xml.match(/<fingering\b/g) ?? []).toHaveLength(
      fingers.right.length + fingers.left.length,
    );
    expect({ right: fingering(parse(id), 'right'), left: fingering(parse(id), 'left') }).toEqual(
      fingers,
    );
    if (FINGERING[id]) expect(xml).toMatch(/Fingering[^<]* as printed in/);
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
    // A lead sheet's bass staff is empty: its left hand comes from the symbols.
    expect(buildSteps(score, 'left').length > 0).toBe(!builtInPiece(id)!.leadSheet);
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
    // Their steps name the keys wait and rhythm mode accept besides the note (X4).
    const decorated = buildSteps(score, 'right').filter((s) => s.ornaments && s.pass === 1);
    expect(decorated.map((s) => [s.measure, s.ornaments])).toEqual([
      [2, [{ noteId: bar3.id, midi: 72, keys: [71] }]],
      [4, [expect.objectContaining({ midi: 72, keys: [71] })]],
      [7, [expect.objectContaining({ midi: 69, keys: [71] })]],
      [10, [expect.objectContaining({ midi: 72, keys: [71] })]],
      [12, [expect.objectContaining({ midi: 72, keys: [71] })]],
      [29, [expect.objectContaining({ midi: 71, keys: [72] })]],
    ]);
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

  // The first pieces (G5a): what each asks of a beginner, and its edition's fingering.
  const keys = (score: Score, hand: 'right' | 'left') =>
    [...new Set(score.notes.filter((n) => n.hand === hand).map((n) => n.midi))].sort(
      (a, b) => a - b,
    );

  it('Aller Anfang ist schwer: eight bars, the right hand on five white keys', () => {
    const score = parse('turk-aller-anfang');
    expect(score.title).toBe('Aller Anfang ist schwer');
    expect(score.measures).toHaveLength(8);
    expect(score.measures.every((m) => m.beats === 4 && m.beatType === 4)).toBe(true);
    expect(runs(score)).toBe('0-7');
    expect(keys(score, 'right')).toEqual([72, 74, 76, 77, 79]);
    expect(keys(score, 'left')).toEqual([48, 55, 59, 60]);
    expect(score.warnings).toEqual([]);
    expect(score.tempos).toEqual([{ tick: 0, bpm: 132 }]);
    // Türk's fingers: C5 with the thumb, G5 with the fifth finger; the left hand's C4 with 1.
    const right = score.notes.filter((n) => n.hand === 'right');
    expect(right.slice(0, 4).map((n) => [n.midi, n.finger])).toEqual([
      [72, 1],
      [72, null],
      [72, null],
      [79, 5],
    ]);
    expect(score.notes.find((n) => n.hand === 'left')).toMatchObject({ midi: 60, finger: 1 });
    expect(buildSteps(score, 'both').at(-1)!.midis).toEqual([48]);
  });

  it('Czerny Op. 599 No. 11: both staves in the treble clef, three chords, both halves repeated', () => {
    const score = parse('czerny-op599-no11');
    expect(score.measures).toHaveLength(16);
    expect(runs(score)).toBe('0-7,0-15,8-15');
    expect(FILES['czerny-op599-no11']).toMatch(
      /<clef number="1"><sign>G<\/sign><line>2<\/line><\/clef><clef number="2"><sign>G<\/sign>/,
    );
    expect(keys(score, 'right')).toEqual([72, 74, 76, 77, 79]);
    expect(keys(score, 'left')).toEqual([59, 60, 62, 64, 65, 67]);
    const chords = new Set(buildSteps(score, 'left').map((s) => s.midis.join(' ')));
    expect([...chords].sort()).toEqual(['59 62 67', '59 65 67', '60 64 67']);
    // Each key of a chord has its own finger: C–E–G with 4 2 1, B–D–G with 5 3 1.
    const bar = (measure: number) =>
      score.notes
        .filter((n) => n.measure === measure && n.hand === 'left')
        .map((n) => [n.midi, n.finger]);
    expect(bar(0)).toEqual([
      [60, 4],
      [64, 2],
      [67, 1],
    ]);
    expect(bar(2)).toEqual([
      [59, 5],
      [62, 3],
      [67, 1],
    ]);
    expect(score.tempos).toEqual([]);
  });

  it('Der muntere Knabe: eight bars of 2/4, slurred pairs and staccato strokes', () => {
    const score = parse('turk-muntere-knabe');
    expect(score.measures).toHaveLength(8);
    expect(score.measures.every((m) => m.beats === 2 && m.beatType === 4)).toBe(true);
    expect(runs(score)).toBe('0-7');
    expect(
      buildSteps(score, 'right')
        .slice(0, 4)
        .map((s) => s.midis),
    ).toEqual([[76], [77], [79], [79]]);
    // Bar 3: the hands run down in tenths, the left hand above its staff.
    expect(
      buildSteps(score, 'both')
        .filter((s) => s.measure === 2)
        .map((s) => s.midis),
    ).toEqual([
      [65, 81],
      [64, 79],
      [62, 77],
      [60, 76],
    ]);
    expect(buildSteps(score, 'both').at(-1)!.midis).toEqual([48]);
  });

  it('Kinderlied: twelve bars, each hand in its five-finger position on white keys', () => {
    const score = parse('beyer-kinderlied');
    expect(score.measures).toHaveLength(12);
    expect(runs(score)).toBe('0-11');
    expect(keys(score, 'right')).toEqual([72, 74, 76, 77, 79]);
    expect(keys(score, 'left')).toEqual([60, 62, 64, 65, 67]);
    expect(FILES['beyer-kinderlied']).toMatch(/<clef number="2"><sign>G<\/sign>/);
    // The third part is the first again, but for its close.
    const bars = (from: number) =>
      score.notes
        .filter((n) => n.measure >= from && n.measure < from + 3)
        .map((n) => [n.onset - score.measures[from]!.start, n.midi, n.duration, n.hand]);
    expect(bars(8)).toEqual(bars(0));
    expect(buildSteps(score, 'both')[0]!.midis).toEqual([64, 79]);
    expect(score.tempos).toEqual([]);
  });

  it('Hans ohne Sorgen: eight bars in G, a C sharp on the way to D', () => {
    const score = parse('turk-hans-ohne-sorgen');
    expect(score.measures).toHaveLength(8);
    expect(runs(score)).toBe('0-7');
    const black = score.notes.filter((n) => isBlack(n.midi));
    // F sharp in the left hand (the key's), C sharp once in the right (bar 3).
    expect(black.map((n) => [n.measure, n.midi, n.hand])).toEqual([
      [1, 54, 'left'],
      [2, 73, 'right'],
      [3, 54, 'left'],
      [5, 54, 'left'],
      [5, 54, 'left'],
    ]);
    // Bar 5: C natural again.
    expect(score.notes.find((n) => n.measure === 4 && n.midi === 72)).toBeDefined();
    expect(buildSteps(score, 'both').at(-1)!.midis).toEqual([43, 67]);
  });

  it('Ich bin so matt und krank: E minor in 3/4, an upbeat, the left hand after the beat', () => {
    const score = parse('turk-matt-und-krank');
    expect(score.measures).toHaveLength(9);
    expect(score.measures[0]).toMatchObject({ number: '0', duration: Q, beats: 3, beatType: 4 });
    // With the upbeat, the last bar is a full bar.
    expect(score.measures[0]!.duration + score.measures[8]!.duration).toBe(3 * Q);
    expect(runs(score)).toBe('0-8');
    expect(buildSteps(score, 'right')[0]!.midis).toEqual([71]);
    // The left hand's first note comes on the second beat of bar 1.
    expect(buildSteps(score, 'left')[0]).toMatchObject({ measure: 1, beat: 2, midis: [55] });
    // D sharp, the leading note: in the right hand in bars 2 and 5, in the left in bar 3.
    expect(
      score.notes.filter((n) => n.midi % 12 === 3).map((n) => [n.measure, n.midi, n.hand]),
    ).toEqual([
      [2, 63, 'right'],
      [2, 63, 'right'],
      [3, 51, 'left'],
      [5, 63, 'right'],
    ]);
    expect(buildSteps(score, 'both').at(-1)!.midis).toEqual([40]);
  });

  it('Bey der Wiege zu singen: F major, an upbeat, the hands together in sixths and tenths', () => {
    const score = parse('turk-bey-der-wiege');
    expect(score.measures).toHaveLength(9);
    expect(score.measures[0]).toMatchObject({ number: '0', duration: Q });
    expect(score.measures[0]!.duration + score.measures[8]!.duration).toBe(4 * Q);
    expect(runs(score)).toBe('0-8');
    // Upbeat and bar 1: F4 A4 G4 F4 G4 over A3 C4 B♭3 A3 B♭3.
    expect(
      buildSteps(score, 'both')
        .slice(0, 5)
        .map((s) => s.midis),
    ).toEqual([
      [57, 65],
      [60, 69],
      [58, 67],
      [57, 65],
      [58, 67],
    ]);
    expect(score.notes.some((n) => n.hand === 'right' && n.midi === 70)).toBe(true);
    expect(buildSteps(score, 'both').at(-1)!.midis).toEqual([41]);
  });

  it('Abendlied: an upbeat and twelve bars, the left hand in the treble clef down to G3', () => {
    const score = parse('beyer-abendlied');
    expect(score.measures).toHaveLength(13);
    expect(score.measures[0]).toMatchObject({ number: '0', duration: Q });
    expect(score.measures[0]!.duration + score.measures[12]!.duration).toBe(4 * Q);
    expect(runs(score)).toBe('0-12');
    expect(FILES['beyer-abendlied']).toMatch(/<clef number="2"><sign>G<\/sign>/);
    // No signature and no black key: the tune is in G, and no F occurs.
    expect(FILES['beyer-abendlied']).toMatch(/<fifths>0<\/fifths>/);
    expect(score.notes.some((n) => isBlack(n.midi) || n.midi % 12 === 5)).toBe(false);
    expect(Math.min(...keys(score, 'left'))).toBe(55);
    expect(buildSteps(score, 'both')[0]!.midis).toEqual([59, 67]);
    expect(buildSteps(score, 'both').at(-1)!.midis).toEqual([59, 67]);
    expect(score.tempos).toEqual([{ tick: 0, bpm: 72 }]);
  });

  it('Beyer No. 66: twenty bars of 6/8, bars 9–20 repeated', () => {
    const score = parse('beyer-op101-no66');
    expect(score.measures).toHaveLength(20);
    expect(score.measures.every((m) => m.beats === 6 && m.beatType === 8)).toBe(true);
    expect(score.measures[8]!.repeat.forward).toBe(true);
    expect(runs(score)).toBe('0-19,8-19');
    // The left hand: broken chords, three eighths to the beat.
    expect(
      buildSteps(score, 'left')
        .slice(0, 6)
        .map((s) => s.midis),
    ).toEqual([[48], [52], [55], [48], [52], [55]]);
    // The last C5 is tied over the middle of the bar: one key press.
    expect(score.notes.filter((n) => n.tieStop)).toHaveLength(1);
    expect(score.tempos).toEqual([{ tick: 0, bpm: 90 }]);
  });

  it('Melodie: twenty bars, the first four repeated, the left hand in the treble clef', () => {
    const score = parse('schumann-melodie');
    expect(score.title).toBe('Melodie');
    expect(score.measures).toHaveLength(20);
    expect(runs(score)).toBe('0-3,0-19');
    expect(FILES['schumann-melodie']).toMatch(/<clef number="2"><sign>G<\/sign>/);
    expect(score.warnings).toEqual([]);
    expect(
      buildSteps(score, 'right')
        .slice(0, 4)
        .map((s) => s.midis),
    ).toEqual([[76], [74], [72], [71]]);
    // Bars 8 and 16: the two voices end on one D5, one key to press.
    for (const measure of [7, 15]) {
      const last = buildSteps(score, 'right')
        .filter((s) => s.measure === measure)
        .at(-1)!;
      expect(last).toMatchObject({ beat: 4.5, midis: [74] });
    }
    // Bar 11: the G5 is taken with 4 and changed to 5 (the first figure is the finger to start
    // with), the chords have a finger for each key.
    const bar11 = score.notes.filter((n) => n.measure === 10 && n.hand === 'right');
    expect(bar11.map((n) => [n.midi, n.finger])).toEqual([
      [81, 5],
      [79, 4],
      [71, 1],
      [77, 4],
      [72, 1],
      [76, 3],
    ]);
    expect(FILES['schumann-melodie']).toMatch(/<fingering placement="above">4-5<\/fingering>/);
    expect(buildSteps(score, 'both').at(-1)!.midis).toEqual([60]);
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

/** The symbols in written order with their bar and beat: "1 G, 3 C, 7.3 D7". */
function symbols(score: Score): string {
  return (score.harmonies ?? [])
    .map((h) => {
      const m = score.measures[h.measure]!;
      const beat = 1 + (h.tick - m.start) / ((4 * Q) / m.beatType);
      return `${m.number}${beat === 1 ? '' : `.${beat}`} ${h.text}`;
    })
    .join(', ');
}

describe('lead sheets', () => {
  it('are the library entries marked as such', () => {
    expect(LEAD_SHEETS).toEqual([
      'trad-twinkle-twinkle',
      'trad-frere-jacques',
      'lyte-row-your-boat',
      'trad-amazing-grace',
      'pierpont-jingle-bells',
      'foster-oh-susanna',
      'trad-auld-lang-syne',
      'trad-swing-low',
    ]);
  });

  it.each(LEAD_SHEETS)(
    '%s: a melody in a singable key, the bass staff left for the symbols',
    (id) => {
      const score = parse(id);
      const fifths = Number(/<fifths>(-?\d+)<\/fifths>/.exec(FILES[id]!)![1]);
      expect(Math.abs(fifths)).toBeLessThanOrEqual(2);
      expect(score.notes.every((n) => n.hand === 'right' && n.staff === 1)).toBe(true);
      // C4 to F5: a voice's range, and the right hand's, above a left hand to come.
      const keys = score.notes.map((n) => n.midi);
      expect(Math.min(...keys)).toBeGreaterThanOrEqual(60);
      expect(Math.max(...keys)).toBeLessThanOrEqual(77);
      expect(builtInPiece(id)!.facts.bars.left).toBe(0);
      expect(score.warnings).toEqual([]);
    },
  );

  it.each(LEAD_SHEETS)(
    '%s: every symbol is a known chord in the house style, written where the chord changes',
    (id) => {
      const score = parse(id);
      const harmonies = score.harmonies!;
      expect(harmonies.length).toBeGreaterThan(0);
      for (const h of harmonies) {
        expect(h.symbol, h.text).not.toBeNull();
        expect(formatSymbol(h.symbol!)).toBe(h.text);
        expect(parseSymbol(h.text)).toEqual(h.symbol);
        expect(symbolPitchClasses(h.symbol!).size).toBeGreaterThanOrEqual(3);
        expect([h.part, h.staff]).toEqual([0, 1]);
      }
      // The first stands over the first full bar's downbeat.
      const first = score.measures.find((m) => m.number === '1')!;
      expect(harmonies[0]!.tick).toBe(first.start);
      for (let i = 1; i < harmonies.length; i++)
        expect(harmonies[i]!.text, symbols(score)).not.toBe(harmonies[i - 1]!.text);
    },
  );

  it.each(LEAD_SHEETS)('%s: the symbols fit the tune', (id) => {
    // Under each symbol, until the next, most of the melody's time is on its chord's tones.
    const score = parse(id);
    const harmonies = score.harmonies!;
    const last = score.measures.at(-1)!;
    harmonies.forEach((h, i) => {
      const until = harmonies[i + 1]?.tick ?? last.start + last.duration;
      const pcs = symbolPitchClasses(h.symbol!);
      let inChord = 0;
      let all = 0;
      for (const n of score.notes) {
        const overlap = Math.min(n.onset + n.duration, until) - Math.max(n.onset, h.tick);
        if (overlap <= 0) continue;
        all += overlap;
        if (pcs.has(n.midi % 12)) inChord += overlap;
      }
      const where = `${h.text} in bar ${score.measures[h.measure]!.number}`;
      expect(inChord / all, where).toBeGreaterThan(0.5);
    });
  });

  it('Twinkle, Twinkle: 24 bars of 2/4 in G, a a b b a a', () => {
    const score = parse('trad-twinkle-twinkle');
    expect(score.measures).toHaveLength(24);
    expect(runs(score)).toBe('0-23');
    expect(
      buildSteps(score, 'right')
        .slice(0, 7)
        .map((s) => s.midis[0]),
    ).toEqual([67, 67, 74, 74, 76, 76, 74]);
    expect(symbols(score)).toBe(
      '1 G, 3 C, 4 G, 5 C, 6 G, 7 D7, 8 G, 10 C, 11 G, 12 D, 13 G, 14 C, 15 G, 16 D, ' +
        '17 G, 19 C, 20 G, 21 C, 22 G, 23 D7, 24 G',
    );
    expect(score.tempos).toEqual([{ tick: 0, bpm: 96 }]);
  });

  it('Frère Jacques: the round and the first voice’s four closing bars, in F', () => {
    const score = parse('trad-frere-jacques');
    expect(score.measures).toHaveLength(20);
    expect(runs(score)).toBe('0-19');
    expect(buildSteps(score, 'right').at(-1)!.midis).toEqual([69]);
    expect(symbols(score)).toBe(
      '1 F, 9 C7, 10 F, 11 C7, 12 F, 13.2 C7, 14 F, 15.2 C7, 16 F, 17.2 C7, 18 F, 19.2 C7, 20 F',
    );
  });

  it('Row Your Boat: 8 bars of 6/8 in D, on D with A7 before the end', () => {
    const score = parse('lyte-row-your-boat');
    expect(score.measures).toHaveLength(8);
    expect(score.measures[0]).toMatchObject({ beats: 6, beatType: 8 });
    expect(runs(score)).toBe('0-7');
    // The tied halves of bars 4 and 8 are no new key presses.
    expect(score.notes.filter((n) => n.tieStop)).toHaveLength(2);
    expect(symbols(score)).toBe('1 D, 7 A7, 8 D');
  });

  it('Amazing Grace: a quarter-note pickup, 3/4 in G, a half note to close', () => {
    const score = parse('trad-amazing-grace');
    expect(score.measures).toHaveLength(15);
    expect(score.measures[0]).toMatchObject({ number: '0', duration: Q });
    expect(score.measures.at(-1)!.duration).toBe(2 * Q);
    expect(runs(score)).toBe('0-14');
    expect(symbols(score)).toBe('1 G, 3 C, 4 G, 6 Em, 6.3 D, 8 G, 10 C, 11 G, 13.3 D7, 14 G');
  });

  it('Jingle Bells: verse and chorus in G, transposed from the edition’s A♭', () => {
    const score = parse('pierpont-jingle-bells');
    expect(score.measures).toHaveLength(16);
    expect(runs(score)).toBe('0-15');
    expect(
      buildSteps(score, 'right')
        .slice(0, 5)
        .map((s) => s.midis[0]),
    ).toEqual([62, 71, 69, 67, 62]);
    expect(FILES['pierpont-jingle-bells']).toMatch(/transposed to G major/);
    expect(symbols(score)).toBe(
      '1 G, 2.3 C, 3 Am, 3.3 D7, 4.3 G, 6.3 C, 7 Am, 7.3 D7, 8.3 G, 11 C, 11.3.5 G, ' +
        '12.3 D7, 13 G, 15 C, 15.3.5 G, 16 D7, 16.3 G',
    );
  });

  it('Oh! Susanna: a pickup, the verse, and the chorus repeated', () => {
    const score = parse('foster-oh-susanna');
    expect(score.measures).toHaveLength(25);
    expect(score.measures[0]).toMatchObject({ number: '0', duration: Q / 2 });
    expect(score.measures[17]!.repeat.forward).toBe(true);
    expect(runs(score)).toBe('0-24,17-24');
    expect(symbols(score)).toBe(
      '1 G, 4 D7, 5 G, 7.2 D7, 8 G, 12 D7, 13 G, 15.2 D7, 16 G, 17 C, 19 G, 20 D7, 21 G, ' +
        '23.2 D7, 24 G',
    );
  });

  it('Auld Lang Syne: the chorus repeated from its own pickup bar, its symbols with it', () => {
    const score = parse('trad-auld-lang-syne');
    expect(score.measures).toHaveLength(18);
    expect(score.measures.map((m) => m.number).slice(7, 10)).toEqual(['7', '8', '8a']);
    expect(score.measures[8]!.duration + score.measures[9]!.duration).toBe(2 * Q);
    expect(score.measures[9]!.repeat.forward).toBe(true);
    expect(runs(score)).toBe('0-17,9-17');
    // Bar 3's Scotch snap: a sixteenth, then a dotted eighth.
    const bar3 = score.notes.filter((n) => n.measure === 3).map((n) => n.duration);
    expect(bar3).toEqual([Q / 4, (3 * Q) / 4, Q / 2, Q / 2]);
    expect(symbols(score)).toBe(
      '1 G, 2 D7, 3 G, 4 C, 5 G, 6 D7, 7 C, 7.2.5 D7, 8 G, 10 D7, 11 G, 12 C, 13 G, 14 D7, ' +
        '15 C, 15.2.5 D7, 16 G',
    );
    // Through the repeat the chorus's symbols come twice.
    const order = performanceOrder(score.measures);
    expect(performedMarks(score.harmonies!, score.measures, order)).toHaveLength(17 + 8);
  });

  it('Swing Low, Sweet Chariot: the D.C. written out, refrain, verse and refrain', () => {
    const score = parse('trad-swing-low');
    expect(score.measures).toHaveLength(24);
    expect(runs(score)).toBe('0-23');
    const fermatas = score.markings.fermatas.map((f) => score.measures[f.measure]!.number);
    expect(fermatas).toEqual(['1', '5', '17', '21']);
    const bars = (from: number) =>
      score.notes
        .filter((n) => n.measure >= from && n.measure < from + 7)
        .map((n) => [n.onset - score.measures[from]!.start, n.midi, n.duration]);
    expect(bars(16)).toEqual(bars(0));
    expect(symbols(score)).toBe(
      '1 F, 2 B♭, 2.2.25 F, 4 C7, 5 F, 6 B♭, 6.2.25 F, 7.2.5 C7, 8 F, 10 B♭, 10.2.25 F, ' +
        '12 C7, 13 F, 14 B♭, 14.2.25 F, 15.2.5 C7, 16 F, 18 B♭, 18.2.25 F, 20 C7, 21 F, ' +
        '22 B♭, 22.2.25 F, 23.2.5 C7, 24 F',
    );
  });
});
