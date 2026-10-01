"""Aller Anfang ist schwer ("Every beginning is hard"): No. 1 of Daniel Gottlob Türk's Sechzig
Handstücke für angehende Klavierspieler, part 1. All 8 bars.

Read from the scan of the second edition (Leipzig and Halle: at the author's expense, 1797) in the
Bayerische Staatsbibliothek (4 Mus.pr. 2009.2607-1/2, public domain), page 1 of the music (scan
page 9). There is no MIDI file of this piece to check against, so it was verified the way the lead
sheets were: a second reader transcribed pitch, rhythm and fingering blind from the same scan, the
two transcriptions were compared mechanically, and they agree note for note and finger for finger.

Fingering as printed in the 1797 edition (Türk's own), on the notes where it prints it. The tempo
words are the edition's ("Allegro, più tosto Presto."); the metronome figure is ours. The
edition's footnote marks (*, **), which point to paragraphs of Türk's Klavierschule, are left
out; nothing else is.
"""

ROWS = [
    ('c5/4!f1 c5/4 c5/4 g5/4!f5', 'c4/16!f1'),
    ('e5/8!f3 c5/8!f1', 'c4/16'),
    ('d5/4!f2 d5/4 d5/4 g5/4!f5', 'b3/16!f2'),
    ('f5/8!f4 d5/8!f2', 'b3/16'),
    ('e5/4!f3 e5/4 e5/4 c5/4!f1', 'c4/16'),
    ('d5/4!f2 d5/4 d5/4 g5/4!f5', 'b3/16'),
    ('e5/4!f3 e5/4 d5/4!f2 d5/4', 'c4/8 g3/8!f4'),
    ('c5/8!f1 r/8', 'c4/8!f1 c3/8!f5'),
]

measures = [{'voices': [(1, 1, rh), (2, 5, lh)]} for rh, lh in ROWS]
measures[-1]['right'] = ['<barline location="right"><bar-style>light-heavy</bar-style></barline>']

PIECE = {
    'title': 'Aller Anfang ist schwer',
    'work_number': 'Sechzig Handstücke für angehende Klavierspieler, part 1, No. 1',
    'composer': 'Daniel Gottlob Türk',
    'fifths': 0, 'beats': 4, 'beat_type': 4, 'beam_group': 8, 'bpm': 132,
    'tempo_text': 'Allegro, più tosto Presto', 'measures': measures,
    'source': 'Sechzig Handstücke für angehende Klavierspieler, Erster Theil, second edition '
              '(Leipzig and Halle: the author, 1797), No. 1; scan of the Bayerische '
              'Staatsbibliothek copy (public domain): '
              'https://www.digitale-sammlungen.de/en/view/bsb00086024?page=9',
    'encoder': 'dacapo project',
    'encoding_date': '2026-10-02',
    'rights': 'Music: public domain. This encoding: dacapo project, released under the MIT licence.',
    'comments': [
        'Read from the scan of the 1797 edition and proofread blind by a second reader against '
        'the same scan (no MIDI file exists to check against). Fingering as printed in the 1797 '
        'edition. The edition\'s tempo words; the metronome figure is ours.',
    ],
}
