"""Hans ohne Sorgen ("Carefree Hans"): No. 4 of Daniel Gottlob Türk's Sechzig Handstücke für
angehende Klavierspieler, part 1. All 8 bars.

Read from the scan of the second edition (Leipzig and Halle: at the author's expense, 1797) in the
Bayerische Staatsbibliothek (4 Mus.pr. 2009.2607-1/2, public domain), page 2 of the music (scan
page 10). There is no MIDI file of this piece to check against, so it was verified the way the
lead sheets were: a second reader transcribed pitch, rhythm and fingering blind from the same
scan, the two transcriptions were compared mechanically, and they agree note for
note, finger for finger and mark for mark.

Fingering as printed in the 1797 edition (Türk's own): four figures in all. The C sharp of bar 3
and the natural before the C of bar 5 are the edition's (the natural is a reminder: it is written
as a cautionary accidental). The tempo words are the edition's ("Allegro moderato."); the
metronome figure is ours.
"""

ROWS = [
    ('b4/4!f3 b4/4 b4/4 c5/2 d5/2', 'g3/16!f1'),
    ('a4/4 a4/4 a4/4 b4/2 a4/2', 'fs3/16'),
    ('g4/4 a4/4 b4/4 cs5/4', 'e3/12 e3/4'),
    ('d5/8 d4/4 r/4', 'd3/4 e3/4 fs3/4 d3/4'),
    ('b4/4!f3 b4/4 b4/4 c5/2!c d5/2', 'g3/16'),
    ('a4/4 a4/4 a4/4 d5/2 c5/2', 'fs3/12 fs3/4'),
    ('b4/4 a4/2 g4/2 a4/4 a4/2 b4/2', 'g3/4 b2/4!f4 c3/4 d3/4'),
    ('g4/8 g4/4 r/4', 'g2/4 g3/4 g2/4 r/4'),
]

measures = [{'voices': [(1, 1, rh), (2, 5, lh)]} for rh, lh in ROWS]
measures[-1]['right'] = ['<barline location="right"><bar-style>light-heavy</bar-style></barline>']

PIECE = {
    'title': 'Hans ohne Sorgen',
    'work_number': 'Sechzig Handstücke für angehende Klavierspieler, part 1, No. 4',
    'composer': 'Daniel Gottlob Türk',
    'fifths': 1, 'beats': 4, 'beat_type': 4, 'beam_group': 4, 'bpm': 108,
    'tempo_text': 'Allegro moderato', 'measures': measures,
    'source': 'Sechzig Handstücke für angehende Klavierspieler, Erster Theil, second edition '
              '(Leipzig and Halle: the author, 1797), No. 4; scan of the Bayerische '
              'Staatsbibliothek copy (public domain): '
              'https://www.digitale-sammlungen.de/en/view/bsb00086024?page=10',
    'encoder': 'dacapo project',
    'encoding_date': '2026-10-02',
    'rights': 'Music: public domain. This encoding: dacapo project, released under the MIT licence.',
    'comments': [
        'Read from the scan of the 1797 edition and proofread blind by a second reader against '
        'the same scan (no MIDI file exists to check against). Fingering as printed in the 1797 '
        'edition. The edition\'s tempo words; the metronome figure is ours.',
    ],
}
