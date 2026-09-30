# Hanon, The Virtuoso Pianist, Part I, Nos. 1-5 -- reader A (passA/w1)
# Source: G. Schirmer [1900], IMSLP #91547, read at 300/600 dpi, doubtful spots at 1200 dpi.

E = []

UP_STARTS_RH = ['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4']
UP_STARTS_LH = ['C2', 'D2', 'E2', 'F2', 'G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3']
DOWN_STARTS_RH = ['G5', 'F5', 'E5', 'D5', 'C5', 'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4', 'B3', 'A3', 'G3']
DOWN_STARTS_LH = ['G4', 'F4', 'E4', 'D4', 'C4', 'B3', 'A3', 'G3', 'F3', 'E3', 'D3', 'C3', 'B2', 'A2', 'G2']


def _d(bar, hand, pairs):
    """pairs: [(idx, digit), ...] -> [(bar, hand, idx, digit), ...]"""
    return [(bar, hand, i, f) for i, f in pairs]


# ---------------------------------------------------------------- No. 1
_d1 = []
for b in (1, 2):
    _d1 += _d(b, 'RH', [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5)])
    _d1 += _d(b, 'LH', [(0, 5), (1, 4), (2, 3), (3, 2), (4, 1)])
for b in range(3, 12):
    _d1 += _d(b, 'RH', [(0, 1), (1, 2)])
    _d1 += _d(b, 'LH', [(0, 5), (1, 4)])
# bars 12-14: no digits printed
_d1 += _d(15, 'RH', [(0, 5), (1, 4), (2, 3), (3, 2), (4, 1)])
_d1 += _d(15, 'LH', [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5)])
for b in range(16, 30):
    _d1 += _d(b, 'RH', [(0, 5), (1, 4)])
    _d1 += _d(b, 'LH', [(0, 1), (1, 2)])

E.append(dict(
    number=1,
    pdf=3, page=2,
    pdf_end=4,
    time='2/4',
    rhythm='8 sixteenths per bar in both hands (two beamed groups of four), closing bar a half note in each hand',
    bars_up=14,
    bars_down=15,
    up_rh='C3 E3 F3 G3 A3 G3 F3 E3',
    up_lh='C2 E2 F2 G2 A2 G2 F2 E2',
    down_rh='G5 E5 D5 C5 B4 C5 D5 E5',
    down_lh='G4 E4 D4 C4 B3 C4 D4 E4',
    starts_rh=UP_STARTS_RH + DOWN_STARTS_RH,
    starts_lh=UP_STARTS_LH + DOWN_STARTS_LH,
    irregular={},
    close_rh='C3', close_lh='C2',
    close_rhythm='half note (both hands)',
    repeat='end-repeat sign (:||, dots on both staves) before the closing bar; no start-repeat anywhere',
    digits=_d1,
    uncertain=[
        'bar 1 RH idx 0: the "1" printed right after "mf" is read as the finger digit of note 0 (C3), not as the '
        '"(1)" footnote mark: no parentheses, same type and baseline as the following 2 3 4 5, and five digits for '
        'the five notes mirror the LH 5 4 3 2 1 (600 dpi)',
    ],
    note='No accidentals. Header text above the music: "Stretch between the fifth and fourth fingers of the left '
         'hand in ascending, and the fifth and fourth fingers of the right hand in descending." / metronome '
         'explanation (60 gradually to 108) / "Lift the fingers high and with precision, playing each note very '
         'distinctly." M.M. quarter = 60 to 108. mf at bar 1 (only dynamic). "ascending" printed under the RH notes '
         'of bar 1 (between the hands, in the bass staff), "descending" above the RH of bar 15. Thin double bar '
         'between bars 14 and 15. Both hands are written in the bass staff at the start: RH moves to the treble '
         'staff from bar 6 note 2 (bar 6 notes 0-1 A3 C4 still in the bass staff), and returns to the bass staff in '
         'bar 23 from note 3 (bar 23 notes 0-2 F4 D4 C4 in treble, notes 3-7 in bass) to the end. No 8va lines. '
         'Digit placement: bars 1-6 RH digits above the notes, LH digits below; bars 7-11 and 18-23 RH digits '
         'below the RH notes and LH digits above the LH notes (between the staves); bars 15-17 both hands\' digits '
         'above their notes; bars 24-29 RH above, LH below again. '
         'Bars 12, 13, 14 carry no digits at all. Footnote at the foot of PDF 3: "(1) For brevity, we shall '
         'henceforward indicate only by their figures those fingers which are to be specially trained in each '
         'exercise; e.g., 3-4 in No 2; 2-3-4 in No 3, etc." plus a paragraph on both hands executing the same '
         'difficulties; I found no "(1)" reference mark anywhere in the music of No. 1 (the "1" right after mf '
         'in bar 1 is the finger digit of RH note 0, in the same type as the following 2 3 4 5). Closing bar '
         '(top of PDF 4) has the text "As soon as Ex. 1 is mastered, go on to Ex. 2 without stopping on this note." '
         'and a final double bar.',
))

