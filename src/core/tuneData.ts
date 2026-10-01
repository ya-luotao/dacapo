// The melodies of the library's lead sheets, for playing them by ear (docs/HARMONY.md, "Playing by
// ear (H5)"): each tune as it is sung, repeats played, one phrase to a line. The notes are the
// library files' right hand, note for note; a test reads every file and holds this table to it
// (src/pieces/library/tunes.test.ts), so the Ear page, the summaries and the validators of stored
// answers need no MusicXML. Where a phrase begins is this table's own: a line of the song, from its
// upbeat where it has one.
//
// A note is its name and its length in sixteenths (`G4/4` a quarter, `Bb4/3` a dotted eighth), a
// rest `r/2`; `~` ties a note to the next; `|` ends a bar (a line that ends without one stops
// within its bar, and the next line's first notes are that bar's upbeat).

import type { TuneId } from './tuneList.ts';

export interface TuneSource {
  /** The key signature of its major key: sharps (+) or flats (−). */
  fifths: number;
  /** Its time signature. */
  beats: number;
  beatType: number;
  /** Quarter notes a minute, as the Ear page plays it: its own pace, kept moderate. */
  bpm: number;
  /** One phrase to a line, in the order sung. */
  phrases: readonly string[];
}

const TWINKLE_A = [
  'G4/4 G4/4 | D5/4 D5/4 | E5/4 E5/4 | D5/8 |',
  'C5/4 C5/4 | B4/4 B4/4 | A4/4 A4/4 | G4/8 |',
];
const TWINKLE_B = 'D5/4 D5/4 | C5/4 C5/4 | B4/4 B4/4 | A4/8 |';

const JINGLE_BELLS = 'B4/2 B4/2 B4/4 B4/2 B4/2 B4/4 | B4/2 D5/2 G4/3 A4/1 B4/6 r/2 |';
const WHAT_FUN = 'C5/2 C5/2 C5/3 C5/1 C5/2 B4/2 B4/2 B4/1 B4/1 |';

const SUSANNA_CHORUS = [
  'C5/4 C5/4 | E5/2 E5/4 E5/2 | D5/2 D5/2 B4/2 G4/2 | A4/4 r/2',
  'G4/1 A4/1 | B4/2 D5/2 D5/2 E5/2 | D5/2 B4/2 G4/2 A4/2 | B4/2 B4/2 A4/2 A4/2 | G4/4 r/4 |',
];

const AULD_CHORUS = [
  'E5/2 | D5/3 B4/1 B4/3 G4/1 | A4/3 G4/1 A4/2 r/1',
  'B4/1 | D5/3 B4/1 B4/3 D5/1 | E5/6',
  'E5/2 | D5/3 B4/1 B4/2 G4/2 | A4/3 G4/1 A4/2',
  'B4/2 | G4/3 E4/1 E4/2 D4/2 | G4/4 r/2 |',
];

const SWING_LOW = 'F4/3 F4/1 D4/1 C4/3 |';
const CARRY_ME = 'F4/1 F4/1 F4/1 F4/1 A4/1 A4/1';
/** The refrain up to its last bar, which the verse's upbeat or the end completes. */
const SWING_REFRAIN = [
  `A4/2 F4/4 A4/2 | ${SWING_LOW}`,
  `${CARRY_ME} C5/2 | C5/8 |`,
  `C5/2 A4/4 C5/2 | ${SWING_LOW}`,
];

