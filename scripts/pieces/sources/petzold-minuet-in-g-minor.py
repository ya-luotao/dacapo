"""Minuet in G minor, BWV Anh. 115 (attributed to Christian Petzold), all 32 bars.

Transcribed from the Mutopia Project's public-domain edition (piece 76, after the
Bach-Gesellschaft edition) and checked note for note against its MIDI file.
"""

from musicxml_gen import REPEAT_BWD, REPEAT_FWD

RH = [
    'bf5/4 a5/4 g5/4', 'a5/4 d5/4 d5/4', 'g5/4 g4/2 a4/2 bf4/2 c5/2', 'd5/12',
    'ef5/4 f5/2 ef5/2 d5/2 c5/2', 'd5/4 ef5/2 d5/2 c5/2 bf4/2', 'c5/4 d5/2 c5/2 bf4/2 c5/2',
    'a4/12!p',
    'bf5/4 a5/4!p g5/4', 'a5/4 d5/4 d5/4', 'g5/4 g4/2 a4/2 bf4/2 c5/2', 'd5/12',
    'f5/4!m g5/2 f5/2 ef5/2 d5/2', 'ef5/4 f5/2 ef5/2 d5/2 c5/2', 'd5/4 g5/4 c5/4!p', None,
    'd5/4 bf4/2 c5/2 d5/2 e5/2', 'f5/4 g5/4 a5/4', 'bf5/4 g5/2 a5/2 bf5/2 g5/2',
    'a5/4 g5/2 a5/2 f5/4', 'f4/2 g4/2 a4/2 bf4/2 c5/2 d5/2', 'ef5/4 d5/4!m c5/4',
    'f5/4 bf4/4 a4/4', 'bf4/12', 'g4/4 d5/2 c5/2 d5/4', 'g4/4 ef5/2 d5/2 ef5/4',
    'g4/2 d5/2 fs4/2 c5/2 g4/2 bf4/2', 'a4/8 r/4', 'd4/2 e4/2 fs4/2 g4/2 a4/2 bf4/2',
    'c5/4 bf4/4 a4/4', 'bf4/2!p c5/1 d5/1 g4/4 fs4/4', None,
]
# Last bar of each half: the right hand has two voices.
RH_TWO_VOICES = {
    15: [(1, 1, 'bf4/12'), (1, 2, '[d4,f4]/12')],
    31: [(1, 1, 'g4/12'), (1, 2, '[bf3,d4]/12')],
}
LH = [
    'g3/12', 'f3/12', 'ef3/12', 'd3/4 d4/2 c4/2 bf3/2 a3/2', '[g3,bf3]/8 a3/4', 'bf3/8 g3/4',
    'a3/4 fs3/4 g3/4', 'd3/4 d4/2 c4/2 bf3/2 a3/2',
    'g3/12', 'f3/12', 'ef3/12', 'd3/4 d4/2 c4/2 b3/2 a3/2', '[b3,d4]/8 g3/4', 'c4/4 a3/4 f3/4',
    'bf3/4 ef3/4 [f3,a3]/4', 'bf3/4 bf2/8',
    'bf3/12', 'a3/4 g3/4 f3/4', 'g3/4 e3/4 c3/4', 'f3/8 r/4', 'a3/4 g3/4 f3/4', 'g3/4 f3/4 ef3/4',
    'd3/4 ef3/4 f3/4', 'bf2/4 d4/4 c4/4',
    '[b3,d4]/12', 'c4/12', 'bf3/4 a3/4 g3/4', 'd4/4 a3/2 g3/2 fs3/2 e3/2', 'd3/8 r/4',
    'ef3/4 d3/4 c3/4', 'bf2/4 c3/4 d3/4', 'g3/4 g2/8',
]

measures = []
for i in range(32):
    voices = RH_TWO_VOICES.get(i) or [(1, 1, RH[i])]
    voices += [(2, 5, LH[i])]
    m = {'voices': voices}
    if i in (15, 31):
        m['right'] = [REPEAT_BWD]
    if i == 16:
        m['left'] = [REPEAT_FWD]
    measures.append(m)

PIECE = {
    'title': 'Minuet in G minor',
    'work_number': 'BWV Anh. 115',
    'composer': 'Christian Petzold (attributed)',
    'fifths': -2, 'beats': 3, 'beat_type': 4, 'beam_group': 4,
    'measures': measures,
    'source': 'Bach-Gesellschaft Ausgabe, as typeset by Allen Garvin for the Mutopia Project '
              '(piece 76, public domain): '
              'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=76',
    'encoder': 'dacapo project',
    'encoding_date': '2026-09-30',
    'rights': 'Music: public domain. This encoding: dacapo project, released under the MIT licence.',
    'comments': [
        'Transcribed from the public-domain Mutopia edition (after the Bach-Gesellschaft) and '
        'checked note for note against its MIDI file. No fingering.',
    ],
}
