"""Der muntere Knabe ("The lively boy"): No. 3 of Daniel Gottlob Türk's Sechzig Handstücke für
angehende Klavierspieler, part 1. All 8 bars.

Read from the scan of the second edition (Leipzig and Halle: at the author's expense, 1797) in the
Bayerische Staatsbibliothek (4 Mus.pr. 2009.2607-1/2, public domain), page 1 of the music (scan
page 9). There is no MIDI file of this piece to check against, so it was verified the way the lead
sheets were: a second reader transcribed pitch, rhythm, fingering and articulation blind from the
same scan, the two transcriptions were compared mechanically, and they agree note for
note, finger for finger and mark for mark.

Fingering as printed in the 1797 edition (Türk's own): four figures in all. The slurs and the
staccato strokes are the edition's (its strokes are written as staccatissimo, the sign MusicXML
has for a stroke). The tempo word is the edition's ("Allegretto."); the metronome figure is ours.
The left hand's bar 3 and the G of bar 4 stand on ledger lines above the bass staff, as printed.
"""

ROWS = [
    ('e5/2(!f2 f5/2) g5/2!sts g5/2!sts', 'c4/4!f4 r/4'),
    ('e5/2( f5/2) g5/2!sts g5/2!sts', 'c4/4 r/4'),
    ('a5/2 g5/2 f5/2 e5/2', 'f4/2 e4/2 d4/2 c4/2'),
    ('d5/4 r/4', 'g4/4 g3/4'),
    ('g5/2(!f5 f5/2) e5/2 d5/2', 'b3/4 r/4'),
    ('g5/2( f5/2) e5/2 d5/2', 'b3/4 r/4'),
    ('e5/2( f5/2) d5/2!sts d5/2!sts', 'c4/2!f1 a3/2 f3/2 g3/2'),
    ('c5/4 r/4', 'c4/4 c3/4'),
]

measures = [{'voices': [(1, 1, rh), (2, 5, lh)]} for rh, lh in ROWS]
measures[-1]['right'] = ['<barline location="right"><bar-style>light-heavy</bar-style></barline>']

PIECE = {
    'title': 'Der muntere Knabe',
    'work_number': 'Sechzig Handstücke für angehende Klavierspieler, part 1, No. 3',
    'composer': 'Daniel Gottlob Türk',
    'fifths': 0, 'beats': 2, 'beat_type': 4, 'beam_group': 8, 'bpm': 88,
    'tempo_text': 'Allegretto', 'measures': measures,
    'source': 'Sechzig Handstücke für angehende Klavierspieler, Erster Theil, second edition '
              '(Leipzig and Halle: the author, 1797), No. 3; scan of the Bayerische '
              'Staatsbibliothek copy (public domain): '
              'https://www.digitale-sammlungen.de/en/view/bsb00086024?page=9',
    'encoder': 'dacapo project',
    'encoding_date': '2026-10-02',
    'rights': 'Music: public domain. This encoding: dacapo project, released under the MIT licence.',
    'comments': [
        'Read from the scan of the 1797 edition and proofread blind by a second reader against '
        'the same scan (no MIDI file exists to check against). Fingering, slurs and staccato '
        'strokes as printed in the 1797 edition. The edition\'s tempo word; the metronome figure '
        'is ours.',
    ],
}
