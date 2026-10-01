// The built-in pieces: public-domain works in encodings we may redistribute, with where each one
// comes from. The MusicXML is loaded only when a piece is opened.

import type { PieceFacts } from '../../core/pieceRecords.ts';

/** 0 = Initial; 1–5 = the usual graded-exam steps, roughly. */
export type PieceLevel = 0 | 1 | 2 | 3 | 4 | 5;

export const BUILT_IN_IDS = [
  'turk-aller-anfang',
  'beethoven-ode-to-joy',
  'czerny-op599-no11',
  'turk-muntere-knabe',
  'beyer-kinderlied',
  'turk-hans-ohne-sorgen',
  'turk-matt-und-krank',
  'turk-bey-der-wiege',
  'beyer-abendlied',
  'beyer-op101-no66',
  'schumann-melodie',
  'petzold-minuet-in-g',
  'burgmuller-arabesque',
  'schumann-soldiers-march',
  'beethoven-fur-elise',
  'bach-prelude-in-c',
  'petzold-minuet-in-g-minor',
  'bach-musette-in-d',
  'burgmuller-candeur',
  'tchaikovsky-old-french-song',
  'tchaikovsky-morning-prayer',
  'chopin-prelude-in-c-minor',
  'satie-gymnopedie-1',
  'trad-twinkle-twinkle',
  'trad-frere-jacques',
  'lyte-row-your-boat',
  'trad-amazing-grace',
  'pierpont-jingle-bells',
  'foster-oh-susanna',
  'trad-auld-lang-syne',
  'trad-swing-low',
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
  /**
   * A lead sheet (docs/HARMONY.md, "Lead sheets (H3)"): a melody on the treble staff with chord
   * symbols of our own, the bass staff empty for a left hand made from the symbols; absent for a
   * piece written out for both hands. The Pieces page lists the lead sheets under their own
   * heading.
   */
  leadSheet?: true;
  /** Checksum and bar counts, for the library without loading the file (locked by a test). */
  facts: PieceFacts;
}

