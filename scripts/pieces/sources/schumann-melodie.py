"""Melodie (Melody), Op. 68 No. 1: the first piece of Robert Schumann's Album für die Jugend. All
20 bars; the first four are repeated.

Read from a scan of the edition "progressiv geordnet und mit Fingersatz versehn von K. Klauser"
(Erstes Album für die Jugend, Op. 68; Leipzig: J. Schuberth & Co., 1867, plate 4359), page 3: the
copy of the Gaylord Music Library, Washington University in St. Louis, at the Internet Archive
(public domain mark). Karl Klauser died in 1905. Verified twice: against the MIDI file of the
Mutopia Project's edition of the piece (after Edition Peters; CC BY-SA 2.5, so a check only and
never a source of this file), which it matches note for note; and, for what a MIDI file cannot
tell (fingering, slurs, the spelling of bar 8), by a second reader who transcribed the piece blind
from the same scan, the two transcriptions compared mechanically and every difference settled by
looking at the scan again (see the report of G5a).

Fingering as printed in the Schuberth edition (Klauser's), on the notes where it prints it; a
chord's two figures are read top figure for the top note. The "4 5" under a small arc over the G
of bars 11 and 19 is a change of finger on the held key. The p and sf, the diminuendo hairpins and
the slurs are the edition's. Editorial decisions:
- The left hand is in the treble clef throughout. The edition opens its staff with a bass clef
  and replaces it with a treble clef before the first note; only the treble clef is written here.
- Bars 8 and 16: the right hand's last four eighths (A C B D) are a second voice under the dotted
  quarter F and the eighth D; the last D is one notehead with two stems in the edition and one
  key to press. The natural before the C is the edition's (the left hand has just played C
  sharp): a cautionary accidental. So are the naturals before the left hand's F in bars 5 and 15.
- Not encoded: the small swell signs (<>) over the first note of bars 5, 6, 7, 13, 14 and 15. The
  generator numbers a staff's hairpins singly, and in bars 7 and 15 the swell stands over the
  start of a diminuendo hairpin.
- Bar 2: the figure over the right hand's A is blurred in the scan. The second reader took it
  for a 4; looked at again at the scan's full size beside the page's other figures, it is the
  narrow upright stroke of a 1 with a blot at its foot, and a third reader shown the figures
  alone read it as a 1 too. It is given as 1 (the thumb after 5 4 3 2 on E D C B).
- The left hand's slurs of bars 3-4, 7-8, 15-16 and 19-20 end on the bar's last note, as the
  second reading and a second look at the scan have them.
- The edition prints no tempo for this piece; none is given.
"""

from musicxml_gen import REPEAT_BWD

