"""Swing Low, Sweet Chariot: a lead sheet, the spiritual as Heart Songs Dear to the American People
(Boston: Chapple, 1909) prints it, page 251 ("Slave Hymn"), in F major and 2/4.

The melody is the edition's soprano line, note for note. The edition prints the refrain (eight
bars, ending at Fine), then the verse with its eighth-note pickup (eight bars, ending D.C.): the
encoding writes the da capo out, refrain, verse, refrain, 24 bars, since dacapo plays written
bars and does not follow D.C. The refrain's last bar is a dotted quarter at Fine; the first time
it holds the verse's pickup after it, the last time an eighth rest. The fermatas over "low" are
the edition's; its dynamics and accents are left out. The edition sets the tune for four voices;
only the tune is taken. The chord symbols are ours (dacapo project, MIT): I, IV and V7 of F. The
bass staff is left empty (whole-bar rests) for a left hand made from the symbols.
"""

REFRAIN = [
    # Swing low, sweet chariot, / Coming for to carry me home,
    'a4/2 f4/4!fe a4/2', '@h:Bb f4/3 f4/1 d4/1 @h:F c4/3',
    'f4/1 f4/1 f4/1 f4/1 a4/1 a4/1 c5/2', '@h:C7 c5/8',
    # Swing low, sweet chariot, / Coming for to carry me home.
    '@h:F c5/2 a4/4!fe c5/2', '@h:Bb f4/3 f4/1 d4/1 @h:F c4/3',
    'f4/1 f4/1 f4/1 f4/1 a4/1 a4/1 @h:C7 g4/2',
]
VERSE = [
    # I looked over Jordan, and what did I see, / Coming for to carry me home?
    'c5/2 f4/1 d4/1 f4/2 f4/1 f4/1', '@h:Bb f4/1 f4/1 f4/2 d4/1 @h:F c4/3',
    'f4/1 f4/1 f4/1 f4/1 a4/1 c5/1 c5/2', '@h:C7 c5/6 c5/2',
    # A band of angels coming after me, / Coming for to carry me home.
    '@h:F d5/1 c5/1 a4/2 a4/2 f4/2', '@h:Bb f4/1 f4/1 f4/1 f4/1 d4/1 @h:F c4/3',
    'f4/1 f4/1 f4/1 f4/1 a4/1 a4/1 @h:C7 g4/2', '@h:F f4/8',
]

DOUBLE = '<barline location="right"><bar-style>light-light</bar-style></barline>'
END = '<barline location="right"><bar-style>light-heavy</bar-style></barline>'

# A symbol only where the harmony changes: the first refrain opens with F, the others follow F.
melody = (['@h:F ' + REFRAIN[0]] + REFRAIN[1:] + ['@h:F f4/6 a4/2'] + VERSE + REFRAIN +
          ['@h:F f4/6 r/2'])
measures = [{'voices': [(1, 1, m), (2, 5, 'r/8')]} for m in melody]
measures[7]['right'] = [DOUBLE]
measures[15]['right'] = [DOUBLE]
measures[-1]['right'] = [END]

PIECE = {
    'title': 'Swing Low, Sweet Chariot',
    'composer': 'Traditional (African American spiritual)',
    'fifths': -1, 'beats': 2, 'beat_type': 4, 'beam_group': 4,
    'measures': measures,
    'source': 'Heart Songs Dear to the American People (Boston: Chapple Publishing, 1909), '
              'p. 251, "Swing Low, Sweet Chariot" (Slave Hymn; public domain), scan: '
              'https://archive.org/details/heartsongsdearto00chap/page/n272/',
    'encoder': 'dacapo project',
    'encoding_date': '2026-10-01',
    'rights': 'Music: public domain. This encoding and the chord symbols: dacapo project, released '
              'under the MIT licence.',
    'comments': [
        'A lead sheet: the melody (the soprano line of the edition\'s four-part setting, note for '
        'note, with its fermatas) and chord symbols of our own (dacapo project, MIT). The '
        'edition\'s D.C. al Fine is written out: refrain, verse, refrain. The bass staff is '
        'empty, for a left hand made from the symbols. No fingering.',
    ],
}
