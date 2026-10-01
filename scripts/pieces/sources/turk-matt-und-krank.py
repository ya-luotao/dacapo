"""Ich bin so matt und krank ("I am so faint and ill"): No. 9 of Daniel Gottlob Türk's Sechzig
Handstücke für angehende Klavierspieler, part 1. A quarter-note upbeat and 8 bars, the last two
beats long. The title is a line of the poet Bürger, whom the edition names beside it.

Read from the scan of the second edition (Leipzig and Halle: at the author's expense, 1797) in the
Bayerische Staatsbibliothek (4 Mus.pr. 2009.2607-1/2, public domain), page 3 of the music (scan
page 11). There is no MIDI file of this piece to check against, so it was verified the way the
lead sheets were: a second reader transcribed pitch, rhythm, fingering and dynamics blind from the
same scan, the two transcriptions were compared mechanically, and they agree note for
note, finger for finger and mark for mark.

Fingering as printed in the 1797 edition (Türk's own): seven figures in all. The two pp are the
edition's, one under each hand's first note. The sharps are the edition's: D sharp in bars 2, 3
and 5 (in bar 2 the sign stands before the half note and holds for the quarter). The tempo words
are the edition's ("Largo molto e tenero."); the metronome figure is ours.
"""

ROWS = [
    ('e4/8 b4/4', 'r/4 @pp g3/4!f1 r/4'),
    ('ds4/8!f2 ds4/4', 'r/4 fs3/4 r/4'),
    ('e4/4!f1 fs4/4 g4/4', 'r/2 g3/2 ds3/4 e3/4'),
    ('a4/8 a4/4', 'c3/4!f1 fs2/4 r/4'),
    ('c5/8 ds4/4', 'r/4 a3/4!f2 r/4'),
    ('b4/8 e4/4!f1', 'r/4 g3/4 r/4'),
    ('a4/4 g4/4 fs4/4', 'r/2 fs3/2 b3/4 b2/4'),
    ('e4/8', 'e3/4 e2/4'),
]

measures = [{'voices': [(1, 1, '@pp b4/4!f5'), (2, 5, 'r/4')], 'number': 0, 'implicit': True}]
measures += [{'voices': [(1, 1, rh), (2, 5, lh)], 'number': i + 1} for i, (rh, lh) in enumerate(ROWS)]
measures[-1]['right'] = ['<barline location="right"><bar-style>light-heavy</bar-style></barline>']

PIECE = {
    'title': 'Ich bin so matt und krank',
    'work_number': 'Sechzig Handstücke für angehende Klavierspieler, part 1, No. 9',
    'composer': 'Daniel Gottlob Türk',
    'fifths': 1, 'beats': 3, 'beat_type': 4, 'beam_group': 4, 'bpm': 56,
    'tempo_text': 'Largo molto e tenero', 'measures': measures, 'pickup': True,
    'source': 'Sechzig Handstücke für angehende Klavierspieler, Erster Theil, second edition '
              '(Leipzig and Halle: the author, 1797), No. 9; scan of the Bayerische '
              'Staatsbibliothek copy (public domain): '
              'https://www.digitale-sammlungen.de/en/view/bsb00086024?page=11',
    'encoder': 'dacapo project',
    'encoding_date': '2026-10-02',
    'rights': 'Music: public domain. This encoding: dacapo project, released under the MIT licence.',
    'comments': [
        'Read from the scan of the 1797 edition and proofread blind by a second reader against '
        'the same scan (no MIDI file exists to check against). Fingering and dynamics as printed '
        'in the 1797 edition. The last bar is two beats long, completing the upbeat. The '
        'edition\'s tempo words; the metronome figure is ours.',
    ],
}
