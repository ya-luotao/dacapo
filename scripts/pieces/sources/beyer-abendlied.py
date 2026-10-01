"""Ferdinand Beyer, Vorschule im Klavierspiel (Elementary Method for the Piano), Op. 101, No. 58:
"Abendlied" (Evening Song), the German song "Der Mond ist aufgegangen" in two parts. A
quarter-note upbeat and 12 bars, the last three beats long.

Read from a scan of the Edition Peters print revised by Adolf Ruthardt (Leipzig: C. F. Peters,
Edition Peters No. 2721, about 1895, plate 8033), page 43: IMSLP file #81208 (PMLP31149), marked
public domain, taken from IMSLP's mirror at the Internet Archive. Ruthardt died in 1934. There is
no MIDI file of this number to check against, so it was verified the way the lead sheets were: a
second reader transcribed pitch, rhythm, fingering, slurs and hairpins blind from the same scan,
the two transcriptions were compared mechanically, and they agree note for
note, finger for finger and slur for slur; two hairpin ends (bars 1 and 7) were moved to where
the second reading has them.

Fingering as printed in the Peters edition, on the notes where it prints it. Both staves are in
the treble clef, as printed: the left hand goes down to G3 on ledger lines. The edition prints no
key signature: the tune is in G, and no F occurs. The p, the hairpins (printed between the
staves), the slurs, the two fermatas and the tempo word ("Andante.") are the edition's; the
metronome figure is ours. The song's first words, which the edition prints between the staves,
are not encoded.
"""

ROWS = [
    ('a4/4 g4/4 c5/4 @! b4/4', 'c4/4 b3/4 e4/4!f1 d4/4!f2'),
    ('@>+4 a4/8 @! g4/4) @< b4/4(!f2', 'c4/4!f3 d4/2!f1 c4/2 b3/6) a3/2('),
    ('b4/4 b4/4 e5/4 d5/4', 'g3/4 d4/4 c4/4 b3/4'),
    ('c5/8 @! b4/4 b4/4!f3', 'a3/4 b3/2 a3/2 g3/6) b3/2('),
    ('b4/4 b4/4 @> c5/4 b4/4', 'd4/2 c4/2 b3/4 a3/4 g3/2 b3/2'),
    ('@! a4/12) @< g4/4(', 'd4/6 c4/2 d4/4) b3/4('),
    ('a4/4 g4/4 c5/4 @! b4/4', 'c4/4 b3/4 e4/4 d4/4'),
    ('@>+4 a4/8 @! g4/4) @< b4/4(!f2', 'c4/4 d4/2!f1 c4/2 b3/6) a3/2('),
    ('b4/4 b4/4 e5/4 d5/4', 'g3/4 d4/4 c4/4 b3/4'),
    ('@! c5/8 b4/4 b4/4!f3', 'a3/4 b3/2 a3/2 g3/6) b3/2('),
    ('b4/4 b4/4 @> c5/4 b4/4', 'd4/2 c4/2 b3/4 a3/4 g3/2 b3/2'),
    ('a4/4 a4/4 @! g4/4)!fe', 'd4/6 c4/2 b3/4)!fe'),
]

measures = [{'voices': [(1, 1, '@p @< g4/4(!f1'), (2, 5, 'b3/4(!f4')], 'number': 0, 'implicit': True}]
measures += [{'voices': [(1, 1, rh), (2, 5, lh)], 'number': i + 1} for i, (rh, lh) in enumerate(ROWS)]
measures[-1]['right'] = ['<barline location="right"><bar-style>light-heavy</bar-style></barline>']

PIECE = {
    'title': 'Abendlied',
    'work_number': 'Vorschule im Klavierspiel, Op. 101, No. 58',
    'composer': 'Ferdinand Beyer',
    'fifths': 0, 'clefs': {2: 'G'}, 'beats': 4, 'beat_type': 4, 'beam_group': 4, 'bpm': 72,
    'tempo_text': 'Andante', 'measures': measures, 'pickup': True,
    'source': 'Vorschule im Klavierspiel, Op. 101, revised by Adolf Ruthardt (Leipzig: Edition '
              'Peters No. 2721, c. 1895, plate 8033), No. 58; scan on IMSLP (public domain): '
              'https://imslp.org/wiki/Vorschule_im_Klavierspiel,_Op.101_(Beyer,_Ferdinand)',
    'encoder': 'dacapo project',
    'encoding_date': '2026-10-02',
    'rights': 'Music: public domain. This encoding: dacapo project, released under the MIT licence.',
    'comments': [
        'Read from the scan of the Edition Peters print (revised by Adolf Ruthardt, c. 1895) and '
        'proofread blind by a second reader against the same scan (no MIDI file exists to check '
        'against). Fingering, slurs, hairpins and fermatas as printed in that edition. Both '
        'staves in the treble clef and no key signature, as printed (the tune is in G; no F '
        'occurs). The last bar is three beats long, completing the upbeat. The edition\'s tempo '
        'word; the metronome figure is ours.',
    ],
}