ROWS = [
    ('@p e5/4(!f5 d5/4 c5/4 b4/4', 'c4/2(!f5 g4/2 f4/2 g4/2 e4/2 g4/2 c4/2 e4/2'),
    ('a4/2!f1 c5/2 b4/2 d5/2 c5/4 g4/4)', 'f4/2!f2 d4/2 g4/2 f4/2 e4/2 f4/2 e4/2 d4/2)'),
    ('@> g5/4(!f5 f5/4 e5/4 @! c5/4!f1', 'e4/2(!f3 g4/2 d4/2 g4/2 c4/2 g4/2 e4/2 g4/2'),
    ('b4/4!f4 [fs4,a4]/4!f_3 g4/4) r/4', 'd4/2 g4/2 c4/2!f4 d4/2!f1 b3/2!f3 d4/2 g3/4)'),
    ('d5/4(!f3 c5/4 b4/4) r/4', 'f4/2(!c!f2 g4/2 e4/2 g4/2 d4/2 g4/2 fs4/2 g4/2)'),
    ('f5/4(!f4 e5/4 d5/4) r/4', 'd4/2(!f3 g4/2 c4/2 g4/2 b3/2 g4/2 fs4/2 g4/2)'),
    ('@sf @> a5/4(!f5 g5/4 f5/4 e5/4', 'f4/2(!f2 g4/2 e4/2 g4/2 d4/2 g4/2 c4/2 g4/2'),
    (['@!+2 d5/2!f1 f5/2!f4 e5/2!f3 g5/2!f5 f5/6!f4 d5/2)!f3', 's/8 a4/2 c5/2!c!f2 b4/2!f1 d5/2'],
     'b3/2 g4/2 c4/2!f4 cs4/2!f3 d4/4!f2 g4/4)'),
    ('@p [c5,e5]/4(!f24 d5/4 c5/4 b4/4!f1', 'c4/2(!f5 g4/2 f4/2 g4/2 e4/2 g4/2 c4/2 e4/2'),
    ('a4/2!f2 c5/2 b4/2 d5/2 c5/4 g4/4)', 'f4/2!f2 d4/2 g4/2 f4/2 e4/2 f4/2 e4/2 c4/2)'),
    ('@> a5/4(!f5 g5/4!f4-5 [b4,f5]/4!f14 [c5,e5]/4!f13',
     'f4/2(!f3 c5/2 e4/2!f4 c5/2 d4/2!f5 g4/2!f1 c4/2!f5 g4/2!f1'),
    ('@! d5/2!f2 f5/2!f4 b4/2!f1 d5/2!f3 c5/4)!f2 r/4',
     'f4/2!f3 a4/2!f1 g4/2 f4/2 e4/2!f4 g4/2!f1 c4/2!f5 e4/2)!f3'),
    ('d5/4(!f3 c5/4 b4/4) r/4', 'f4/2(!f2 g4/2 e4/2 g4/2 d4/2 g4/2 fs4/2 g4/2)'),
    ('f5/4(!f4 e5/4 d5/4) r/4', 'd4/2(!f3 g4/2 c4/2 g4/2 b3/2 g4/2 fs4/2 g4/2)'),
    ('@sf @> a5/4(!f5 g5/4 f5/4 e5/4', 'f4/2(!c g4/2 e4/2 g4/2 d4/2 g4/2 c4/2 g4/2'),
    (['@! d5/2 f5/2!f4 e5/2 g5/2 f5/6 d5/2)!f3', 's/8 a4/2 c5/2!c b4/2 d5/2'],
     'b3/2 g4/2 c4/2!f4 cs4/2!f3 d4/4 g4/4)'),
    ('@p [c5,e5]/4(!f24 d5/4 c5/4 b4/4!f1', 'c4/2( g4/2 f4/2 g4/2 e4/2 g4/2 c4/2 e4/2'),
    ('a4/2!f2 c5/2 b4/2 d5/2 c5/4 g4/4)', 'f4/2 d4/2 g4/2 f4/2 e4/2 f4/2 e4/2 c4/2)'),
    ('@> a5/4!f5 g5/4(!f4-5 [b4,f5]/4 [c5,e5]/4', 'f4/2(!f3 c5/2 e4/2 c5/2 d4/2 g4/2 c4/2 g4/2'),
    ('@! d5/2 f5/2 b4/2 d5/2 c5/4) r/4', 'f4/2!f3 a4/2 g4/2 f4/2 e4/2 g4/2 c4/4)'),
]

measures = []
for rh, lh in ROWS:
    voices = [(1, 1, rh[0]), (1, 2, rh[1])] if isinstance(rh, list) else [(1, 1, rh)]
    measures.append({'voices': voices + [(2, 5, lh)]})
measures[3]['right'] = [REPEAT_BWD]
measures[-1]['right'] = ['<barline location="right"><bar-style>light-heavy</bar-style></barline>']

PIECE = {
    'title': 'Melodie',
    'work_number': 'Album für die Jugend, Op. 68, No. 1',
    'composer': 'Robert Schumann',
    'fifths': 0, 'clefs': {2: 'G'}, 'beats': 4, 'beat_type': 4, 'beam_group': 8,
    'measures': measures,
    'source': 'Erstes Album für die Jugend, Op. 68, progressiv geordnet und mit Fingersatz '
              'versehn von K. Klauser (Leipzig: J. Schuberth & Co., 1867, plate 4359), No. 1; '
              'scan at the Internet Archive (public domain): '
              'https://archive.org/details/b26976821/page/n2/',
    'encoder': 'dacapo project',
    'encoding_date': '2026-10-02',
    'rights': 'Music: public domain. This encoding: dacapo project, released under the MIT licence.',
    'comments': [
        'Read from the scan of the Schuberth edition of 1867 (fingered by Karl Klauser), checked '
        'note for note against the MIDI file of the Mutopia edition (a check only) and proofread '
        'blind by a second reader against the scan. Fingering, dynamics, hairpins and slurs as '
        'printed in the 1867 edition; its small swell signs are not encoded. The left hand in the '
        'treble clef, as printed; the first four bars repeated.',
    ],
}
