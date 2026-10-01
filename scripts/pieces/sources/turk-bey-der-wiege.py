"""Bey der Wiege zu singen ("To sing at the cradle"): No. 5 of Daniel Gottlob Türk's Sechzig
Handstücke für angehende Klavierspieler, part 1. A quarter-note upbeat and 8 bars, the last three
beats long.

Read from the scan of the second edition (Leipzig and Halle: at the author's expense, 1797) in the
Bayerische Staatsbibliothek (4 Mus.pr. 2009.2607-1/2, public domain), page 2 of the music (scan
page 10). There is no MIDI file of this piece to check against, so it was verified the way the
lead sheets were: a second reader transcribed pitch, rhythm, fingering and slurs blind from the
same scan, the two transcriptions were compared mechanically, and they agree note for
note, finger for finger and mark for mark.

Fingering as printed in the 1797 edition (Türk's own): five figures in all. The p and the slurs
are the edition's. Not encoded: the edition's sign '' over bars 2 and 6 (in both hands), which
tells the player to lift the finger early at the end of a phrase (its footnote explains it);
MusicXML has no sign for it, and the slur before it already ends there. The tempo word is the
edition's ("Andantino."); the metronome figure is ours.
"""

ROWS = [
    ('a4/4 g4/4 f4/4 g4/4', 'c4/4 bf3/4 a3/4 bf3/4'),
    ('a4/8( f4/4) a4/4', 'c4/8( a3/4) f3/4'),
    ('c5/4 c5/4 bf4/4 a4/4', 'a3/4 a3/4 g3/4 f3/4'),
    ('g4/8 r/4 a4/2!f3 g4/2', 'c4/8 c3/4 r/4'),
    ('f4/4 g4/4 a4/4 bf4/4', 'a3/4!f2 e3/4 f3/4 g3/4'),
    ('c5/8( a4/4) f4/4', 'a3/8( f3/4) a3/4'),
    ('bf4/4 a4/3( c5/1) a4/4 g4/4', 'g3/4 f3/4 c4/4 c3/4'),
    ('f4/8 r/4', 'f3/8!f1 f2/4'),
]

measures = [{'voices': [(1, 1, '@p f4/4!f1'), (2, 5, 'a3/4!f3')], 'number': 0, 'implicit': True}]
measures += [{'voices': [(1, 1, rh), (2, 5, lh)], 'number': i + 1} for i, (rh, lh) in enumerate(ROWS)]
measures[-1]['right'] = ['<barline location="right"><bar-style>light-heavy</bar-style></barline>']

PIECE = {
    'title': 'Bey der Wiege zu singen',
    'work_number': 'Sechzig Handstücke für angehende Klavierspieler, part 1, No. 5',
    'composer': 'Daniel Gottlob Türk',
    'fifths': -1, 'beats': 4, 'beat_type': 4, 'beam_group': 4, 'bpm': 76,
    'tempo_text': 'Andantino', 'measures': measures, 'pickup': True,
    'source': 'Sechzig Handstücke für angehende Klavierspieler, Erster Theil, second edition '
              '(Leipzig and Halle: the author, 1797), No. 5; scan of the Bayerische '
              'Staatsbibliothek copy (public domain): '
              'https://www.digitale-sammlungen.de/en/view/bsb00086024?page=10',
    'encoder': 'dacapo project',
    'encoding_date': '2026-10-02',
    'rights': 'Music: public domain. This encoding: dacapo project, released under the MIT licence.',
    'comments': [
        'Read from the scan of the 1797 edition and proofread blind by a second reader against '
        'the same scan (no MIDI file exists to check against). Fingering, slurs and the p as '
        'printed in the 1797 edition; its sign for lifting the finger early (bars 2 and 6) is '
        'not encoded. The last bar is three beats long, completing the upbeat. The edition\'s '
        'tempo word; the metronome figure is ours.',
    ],
}