# ---------------------------------------------------------------- No. 2
_d2 = []
_d2 += _d(1, 'RH', [(0, 1), (1, 2), (2, 5), (3, 4), (4, 3), (5, 4), (6, 3), (7, 2)])
_d2 += _d(1, 'LH', [(0, 5), (1, 3), (2, 1), (3, 2), (4, 3), (5, 2), (6, 3), (7, 4)])
for b in (2, 3):
    _d2 += _d(b, 'RH', [(0, 1), (1, 2), (2, 5)])
    _d2 += _d(b, 'LH', [(0, 5), (1, 3), (2, 1)])
_d2 += _d(4, 'RH', [(0, 1), (1, 2)])
_d2 += _d(4, 'LH', [(0, 5), (1, 3), (2, 1)])
for b in range(5, 15):
    _d2 += _d(b, 'RH', [(0, 1), (1, 2)])
    _d2 += _d(b, 'LH', [(0, 5), (1, 3)])
_d2 += _d(15, 'RH', [(0, 5), (1, 2), (2, 1), (3, 2), (4, 3), (5, 2), (6, 3), (7, 4)])
_d2 += _d(15, 'LH', [(0, 1), (1, 3), (2, 5), (3, 4), (4, 3), (5, 4), (6, 3), (7, 2)])
for b in range(16, 24):
    _d2 += _d(b, 'RH', [(0, 5), (1, 2), (2, 1)])
    _d2 += _d(b, 'LH', [(0, 1), (1, 3), (2, 5)])
for b in range(24, 30):
    _d2 += _d(b, 'RH', [(0, 5), (1, 2)])
    _d2 += _d(b, 'LH', [(0, 1), (1, 3)])

