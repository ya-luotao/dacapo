"""Carl Czerny, Practical Method for Beginners on the Pianoforte (Erster Wiener Lehrmeister im
Pianofortespiel), Op. 599, No. 11: the first of the "Five-finger Exercises with quiet Hand". All
16 bars, both halves repeated.

Read from a scan of the edition "edited, revised and fingered by Giuseppe Buonamici" (Schirmer's
Library of Musical Classics, vol. 146; New York: G. Schirmer, copyright 1893, plate 11038), page
6. IMSLP lists its two scans of this edition (#86518 and #105466) as public domain; the copy read
is the file PMLP177048 of IMSLP's mirror at the Internet Archive (item
imslp-exercises-for-beginners-op599-czerny-carl). Buonamici died in 1914. There is no MIDI file of this number to check against, so it was verified
the way the lead sheets were: a second reader transcribed pitch, rhythm, fingering and slurs blind
from the same scan, the two transcriptions were compared mechanically, and they agree note for
note, finger for finger and mark for mark.

Fingering as printed in the Schirmer edition (Buonamici's), on the notes where it prints it. The
left hand's chords carry theirs as a column above the staff, read here chord note by chord note:
C-E-G with 4-2-1 and B-D-G with 5-3-1, so that the hand stays over B-C-D-E-F-G. Both staves are
in the treble clef, as printed. The slurs are the edition's: one over each half. The edition
prints no tempo and no dynamics here.
"""

from musicxml_gen import REPEAT_BWD, REPEAT_FWD

C, G, G7 = '[c4,e4,g4]', '[b3,d4,g4]', '[b3,f4,g4]'
ROWS = [
    ('c5/4(!f1 e5/4!f3 c5/4!f1 e5/4!f3', f'{C}/16!f421'),
    ('g5/4!f5 e5/4 c5/4 e5/4', f'{C}/16'),
    ('d5/4!f2 g5/4!f5 f5/4!f4 d5/4!f2', f'{G}/16!f531'),
    ('e5/4!f3 c5/4 g5/4 e5/4', f'{C}/16!f421'),
    ('c5/4 e5/4 c5/4 e5/4', f'{C}/16'),
    ('g5/4 e5/4 c5/4 e5/4', f'{C}/16'),
    ('d5/4!f2 g5/4!f5 f5/4!f4 d5/4!f2', f'{G7}/16!f521'),
    ('c5/4!f1 e5/4 c5/8)', f'{C}/16!f421'),
    ('d5/4(!f2 e5/4 f5/4 d5/4', f'{G}/16!f531'),
    ('e5/4!f3 g5/4!f5 e5/4 c5/4', f'{C}/16!f421'),
    ('d5/4 e5/4 f5/4 d5/4', f'{G}/16'),
    ('e5/4!f3 g5/4!f5 f5/4!f4 d5/4!f2', f'{C}/8 {G}/8'),
    ('c5/4!f1 e5/4 c5/4 e5/4', f'{C}/16'),
    ('g5/4 e5/4 c5/4 e5/4', f'{C}/16'),
    ('d5/4!f2 g5/4!f5 f5/4!f4 d5/4!f2', f'{G7}/8!f521 {G7}/8'),
    ('c5/4!f1 e5/4 c5/8)', f'{C}/16'),
]

measures = [{'voices': [(1, 1, rh), (2, 5, lh)]} for rh, lh in ROWS]
measures[7]['right'] = [REPEAT_BWD]
measures[8]['left'] = [REPEAT_FWD]
measures[15]['right'] = [REPEAT_BWD]

PIECE = {
    'title': 'Five-Finger Exercise in C major',
    'work_number': 'Op. 599, No. 11',
    'composer': 'Carl Czerny',
    'fifths': 0, 'clefs': {2: 'G'}, 'beats': 4, 'beat_type': 4, 'beam_group': 8,
    'measures': measures,
    'source': 'Practical Method for Beginners on the Pianoforte, Op. 599, edited, revised and '
              'fingered by Giuseppe Buonamici (New York: G. Schirmer, 1893, plate 11038), No. 11; '
              'scan on IMSLP (public domain): '
              'https://imslp.org/wiki/Practical_Exercises_for_Beginners,_Op.599_(Czerny,_Carl)',
    'encoder': 'dacapo project',
    'encoding_date': '2026-10-02',
    'rights': 'Music: public domain. This encoding: dacapo project, released under the MIT licence.',
    'comments': [
        'Read from the scan of the Schirmer edition of 1893 and proofread blind by a second '
        'reader against the same scan (no MIDI file exists to check against). Fingering as '
        'printed in that edition (Giuseppe Buonamici\'s). Both staves in the treble clef and '
        'both halves repeated, as printed.',
    ],
}
