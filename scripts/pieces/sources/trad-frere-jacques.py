"""Frère Jacques: a lead sheet, the round as J.-B. Weckerlin's Chansons et rondes enfantines
(Paris: Garnier frères, 1885) prints it, page 85 ("chanson en canon à deux voix"), in F major
and 2/4.

The melody is the edition's first voice (1re voix), note for note: the round's sixteen bars, then
the four bars the first voice sings while the second finishes ("Frère Jacques, dormez-vous ?
Frère, dormez-vous ?"), ending on A. The second voice and the piano are not taken. The tempo words
are the edition's ("Pas trop vite."); the metronome figure is ours. The chord symbols are ours
(dacapo project, MIT): F, with C7 where the tune leans on it. The bass staff is left empty
(whole-bar rests) for a left hand made from the symbols.
"""

MELODY = [
    # Frère Jacques, Frère Jacques, / Dormez-vous ? Dormez-vous ?
    '@h:F f4/4 g4/4', 'a4/4 f4/4', 'f4/4 g4/4', 'a4/4 f4/4',
    'a4/4 bf4/4', 'c5/8', 'a4/4 bf4/4', 'c5/8',
    # Sonnez les matines, sonnez les matines, / Dig' din don, dig' din don.
    '@h:C7 c5/2 d5/2 c5/2 bf4/2', '@h:F a4/4 f4/4', '@h:C7 c5/2 d5/2 c5/2 bf4/2', '@h:F a4/4 f4/4',
    'f4/4 @h:C7 c4/4', '@h:F f4/4 r/4', 'f4/4 @h:C7 c4/4', '@h:F f4/4 r/4',
    # The first voice's close: Frère Jacques, dormez-vous ? Frère, dormez-vous ?
    'a4/2 c5/2 @h:C7 bf4/2 g4/2', '@h:F a4/2 c5/2 f5/4', 'a4/2 c5/2 @h:C7 bf4/2 g4/2',
    '@h:F a4/4 r/4',
]

measures = [{'voices': [(1, 1, rh), (2, 5, 'r/8')]} for rh in MELODY]
measures[-1]['right'] = ['<barline location="right"><bar-style>light-heavy</bar-style></barline>']

PIECE = {
    'title': 'Frère Jacques',
    'composer': 'Traditional (French)',
    'fifths': -1, 'beats': 2, 'beat_type': 4, 'beam_group': 4, 'bpm': 92,
    'tempo_text': 'Pas trop vite.', 'measures': measures,
    'source': 'J.-B. Weckerlin, Chansons et rondes enfantines (Paris: Garnier frères, 1885), '
              'p. 85, "Frère Jacques (chanson en canon à deux voix)", first voice (public domain), '
              'scan: https://archive.org/details/chansonsetronde00weck/page/n102/',
    'encoder': 'dacapo project',
    'encoding_date': '2026-10-01',
    'rights': 'Music: public domain. This encoding and the chord symbols: dacapo project, released '
              'under the MIT licence.',
    'comments': [
        'A lead sheet: the melody (the edition\'s first voice, note for note, with its four '
        'closing bars) and chord symbols of our own (dacapo project, MIT). The edition\'s tempo '
        'words; the metronome figure is ours. The bass staff is empty, for a left hand made from '
        'the symbols. No fingering.',
    ],
}