export const TUNE_SOURCES: Readonly<Record<TuneId, TuneSource>> = {
  // a a b b a a, written out in the print.
  'trad-twinkle-twinkle': {
    fifths: 1,
    beats: 2,
    beatType: 4,
    bpm: 96,
    phrases: [...TWINKLE_A, TWINKLE_B, TWINKLE_B, ...TWINKLE_A],
  },
  'trad-frere-jacques': {
    fifths: -1,
    beats: 2,
    beatType: 4,
    bpm: 92,
    phrases: [
      'F4/4 G4/4 | A4/4 F4/4 | F4/4 G4/4 | A4/4 F4/4 |',
      'A4/4 Bb4/4 | C5/8 | A4/4 Bb4/4 | C5/8 |',
      'C5/2 D5/2 C5/2 Bb4/2 | A4/4 F4/4 | C5/2 D5/2 C5/2 Bb4/2 | A4/4 F4/4 |',
      'F4/4 C4/4 | F4/4 r/4 | F4/4 C4/4 | F4/4 r/4 |',
      'A4/2 C5/2 Bb4/2 G4/2 | A4/2 C5/2 F5/4 | A4/2 C5/2 Bb4/2 G4/2 | A4/4 r/4 |',
    ],
  },
  // A dotted quarter at 60.
  'lyte-row-your-boat': {
    fifths: 2,
    beats: 6,
    beatType: 8,
    bpm: 90,
    phrases: [
      'D4/6 D4/6 | D4/4 E4/2 F#4/6 |',
      'F#4/4 F#4/2 F#4/4 G4/2 | A4/6~ A4/6 |',
      'D5/2 D5/2 D5/2 A4/2 A4/2 A4/2 | F#4/2 F#4/2 F#4/2 D4/2 D4/2 D4/2 |',
      'A4/4 G4/2 F#4/4 E4/2 | D4/6~ D4/6 |',
    ],
  },
  // Common metre: lines of four and three bars, each from the last beat of a bar.
  'trad-amazing-grace': {
    fifths: 1,
    beats: 3,
    beatType: 4,
    bpm: 84,
    phrases: [
      'D4/4 | G4/8 B4/2 G4/2 | B4/8 A4/4 | G4/8 E4/4 | D4/8',
      'D4/4 | G4/8 B4/2 G4/2 | B4/8 A4/4 | D5/8',
      'B4/4 | D5/6 B4/2 D5/2 B4/2 | G4/8 D4/4 | E4/6 G4/2 G4/2 E4/2 | D4/8',
      'D4/4 | G4/8 B4/2 G4/2 | B4/8 A4/4 | G4/8 |',
    ],
  },
  // The print writes two bars of the song in one, at 132; here at 108.
  'pierpont-jingle-bells': {
    fifths: 1,
    beats: 4,
    beatType: 4,
    bpm: 108,
    phrases: [
      'D4/2 B4/2 A4/2 G4/2 D4/4 r/2 D4/1 D4/1 | D4/2 B4/2 A4/2 G4/2 E4/4 r/4 |',
      'E4/2 C5/2 B4/2 A4/2 F#4/4 r/4 | D5/2 D5/2 C5/2 A4/2 B4/4 G4/2 r/2 |',
      'D4/2 B4/2 A4/2 G4/2 D4/4 r/4 | D4/2 B4/2 A4/2 G4/2 E4/4 r/2',
      'E4/2 | E4/2 C5/2 B4/2 A4/2 D5/2 D5/2 D5/2 D5/2 | E5/2 D5/2 C5/2 A4/2 G4/6 r/2 |',
      JINGLE_BELLS,
      `${WHAT_FUN} B4/2 A4/2 A4/2 G4/2 A4/2 D5/6 |`,
      JINGLE_BELLS,
      `${WHAT_FUN} D5/2 D5/2 C5/2 A4/2 G4/6 r/2 |`,
    ],
  },
  // The verse, then the chorus twice (repeat signs in the print).
  'foster-oh-susanna': {
    fifths: 1,
    beats: 2,
    beatType: 4,
    bpm: 100,
    phrases: [
      'G4/1 A4/1 | B4/2 D5/2 D5/2 E5/2 | D5/2 B4/2 G4/3 A4/1 | B4/2 B4/2 A4/2 G4/2 | A4/6',
      'G4/1 A4/1 | B4/2 D5/2 D5/3 E5/1 | D5/2 B4/2 G4/3 A4/1 | B4/2 B4/2 A4/2 A4/2 | G4/4 r/2',
      'G4/1 A4/1 | B4/2 D5/2 D5/3 E5/1 | D5/2 B4/2 G4/3 A4/1 | B4/2 B4/2 A4/2 G4/2 | A4/4 r/2',
      'G4/1 A4/1 | B4/2 D5/2 D5/2 E5/2 | D5/2 B4/2 G4/3 A4/1 | B4/1 B4/3 A4/3 A4/1 | G4/4 r/4 |',
      ...SUSANNA_CHORUS,
      ...SUSANNA_CHORUS,
    ],
  },
  // Half lines, each from its upbeat, at the print's slow 60; the chorus twice, from its own
  // upbeat bar after the repeat sign.
  'trad-auld-lang-syne': {
    fifths: 1,
    beats: 2,
    beatType: 4,
    bpm: 60,
    phrases: [
      'D4/2 | G4/3 G4/1 G4/2 B4/2 | A4/3 G4/1 A4/2',
      'B4/2 | G4/1 G4/3 B4/2 D5/2 | E5/6',
      'E5/2 | D5/3 B4/1 B4/2 G4/2 | A4/3 G4/1 A4/2',
      'B4/2 | G4/3 E4/1 E4/2 D4/2 | G4/4 r/2 |',
      ...AULD_CHORUS,
      ...AULD_CHORUS,
    ],
  },
  // Call and response, two bars each: refrain, verse, refrain (the print's D.C. written out).
  // The print writes the song's quarters as eighths, so a quarter here is slow.
  'trad-swing-low': {
    fifths: -1,
    beats: 2,
    beatType: 4,
    bpm: 50,
    phrases: [
      ...SWING_REFRAIN,
      `${CARRY_ME} G4/2 | F4/6`,
      'A4/2 | C5/2 F4/1 D4/1 F4/2 F4/1 F4/1 | F4/1 F4/1 F4/2 D4/1 C4/3 |',
      'F4/1 F4/1 F4/1 F4/1 A4/1 C5/1 C5/2 | C5/6',
      'C5/2 | D5/1 C5/1 A4/2 A4/2 F4/2 | F4/1 F4/1 F4/1 F4/1 D4/1 C4/3 |',
      `${CARRY_ME} G4/2 | F4/8 |`,
      ...SWING_REFRAIN,
      `${CARRY_ME} G4/2 | F4/6 r/2 |`,
    ],
  },
};
