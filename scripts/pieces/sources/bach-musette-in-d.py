"""Musette in D major, BWV Anh. 126 (anonymous, attributed to Johann Sebastian Bach), all 20 bars.

Transcribed from the Mutopia Project's public-domain edition (piece 79, after the
Bach-Gesellschaft edition) and checked note for note against its MIDI file. Both halves are
repeated (bars 1-8 and 9-20), as in the source. Two marks of the edition have no token here and
are left out: the fermata on the last note of bar 8 (both hands), and the cautionary natural on
the right hand's D5 in bar 18 (after the D#s of bar 17; the pitch is the same). The source has
no printed tempo marking (its 4 = 120 is only a MIDI setting), so none is given.
"""

from musicxml_gen import REPEAT_BWD, REPEAT_FWD

RH = [
    'a5/4 g5/1 fs5/1 e5/1 d5/1', 'a5/4 g5/1 fs5/1 e5/1 d5/1', 'fs4/1 g4/1 a4/2 g4/2 fs4/2',
    'e4/2 a4/2 fs4/2 d4/2', 'a5/4 g5/1 fs5/1 e5/1 d5/1', 'a5/4 g5/1 fs5/1 e5/1 d5/1',
    'fs4/1 g4/1 a4/2 g4/2 fs4/2', 'e4/2 a4/2 d4/4',
    'cs5/1 d5/1 e5/2 cs5/1 d5/1 e5/2', 'a5/2 e5/2 e5/4', 'a5/2 e5/2 a5/2 e5/2',
    'd5/1 cs5/1 b4/1 a4/1 b4/2 e4/2', 'e5/2 ds5/2 e4/2 d5/2~', 'd5/2 cs5/2 a5/2 gs5/2',
    'e5/2 ds5/2 e4/2 d5/2~', 'd5/2 cs5/2 a5/2 gs5/2', 'e5/1 ds5/1 cs5/1 ds5/1 e5/1 ds5/1 cs5/1 ds5/1',
    'e5/2 gs4/2 a4/2 d5/2', 'cs5/1 d5/1 e5/2 a4/2 d4/2', 'cs4/1 d4/1 e4/2 a3/4',
]
D_OCTAVES = 'd2/2 d3/2 d2/2 d3/2'
A_OCTAVES = 'a2/2 a3/2 a2/2 a3/2'
E_OCTAVES = 'e2/2 e3/2 e2/2 e3/2'
LH = [
    D_OCTAVES, D_OCTAVES, 'fs3/1 g3/1 a3/2 g3/2 fs3/2', 'e3/2 a3/2 fs3/2 d3/2',
    D_OCTAVES, D_OCTAVES, 'fs3/1 g3/1 a3/2 g3/2 fs3/2', 'e3/2 a3/2 d3/4',
    A_OCTAVES, A_OCTAVES, A_OCTAVES, 'a2/2 a3/2 e2/2 e3/2', E_OCTAVES, E_OCTAVES, E_OCTAVES,
    E_OCTAVES, E_OCTAVES, 'e2/2 d3/2 cs3/2 d3/2', 'e3/4 a2/2 d3/2', 'cs3/1 d3/1 e3/2 a2/4',
]

measures = []
for i in range(20):
    m = {'voices': [(1, 1, RH[i]), (2, 5, LH[i])]}
    if i in (7, 19):
        m['right'] = [REPEAT_BWD]
    if i == 8:
        m['left'] = [REPEAT_FWD]
    measures.append(m)

PIECE = {
    'title': 'Musette in D major',
    'work_number': 'BWV Anh. 126',
    'composer': 'Johann Sebastian Bach (attributed)',
    'fifths': 2, 'beats': 2, 'beat_type': 4, 'beam_group': 4,
    'measures': measures,
    'source': 'Bach-Gesellschaft Ausgabe (Notebook for Anna Magdalena Bach, 1725), as typeset by '
              'Allen Garvin for the Mutopia Project (piece 79, public domain): '
              'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=79',
    'encoder': 'dacapo project',
    'encoding_date': '2026-09-30',
    'rights': 'Music: public domain. This encoding: dacapo project, released under the MIT licence.',
    'comments': [
        'Transcribed from the public-domain Mutopia edition (after the Bach-Gesellschaft) and '
        'checked note for note against its MIDI file. No fingering. Anonymous; the edition credits '
        'J. S. Bach. Left out, having no token: the fermata in bar 8 and the cautionary natural on '
        'D5 in bar 18. No tempo marking in the source (its 4 = 120 is a MIDI setting only).',
    ],
}
