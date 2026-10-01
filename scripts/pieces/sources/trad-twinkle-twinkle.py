"""Twinkle, Twinkle, Little Star: a lead sheet, the French air (Ah ! vous dirai-je, maman) as
the Franklin Square Song Collection (1881) prints it, page 95, in G major and 2/4.

The melody is the edition's soprano line, note for note (24 bars: the air's a a b b a a, the
"Up above the world so high" phrase twice). The edition sets it for four voices; only the tune is
taken. The tempo words are the edition's ("Not too slow."); the metronome figure is ours. The
chord symbols are ours (dacapo project, MIT): I, IV and V7 of G, one or two to a bar. The bass
staff is left empty (whole-bar rests) for a left hand made from the symbols.
"""

# One bar per string: the melody with its symbols (@h:, before the note they stand over).
MELODY = [
    # a: Twinkle, twinkle, little star, / How I wonder what you are.
    '@h:G g4/4 g4/4', 'd5/4 d5/4', '@h:C e5/4 e5/4', '@h:G d5/8',
    '@h:C c5/4 c5/4', '@h:G b4/4 b4/4', '@h:D7 a4/4 a4/4', '@h:G g4/8',
    # b: Up above the world so high, / Like a diamond in the sky.
    'd5/4 d5/4', '@h:C c5/4 c5/4', '@h:G b4/4 b4/4', '@h:D a4/8',
    '@h:G d5/4 d5/4', '@h:C c5/4 c5/4', '@h:G b4/4 b4/4', '@h:D a4/8',
    # a: Twinkle, twinkle, little star, / How I wonder what you are.
    '@h:G g4/4 g4/4', 'd5/4 d5/4', '@h:C e5/4 e5/4', '@h:G d5/8',
    '@h:C c5/4 c5/4', '@h:G b4/4 b4/4', '@h:D7 a4/4 a4/4', '@h:G g4/8',
]

measures = [{'voices': [(1, 1, rh), (2, 5, 'r/8')]} for rh in MELODY]
measures[-1]['right'] = ['<barline location="right"><bar-style>light-heavy</bar-style></barline>']

PIECE = {
    'title': 'Twinkle, Twinkle, Little Star',
    'composer': 'Traditional (French air)',
    'fifths': 1, 'beats': 2, 'beat_type': 4, 'beam_group': 4, 'bpm': 96,
    'tempo_text': 'Not too slow.', 'measures': measures,
    'source': 'Franklin Square Song Collection, selected by J. P. McCaskey (New York: Harper & '
              'Brothers, 1881), p. 95, "Twinkle, Twinkle, Little Star" (French air; public '
              'domain), scan: https://archive.org/details/franklinsquares04mccagoog/page/n99/',
    'encoder': 'dacapo project',
    'encoding_date': '2026-10-01',
    'rights': 'Music: public domain. This encoding and the chord symbols: dacapo project, released '
              'under the MIT licence.',
    'comments': [
        'A lead sheet: the melody (the soprano line of the edition\'s four-part setting, note for '
        'note) and chord symbols of our own (dacapo project, MIT). The edition\'s tempo words; the '
        'metronome figure is ours. The bass staff is empty, for a left hand made from the '
        'symbols. No fingering.',
    ],
}