E.append(dict(
    number=2,
    pdf=4, page=3,
    pdf_end=4,
    time='2/4',
    rhythm='8 sixteenths per bar in both hands (two beamed groups of four), closing bar a half note in each hand',
    bars_up=14,
    bars_down=15,
    up_rh='C3 E3 A3 G3 F3 G3 F3 E3',
    up_lh='C2 E2 A2 G2 F2 G2 F2 E2',
    down_rh='G5 D5 B4 C5 D5 C5 D5 E5',
    down_lh='G4 D4 B3 C4 D4 C4 D4 E4',
    starts_rh=UP_STARTS_RH + DOWN_STARTS_RH,
    starts_lh=UP_STARTS_LH + DOWN_STARTS_LH,
    irregular={},
    close_rh='C3', close_lh='C2',
    close_rhythm='half note (both hands)',
    repeat='end-repeat sign (:||) before the closing bar; no start-repeat anywhere',
    digits=_d2,
    uncertain=[
        'bar 1 LH: a small tick between the digits at idx 6 and 7 (printed "3\' 4"); read as 3 and 4, the tick '
        'looks like a speck, not a digit (600 dpi)',
        'bar 16 LH: a small arrow-like mark on the bass top line just left of note 0 (after the barline); '
        'no digit or accidental shape, read as a plate blemish (600 and 1200 dpi)',
    ],
    note='No accidentals. The descending group is NOT the inversion of the ascending one: bar 1 goes up a third then '
         'a fourth (C E A), bar 15 goes down a fourth then a third (G D B), i.e. the ascending intervals in reverse '
         'order; checked at 1200 dpi by measuring note heads against the staff lines (bar 15 RH notes 1, 4, 6 all '
         'on the D5 line, note 7 in the E5 space; LH notes 1, 4, 6 between the C4 and E4 ledger lines = D4, note 7 '
         'on the E4 ledger line); bar 16 (F5 C5 A4 ...) agrees. Heading text under "No 2": "(3-4) When this '
         'exercise is mastered, recommence the preceding one, and play both together four times without '
         'interruption; the fingers will gain considerably by practising these exercises, and those following, in '
         'this way." Footnote mark "(1)" printed above bar 1 (treble staff) and again above bar 15 (just after the '
         'double bar); footnote at foot of PDF 4: "(1) The fourth and fifth fingers being naturally weak, it should '
         'be observed that this exercise, and those following it up to No 31, are intended to render them as strong '
         'and agile as the second and third." No metronome mark, no dynamics, no "ascending/descending" words. '
         'Thin double bar between bars 14 and 15. RH written in the bass staff bars 1-5 and bar 6 notes 0-1 '
         '(A3 C4), treble from bar 6 note 2; back in the bass staff in bar 23 from note 2 (bar 23 notes 0-1 F4 C4 in '
         'treble, notes 2-7 A3 B3 C4 B3 C4 D4 in bass) to the end. No 8va lines. Digit placement: bars 1-5 RH above, '
         'LH below; bar 6 RH digits just above its notes 0-1 (A3, C4 in the bass staff), LH still below; bars 7-11 and 18-22 RH below its notes and LH above its notes (between the staves); bars 12-17 '
         'RH digits above the RH (treble) notes and LH above the LH notes; bar 23 RH above, LH below; '
         'bars 24-29 RH above, LH below. The abbreviation is asymmetric: bar 4 RH already drops to "1 2" while LH '
         'keeps "5 3 1"; LH drops to "5 3" from bar 5. Final double bar after the closing bar.',
))


# ---------------------------------------------------------------- No. 3
_d3 = []
_d3 += _d(1, 'RH', [(0, 1), (1, 2), (2, 5), (3, 4), (4, 3), (5, 2), (6, 3), (7, 4)])
_d3 += _d(1, 'LH', [(0, 5), (1, 3), (2, 1), (3, 2), (4, 3), (5, 4), (6, 3), (7, 2)])
_d3 += _d(2, 'RH', [(0, 1), (1, 2), (2, 5), (3, 4), (4, 3), (5, 2)])
_d3 += _d(2, 'LH', [(0, 5), (1, 3), (2, 1), (3, 2), (4, 3), (5, 4)])
for b in range(3, 9):
    _d3 += _d(b, 'RH', [(0, 1), (1, 2), (2, 5)])
    _d3 += _d(b, 'LH', [(0, 5), (1, 3), (2, 1)])
for b in range(9, 15):
    _d3 += _d(b, 'RH', [(0, 1), (1, 2)])
    _d3 += _d(b, 'LH', [(0, 5), (1, 3)])
_d3 += _d(15, 'RH', [(0, 5), (1, 2), (2, 1), (3, 2), (4, 3), (5, 4), (6, 3), (7, 2)])
_d3 += _d(15, 'LH', [(0, 1), (1, 3), (2, 5), (3, 4), (4, 3), (5, 2), (6, 3), (7, 4)])
for b in range(16, 21):
    _d3 += _d(b, 'RH', [(0, 5), (1, 2), (2, 1)])
for b in range(16, 20):
    _d3 += _d(b, 'LH', [(0, 1), (1, 3), (2, 5)])
_d3 += _d(20, 'LH', [(0, 1), (1, 3)])
for b in range(21, 30):
    _d3 += _d(b, 'RH', [(0, 5), (1, 2)])
    _d3 += _d(b, 'LH', [(0, 1), (1, 3)])

