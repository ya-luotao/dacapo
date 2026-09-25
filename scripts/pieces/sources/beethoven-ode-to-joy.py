"""Ode to Joy: the theme of the finale of Beethoven's Symphony No. 9, Op. 125, for beginners.

Our own arrangement. Key: C major instead of Beethoven's D major, so the right hand stays in the
C position (C4-G4 with one reach down to G3) on white keys only, the notes a beginner has just
learnt in the Read levels; nothing else is changed in the melody. The anticipation in bar 12
(Beethoven ties the first note of the last phrase over from the fourth beat) is written straight,
as in most beginner editions. The left hand is ours: single roots of I (C3) and V (G2), one or
two per bar, and a C major chord to close.
"""

MELODY = [
    'e4/4 e4/4 f4/4 g4/4', 'g4/4 f4/4 e4/4 d4/4', 'c4/4 c4/4 d4/4 e4/4', 'e4/6 d4/2 d4/8',
    'e4/4 e4/4 f4/4 g4/4', 'g4/4 f4/4 e4/4 d4/4', 'c4/4 c4/4 d4/4 e4/4', 'd4/6 c4/2 c4/8',
    'd4/4 d4/4 e4/4 c4/4', 'd4/4 e4/2 f4/2 e4/4 c4/4', 'd4/4 e4/2 f4/2 e4/4 d4/4', 'c4/4 d4/4 g3/8',
    'e4/4 e4/4 f4/4 g4/4', 'g4/4 f4/4 e4/4 d4/4', 'c4/4 c4/4 d4/4 e4/4', 'd4/6 c4/2 c4/8',
]
I, V = 'c3', 'g2'
BASS = [
    f'{I}/16', f'{V}/16', f'{I}/16', f'{V}/16',
    f'{I}/16', f'{V}/16', f'{I}/16', f'{V}/8 {I}/8',
    f'{V}/8 {I}/8', f'{V}/8 {I}/8', f'{V}/16', f'{I}/8 {V}/8',
    f'{I}/16', f'{V}/16', f'{I}/16', f'{V}/8 [c3,e3,g3]/8',
]

measures = [{'voices': [(1, 1, rh), (2, 5, lh)]} for rh, lh in zip(MELODY, BASS)]
measures[-1]['right'] = ['<barline location="right"><bar-style>light-heavy</bar-style></barline>']

PIECE = {
    'title': 'Ode to Joy',
    'work_number': 'Symphony No. 9, Op. 125, finale (theme)',
    'composer': 'Ludwig van Beethoven',
    'arranger': 'dacapo project',
    'fifths': 0, 'beats': 4, 'beat_type': 4, 'beam_group': 8,
    'measures': measures,
    'source': 'The theme of the finale of Symphony No. 9 in D minor, Op. 125 (1824; scores on '
              'IMSLP: https://imslp.org/wiki/Symphony_No.9,_Op.125_(Beethoven,_Ludwig_van)), '
              'transposed to C major and arranged for beginners by the dacapo project.',
    'encoder': 'dacapo project',
    'encoding_date': '2026-09-25',
    'rights': 'Music: public domain. This arrangement and encoding: dacapo project, released under '
              'the MIT licence.',
    'comments': [
        'Our own arrangement: C major (Beethoven: D major) so the right hand stays in the C '
        'position on white keys; the bar-12 anticipation is written straight; the left hand '
        'plays the roots of I and V. No fingering.',
    ],
}
