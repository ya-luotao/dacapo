"""Gymnopédie No. 1 (1888), complete: 31 repeated bars with first and second endings of 8 bars each.

Transcribed from the Mutopia Project's public-domain edition (piece 37, typeset by Evin Robertson
from the Dover edition, which reproduces the original edition) and checked note for note against
its MIDI file. No fingering.

Staves and hands. In the edition the left hand's chords (beats 2 and 3) are one voice that is
printed on the treble staff in bars 1-18 and in both endings (bars 32-37 and 40-45) and on the
bass staff in bars 19-31 (the source's \\change Staff). The chords are the left hand's part of the
bass-and-chord pattern in every bar, and dacapo assigns hands by staff, so here they are always on
the bass staff: voice 5 (stems up, a quarter rest on beat 1) over the bass note in voice 6
(stems down, a dotted half). With the chords off the treble staff, the melody's invisible
first-beat spacers in bars 5 and 13 are written as quarter rests. The exception is bar 5 of each
ending (bars 37 and 45): there the left hand has its own second voice on the bass staff (B2, E3 on
beats 2-3 over the bass E2), so the chords printed on the treble staff (A3 D4, then B3 D4 G4) stay
there as the right hand's lower voice under its held melody note, as printed. The last two bars of
each ending are chords in both hands, as printed.

Markings (added in X0 from the Mutopia LilyPond file gymnopedie_1.ly, piece 37, and checked
against its PDF): the melody's slurs, hairpins and pp, above the treble staff as printed, and the
dynamics printed with the left-hand chords (f in bar 9, pp in bar 13, p in bar 22), which go with
the chords on the bass staff here. The f in bar 9 is as the Mutopia edition prints it.
"""

from musicxml_gen import REPEAT_FWD, ending_discontinue, ending_start, ending_stop_repeat

BD = '[b3,d4,fs4]/8'
AC = '[a3,cs4,fs4]/8'

# (right hand, left-hand chord on beats 2-3, left-hand bass) per bar. The melody's dynamics and
# hairpins are above the treble staff, as printed (the LilyPond file's dynamicUp); the dynamics the
# edition prints with the chords (f in bar 9, pp in bar 13, p in bar 22) go with the chords.
BODY = [
    ('r/12', BD, 'g2'), ('r/12', AC, 'd2'), ('r/12', BD, 'g2'), ('r/12', AC, 'd2'),
    ('r/4 @pp^ @<^ fs5/4( a5/4', BD, 'g2'), ('g5/4 fs5/4 cs5/4', AC, 'd2'),
    ('b4/4 @!^ cs5/4 @>^ d5/4', BD, 'g2'), ('a4/12', AC, 'd2'),
    ('@!^ fs4/12~)', '@f^ ' + BD, 'g2'), ('fs4/12~', AC, 'd2'), ('fs4/12~', BD, 'g2'),
    ('fs4/12', AC, 'd2'),
    ('r/4 @<^ fs5/4( a5/4', '@pp^ ' + BD, 'g2'), ('g5/4 fs5/4 cs5/4', AC, 'd2'),
    ('b4/4 cs5/4 @!^ d5/4', BD, 'g2'), ('@>^ a4/12', AC, 'd2'),
    ('cs5/12', AC, 'fs2'), ('fs5/12', BD, 'b1'),
    ('@!^ e4/12~)', '[g3,b3]/8', 'e2'), ('e4/12~', '[b3,d4,g4]/8', 'e2'),
    ('e4/12', '[f3,a3,d4]/8', 'd2'),
    ('@<^ a4/4( b4/4 c5/4', '@p [a3,c4,e4]/8', 'a1'), ('e5/4 d5/4 b4/4', '[g3,b3,e4]/8', 'd2'),
    ('d5/4 c5/4 @!^ b4/4', '[d3,g3,b3,e4]/8', 'd2'),
    ('@>^ d5/12~', '[c3,e3,a3,d4]/8', 'd2'), ('@!^ d5/8) @<^ d5/4(', '[c3,fs3,a3,d4]/8', 'd2'),
    ('e5/4 f5/4 g5/4', '[a3,c4,f4]/8', 'd2'), ('a5/4 c5/4 @!^ d5/4', '[a3,c4,e4]/8', 'd2'),
    ('@>^ e5/4 d5/4 b4/4', '[d3,g3,b3,e4]/8', 'd2'),
    ('@!^ d5/12~', '[c3,e3,a3,d4]/8', 'd2'), ('d5/8) d5/4', '[c3,fs3,a3,d4]/8', 'd2'),
]
FIRST = [
    ('@<^ g5/12(', '[b3,e4,g4]/8', 'e2'), ('@!^ fs5/12', '[a3,cs4,fs4]/8', 'fs2'),
    ('b4/4 a4/4 b4/4', '[b3,d4,fs4]/8', 'b1'), ('cs5/4 d5/4 e5/4', '[cs4,e4,a4]/8', 'e2'),
    ('cs5/4 d5/4 @>^ e5/4', '[a3,cs4,fs4,a4]/8', 'e2'),
]
SECOND = [
    ('@<^ g5/12(', '[b3,e4,g4]/8', 'e2'), ('@!^ f5/12', '[a3,d4,f4,a4]/8', 'e2'),
    ('b4/4 c5/4 f5/4', '[a3,c4,f4]/8', 'e2'), ('e5/4 d5/4 c5/4', '[c4,e4,a4]/8', 'e2'),
    ('e5/4 d5/4 @>^ c5/4', '[a3,c4,f4,a4]/8', 'e2'),
]
# Bar 5 of each ending: the right hand's chords under its held melody note; the left hand's B2, E3
# over the bass E2.