E.append(dict(
    number=3,
    pdf=5, page=4,
    pdf_end=5,
    time='2/4',
    rhythm='8 sixteenths per bar in both hands (two beamed groups of four), closing bar a half note in each hand',
    bars_up=14,
    bars_down=15,
    up_rh='C3 E3 A3 G3 F3 E3 F3 G3',
    up_lh='C2 E2 A2 G2 F2 E2 F2 G2',
    down_rh='G5 D5 B4 C5 D5 E5 D5 C5',
    down_lh='G4 D4 B3 C4 D4 E4 D4 C4',
    starts_rh=UP_STARTS_RH + DOWN_STARTS_RH,
    starts_lh=UP_STARTS_LH + DOWN_STARTS_LH,
    irregular={},
    close_rh='C3', close_lh='C2',
    close_rhythm='half note (both hands)',
    repeat='end-repeat sign (:||) before the closing bar; no start-repeat anywhere',
    digits=_d3,
    uncertain=[
        'bar 4 LH idx 0: the digit 5 is badly printed (only its top stroke and a detached lower curve), read as 5 '
        'at 600 dpi; its position and the 5 3 1 pattern of bars 3-8 agree',
        'bar 17 RH idx 1: digit printed damaged, looks like a "2" with its top curve broken off (an "x"-like '
        'shape), read as 2 at 1200 dpi; the 5 2 1 pattern of bars 16-20 agrees',
        'bar 17 LH: a small dark blot inside the bass staff on the stem of note 5 (C4), well below its note head, '
        'not a note head and no ledger; read as a plate blemish (1200 dpi)',
    ],
    note='No accidentals. As in No. 2, the descending group is not the inversion of the ascending one: bar 1 goes up '
         'a third then a fourth (C E A), bar 15 goes down a fourth then a third (G D B); checked at 1200 dpi for '
         'bars 15 and 17 by measuring note heads against the staff lines (bar 17 RH E5 B4 G4 A4 B4 C5 B4 A4, LH E4 B3 '
         'G3 A3 B3 C4 B3 A3). Heading text: "(2-3-4) Before beginning to practise No 3, play through the preceding '
         'exercises once or twice without stopping. When No 3 is mastered, practise No 4, and then No 5, and as soon '
         'as they are thoroughly learned play through all three at least four times without interruption, not '
         'stopping until the last note on page 6. The entire work should be practised in this manner. Therefore, '
         'when playing the numbers in the First Part, stop only on the last note on pp. 3, 6, 9, 12, 15, 18, and 21." '
         'No footnote marks, no metronome mark, no dynamics. Thin double bar between bars 14 and 15. Staff changes as '
         'in No. 2: RH in the bass staff bars 1-5 and bar 6 notes 0-1 (A3 C4); treble from bar 6 note 2; back to the '
         'bass staff in bar 23 from note 2 (notes 0-1 F4 C4 in treble) to the end. Digit placement: bars 1-6 RH above, '
         'LH below; bars 7-11 RH below its notes, LH above; bars 12-17 both above their notes; bars 18-22 RH below, '
         'LH above; bar 23 RH below, LH below; bars 24-29 RH above, LH below. Abbreviation steps down unevenly: '
         'bar 2 has six digits per hand; "1 2 5"/"5 3 1" through bar 8; "1 2"/"5 3" bars 9-14; descending "5 2 1" RH '
         'through bar 20 but LH "1 3 5" only through bar 19 (bar 20 LH "1 3"); "5 2"/"1 3" from bar 21. '
         'Final double bar after the closing bar.',
))

# ---------------------------------------------------------------- No. 4
_d4 = []
_d4 += _d(1, 'RH', [(0, 1), (1, 2), (2, 1), (3, 2), (4, 5)])
_d4 += _d(1, 'LH', [(0, 5), (1, 4), (2, 5), (3, 3), (4, 1)])
_d4 += _d(2, 'RH', [(0, 1), (1, 2), (3, 2), (4, 5)])
_d4 += _d(2, 'LH', [(0, 5), (1, 4), (2, 5), (3, 3), (4, 1)])
for b in range(3, 15):
    _d4 += _d(b, 'RH', [(0, 1)])
    _d4 += _d(b, 'LH', [(0, 5)])
for b in (15, 16):
    _d4 += _d(b, 'RH', [(0, 5), (1, 4), (2, 5), (3, 2), (4, 1)])
    _d4 += _d(b, 'LH', [(0, 1), (1, 2), (2, 1), (3, 3), (4, 5)])
for b in range(17, 30):
    _d4 += _d(b, 'RH', [(0, 5)])
    _d4 += _d(b, 'LH', [(0, 1)])

