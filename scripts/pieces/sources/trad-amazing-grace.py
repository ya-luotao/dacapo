"""Amazing Grace: a lead sheet, the hymn tune (New Britain) as E. O. Excell's Coronation Hymns
(Chicago: E. O. Excell, 1910) prints it, No. 282 ("arr. by E. O. Excell"), in G major and 3/4.

The melody is the edition's soprano line, note for note: a quarter-note pickup, fourteen bars, the
last a half note. Excell's harmony (the alto, tenor and bass) is not taken. The chord symbols are
ours (dacapo project, MIT): I, IV and V of G, with vi and V on the way to the half cadence and
V7 before the last bar. The bass staff is left empty (whole-bar rests) for a left hand made from
the symbols.
"""

MELODY = [
    # A-mazing grace! how sweet the sound, / That saved a wretch like me!
    '@h:G g4/8 b4/2 g4/2', 'b4/8 a4/4', '@h:C g4/8 e4/4', '@h:G d4/8 d4/4',
    'g4/8 b4/2 g4/2', '@h:Em b4/8 @h:D a4/4', 'd5/8 b4/4',
    # I once was lost, but now am found, / Was blind, but now I see.
    '@h:G d5/6 b4/2 d5/2 b4/2', 'g4/8 d4/4', '@h:C e4/6 g4/2 g4/2 e4/2', '@h:G d4/8 d4/4',
    'g4/8 b4/2 g4/2', 'b4/8 @h:D7 a4/4', '@h:G g4/8',
]

measures = [{'voices': [(1, 1, 'd4/4'), (2, 5, 'r/4')], 'number': 0, 'implicit': True}]
measures += [{'voices': [(1, 1, rh), (2, 5, 'r/8' if i == len(MELODY) - 1 else 'r/12')],
              'number': i + 1} for i, rh in enumerate(MELODY)]
measures[-1]['right'] = ['<barline location="right"><bar-style>light-heavy</bar-style></barline>']

PIECE = {
    'title': 'Amazing Grace',
    'composer': 'Traditional (American hymn tune)',
    'fifths': 1, 'beats': 3, 'beat_type': 4, 'beam_group': 4,
    'measures': measures, 'pickup': True,
    'source': 'Coronation Hymns, ed. E. O. Excell (Chicago: E. O. Excell, 1910), No. 282, "Amazing '
              'Grace", arr. by E. O. Excell, soprano line (public domain), scan: '
              'https://archive.org/details/coronationhymns0000eoex_f0r6/page/n281/',
    'encoder': 'dacapo project',
    'encoding_date': '2026-10-01',
    'rights': 'Music: public domain. This encoding and the chord symbols: dacapo project, released '
              'under the MIT licence.',
    'comments': [
        'A lead sheet: the melody (the soprano line of the edition\'s four-part setting, note for '
        'note) and chord symbols of our own (dacapo project, MIT). The last bar is a half note, '
        'completing the pickup. The bass staff is empty, for a left hand made from the symbols. '
        'No fingering.',
    ],
}