def pattern(rh, chord, bass):
    return {'voices': [(1, 1, rh), (2, 5, f'r/4 {chord}'), (2, 6, f'{bass}/12')]}


def ending(bars, melody, end):
    """`end`: the bar (6 or 7 of the ending) where the diminuendo and the slur end."""
    ms = [pattern(*b) for b in bars]
    ms.append({'voices': [(1, 1, f'{melody}/12'), (1, 2, 'r/4 [a3,d4]/4 [b3,d4,g4]/4'),
                          (2, 5, 'r/4 b2/4 e3/4'), (2, 6, 'e2/12')]})
    close = ('@!^ ', ')')
    six = close if end == 6 else ('', '')
    seven = close if end == 7 else ('', '')
    ms.append({'voices': [(1, 1, f'{six[0]}[c4,e4,a4,c5]/12{six[1]}'), (2, 5, '[a2,g3]/12')]})
    ms.append({'voices': [(1, 1, f'{seven[0]}[d4,{melody},a4,d5]/12{seven[1]}'),
                          (2, 5, '[d2,a2,d3]/12')]})
    return ms


measures = [pattern(*b) for b in BODY] + ending(FIRST, 'fs4', 6) + ending(SECOND, 'f4', 7)
measures[0]['left'] = [REPEAT_FWD]
measures[31]['left'] = [ending_start(1)]
measures[38]['right'] = [ending_stop_repeat(1)]
measures[39]['left'] = [ending_start(2)]
measures[46]['right'] = [ending_discontinue(2, final=True)]

PIECE = {
    'title': 'Gymnopédie No. 1',
    'composer': 'Erik Satie',
    'fifths': 2, 'beats': 3, 'beat_type': 4, 'beam_group': 4,
    'tempo_text': 'Lent et douloureux', 'measures': measures,
    'source': 'Dover edition (a reprint of the original edition), as typeset by Evin Robertson '
              'for the Mutopia Project (piece 37, public domain): '
              'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=37',
    'encoder': 'dacapo project',
    'encoding_date': '2026-09-30',
    'rights': 'Music: public domain. This encoding: dacapo project, released under the MIT licence.',
    'comments': [
        'The whole piece, transcribed from the public-domain Mutopia edition (after the Dover '
        'reprint of the original edition) and checked note for note against its MIDI file. '
        'No fingering. The left-hand chords, which the edition prints on the treble staff in '
        'bars 1-18 and in both endings, are written on the bass staff with the bass notes, since '
        'the left hand plays them; only in bars 37 and 45, where the left hand has its own second '
        'voice, do the treble-staff chords stay on the treble staff for the right hand. Slurs, '
        'hairpins and dynamics as printed in the Mutopia LilyPond file (gymnopedie_1.ly, piece 37); '
        'the dynamics printed with the chords go with them on the bass staff.',
    ],
}
