// The built-in pieces: public-domain works in encodings we may redistribute, with where each one
// comes from. The MusicXML is loaded only when a piece is opened.

import type { PieceFacts } from '../../core/pieceRecords.ts';

/** 0 = Initial; 1–5 = the usual graded-exam steps, roughly. */
export type PieceLevel = 0 | 1 | 2 | 3 | 4 | 5;

export const BUILT_IN_IDS = [
  'beethoven-ode-to-joy',
  'petzold-minuet-in-g',
  'burgmuller-arabesque',
  'schumann-soldiers-march',
  'beethoven-fur-elise',
  'bach-prelude-in-c',
] as const;

export type BuiltInId = (typeof BUILT_IN_IDS)[number];

export interface BuiltInPiece {
  id: BuiltInId;
  level: PieceLevel;
  /** English, as in the file. */
  composer: string;
  work: string;
  /** The edition the notes were taken from. */
  source: string;
  sourceUrl: string;
  encoder: string;
  licence: string;
  /** Checksum and bar counts, for the library without loading the file (locked by a test). */
  facts: PieceFacts;
}

export const BUILT_IN: readonly BuiltInPiece[] = [
  {
    id: 'beethoven-ode-to-joy',
    level: 0,
    composer: 'Ludwig van Beethoven',
    work: 'Symphony No. 9 in D minor, Op. 125, finale: theme (“Ode to Joy”), arranged in C major',
    source:
      'The theme of the Ninth Symphony’s finale, transposed to C; left hand by the dacapo project',
    sourceUrl: 'https://imslp.org/wiki/Symphony_No.9,_Op.125_(Beethoven,_Ludwig_van)',
    encoder: 'dacapo project',
    licence: 'Public-domain work; arrangement and encoding MIT',
    facts: { checksum: '7a47ee21', bars: { right: 16, left: 16, both: 16 } },
  },
  {
    id: 'petzold-minuet-in-g',
    level: 1,
    composer: 'Christian Petzold (attr.)',
    work: 'Minuet in G major, BWV Anh. 114',
    source: 'Bach-Gesellschaft vol. 43.2 (1894), as typeset for the Mutopia Project (piece 75)',
    sourceUrl: 'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=75',
    encoder: 'dacapo project',
    licence: 'Public-domain work; encoding MIT',
    facts: { checksum: 'b80fe0e1', bars: { right: 32, left: 32, both: 32 } },
  },
  {
    id: 'burgmuller-arabesque',
    level: 3,
    composer: 'Friedrich Burgmüller',
    work: '25 Études faciles et progressives, Op. 100 No. 2: Arabesque',
    source: 'MuseScore upload by PianoXML, via PDMX',
    sourceUrl: 'https://musescore.com/user/9292486/scores/5849868',
    encoder: 'PianoXML (fingering removed by the dacapo project)',
    licence: 'CC0 1.0; PDMX dataset CC BY 4.0',
    facts: { checksum: '7db61cc9', bars: { right: 31, left: 33, both: 33 } },
  },
  {
    id: 'schumann-soldiers-march',
    level: 2,
    composer: 'Robert Schumann',
    work: 'Album für die Jugend, Op. 68 No. 2: Soldatenmarsch',
    source: 'MuseScore upload by jadr, via PDMX',
    sourceUrl: 'https://musescore.com/user/31901603/scores/5860733',
    encoder: 'jadr (fingering removed by the dacapo project)',
    licence: 'CC0 1.0; PDMX dataset CC BY 4.0',
    facts: { checksum: '3deaa5fc', bars: { right: 32, left: 32, both: 32 } },
  },
  {
    id: 'beethoven-fur-elise',
    level: 3,
    composer: 'Ludwig van Beethoven',
    work: 'Bagatelle in A minor, WoO 59 (“Für Elise”): A section',
    source: 'Breitkopf & Härtel 1888, as typeset for the Mutopia Project (piece 931)',
    sourceUrl: 'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=931',
    encoder: 'dacapo project',
    licence: 'Public-domain work; encoding MIT',
    facts: { checksum: '2718f11a', bars: { right: 25, left: 20, both: 25 } },
  },
  {
    id: 'bach-prelude-in-c',
    level: 5,
    composer: 'Johann Sebastian Bach',
    work: 'The Well-Tempered Clavier I, Prelude in C major, BWV 846',
    source: 'The Open Well-Tempered Clavier score (MuseScore upload by OpenGoldberg), via PDMX',
    sourceUrl: 'https://musescore.com/user/9836/scores/719631',
    encoder: 'OpenGoldberg (Open WTC)',
    licence: 'CC0 1.0; PDMX dataset CC BY 4.0',
    facts: { checksum: 'aaa8934c', bars: { right: 35, left: 35, both: 35 } },
  },
];

const FILES = import.meta.glob<string>('./*.musicxml', { query: '?raw', import: 'default' });

export function isBuiltInId(id: string): id is BuiltInId {
  return (BUILT_IN_IDS as readonly string[]).includes(id);
}

export function builtInPiece(id: string): BuiltInPiece | undefined {
  return BUILT_IN.find((p) => p.id === id);
}

/** The MusicXML of a built-in piece. */
export function loadBuiltIn(id: BuiltInId): Promise<string> {
  const load = FILES[`./${id}.musicxml`];
  if (!load) return Promise.reject(new Error(`No file for built-in piece ${id}`));
  return load();
}
