"""Old French Song, Op. 39 No. 16 (Album for the Young), all 32 bars and the eighth-note pickup.

Transcribed from the Mutopia Project's public-domain edition (piece 2080, after Schirmer 1904)
and checked note for note against its MIDI file. The form is A A B A. The edition writes the
second A out in full (the source's `\\repeat unfold` with alternatives in the left hand), so there
are no repeat signs: the bars are encoded as printed, and bar 8 (G3 then G2 in the bass) and bar
16 (a half note) are the two different endings of the A section.

The left hand has two voices in the A sections (the inner line with stems up, the tied G pedal
with stems down) and one voice in the B section. The right hand has a second voice only in the
last two bars (E-flat4 D4, then B-flat3 under the final G4).

The melody's A-double-dotted-quarter-and-G-sixteenth (bars 7, 15 and 31) is written as a dotted
quarter tied to a sixteenth, since the generator has no double-dotted notes; it sounds the same.

On the second beat of bars 4, 6, 12, 14, 28 and 30 both left-hand voices have G3 (one notehead
with two stems in the edition), so the file has two G3s there. They are one key press, as in the
app and in the MIDI file, and verify.ts counts them once.

Markings (added in X0 from the Mutopia LilyPond file 16OldFrenchSong.ly, piece 2080, and checked
against its PDF): p, pp, mf and the hairpins of its dynamics line (placed below the right hand);
the melody's slurs (the same in each A section, from the eighth-note pickup); the inner voice's
slurs, its phrasing slur over bars 4-6 written as a slur; the bass slur of bars 31-32; the
staccato on the bass's G2 in bar 8 and on the left hand's eighths in bars 17-20, and the left
hand's slurs in bars 21-24. The espressivo marks (a small swell over the inner voice's note in
bars 7, 15 and 31) have no MusicXML equivalent and are left out.
"""

# The first six bars of each A section: right hand, left-hand inner voice, left-hand bass.
A_HEAD = [
    ('g4/2 a4/2 bf4/2 c5/2', 'bf3/2( c4/2 d4/2 c4/2', 'g3/8~'),
    ('d5/6) d5/2(', 'bf3/8)', 'g3/4 g3/4~'),
    ('c5/2 d5/2 ef5/2 c5/2', 'ef4/4( c4/4', 'g3/8~'),
    ('d5/6) d5/2(', 'bf3/4) g3/4(', 'g3/4 g3/4~'),
    ('c5/2 d5/2 ef5/2 c5/2', 'ef4/4 c4/4', 'g3/8~'),
    ('d5/2 ef5/1 d5/1 c5/2 bf4/2', 'bf3/4 g3/4)', 'g3/4 g3/4'),
]
A_BAR7 = 'a4/6~ a4/1 g4/1'

rows = [[(1, 1, '@p d4/2('), (2, 5, 's/2')]]


def a_section(bar7_middle, bar7_bass, last, rh2=None):
    out = [[(1, 1, rh), (2, 5, mid), (2, 6, bass)] for rh, mid, bass in A_HEAD]
    bar7 = [(1, 1, A_BAR7)] + ([(1, 2, rh2[0])] if rh2 else [])
    out.append(bar7 + [(2, 5, bar7_middle), (2, 6, bar7_bass)])
    out.append(last)
    return out


# A, with the first ending: the melody's pickup into the second A.
rows += a_section('c4/8', 'fs3/4 d3/4',
                  [(1, 1, 'g4/6) @pp d4/2('), (2, 5, 'bf3/4 s/4'), (2, 6, 'g3/4 g2/4!st')])
# A, with the second ending.
rows += a_section('c4/8', 'fs3/4 d3/4', [(1, 1, 'g4/8)'), (2, 5, 'bf3/8'), (2, 6, 'g3/8')])
# B: one voice in each hand.
B = [
    ('@p g4/4( g4/2 a4/2', 'c3/2!st g3/2!st c4/2!st ef4/2!st'),
    ('bf4/6) bf4/2(', 'g2/2!st g3/2!st c4/2!st ef4/2!st'),
    ('c5/4) c5/4(', 'c3/2!st g3/2!st c4/2!st ef4/2!st'),
    ('@< a4/6) a4/2(', 'd3/2!st a3/2!st c4/2!st fs4/2!st'),
    ('d5/6 @! d5/2', '[g3,bf3]/2( d4/2 g4/2) r/2'),
    ('@mf ef5/2 f5/1 ef5/1 d5/2 c5/2', '[c4,ef4,g4]/8('),
    ('bf4/4 @> a4/2 g4/2', '[d4,g4]/4) r/4'),
    ('[fs4,a4]/6) @! @p d4/2(', 'd4/4( d3/4)'),
]
rows += [[(1, 1, rh), (2, 5, lh)] for rh, lh in B]
# A, closing: the right hand's second voice in the last two bars.
rows += a_section('g3/4 fs3/4', 'c3/4( d3/4',
                  [(1, 1, 'g4/8)'), (1, 2, 'bf3/8'), (2, 5, 'd3/8'), (2, 6, 'g2/8)')],
                  rh2=('ef4/4 d4/4',))

measures = [{'voices': voices, 'number': i} for i, voices in enumerate(rows)]
measures[0]['implicit'] = True

PIECE = {
    'title': 'Old French Song',
    'work_number': 'Op. 39, No. 16',
    'composer': 'Pyotr Ilyich Tchaikovsky',
    'fifths': -2, 'beats': 2, 'beat_type': 4, 'beam_group': 8, 'bpm': 70,
    'tempo_text': 'Moderato assai', 'measures': measures, 'pickup': True,
    'source': 'Schirmer, 1904, as typeset by David McNamara for the Mutopia Project '
              '(piece 2080, public domain): '
              'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2080',
    'encoder': 'dacapo project',
    'encoding_date': '2026-09-30',
    'rights': 'Music: public domain. This encoding: dacapo project, released under the MIT licence.',
    'comments': [
        'The whole piece, transcribed from the public-domain Mutopia edition and checked note for '
        'note against its MIDI file. No fingering. The second A section is written out as in the '
        'edition (no repeat signs). The double-dotted A in bars 7, 15 and 31 is a dotted quarter '
        'tied to a sixteenth. On the second beat of bars 4, 6, 12, 14, 28 and 30 both left-hand '
        'voices have G3, as in the edition (the MIDI file has one note there). Dynamics, hairpins, '
        'slurs (the phrasing slur of bars 4-6 as a slur) and staccatos as printed in the Mutopia '
        'LilyPond file (16OldFrenchSong.ly, piece 2080); its espressivo marks (a small swell on the '
        'inner voice in bars 7, 15 and 31) have no MusicXML equivalent and are left out.',
    ],
}
