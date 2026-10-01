"""Jingle Bells (James Lord Pierpont, 1857): a lead sheet, the song as Heart Songs Dear to the
American People (Boston: Chapple, 1909) prints it, pages 148-149, in 4/4, transposed from the
edition's A-flat major down a semitone to G major (one sharp instead of four flats; it sits in the
same place for the voice).

The melody is the edition's voice part for the first verse, note for note, then the chorus,
sixteen bars in all, as printed (the edition writes eighth notes in common time: each bar is two
bars of the song as it is usually written today). The small notes and the extra stems the edition
adds for the second and third verses' syllables are left out, and where the first verse has a
rest there, so does the encoding: bar 1's two sixteenths ("In a") are two notes, which the later
verses tie. The tempo words are the edition's ("Allegro"); the metronome figure is ours. The
edition sets the chorus over four voices; only the tune is taken. The chord symbols are ours
(dacapo project, MIT): I, ii, IV and V7 of G, two to a bar where the harmony moves. The bass staff
is left empty (whole-bar rests) for a left hand made from the symbols.
"""

VERSE = [
    # Dashing thro' the snow, In a / one-horse open sleigh;
    '@h:G d4/2 b4/2 a4/2 g4/2 d4/4 r/2 d4/1 d4/1', 'd4/2 b4/2 a4/2 g4/2 @h:C e4/4 r/2 r/2',
    # O'er the fields we go, / Laughing all the way;
    '@h:Am e4/2 c5/2 b4/2 a4/2 @h:D7 fs4/4 r/2 r/2', 'd5/2 d5/2 c5/2 a4/2 @h:G b4/4 g4/2 r/2',
    # Bells on bob-tail ring, / Making spirits bright; What
    'd4/2 b4/2 a4/2 g4/2 d4/4 r/2 r/2', 'd4/2 b4/2 a4/2 g4/2 @h:C e4/4 r/2 e4/2',
    # fun it is to ride and sing / A sleighing song to-night!
    '@h:Am e4/2 c5/2 b4/2 a4/2 @h:D7 d5/2 d5/2 d5/2 d5/2', 'e5/2 d5/2 c5/2 a4/2 @h:G g4/6 r/2',
]
CHORUS = [
    # Jingle, bells! Jingle, bells! / Jingle all the way!
    'b4/2 b4/2 b4/4 b4/2 b4/2 b4/4', 'b4/2 d5/2 g4/3 a4/1 b4/6 r/2',
    # Oh! what fun it is to ride / In a one-horse open sleigh!
    '@h:C c5/2 c5/2 c5/3 c5/1 c5/2 @h:G b4/2 b4/2 b4/1 b4/1',
    'b4/2 a4/2 a4/2 g4/2 @h:D7 a4/2 d5/6',
    # Jingle, bells! jingle, bells! / Jingle all the way!
    '@h:G b4/2 b4/2 b4/4 b4/2 b4/2 b4/4', 'b4/2 d5/2 g4/3 a4/1 b4/6 r/2',
    # Oh! what fun it is to ride / In a one-horse open sleigh!
    '@h:C c5/2 c5/2 c5/3 c5/1 c5/2 @h:G b4/2 b4/2 b4/1 b4/1',
    '@h:D7 d5/2 d5/2 c5/2 a4/2 @h:G g4/6 r/2',
]

measures = [{'voices': [(1, 1, m), (2, 5, 'r/16')]} for m in VERSE + CHORUS]
measures[7]['right'] = ['<barline location="right"><bar-style>light-light</bar-style></barline>']
measures[-1]['right'] = ['<barline location="right"><bar-style>light-heavy</bar-style></barline>']

PIECE = {
    'title': 'Jingle Bells',
    'composer': 'James Lord Pierpont',
    'fifths': 1, 'beats': 4, 'beat_type': 4, 'beam_group': 4, 'bpm': 132,
    'tempo_text': 'Allegro', 'measures': measures,
    'source': 'Heart Songs Dear to the American People (Boston: Chapple Publishing, 1909), '
              'pp. 148-149, "Jingle, Bells" (public domain), in A-flat major, transposed to G major '
              'by the dacapo project, scan: '
              'https://archive.org/details/heartsongsdearto00chap/page/n163/',
    'encoder': 'dacapo project',
    'encoding_date': '2026-10-01',
    'rights': 'Music: public domain. This encoding, its transposition and the chord symbols: '
              'dacapo project, released under the MIT licence.',
    'comments': [
        'A lead sheet: the melody (the edition\'s voice part for the first verse, then the chorus, '
        'note for note) transposed from A-flat major to G major, and chord symbols of our own '
        '(dacapo project, MIT). The small notes for the later verses\' syllables are left out. The '
        'edition\'s tempo word; the metronome figure is ours. The bass staff is empty, for a left '
        'hand made from the symbols. No fingering.',
    ],
}
