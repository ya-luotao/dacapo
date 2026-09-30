"""Morning Prayer, Op. 39 No. 1 (Album for the Young), all 24 bars.

Transcribed from the Mutopia Project's public-domain edition (piece 2032, after Schirmer 1904)
and checked note for note against its MIDI file. There are no repeats.

A four-part chorale: where a hand has two lines the edition writes them as two voices, and so
does this file (right hand: voices 1 and 2; left hand: voices 5 and 6); elsewhere a hand plays
block chords in one voice. Where the two voices of a hand meet on the same note, both voices
have it, as in the edition: the right hand's C5 in bar 17 and C4 in bar 19 (the upper voice drops
onto the lower voice's repeated C), and the left hand's D3 on the third beat of bar 15 (the upper
voice's D is tied into bar 16, the lower voice's D moves on to the G pedal).

The right hand is in the bass clef from the third beat of bar 19 to the end of bar 20, as in the
edition. In bar 23 the right hand's lower voice stops after its half note (the edition has nothing
there, not a rest). In bars 22 to 24 the left hand's repeated D3s and G2s are slurred in the
edition, not tied, so each is played again.

Markings (added in X0 from the Mutopia LilyPond file 01MorningPrayer.ly, piece 2032, and checked
against its PDF): the dynamics (p, mf, f, pp), the hairpins (the one over the left hand in bar 17
placed above it, as printed), "dim." with its dashed line from bar 20 to the pp, the slurs of
both hands (the edition doubles the slurs on the chords of bar 3, above and below; here each is
one slur; the left hand's slur from bar 20, which the LilyPond file ends on the rest at the
start of bar 22, ends on the A before it, where the printed slur ends), the accents, the
tenuto on the last chord, the pedal (Ped. in bar 22, released at bar 24), and the cautionary
naturals the edition prints (bars 5, 6, 13 and 14). The mp the LilyPond file hides in bar 5 is not
printed and is left out.
"""