export const BUILT_IN: readonly BuiltInPiece[] = [
  {
    id: 'turk-aller-anfang',
    level: 0,
    composer: 'Daniel Gottlob Türk',
    work: 'Sechzig Handstücke für angehende Klavierspieler, part 1, No. 1: Aller Anfang ist schwer',
    source:
      'Sechzig Handstücke für angehende Klavierspieler, part 1, 2nd edition (Leipzig and Halle, 1797); scan of the Bayerische Staatsbibliothek',
    sourceUrl: 'https://www.digitale-sammlungen.de/en/view/bsb00086024?page=9',
    encoder: 'dacapo project',
    licence: 'Public-domain work; encoding MIT',
    facts: {
      checksum: '09efdf72',
      bars: { right: 8, left: 8, both: 8 },
      notes: { play: 35, skip: 35 },
    },
  },
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
    facts: {
      checksum: '7a47ee21',
      bars: { right: 16, left: 16, both: 16 },
      notes: { play: 85, skip: 85 },
    },
  },
  {
    id: 'czerny-op599-no11',
    level: 0,
    composer: 'Carl Czerny',
    work: 'Practical Method for Beginners on the Pianoforte, Op. 599, No. 11',
    source:
      'G. Schirmer (New York, 1893), edited and fingered by Giuseppe Buonamici; scan on IMSLP',
    sourceUrl: 'https://imslp.org/wiki/Practical_Exercises_for_Beginners,_Op.599_(Czerny,_Carl)',
    encoder: 'dacapo project',
    licence: 'Public-domain work; encoding MIT',
    facts: {
      checksum: 'a2c6a2a0',
      bars: { right: 16, left: 16, both: 16 },
      notes: { play: 232, skip: 116 },
    },
  },
  {
    id: 'turk-muntere-knabe',
    level: 0,
    composer: 'Daniel Gottlob Türk',
    work: 'Sechzig Handstücke für angehende Klavierspieler, part 1, No. 3: Der muntere Knabe',
    source:
      'Sechzig Handstücke für angehende Klavierspieler, part 1, 2nd edition (Leipzig and Halle, 1797); scan of the Bayerische Staatsbibliothek',
    sourceUrl: 'https://www.digitale-sammlungen.de/en/view/bsb00086024?page=9',
    encoder: 'dacapo project',
    licence: 'Public-domain work; encoding MIT',
    facts: {
      checksum: '6be48d2b',
      bars: { right: 8, left: 8, both: 8 },
      notes: { play: 42, skip: 42 },
    },
  },
  {
    id: 'beyer-kinderlied',
    level: 0,
    composer: 'Ferdinand Beyer',
    work: 'Vorschule im Klavierspiel, Op. 101, No. 24: Kinderlied',
    source: 'Edition Peters No. 2721, revised by Adolf Ruthardt (Leipzig, c. 1895); scan on IMSLP',
    sourceUrl: 'https://imslp.org/wiki/Vorschule_im_Klavierspiel,_Op.101_(Beyer,_Ferdinand)',
    encoder: 'dacapo project',
    licence: 'Public-domain work; encoding MIT',
    facts: {
      checksum: '12d399be',
      bars: { right: 12, left: 12, both: 12 },
      notes: { play: 79, skip: 79 },
    },
  },
  {
    id: 'turk-hans-ohne-sorgen',
    level: 0,
    composer: 'Daniel Gottlob Türk',
    work: 'Sechzig Handstücke für angehende Klavierspieler, part 1, No. 4: Hans ohne Sorgen',
    source:
      'Sechzig Handstücke für angehende Klavierspieler, part 1, 2nd edition (Leipzig and Halle, 1797); scan of the Bayerische Staatsbibliothek',
    sourceUrl: 'https://www.digitale-sammlungen.de/en/view/bsb00086024?page=10',
    encoder: 'dacapo project',
    licence: 'Public-domain work; encoding MIT',
    facts: {
      checksum: 'b8164335',
      bars: { right: 8, left: 8, both: 8 },
      notes: { play: 52, skip: 52 },
    },
  },
  {
    id: 'turk-matt-und-krank',
    level: 0,
    composer: 'Daniel Gottlob Türk',
    work: 'Sechzig Handstücke für angehende Klavierspieler, part 1, No. 9: Ich bin so matt und krank',
    source:
      'Sechzig Handstücke für angehende Klavierspieler, part 1, 2nd edition (Leipzig and Halle, 1797); scan of the Bayerische Staatsbibliothek',
    sourceUrl: 'https://www.digitale-sammlungen.de/en/view/bsb00086024?page=11',
    encoder: 'dacapo project',
    licence: 'Public-domain work; encoding MIT',
    facts: {
      checksum: '7c04d493',
      bars: { right: 9, left: 8, both: 9 },
      notes: { play: 32, skip: 32 },
    },
  },
  {
    id: 'turk-bey-der-wiege',
    level: 1,
    composer: 'Daniel Gottlob Türk',
    work: 'Sechzig Handstücke für angehende Klavierspieler, part 1, No. 5: Bey der Wiege zu singen',
    source:
      'Sechzig Handstücke für angehende Klavierspieler, part 1, 2nd edition (Leipzig and Halle, 1797); scan of the Bayerische Staatsbibliothek',
    sourceUrl: 'https://www.digitale-sammlungen.de/en/view/bsb00086024?page=10',
    encoder: 'dacapo project',
    licence: 'Public-domain work; encoding MIT',
    facts: {
      checksum: 'a0ae966d',
      bars: { right: 9, left: 9, both: 9 },
      notes: { play: 55, skip: 55 },
    },
  },
  {
    id: 'beyer-abendlied',
    level: 1,
    composer: 'Ferdinand Beyer',
    work: 'Vorschule im Klavierspiel, Op. 101, No. 58: Abendlied',
    source: 'Edition Peters No. 2721, revised by Adolf Ruthardt (Leipzig, c. 1895); scan on IMSLP',
    sourceUrl: 'https://imslp.org/wiki/Vorschule_im_Klavierspiel,_Op.101_(Beyer,_Ferdinand)',
    encoder: 'dacapo project',
    licence: 'Public-domain work; encoding MIT',
    facts: {
      checksum: 'b1609557',
      bars: { right: 13, left: 13, both: 13 },
      notes: { play: 98, skip: 98 },
    },
  },
  {
    id: 'beyer-op101-no66',
    level: 1,
    composer: 'Ferdinand Beyer',
    work: 'Vorschule im Klavierspiel, Op. 101, No. 66',
    source: 'Edition Peters No. 2721, revised by Adolf Ruthardt (Leipzig, c. 1895); scan on IMSLP',
    sourceUrl: 'https://imslp.org/wiki/Vorschule_im_Klavierspiel,_Op.101_(Beyer,_Ferdinand)',
    encoder: 'dacapo project',
    licence: 'Public-domain work; encoding MIT',
    facts: {
      checksum: 'a4109d0e',
      bars: { right: 20, left: 20, both: 20 },
      notes: { play: 278, skip: 174 },
    },
  },
  {
    id: 'schumann-melodie',
    level: 1,
    composer: 'Robert Schumann',
    work: 'Album für die Jugend, Op. 68 No. 1: Melodie',
    source:
      'J. Schuberth & Co. (Leipzig, 1867), fingered by Karl Klauser; scan at the Internet Archive',
    sourceUrl: 'https://archive.org/details/b26976821/page/n2/',
    encoder: 'dacapo project',
    licence: 'Public-domain work; encoding MIT',
    facts: {
      checksum: 'b99b28f6',
      bars: { right: 20, left: 20, both: 20 },
      notes: { play: 303, skip: 254 },
    },
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
    facts: {
      checksum: 'b80fe0e1',
      bars: { right: 32, left: 32, both: 32 },
      notes: { play: 406, skip: 203 },
    },
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
    facts: {
      checksum: '7db61cc9',
      bars: { right: 31, left: 33, both: 33 },
      notes: { play: 480, skip: 271 },
    },
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
    facts: {
      checksum: '3deaa5fc',
      bars: { right: 32, left: 32, both: 32 },
      notes: { play: 312, skip: 212 },
    },
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
    facts: {
      checksum: '2718f11a',
      bars: { right: 25, left: 20, both: 25 },
      notes: { play: 293, skip: 146 },
    },
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
    facts: {
      checksum: 'aaa8934c',
      bars: { right: 35, left: 35, both: 35 },
      notes: { play: 549, skip: 549 },
    },
  },
  {
    id: 'petzold-minuet-in-g-minor',
    level: 1,
    composer: 'Christian Petzold (attr.)',
    work: 'Minuet in G minor, BWV Anh. 115',
    source: 'Bach-Gesellschaft, as typeset for the Mutopia Project (piece 76)',
    sourceUrl: 'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=76',
    encoder: 'dacapo project',
    licence: 'Public-domain work; encoding MIT',
    facts: {
      checksum: '1bd02b28',
      bars: { right: 32, left: 32, both: 32 },
      notes: { play: 398, skip: 199 },
    },
  },
  {
    id: 'bach-musette-in-d',
    level: 2,
    composer: 'Johann Sebastian Bach (attr.)',
    work: 'Musette in D major, BWV Anh. 126',
    source: 'Bach-Gesellschaft, as typeset for the Mutopia Project (piece 79)',
    sourceUrl: 'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=79',
    encoder: 'dacapo project',
    licence: 'Public-domain work; encoding MIT',
    facts: {
      checksum: '57131154',
      bars: { right: 20, left: 20, both: 20 },
      notes: { play: 342, skip: 171 },
    },
  },
  {
    id: 'burgmuller-candeur',
    level: 2,
    composer: 'Friedrich Burgmüller',
    work: '25 Études faciles et progressives, Op. 100 No. 1: La Candeur',
    source: 'Collection Litolff, as typeset for the Mutopia Project (piece 202)',
    sourceUrl: 'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=202',
    encoder: 'dacapo project',
    licence: 'Public-domain work; encoding MIT',
    facts: {
      checksum: '77bc647c',
      bars: { right: 23, left: 22, both: 23 },
      notes: { play: 408, skip: 235 },
    },
  },
  {
    id: 'tchaikovsky-old-french-song',
    level: 2,
    composer: 'Pyotr Ilyich Tchaikovsky',
    work: 'Album for the Young, Op. 39 No. 16: Old French Song',
    source: 'Schirmer (1904), as typeset for the Mutopia Project (piece 2080)',
    sourceUrl: 'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2080',
    encoder: 'dacapo project',
    licence: 'Public-domain work; encoding MIT',
    facts: {
      checksum: 'f8a3c552',
      bars: { right: 33, left: 32, both: 33 },
      notes: { play: 188, skip: 188 },
    },
  },
  {
    id: 'tchaikovsky-morning-prayer',
    level: 3,
    composer: 'Pyotr Ilyich Tchaikovsky',
    work: 'Album for the Young, Op. 39 No. 1: Morning Prayer',
    source: 'Schirmer (1904), as typeset for the Mutopia Project (piece 2032)',
    sourceUrl: 'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2032',
    encoder: 'dacapo project',
    licence: 'Public-domain work; encoding MIT',
    facts: {
      checksum: '9e16a928',
      bars: { right: 24, left: 24, both: 24 },
      notes: { play: 246, skip: 246 },
    },
  },
  {
    id: 'chopin-prelude-in-c-minor',
    level: 4,
    composer: 'Frédéric Chopin',
    work: 'Prelude in C minor, Op. 28 No. 20',
    source: 'Edition Peters, as typeset for the Mutopia Project (piece 472)',
    sourceUrl: 'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=472',
    encoder: 'dacapo project',
    licence: 'Public-domain work; encoding MIT',
    facts: {
      checksum: '842bdcd3',
      bars: { right: 13, left: 13, both: 13 },
      notes: { play: 286, skip: 286 },
    },
  },
  {
    id: 'satie-gymnopedie-1',
    level: 4,
    composer: 'Erik Satie',
    work: 'Gymnopédie No. 1',
    source: 'Dover reprint of the original edition, as typeset for the Mutopia Project (piece 37)',
    sourceUrl: 'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=37',
    encoder: 'dacapo project',
    licence: 'Public-domain work; encoding MIT',
    facts: {
      checksum: 'db34d100',
      bars: { right: 38, left: 47, both: 47 },
      notes: { play: 455, skip: 228 },
    },
  },
  {
    id: 'trad-twinkle-twinkle',
    level: 0,
    composer: 'Traditional (French air)',
    work: 'Twinkle, Twinkle, Little Star (Ah ! vous dirai-je, maman)',
    source:
      'Franklin Square Song Collection (Harper & Brothers, 1881), p. 95; chord symbols by the dacapo project',
    sourceUrl: 'https://archive.org/details/franklinsquares04mccagoog/page/n99/',
    encoder: 'dacapo project',
    licence: 'Public-domain melody; chord symbols and encoding MIT',
    leadSheet: true,
    facts: {
      checksum: 'eeb5c6ad',
      bars: { right: 24, left: 0, both: 24 },
      notes: { play: 42, skip: 42 },
    },
  },
  {
    id: 'trad-frere-jacques',
    level: 0,
    composer: 'Traditional (French)',
    work: 'Frère Jacques (a round), first voice',
    source:
      'J.-B. Weckerlin, Chansons et rondes enfantines (Garnier frères, 1885), p. 85; chord symbols by the dacapo project',
    sourceUrl: 'https://archive.org/details/chansonsetronde00weck/page/n102/',
    encoder: 'dacapo project',
    licence: 'Public-domain melody; chord symbols and encoding MIT',
    leadSheet: true,
    facts: {
      checksum: '778fec8a',
      bars: { right: 20, left: 0, both: 20 },
      notes: { play: 44, skip: 44 },
    },
  },
  {
    id: 'lyte-row-your-boat',
    level: 1,
    composer: 'E. O. Lyte',
    work: 'Row Your Boat (a round)',
    source:
      'Franklin Square Song Collection (Harper & Brothers, 1881), p. 69; chord symbols by the dacapo project',
    sourceUrl: 'https://archive.org/details/franklinsquares04mccagoog/page/n73/',
    encoder: 'dacapo project',
    licence: 'Public-domain melody; chord symbols and encoding MIT',
    leadSheet: true,
    facts: {
      checksum: 'f8cdf8f2',
      bars: { right: 8, left: 0, both: 8 },
      notes: { play: 27, skip: 27 },
    },
  },
  {
    id: 'trad-amazing-grace',
    level: 1,
    composer: 'Traditional (American hymn tune)',
    work: 'Amazing Grace (the tune New Britain; words by John Newton)',
    source:
      'Coronation Hymns, ed. E. O. Excell (1910), No. 282, the soprano line; chord symbols by the dacapo project',
    sourceUrl: 'https://archive.org/details/coronationhymns0000eoex_f0r6/page/n281/',
    encoder: 'dacapo project',
    licence: 'Public-domain melody; chord symbols and encoding MIT',
    leadSheet: true,
    facts: {
      checksum: '45518e37',
      bars: { right: 15, left: 0, both: 15 },
      notes: { play: 35, skip: 35 },
    },
  },
  {
    id: 'pierpont-jingle-bells',
    level: 1,
    composer: 'James Lord Pierpont',
    work: 'Jingle Bells (One Horse Open Sleigh): first verse and chorus',
    source:
      'Heart Songs Dear to the American People (Chapple, 1909), pp. 148–149, transposed from A♭ to G major; chord symbols by the dacapo project',
    sourceUrl: 'https://archive.org/details/heartsongsdearto00chap/page/n163/',
    encoder: 'dacapo project',
    licence: 'Public-domain melody; chord symbols and encoding MIT',
    leadSheet: true,
    facts: {
      checksum: '19fc9bb3',
      bars: { right: 16, left: 0, both: 16 },
      notes: { play: 98, skip: 98 },
    },
  },
  {
    id: 'foster-oh-susanna',
    level: 2,
    composer: 'Stephen Foster',
    work: 'Oh! Susanna: verse and chorus',
    source:
      'Heart Songs Dear to the American People (Chapple, 1909), pp. 172–173; chord symbols by the dacapo project',
    sourceUrl: 'https://archive.org/details/heartsongsdearto00chap/page/n187/',
    encoder: 'dacapo project',
    licence: 'Public-domain melody; chord symbols and encoding MIT',
    leadSheet: true,
    facts: {
      checksum: 'f1e65c83',
      bars: { right: 25, left: 0, both: 25 },
      notes: { play: 110, skip: 85 },
    },
  },
  {
    id: 'trad-auld-lang-syne',
    level: 2,
    composer: 'Traditional (Scottish)',
    work: 'Auld Lang Syne: verse and chorus',
    source:
      'Franklin Square Song Collection (Harper & Brothers, 1881), p. 104; chord symbols by the dacapo project',
    sourceUrl: 'https://archive.org/details/franklinsquares04mccagoog/page/n108/',
    encoder: 'dacapo project',
    licence: 'Public-domain melody; chord symbols and encoding MIT',
    leadSheet: true,
    facts: {
      checksum: '1fc67ba5',
      bars: { right: 18, left: 0, both: 18 },
      notes: { play: 84, skip: 56 },
    },
  },
  {
    id: 'trad-swing-low',
    level: 2,
    composer: 'Traditional (African American spiritual)',
    work: 'Swing Low, Sweet Chariot: refrain, verse and refrain',
    source:
      'Heart Songs Dear to the American People (Chapple, 1909), p. 251, the soprano line; chord symbols by the dacapo project',
    sourceUrl: 'https://archive.org/details/heartsongsdearto00chap/page/n272/',
    encoder: 'dacapo project',
    licence: 'Public-domain melody; chord symbols and encoding MIT',
    leadSheet: true,
    facts: {
      checksum: 'ec992a8e',
      bars: { right: 24, left: 0, both: 24 },
      notes: { play: 100, skip: 100 },
    },
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
