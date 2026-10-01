"""Auld Lang Syne: a lead sheet, the Scottish air as the Franklin Square Song Collection (1881)
prints it, page 104, in G major and 2/4.

The melody is the edition's soprano line, note for note: an eighth-note pickup, the verse (eight
bars, the last cut short by the chorus's pickup) and the chorus between repeat signs, as printed
("Repeat Chorus ff."). The edition's Scotch snaps are kept: "be for-got" (bar 3) and the like are
a sixteenth then a dotted eighth. Bar 8 holds a quarter note and an eighth rest; the chorus's
eighth-note pickup stands after the repeat sign in a bar of its own, so the repeat goes back to
it. The tempo word is the edition's ("Slow."); the metronome figure is ours. The edition sets the
air for four voices; only the tune is taken. The chord symbols are ours (dacapo project, MIT):
I, IV and V7 of G. The bass staff is left empty (rests) for a left hand made from the symbols.
"""

REPEAT_FWD = ('<barline location="left"><bar-style>heavy-light</bar-style>'
              '<repeat direction="forward"/></barline>')
REPEAT_BWD = ('<barline location="right"><bar-style>light-heavy</bar-style>'
              '<repeat direction="backward"/></barline>')

VERSE = [
    # Should auld acquaintance be forgot, / And never brought to mind?
    '@h:G g4/3 g4/1 g4/2 b4/2', '@h:D7 a4/3 g4/1 a4/2 b4/2', '@h:G g4/1 g4/3 b4/2 d5/2',
    '@h:C e5/6 e5/2', '@h:G d5/3 b4/1 b4/2 g4/2',
    # Should auld acquaintance be forgot, / And days of auld lang syne?
    '@h:D7 a4/3 g4/1 a4/2 b4/2', '@h:C g4/3 e4/1 e4/2 @h:D7 d4/2', '@h:G g4/4 r/2',
]
CHORUS = [
    # For auld lang syne, my dear, / For auld lang syne,
    'd5/3 b4/1 b4/3 g4/1', '@h:D7 a4/3 g4/1 a4/2 r/1 b4/1', '@h:G d5/3 b4/1 b4/3 d5/1',
    '@h:C e5/6 e5/2',
    # We'll tak' a cup o' kindness yet / For auld lang syne.
    '@h:G d5/3 b4/1 b4/2 g4/2', '@h:D7 a4/3 g4/1 a4/2 b4/2', '@h:C g4/3 e4/1 e4/2 @h:D7 d4/2',
    '@h:G g4/4 r/2',
]


def bar(melody, number, length=8, **extra):
    rest = f'r/{length}'
    return {'voices': [(1, 1, melody), (2, 5, rest)], 'number': number, **extra}


measures = [bar('d4/2', '0', 2, implicit=True)]
measures += [bar(m, str(i + 1), 6 if i == 7 else 8) for i, m in enumerate(VERSE)]
# The chorus's pickup, after the repeat sign, in a bar of its own.
measures.append(bar('e5/2', '8a', 2, implicit=True, left=[REPEAT_FWD]))
measures += [bar(m, str(i + 9), 6 if i == 7 else 8) for i, m in enumerate(CHORUS)]
measures[-1]['right'] = [REPEAT_BWD]

PIECE = {
    'title': 'Auld Lang Syne',
    'composer': 'Traditional (Scottish)',
    'fifths': 1, 'beats': 2, 'beat_type': 4, 'beam_group': 4, 'bpm': 60,
    'tempo_text': 'Slow.', 'measures': measures,
    'source': 'Franklin Square Song Collection, selected by J. P. McCaskey (New York: Harper & '
              'Brothers, 1881), p. 104, "Auld Lang Syne" (Scottish air; public domain), scan: '
              'https://archive.org/details/franklinsquares04mccagoog/page/n108/',
    'encoder': 'dacapo project',
    'encoding_date': '2026-10-01',
    'rights': 'Music: public domain. This encoding and the chord symbols: dacapo project, released '
              'under the MIT licence.',
    'comments': [
        'A lead sheet: the melody (the soprano line of the edition\'s four-part setting, note for '
        'note, its Scotch snaps kept) and chord symbols of our own (dacapo project, MIT). The '
        'chorus is repeated as printed; its eighth-note pickup stands in a bar of its own after '
        'the repeat sign. The edition\'s tempo word; the metronome figure is ours. The bass staff '
        'is empty, for a left hand made from the symbols. No fingering.',
    ],
}