# (right hand voices, left hand voices) per bar; one string is a single voice.
BARS = [
    # 1-4
    ('@p [g4,b4]/4 [g4,b4]/6 [fs4,a4]/2', '[g3,d4]/4 [g3,d4]/6 [d3,d4]/2'),
    ('[g4,c5]/4 [g4,b4]/8', '[e3,c4]/4 [g3,d4]/8'),
    ('@< [fs4,a4]/4( [e4,g4]/4) [e4,a4]/4', '[d3,d4]/4( [e3,b3]/4) [c3,e3]/4'),
    ('@! [ds4,b4]/12', '[b2,fs3]/12'),
    # 5-8
    (('@> b4/4 e4/6( @! a4/2)', 'd4/4!c cs4/8'), ('e3/4 e3/8', 'gs2/4 a2/4( g2/4)')),
    (('@< a4/4 d4/6( fs4/2', 'c4/4!c b3/4( c4/4)'), ('d3/4 d3/8', 'fs2/4 g2/4( a2/4)')),
    (('g4/4) g4/4 e5/3!ac( @! a4/1)', 'd4/4 e4/4 g4/4'), '[b2,g3]/4 [c3,g3]/4 [cs3,a3]/4'),
    (('@mf a4/12', 'g4/4( @> fs4/2 e4/2 @! fs4/4)'), ('a3/8( d4/4)', 'd3/12')),
    # 9-12
    ('@p [g4,b4]/4 [g4,b4]/6 [fs4,a4]/2', '[g3,d4]/4 [g3,d4]/6 [d3,d4]/2'),
    ('@< [g4,c5]/4 [g4,b4]/6 [g4,b4]/2', '[e3,c4]/4 [g3,d4]/4 f4/4('),
    ('[g4,c5]/4 [g4,b4,d5]/4 @! [g4,c5,e5]/4', 'e4/4 d4/4 c4/2 b3/2'),
    (('@f fs5/8!ac( fs5/4', '[fs4,cs5]/12'), 'as3/12)'),
    # 13-16
    (('ds5/4)( @> e5/6 cs5/2', 'b4/4 b4/4( a4/4)'), ('fs4/4 e4/8', 'a3/4!c( gs3/4 g3/4)')),
    (('d5/4) b4/4 c5/4!c', 'a4/4 g4/4 g4/4'), '[fs3,d4]/4 [g3,d4]/4 [e3,c4]/4'),
    (('b4/3!ac( a4/1) a4/4 fs4/4(', 'e4/8 d4/2( c4/2'), ('g3/8 d3/4~', 'c3/8 d3/4(')),
    (('@! g4/4) r/4 g5/4(', 'b3/4) s/4 @f b4/4'),
     ('d3/4 r/4 d3/4(', 'g2/2) g2/2 g2/2 g2/2 g2/2 g2/2')),
    # 17-20
    (('fs5/3!ac c5/1 c5/4 b4/2 a4/2', 'c5/3 c5/1 c5/4 fs4/4'),
     ('@>^ ef3/12', 'g2/2 g2/2 g2/2 g2/2 g2/2 g2/2')),
    (('b4/4) r/4 g4/4(', 'g4/4 r/4 @mf b3/4'),
     ('@!^ d3/4) r/4 d3/4(', 'g2/2 g2/2 g2/2 g2/2 g2/2 g2/2')),
    (('fs4/3!ac c4/1 c4/4 clef:F b3/2 a3/2)', 'c4/3 c4/1 c4/4 fs3/4'),
     ('ef3/12', 'g2/2 g2/2 g2/2 g2/2 g2/2 g2/2')),
    ('[g3,b3]/4 [g3,e4]/4 @w:dim. @dashes[ [g3,d4]/4',
     ('d3/4)( c3/4 b2/4', 'g2/2 g2/2 g2/2 g2/2 g2/2 g2/2')),
    # 21-24
    ('clef:G [cs4,e4]/8 [c4,fs4]/4', ('bf2/8 a2/4)', 'g2/2 g2/2 g2/2 g2/2 g2/2 g2/2')),
    (('g4/8 r/4', 'b3/8 b3/4('), ('r/4 d3/8(', '@Ped g2/12(')),
    (('r/4 g4/4 [g4,b4]/4', '[b3,d4]/8) s/4'), ('d3/12)(', 'g2/12)(')),
    ('@dashes] @pp [g4,b4,d5]/12!te', ('d3/12)', '@Ped* g2/12)')),
]


def hand(staff, voices):
    first = 1 if staff == 1 else 5
    if isinstance(voices, str):
        return [(staff, first, voices)]
    return [(staff, first, voices[0]), (staff, first + 1, voices[1])]


measures = [{'voices': hand(1, rh) + hand(2, lh)} for rh, lh in BARS]
measures[-1]['right'] = ['<barline location="right"><bar-style>light-heavy</bar-style></barline>']

PIECE = {
    'title': 'Morning Prayer',
    'work_number': 'Op. 39, No. 1',
    'composer': 'Pyotr Ilyich Tchaikovsky',
    'fifths': 1, 'beats': 3, 'beat_type': 4, 'beam_group': 12, 'bpm': 62,
    'tempo_text': 'Lento', 'measures': measures,
    'source': 'Schirmer, 1904, as typeset by Rem Zolotykh for the Mutopia Project '
              '(piece 2032, public domain): '
              'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2032',
    'encoder': 'dacapo project',
    'encoding_date': '2026-09-30',
    'rights': 'Music: public domain. This encoding: dacapo project, released under the MIT licence.',
    'comments': [
        'The whole piece, transcribed from the public-domain Mutopia edition and checked note for '
        'note against its MIDI file. No fingering. The four-part texture is kept as the edition '
        'writes it: two voices in a hand where it has two lines, with a note both voices share '
        '(RH C5 in bar 17, C4 in bar 19; LH D3 in bar 15) written in both. The right hand is in '
        'the bass clef from beat 3 of bar 19 to bar 20. Slurred repeated notes (LH bars 22-24) '
        'are played again, as the edition slurs rather than ties them. Dynamics, hairpins, "dim.", '
        'slurs, accents, the tenuto, the pedal and the cautionary naturals as printed in the Mutopia '
        'LilyPond file (01MorningPrayer.ly, piece 2032).',
    ],
}