E.append(dict(
    number=4,
    pdf=6, page=5,
    pdf_end=6,
    time='2/4',
    rhythm='8 sixteenths per bar in both hands (two beamed groups of four), closing bar a half note in each hand',
    bars_up=14,
    bars_down=15,
    up_rh='C3 D3 C3 E3 A3 G3 F3 E3',
    up_lh='C2 D2 C2 E2 A2 G2 F2 E2',
    down_rh='G5 F5 G5 D5 B4 C5 D5 E5',
    down_lh='G4 F4 G4 D4 B3 C4 D4 E4',
    starts_rh=UP_STARTS_RH + DOWN_STARTS_RH,
    starts_lh=UP_STARTS_LH + DOWN_STARTS_LH,
    irregular={},
    close_rh='C3', close_lh='C2',
    close_rhythm='half note (both hands)',
    repeat='end-repeat sign (:||) before the closing bar; no start-repeat anywhere',
    digits=_d4,
    uncertain=[],
    note='No accidentals. The descending group is not the inversion of the ascending one: bar 1 is C D C then up a '
         'third and a fourth (E A); bar 15 is G F G then down a fourth and a third (D B), i.e. the ascending '
         'intervals in reverse order; checked at 1200 dpi (bar 15 RH note 3 on the D5 line, note 4 on the B4 line; '
         'LH D4 between the ledger lines, B3 below the C4 ledger). Heading line: "(3-4-5) (1) Special exercise for '
         'the 3rd, 4th and 5th fingers of the hand." -- the "(1)" there is the key for the "(1)" marks in the music: '
         'one printed just left of LH bar 1 note 0 (below the bass staff) and one above bar 15 (just before the '
         'double bar, treble staff); there is no separate footnote at the foot of the page. No metronome mark, no '
         'dynamics. Thin double bar between bars 14 and 15. Bar 2 RH has no digit on note 2 (digits 1 2 . 2 5). '
         'Staff changes: RH in the bass staff bars 1-5 and bar 6 notes 0-3 (A3 B3 A3 C4), treble from bar 6 note 4; '
         'bar 23 notes 0-3 (F4 E4 F4 C4) in treble, notes 4-7 (A3 B3 C4 D4) in the bass staff, and bass staff to the '
         'end. Digit placement: bars 1-6 RH above, LH below (bar 6 LH "5" just left of note 0); bars 7-11 RH below, '
         'LH above; bars 12-19 both above their notes; bars 20-23 RH below (just left of note 0), LH above; bars '
         '24-29 RH above, LH below. Final double bar after the closing bar.',
))

# ---------------------------------------------------------------- No. 5
_d5 = []
for b in (1, 2):
    _d5 += _d(b, 'RH', [(0, 1), (1, 5), (2, 4), (3, 5), (4, 3), (5, 4), (6, 2), (7, 3)])
    _d5 += _d(b, 'LH', [(0, 5), (1, 1), (2, 2), (3, 1), (4, 3), (5, 2), (6, 4), (7, 3)])
for b in range(3, 15):
    _d5 += _d(b, 'RH', [(0, 1)])
    _d5 += _d(b, 'LH', [(0, 5)])
for b in (15, 16):
    _d5 += _d(b, 'RH', [(0, 1), (1, 2), (2, 1), (3, 3), (4, 2), (5, 4), (6, 3), (7, 5)])
    _d5 += _d(b, 'LH', [(0, 5), (1, 4), (2, 5), (3, 3), (4, 4), (5, 2), (6, 3), (7, 1)])
for b in range(17, 29):
    _d5 += _d(b, 'RH', [(0, 1)])
    _d5 += _d(b, 'LH', [(0, 5)])

