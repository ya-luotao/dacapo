"""Ferdinand Beyer, Vorschule im Klavierspiel (Elementary Method for the Piano), Op. 101, No. 66
(Allegretto, 6/8). All 20 bars; bars 9-20 are repeated.

Read from a scan of the Edition Peters print revised by Adolf Ruthardt (Leipzig: C. F. Peters,
Edition Peters No. 2721, about 1895, plate 8033), page 49: IMSLP file #81208 (PMLP31149), marked
public domain, taken from IMSLP's mirror at the Internet Archive. Ruthardt died in 1934. There is
no MIDI file of this number to check against, so it was verified the way the lead sheets were: a
second reader transcribed pitch, rhythm, fingering, slurs and hairpins blind from the same scan,
the two transcriptions were compared mechanically, and they agree note for
note, finger for finger and slur for slur; the diminuendo hairpins of bars 10 and 12 were
lengthened to the whole bar, as the second reading and the scan have them.

Fingering as printed in the Peters edition, on the notes where it prints it. The repeat is the
edition's: a repeat sign opens bar 9 and another closes the piece; the first eight bars have
none. The words "dolce" and "legato", the hairpins (printed between the staves), the slurs and
the tie of the last bar are the edition's, and so is the tempo word ("Allegretto."); the
metronome figure is ours (a dotted quarter at 60). The edition's note above the piece ("Repeat 4
times at least") is not encoded.
"""

from musicxml_gen import REPEAT_BWD, REPEAT_FWD

I = 'c3/2 e3/2 g3/2 c3/2 e3/2 g3/2'
IV = 'c3/2 f3/2 a3/2 c3/2 f3/2 a3/2'
V = 'b2/2 d3/2 g3/2 b2/2 d3/2 g3/2'
ROWS = [
    ('@w:dolce g4/6(!f1 e5/6!f5', '@w:legato c3/2!f5 e3/2!f3 g3/2!f1 c3/2 e3/2 g3/2'),
    ('g4/6 e5/6', I),
    ('@< g4/2 e5/2 d5/2 c5/2 b4/2 c5/2', I),
    ('@! @> d5/12)', 'c3/2 f3/2!f2 a3/2!f1 c3/2 f3/2 a3/2'),
    ('@! a4/6(!f1 d5/6!f4', IV),
    ('a4/6 d5/6', IV),
    ('a4/2 d5/2 c5/2 b4/2 a4/2 b4/2', 'c3/2 f3/2 a3/2 c3/2 f3/2!f2 g3/2!f1'),
    ('c5/12)', 'c3/2 e3/2!f3 g3/2!f1 c3/2 e3/2 g3/2'),
    ('@< d5/6(!f4 g4/6!f1', 'b2/2!f5 d3/2!f3 g3/2 b2/2 d3/2 g3/2'),
    ('@! @> e5/2!f5 c5/2!f3 g4/2!f1 e5/6)!f5', 'c3/2!f5 e3/2 g3/2 c3/2 e3/2 g3/2'),
    ('@! @< d5/6( g4/6', V),
    ('@! @> e5/2 c5/2 g4/2 e5/6)', I),
    ('@! g4/6( e5/6', I),
    ('g4/6 e5/6', I),
    ('@< g4/2 e5/2 d5/2 c5/2 b4/2 c5/2', I),
    ('@! @> d5/12)', IV),
    ('@! a4/6( d5/6', IV),
    ('a4/6 d5/6', IV),
    ('a4/2 d5/2 c5/2 b4/2 a4/2 b4/2', 'c3/2 f3/2 a3/2 c3/2 f3/2 g3/2'),
    ('c5/6~ c5/2) r/2 r/2', 'c3/2 e3/2 g3/2 c3/2 r/2 r/2'),
]

measures = [{'voices': [(1, 1, rh), (2, 5, lh)]} for rh, lh in ROWS]
measures[8]['left'] = [REPEAT_FWD]
measures[19]['right'] = [REPEAT_BWD]

PIECE = {
    'title': 'Allegretto in C major',
    'work_number': 'Vorschule im Klavierspiel, Op. 101, No. 66',
    'composer': 'Ferdinand Beyer',
    'fifths': 0, 'beats': 6, 'beat_type': 8, 'beam_group': 6, 'bpm': 90,
    'tempo_text': 'Allegretto', 'measures': measures,
    'source': 'Vorschule im Klavierspiel, Op. 101, revised by Adolf Ruthardt (Leipzig: Edition '
              'Peters No. 2721, c. 1895, plate 8033), No. 66; scan on IMSLP (public domain): '
              'https://imslp.org/wiki/Vorschule_im_Klavierspiel,_Op.101_(Beyer,_Ferdinand)',
    'encoder': 'dacapo project',
    'encoding_date': '2026-10-02',
    'rights': 'Music: public domain. This encoding: dacapo project, released under the MIT licence.',
    'comments': [
        'Read from the scan of the Edition Peters print (revised by Adolf Ruthardt, c. 1895) and '
        'proofread blind by a second reader against the same scan (no MIDI file exists to check '
        'against). Fingering, slurs, hairpins, "dolce" and "legato" as printed in that edition. '
        'Bars 9-20 are repeated, as printed. The edition\'s tempo word; the metronome figure is '
        'ours.',
    ],
}
