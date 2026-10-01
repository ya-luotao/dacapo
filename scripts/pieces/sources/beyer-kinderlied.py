"""Ferdinand Beyer, Vorschule im Klavierspiel (Elementary Method for the Piano), Op. 101, No. 24:
"Kinderlied" (Child's Song), the German children's song "Summ, summ, summ, Bienchen summ herum".
All 12 bars.

Read from a scan of the Edition Peters print revised by Adolf Ruthardt (Leipzig: C. F. Peters,
Edition Peters No. 2721, about 1895, plate 8033), page 27: IMSLP file #81208 (PMLP31149), marked
public domain, taken from IMSLP's mirror at the Internet Archive. Ruthardt died in 1934. There is
no MIDI file of this number to check against, so it was verified the way the lead sheets were: a
second reader transcribed pitch, rhythm, fingering and slurs blind from the same scan, the two
transcriptions were compared mechanically, and they agree note for
note, finger for finger and mark for mark.

Fingering as printed in the Peters edition: three figures, the hands' first notes (the book has
taught the five-finger position by now, and each hand stays in it: the right over C5-G5, the left
over C4-G4). Both staves are in the treble clef, as printed. The slurs and the word "legato" are
the edition's; it prints no tempo and no dynamics. The song's first words, which the edition
prints between the staves, are not encoded.
"""

ROWS = [
    ('g5/8(!f5 f5/8', '@w:legato e4/4!f3 c4/4!f5 d4/4 g4/4'),
    ('e5/16)', 'c4/4 d4/4 e4/4 c4/4'),
    ('d5/4( e5/4 f5/4 d5/4', 'f4/4 e4/4 d4/4 f4/4'),
    ('c5/16)', 'e4/4 f4/4 g4/4 e4/4'),
    ('e5/4( f5/4 g5/4 e5/4', 'c4/4 d4/4 e4/4 g4/4'),
    ('d5/4 e5/4 f5/4 d5/4)', 'f4/4 e4/4 d4/4 f4/4'),
    ('e5/4( f5/4 g5/4 e5/4', 'c4/4 d4/4 e4/4 g4/4'),
    ('d5/4 e5/4 f5/4 d5/4)', 'f4/4 e4/4 d4/4 f4/4'),
    ('g5/8( f5/8', 'e4/4 c4/4 d4/4 g4/4'),
    ('e5/16)', 'c4/4 d4/4 e4/4 c4/4'),
    ('d5/4( e5/4 f5/4 d5/4', 'f4/4 e4/4 d4/4 f4/4'),
    ('c5/16)', 'e4/4 d4/4 c4/8'),
]

measures = [{'voices': [(1, 1, rh), (2, 5, lh)]} for rh, lh in ROWS]
measures[-1]['right'] = ['<barline location="right"><bar-style>light-heavy</bar-style></barline>']

PIECE = {
    'title': 'Kinderlied',
    'work_number': 'Vorschule im Klavierspiel, Op. 101, No. 24',
    'composer': 'Ferdinand Beyer',
    'fifths': 0, 'clefs': {2: 'G'}, 'beats': 4, 'beat_type': 4, 'beam_group': 8,
    'measures': measures,
    'source': 'Vorschule im Klavierspiel, Op. 101, revised by Adolf Ruthardt (Leipzig: Edition '
              'Peters No. 2721, c. 1895, plate 8033), No. 24; scan on IMSLP (public domain): '
              'https://imslp.org/wiki/Vorschule_im_Klavierspiel,_Op.101_(Beyer,_Ferdinand)',
    'encoder': 'dacapo project',
    'encoding_date': '2026-10-02',
    'rights': 'Music: public domain. This encoding: dacapo project, released under the MIT licence.',
    'comments': [
        'Read from the scan of the Edition Peters print (revised by Adolf Ruthardt, c. 1895) and '
        'proofread blind by a second reader against the same scan (no MIDI file exists to check '
        'against). Fingering, slurs and "legato" as printed in that edition. Both staves in the '
        'treble clef, as printed.',
    ],
}
