"""La Candeur, Op. 100 No. 1 (Burgmüller, 25 Études faciles et progressives), all 23 written bars.

Transcribed from the Mutopia Project's public-domain edition (piece 202, after the Collection
Litolff) and checked note for note against its MIDI file. Both halves are repeated, the second with
first and second endings, as in the source. The source has a second right-hand voice only in bar
13 (the eighths under the half notes G5 and F#5). The left hand changes to the treble clef for bars
15-21 and back to the bass clef halfway through bar 21, as in the source. The tempo is the
source's "Allegro moderato"; the metronome value is the one in the source's MIDI block.

Markings (added in X0 from the Mutopia LilyPond file 25EF-01.ly, piece 202, and checked against
its PDF): the dynamics (p, sf, pp), the hairpins, the words dolce, cresc., "dolce e poco rit."
and "dim. e poco rit.", and every slur, as the edition prints them. Two spots follow the printed
page where the LilyPond source says more: the crescendo written on a note inside the chord of
bar 10 is not printed there (LilyPond drops it), and the slur of bars 10-12 runs from the chord
of bar 10 to the chord of bar 12 (the second slur start on bar 11's F is ignored there). A slur
that ends and starts on one note (bars 14, 15 and 19) is written that way. No fingering.
"""

from musicxml_gen import REPEAT_BWD, REPEAT_FWD, ending_discontinue, ending_start, ending_stop_repeat

# (right hand, left hand) per written bar; a right hand given as a list has two voices.
ROWS = [
    # First half (repeated).
    ('@p g5/2( e5/2 d5/2 c5/2) g5/2( e5/2 d5/2 c5/2)', '@w:dolce^ [c3,e3,g3]/16'),
    ('@> c6/2( a5/2 g5/2 @! f5/2) c6/2( a5/2 g5/2 f5/2)', '[c3,f3,a3]/16'),
    ('g5/2( e5/2 d5/2 c5/2 b4/2 c5/2 e5/2 f5/2)', '[c3,e3,g3]/16~'),
    ('g5/2( e5/2 d5/2 c5/2 b4/2 c5/2 d5/2 e5/2)', '[c3,e3,g3]/16'),
    ('@w:cresc. g5/2( f5/2 e5/2 d5/2) g5/2( f5/2 e5/2 d5/2)', '[b2,f3,g3]/16'),
    ('f5/2( e5/2 d5/2 c5/2) f5/2( e5/2 d5/2 c5/2)', '[c3,e3,g3]/16'),
    ('@< b4/2( a4/2 c5/2 @! b4/2 d5/2 c5/2 b4/2 a4/2', '[d3,fs3,c4]/16'),
    ('g4/2 b4/2 c5/2 d5/2 g5/4) r/4', '[g3,b3]/12 r/4'),
    # Second half (repeated, with two endings).
    ('@p f5/2( d5/2 c5/2 b4/2 f5/2 d5/2 c5/2 b4/2',
     'g3/2( b3/2 c4/2 d4/2) g3/2( b3/2 c4/2 d4/2)'),
    ('[c5,e5]/16)(', 'g3/2( a3/2 b3/2 c4/2 d4/2 c4/2 e4/2 c4/2)'),
    ('f5/2 d5/2 c5/2 b4/2 f5/2 d5/2 c5/2 b4/2', 'g3/2( b3/2 c4/2 d4/2) g3/2( b3/2 c4/2 d4/2)'),
    ('@< [c5,e5]/16)', 'g3/2( a3/2 b3/2 c4/2 d4/2 c4/2 e4/2 c4/2)'),
    (['@! @> g5/8 @! @> fs5/8', 'r/2 ef5/2( d5/2 c5/2) r/2 ef5/2( d5/2 c5/2)'], 'a3/8 [a3,c4]/8'),
    ('@! @sf @> a5/2( g5/2) c5/2( @! d5/2 f5/2 e5/2)( g4/2 a4/2', '[g3,c4,e4]/16'),
    ('@p c5/2 @w:dolce_e_poco_rit. b4/2)( g4/2 a4/2 c5/2 b4/2 e5/2 d5/2',
     'clef:G [g3,f4]/8 [g3,f4]/8'),
    ('e5/12) r/4', 'c4/2( e4/2 f4/2 g4/2 c4/4) r/4'),
    ('c5/2 b4/2( c5/2 d5/2 e5/2 f5/2 g5/2 c5/2', '[c4,e4]/8 r/8'),
    # Coda.
    ('@> f5/2 d5/2 c5/2 @! b4/2 @> f5/2 d5/2 c5/2 @! b4/2', '[c4,f4,af4]/8 [c4,f4,af4]/8'),
    ('c5/2 b4/2)( c5/2 d5/2 e5/2 f5/2 g5/2 c5/2', '[c4,e4,g4]/16'),
    ('@> f5/2 d5/2 c5/2 @! b4/2 @> f5/2 d5/2 c5/2 @! b4/2', '[c4,f4,af4]/8 [c4,f4,af4]/8'),
    ('c5/4) r/4 @p r/8', '[c4,e4,g4]/4 r/4 clef:F c3/2( e3/2 f3/2 g3/2'),
    ('@w:dim._e_poco_rit. [g4,c5,e5]/8 r/8', 'c3/8) c3/2( e3/2 f3/2 g3/2~'),
    ('@pp [e4,c5]/16', '[c3,g3]/16)'),
]

measures = []
for rh, lh in ROWS:
    if isinstance(rh, list):
        voices = [(1, 1, rh[0]), (1, 2, rh[1])]
    else:
        voices = [(1, 1, rh)]
    measures.append({'voices': voices + [(2, 5, lh)]})
measures[7]['right'] = [REPEAT_BWD]
measures[8]['left'] = [REPEAT_FWD]
measures[15].update({'left': [ending_start(1)], 'right': [ending_stop_repeat(1)]})
measures[16].update({'left': [ending_start(2)], 'right': [ending_discontinue(2)]})
measures[-1]['right'] = ['<barline location="right"><bar-style>light-heavy</bar-style></barline>']

PIECE = {
    'title': 'La Candeur',
    'work_number': 'Op. 100, No. 1',
    'composer': 'Friedrich Burgmüller',
    'fifths': 0, 'beats': 4, 'beat_type': 4, 'beam_group': 8, 'bpm': 152,
    'tempo_text': 'Allegro moderato', 'measures': measures,
    'source': 'Collection Litolff (19th century), as typeset by Bas Wassink for the Mutopia Project '
              '(piece 202, public domain): '
              'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=202',
    'encoder': 'dacapo project',
    'encoding_date': '2026-09-30',
    'rights': 'Music: public domain. This encoding: dacapo project, released under the MIT licence.',
    'comments': [
        'Transcribed from the public-domain Mutopia edition (after the Collection Litolff) and '
        'checked note for note against its MIDI file. No fingering. Both halves repeated, the '
        'second with first and second endings, as in the source. Tempo mark Allegro moderato as in '
        'the edition; the metronome value (quarter = 152) is the one in the Mutopia MIDI block, '
        'not printed in the edition. Dynamics, hairpins, words and slurs as printed in the Mutopia '
        'LilyPond file (25EF-01.ly, piece 202) and its PDF.',
    ],
}