E.append(dict(
    number=5,
    pdf=7, page=6,
    pdf_end=7,
    time='2/4',
    rhythm='8 sixteenths per bar in both hands (two beamed groups of four), closing bar a half note in each hand',
    bars_up=14,
    bars_down=14,
    up_rh='C3 A3 G3 A3 F3 G3 E3 F3',
    up_lh='C2 A2 G2 A2 F2 G2 E2 F2',
    down_rh='C5 D5 C5 E5 D5 F5 E5 G5',
    down_lh='C4 D4 C4 E4 D4 F4 E4 G4',
    starts_rh=UP_STARTS_RH + ['C5', 'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4', 'B3', 'A3', 'G3', 'F3', 'E3', 'D3'],
    starts_lh=UP_STARTS_LH + ['C4', 'B3', 'A3', 'G3', 'F3', 'E3', 'D3', 'C3', 'B2', 'A2', 'G2', 'F2', 'E2', 'D2'],
    irregular={},
    close_rh='C3', close_lh='C2',
    close_rhythm='half note (both hands)',
    repeat='end-repeat sign (:||) before the closing bar; no start-repeat anywhere',
    digits=_d5,
    uncertain=[],
    note='No accidentals. Differs from Nos. 1-4 in shape: 28 bars, not 29 -- 14 ascending (C3..B4) and 14 '
         'descending. The ascending group leaps up a sixth and zig-zags down (C A G A F G E F); the descending '
         'group is NOT a falling figure: it starts low and zig-zags UP (C5 D5 C5 E5 D5 F5 E5 G5: +1 -1 +2 -1 +2 -1 '
         '+2), each bar a step lower. The descending half starts on C5, one step ABOVE the start of bar 14 (B4) and '
         'not on the G5 top note used by Nos. 1-4; its last bar starts on D3 (D3 E3 D3 F3 E3 G3 F3 A3 / D2 E2 D2 F2 '
         'E2 G2 F2 A2), and the closing C3/C2 follows a step below. Bar 15 and bar 28 checked by measuring note heads '
         'against the staff lines at 1200/600 dpi. Heading text: "(1-2-3-4-5) We repeat, that the fingers should be '
         'lifted high, and with precision, until this entire volume is mastered." Footnote mark "(1)" printed just '
         'left of RH bar 1 note 0 (between the staves, above the bass staff); footnote at the foot of PDF 7: '
         '"(1) Preparation for the trill with the 4th and 5th fingers of the right hand." No metronome mark, no '
         'dynamics. Thin double bar between bars 14 and 15. Staff changes: RH in the bass staff bars 1-5 and bar 6 '
         'note 0 (A3), treble from bar 6 note 1 through bar 23 (bar 23 starts B3 below the treble staff); bass staff '
         'from bar 24 to the end. Digit placement: bars 1-6 RH above, LH below; bars 7-11 RH below, LH above; bars '
         '12-17 both above their notes; bars 18-23 RH below, LH above; bars 24-28 RH above, LH below. Final double '
         'bar after the closing bar; this closing note is the end of p. 6, where the heading of No. 3 says to stop.',
))


if __name__ == '__main__':
    STEPS = 'CDEFGAB'

    def idx(p):
        return int(p[-1]) * 7 + STEPS.index(p[0])

    for e in E:
        n = e['bars_up'] + e['bars_down']
        assert len(e['starts_rh']) == len(e['starts_lh']) == n, e['number']
        for (bar, hand, i, f) in e['digits']:
            assert 1 <= bar <= n and 0 <= i <= 7 and 1 <= f <= 5 and hand in ('RH', 'LH'), (e['number'], bar)
        assert len(set((b, h, i) for b, h, i, _ in e['digits'])) == len(e['digits']), ('dup digit', e['number'])
        for key in ('starts_rh', 'starts_lh'):
            s = [idx(p) for p in e[key]]
            up, down = s[:e['bars_up']], s[e['bars_up']:]
            assert all(b - a == 1 for a, b in zip(up, up[1:])), (e['number'], key, 'up')
            assert all(a - b == 1 for a, b in zip(down, down[1:])), (e['number'], key, 'down')
        for key in ('up_rh', 'up_lh', 'down_rh', 'down_lh'):
            assert len(e[key].split()) == 8, (e['number'], key)
        assert e['up_rh'].split()[0] == e['starts_rh'][0] and e['down_rh'].split()[0] == e['starts_rh'][e['bars_up']]
        assert e['up_lh'].split()[0] == e['starts_lh'][0] and e['down_lh'].split()[0] == e['starts_lh'][e['bars_up']]
        print('No.', e['number'], 'ok:', n, 'bars,', len(e['digits']), 'digits')
