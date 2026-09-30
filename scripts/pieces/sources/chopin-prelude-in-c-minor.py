"""Prelude in C minor, Op. 28 No. 20, all 13 bars.

Transcribed from the Mutopia Project's public-domain edition (piece 472, after Edition Peters)
and checked note for note against its MIDI file. Bars 9-12 are written out in the source (the
repeat of bars 5-8, pianissimo), not given with repeat signs. The right hand starts in the bass
clef and changes clef where the source does (bars 4, 8, 9, 12 and 13). On beat 3 the source
writes a separate top voice (dotted eighth and sixteenth over a quarter-note chord) in bars 1-5,
7-9, 11 and 12; only there does the right hand have two voices. In bars 7 and 11 the source
enters the quarter-note chord first with \\stemDown and the moving voice second with \\stemUp;
here the moving voice is voice 1 (stems up), which is how the source prints it. The closing
fermata is not encoded.
"""

# Right hand, one row per bar: (voice 1, voice 2 or None).
RH = [
    ('[g3,c4,ef4,g4]/4 [af3,c4,ef4,af4]/4 [ef4,g4]/3 [d4,f4]/1 [ef3,g3,c4,ef4]/4',
     's/8 [g3,b3]/4 s/4'),
    ('[ef3,af3,c4,ef4]/4 [f3,af3,df4,f4]/4 [c4,ef4]/3 [bf3,df4]/1 [c3,ef3,af3,c4]/4',
     's/8 [df3,ef3,g3]/4 s/4'),
    ('[d3,f3,b3,d4]/4 [e3,g3,bf3,c4,e4]/4 g4/3 f4/1 [g3,c4,ef4]/4',
     's/8 [af3,c4]/4 s/4'),
    ('[fs3,c4,d4]/4 [g3,b3,d4,g4]/4 clef:G b4/3 a4/1 [b3,d4,g4]/4',
     's/8 [c4,d4,fs4]/4 s/4'),
    ('[ef4,g4,ef5]/4 [ef4,af4,ef5]/4 [d4,d5]/4 [d4,g4,d5]/4',
     's/8 af4/3 fs4/1 s/4'),
    ('[c4,g4,c5]/4 [c4,d4,fs4,d5]/4 [d4,g4,b4]/3 [c4,a4]/1 [b3,d4,g4]/4', None),
    ('[c4,g4,c5]/4 [af3,c4,af4]/4 g4/3 f4/1 [g3,c4,ef4]/4',
     's/8 [g3,d4]/4 s/4'),
    ('clef:F [ef3,af3,c4,ef4]/4 [f3,af3,df4,f4]/4 ef4/3 d4/1 [ef3,g3,c4]/4',
     's/8 [f3,g3,b3]/4 s/4'),
]
# Bars 9-12 repeat bars 5-8 note for note; bar 9 returns to the treble clef.
RH += [('clef:G ' + RH[4][0], RH[4][1])] + RH[5:8]
RH += [('clef:G [c4,ef4,g4,c5]/16', None)]

LH = [
    '[c2,c3]/4 [f1,f2]/4 [g1,g2]/4 [c2,g2,c3]/4',
    '[af1,af2]/4 [df1,df2]/4 [ef1,ef2]/4 [af1,af2]/4',
    '[g1,g2]/4 [c1,c2]/4 [f1,f2]/4 [c2,c3]/4',
    '[d2,a2,d3]/4 [g1,g2]/4 [d1,d2]/4 [g1,g2]/4',
    '[c2,c3]/4 [c3,c4]/4 [b2,b3]/4 [bf2,bf3]/4',
    '[a2,a3]/4 [af2,af3]/4 [g2,g3]/4 [f2,f3]/4',
    '[ef2,ef3]/4 [f2,f3]/4 [b1,b2]/4 [c2,c3]/4',
    '[af1,af2]/4 [df1,df2]/4 [g1,g2]/4 [c1,c2]/4',
]
LH += LH[4:8] + ['[c3,g3]/16']

measures = []
for (v1, v2), lh in zip(RH, LH):
    voices = [(1, 1, v1)] + ([(1, 2, v2)] if v2 else []) + [(2, 5, lh)]
    measures.append({'voices': voices})
measures[-1]['right'] = ['<barline location="right"><bar-style>light-heavy</bar-style></barline>']

PIECE = {
    'title': 'Prelude in C minor',
    'work_number': 'Op. 28, No. 20',
    'composer': 'Frédéric Chopin',
    'fifths': -3, 'clefs': {1: 'F'}, 'beats': 4, 'beat_type': 4, 'beam_group': 4, 'bpm': 42,
    'tempo_text': 'Largo', 'measures': measures,
    'source': 'Edition Peters, as typeset by Magnus Lewis-Smith for the Mutopia Project '
              '(piece 472, public domain): '
              'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=472',
    'encoder': 'dacapo project',
    'encoding_date': '2026-09-30',
    'rights': 'Music: public domain. This encoding: dacapo project, released under the MIT licence.',
    'comments': [
        'Transcribed from the public-domain Mutopia edition (after Edition Peters) and checked '
        'note for note against its MIDI file. No fingering. Bars 9-12 are written out as in the '
        'source. The tempo, quarter = 42, is the one the source gives its MIDI rendering. The '
        'right hand has two voices only on beat 3 where the source writes a separate top voice; '
        'the closing fermata is not encoded.',
    ],
}
