"""Für Elise, WoO 59: the A section, up to the F-major section, with both repeats.

Transcribed from the Mutopia Project's public-domain edition (piece 931, after Breitkopf &
Härtel 1888) and checked note for note against its MIDI file. The theme and the episode
with the return of the theme are each repeated, with first and second
endings as in the source. The source's second ending of the second repeat is the transition into the
F-major section (chords on C); since this piece stops before that section, its second ending is
the closing bar Beethoven writes when the theme returns for the last time (the last bar of the
piece: A4 over octave As), so the A section ends on its own cadence.
"""

from musicxml_gen import REPEAT_FWD, ending_discontinue, ending_start, ending_stop_repeat

THEME = [
    ('e5/1 ds5/1', 'r/2'),
    ('e5/1 ds5/1 e5/1 b4/1 d5/1 c5/1', 'r/6'),
    ('a4/2 r/1 c4/1 e4/1 a4/1', 'a2/1 e3/1 a3/1 r/1 r/2'),
    ('b4/2 r/1 e4/1 gs4/1 b4/1', 'e2/1 e3/1 gs3/1 r/1 r/2'),
    ('c5/2 r/1 e4/1 e5/1 ds5/1', 'a2/1 e3/1 a3/1 r/1 r/2'),
    ('e5/1 ds5/1 e5/1 b4/1 d5/1 c5/1', 'r/6'),
    ('a4/2 r/1 c4/1 e4/1 a4/1', 'a2/1 e3/1 a3/1 r/1 r/2'),
    ('b4/2 r/1 e4/1 c5/1 b4/1', 'e2/1 e3/1 gs3/1 r/1 r/2'),
]
THEME_FIRST = ('a4/4', 'a2/1 e3/1 a3/1 r/1')
THEME_SECOND = ('a4/2 r/1 b4/1 c5/1 d5/1', 'a2/1 e3/1 a3/1 r/1 r/2')
EPISODE_AND_RETURN = [
    ('e5/3 g4/1 f5/1 e5/1', 'c3/1 g3/1 c4/1 r/1 r/2'),
    ('d5/3 f4/1 e5/1 d5/1', 'g2/1 g3/1 b3/1 r/1 r/2'),
    ('c5/3 e4/1 d5/1 c5/1', 'a2/1 e3/1 a3/1 r/1 r/2'),
    ('b4/2 r/1 e4/1 e5/1 r/1', 'e2/1 e3/1 e4/1 r/1 r/1 clef:G e4/1'),
    ('r/1 e5/1 e6/1 r/1 r/1 ds5/1', 'e5/1 r/1 r/1 ds5/1 e5/1 r/1'),
    ('e5/2 r/1 ds5/1 e5/1 ds5/1', 'r/1 ds5/1 e5/1 r/1 r/2'),
    ('e5/1 ds5/1 e5/1 b4/1 d5/1 c5/1', 'r/6'),
    ('a4/2 r/1 c4/1 e4/1 a4/1', 'clef:F a2/1 e3/1 a3/1 r/1 r/2'),
    ('b4/2 r/1 e4/1 gs4/1 b4/1', 'e2/1 e3/1 gs3/1 r/1 r/2'),
    ('c5/2 r/1 e4/1 e5/1 ds5/1', 'a2/1 e3/1 a3/1 r/1 r/2'),
    ('e5/1 ds5/1 e5/1 b4/1 d5/1 c5/1', 'r/6'),
    ('a4/2 r/1 c4/1 e4/1 a4/1', 'a2/1 e3/1 a3/1 r/1 r/2'),
    ('b4/2 r/1 e4/1 c5/1 b4/1', 'e2/1 e3/1 gs3/1 r/1 r/2'),
]
RETURN_FIRST = ('a4/2 r/1 b4/1 c5/1 d5/1', 'a2/1 e3/1 a3/1 r/1 r/2')
# The last bar of the piece (see the module docstring).
CLOSING = ('a4/2 r/2', '[a1,a2]/2 r/2')

rows = THEME + [THEME_FIRST, THEME_SECOND] + EPISODE_AND_RETURN + [RETURN_FIRST, CLOSING]
measures = [{'voices': [(1, 1, rh), (2, 5, lh)], 'number': i} for i, (rh, lh) in enumerate(rows)]
measures[0]['implicit'] = True
measures[8].update({'left': [ending_start(1)], 'right': [ending_stop_repeat(1)], 'implicit': True})
measures[9].update({'left': [ending_start(2)], 'right': [ending_discontinue(2)]})
measures[10]['left'] = [REPEAT_FWD]
measures[23].update({'left': [ending_start(1)], 'right': [ending_stop_repeat(1)]})
measures[24].update({
    'left': [ending_start(2)], 'right': [ending_discontinue(2, final=True)], 'implicit': True,
})

PIECE = {
    'title': 'Für Elise',
    'work_number': 'WoO 59',
    'composer': 'Ludwig van Beethoven',
    'fifths': 0, 'beats': 3, 'beat_type': 8, 'beam_group': 6, 'bpm': 72,
    'tempo_text': 'Poco moto', 'measures': measures, 'pickup': True,
    'source': 'Breitkopf & Härtel, 1888, as typeset by Stelios Samelis for the Mutopia Project '
              '(piece 931, public domain): '
              'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=931',
    'encoder': 'dacapo project',
    'encoding_date': '2026-09-25',
    'rights': 'Music: public domain. This encoding: dacapo project, released under the MIT licence.',
    'comments': [
        'The A section with both repeats, transcribed from the public-domain Mutopia '
        'edition and checked note for note against its MIDI file. No fingering. The second ending '
        'of the second repeat is the closing bar of the piece instead of the transition into the F-major '
        'section, so the excerpt ends on its cadence.',
    ],
}
