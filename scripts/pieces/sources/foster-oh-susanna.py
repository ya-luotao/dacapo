"""Oh! Susanna (Stephen Foster, 1848): a lead sheet, the song as Heart Songs Dear to the American
People (Boston: Chapple, 1909) prints it, pages 172-173, in G major and 2/4.

The melody is the edition's voice part, note for note: a two-sixteenth pickup, the verse (sixteen
bars) and the chorus between repeat signs (eight bars), the chorus's top line taken where it is
set in two parts. The edition's last bar (G and an eighth rest, before the repeat) is a bar of
2/4 short of an eighth; it is completed with a quarter rest, as the verse's last bar is printed.
The tempo word is the edition's ("Allegretto"); the metronome figure is ours. The chord symbols are
ours (dacapo project, MIT): I, IV and V7 of G. The bass staff is left empty (rests) for a left hand
made from the symbols.
"""

REPEAT_FWD = ('<barline location="left"><bar-style>heavy-light</bar-style>'
              '<repeat direction="forward"/></barline>')
REPEAT_BWD = ('<barline location="right"><bar-style>light-heavy</bar-style>'
              '<repeat direction="backward"/></barline>')

VERSE = [
    # I come from Alabama / With my banjo on my knee, I'm
    '@h:G b4/2 d5/2 d5/2 e5/2', 'd5/2 b4/2 g4/3 a4/1', 'b4/2 b4/2 a4/2 g4/2',
    '@h:D7 a4/6 g4/1 a4/1',
    # going to Louisiana, / My true love for to see; It
    '@h:G b4/2 d5/2 d5/3 e5/1', 'd5/2 b4/2 g4/3 a4/1', 'b4/2 b4/2 @h:D7 a4/2 a4/2',
    '@h:G g4/4 r/2 g4/1 a4/1',
    # rained all night the day I left, / The weather it was dry, The
    'b4/2 d5/2 d5/3 e5/1', 'd5/2 b4/2 g4/3 a4/1', 'b4/2 b4/2 a4/2 g4/2',
    '@h:D7 a4/4 r/2 g4/1 a4/1',
    # sun so hot I froze to death, / Susanna, don't you cry.
    '@h:G b4/2 d5/2 d5/2 e5/2', 'd5/2 b4/2 g4/3 a4/1', 'b4/1 b4/3 @h:D7 a4/3 a4/1',
    '@h:G g4/4 r/4',
]
CHORUS = [
    # Oh! Susanna, / Oh, don't you cry for me, I've
    '@h:C c5/4 c5/4', 'e5/2 e5/4 e5/2', '@h:G d5/2 d5/2 b4/2 g4/2', '@h:D7 a4/4 r/2 g4/1 a4/1',
    # come from Alabama / With my banjo on my knee.
    '@h:G b4/2 d5/2 d5/2 e5/2', 'd5/2 b4/2 g4/2 a4/2', 'b4/2 b4/2 @h:D7 a4/2 a4/2',
    '@h:G g4/4 r/4',
]

measures = [{'voices': [(1, 1, 'g4/1 a4/1'), (2, 5, 'r/2')], 'number': 0, 'implicit': True}]
measures += [{'voices': [(1, 1, m), (2, 5, 'r/8')], 'number': i + 1}
             for i, m in enumerate(VERSE + CHORUS)]
measures[17]['left'] = [REPEAT_FWD]
measures[-1]['right'] = [REPEAT_BWD]

PIECE = {
    'title': 'Oh! Susanna',
    'composer': 'Stephen Foster',
    'fifths': 1, 'beats': 2, 'beat_type': 4, 'beam_group': 4, 'bpm': 100,
    'tempo_text': 'Allegretto', 'measures': measures, 'pickup': True,
    'source': 'Heart Songs Dear to the American People (Boston: Chapple Publishing, 1909), '
              'pp. 172-173, "Oh! Susanna" (public domain), scan: '
              'https://archive.org/details/heartsongsdearto00chap/page/n187/',
    'encoder': 'dacapo project',
    'encoding_date': '2026-10-01',
    'rights': 'Music: public domain. This encoding and the chord symbols: dacapo project, released '
              'under the MIT licence.',
    'comments': [
        'A lead sheet: the melody (the edition\'s voice part, note for note; the top line of the '
        'chorus) and chord symbols of our own (dacapo project, MIT). The last bar, printed as G '
        'and an eighth rest, is completed with a quarter rest. The edition\'s tempo word; the '
        'metronome figure is ours. The bass staff is empty, for a left hand made from the '
        'symbols. No fingering.',
    ],
}
