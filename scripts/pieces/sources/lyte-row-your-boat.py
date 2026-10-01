"""Row Your Boat: a lead sheet, the round as the Franklin Square Song Collection (1881) prints it,
page 69, in D major and 6/8, with E. O. Lyte's name.

The melody is the edition's single line, note for note (8 bars; the edition numbers the four
entries of the round 1 to 4). Bar 3 is printed F-sharp F-sharp F-sharp G ("Gent-ly down the"), not
the F-sharp E F-sharp G sung today; it is encoded as printed. The ties into the second half of
bars 4 and 8 are the edition's. The chord symbols are ours (dacapo project, MIT): a round sits on
its tonic, so D throughout, with A7 under "Life is but a". The bass staff is left empty
(whole-bar rests) for a left hand made from the symbols.
"""

MELODY = [
    # Row, row, row your boat, / Gently down the stream;
    '@h:D d4/6 d4/6', 'd4/4 e4/2 fs4/6', 'fs4/4 fs4/2 fs4/4 g4/2', 'a4/6~ a4/6',
    # Merrily, merrily, merrily, merrily; / Life is but a dream.
    'd5/2 d5/2 d5/2 a4/2 a4/2 a4/2', 'fs4/2 fs4/2 fs4/2 d4/2 d4/2 d4/2',
    '@h:A7 a4/4 g4/2 fs4/4 e4/2', '@h:D d4/6~ d4/6',
]

measures = [{'voices': [(1, 1, rh), (2, 5, 'r/12')]} for rh in MELODY]
measures[-1]['right'] = ['<barline location="right"><bar-style>light-heavy</bar-style></barline>']

PIECE = {
    'title': 'Row Your Boat',
    'composer': 'E. O. Lyte',
    'fifths': 2, 'beats': 6, 'beat_type': 8, 'beam_group': 6,
    'measures': measures,
    'source': 'Franklin Square Song Collection, selected by J. P. McCaskey (New York: Harper & '
              'Brothers, 1881), p. 69, "Row Your Boat" (round; E. O. Lyte; public domain), scan: '
              'https://archive.org/details/franklinsquares04mccagoog/page/n73/',
    'encoder': 'dacapo project',
    'encoding_date': '2026-10-01',
    'rights': 'Music: public domain. This encoding and the chord symbols: dacapo project, released '
              'under the MIT licence.',
    'comments': [
        'A lead sheet: the melody (the edition\'s single line, note for note; bar 3 as printed, '
        'F-sharp F-sharp F-sharp G) and chord symbols of our own (dacapo project, MIT). The bass '
        'staff is empty, for a left hand made from the symbols. No fingering.',
    ],
}
