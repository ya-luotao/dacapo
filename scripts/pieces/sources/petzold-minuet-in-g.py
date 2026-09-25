"""Minuet in G major, BWV Anh. 114 (attributed to Christian Petzold), all 32 bars.

Transcribed from the Mutopia Project's public-domain edition (piece 75, after the
Bach-Gesellschaft edition, BGA 43.2) and checked note for note against its MIDI file.
Bar 30, left hand: E3 G3 F#3, as in Mutopia (after BG) and three other encodings; one encoding
(PDMX 6180412) has E3 on the third beat. The BG scan on IMSLP could not be consulted from here.
"""

from musicxml_gen import REPEAT_BWD, REPEAT_FWD

RH = [
    'd5/4 g4/2 a4/2 b4/2 c5/2', 'd5/4 g4/4 g4/4', 'e5/4 c5/2!m d5/2 e5/2 fs5/2', 'g5/4 g4/4 g4/4',
    'c5/4!m d5/2 c5/2 b4/2 a4/2', 'b4/4 c5/2 b4/2 a4/2 g4/2', 'fs4/4 g4/2 a4/2 b4/2 g4/2',
    'g:b4/2 a4/12',
    'd5/4 g4/2 a4/2 b4/2 c5/2', 'd5/4 g4/4 g4/4', 'e5/4 c5/2!m d5/2 e5/2 fs5/2', 'g5/4 g4/4 g4/4',
    'c5/4!m d5/2 c5/2 b4/2 a4/2', 'b4/4 c5/2 b4/2 a4/2 g4/2', 'a4/4 b4/2 a4/2 g4/2 fs4/2', 'g4/12',
    'b5/4 g5/2 a5/2 b5/2 g5/2', 'a5/4 d5/2 e5/2 fs5/2 d5/2', 'g5/4 e5/2 fs5/2 g5/2 d5/2',
    'cs5/4 b4/2 cs5/2 a4/4', 'a4/2 b4/2 cs5/2 d5/2 e5/2 fs5/2', 'g5/4 fs5/4 e5/4',
    'fs5/4 a4/4 cs5/4', 'd5/12', 'd5/4 g4/2 fs4/2 g4/4', 'e5/4 g4/2 fs4/2 g4/4', 'd5/4 c5/4 b4/4',
    'a4/2 g4/2 fs4/2 g4/2 a4/4', 'd4/2 e4/2 fs4/2 g4/2 a4/2 b4/2', 'c5/4 b4/4!p a4/4',
    'b4/2 d5/2 g4/4 fs4/4', None,
]
LH = [
    None, 'b3/12', 'c4/12', 'b3/12', 'a3/12', 'g3/12', 'd4/4 b3/4 g3/4', 'd4/4 d3/2 c4/2 b3/2 a3/2',
    'b3/8 a3/4', 'g3/4 b3/4 g3/4', 'c4/12', 'b3/4 c4/2 b3/2 a3/2 g3/2', 'a3/8 fs3/4', 'g3/8 b3/4',
    'c4/4 d4/4 d3/4', 'g3/8 g2/4',
    'g3/12', 'fs3/12', 'e3/4 g3/4 e3/4', 'a3/8 a2/4', 'a3/12', 'b3/4 d4/4 cs4/4', 'd4/4 fs3/4 a3/4',
    'd4/4 d3/4 c4/4', None, None, 'b3/4 a3/4 g3/4', 'd4/8 r/4', None, 'e3/4 g3/4 fs3/4',
    'g3/4 b2/4 d3/4', 'g3/4 d3/4 g2/4',
]
# Bars where the left hand has two voices.
TWO_VOICES = {
    0: [(2, 5, '[b3,d4]/8 a3/4'), (2, 6, 'g3/8 s/4')],
    24: [(2, 5, 'r/4 d4/8'), (2, 6, 'b3/8 b3/4')],
    25: [(2, 5, 'r/4 e4/8'), (2, 6, 'c4/8 c4/4')],
    28: [(2, 5, 'r/4 r/4 fs3/4'), (2, 6, 'd3/12')],
}

measures = []
for i in range(32):
    voices = [(1, 1, RH[i])] if RH[i] else [(1, 1, 'g4/12'), (1, 2, '[b3,d4]/12')]
    voices += TWO_VOICES.get(i, [(2, 5, LH[i])])
    m = {'voices': voices}
    if i in (15, 31):
        m['right'] = [REPEAT_BWD]
    if i == 16:
        m['left'] = [REPEAT_FWD]
    measures.append(m)

PIECE = {
    'title': 'Minuet in G major',
    'work_number': 'BWV Anh. 114',
    'composer': 'Christian Petzold (attributed)',
    'fifths': 1, 'beats': 3, 'beat_type': 4, 'beam_group': 4,
    'measures': measures,
    'source': 'Bach-Gesellschaft Ausgabe, vol. 43.2 (Breitkopf & Härtel, 1894), as typeset by '
              'Allen Garvin for the Mutopia Project (piece 75, public domain): '
              'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=75',
    'encoder': 'dacapo project',
    'encoding_date': '2026-09-25',
    'rights': 'Music: public domain. This encoding: dacapo project, released under the MIT licence.',
    'comments': [
        'Transcribed from the public-domain Mutopia edition (after the Bach-Gesellschaft) and '
        'checked note for note against its MIDI file. No fingering. Bar 30, left hand: E3 G3 F#3 '
        'as in Mutopia/BG and three other encodings; the BG scan itself could not be consulted.',
    ],
}
