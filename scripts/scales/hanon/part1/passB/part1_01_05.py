# Hanon, The Virtuoso Pianist, Part I, Nos. 1-5 -- independent reading (pass B, reader w1)
# Source: G. Schirmer [1900], IMSLP #91547, rendered at 300, 600 and (spot) 1200 dpi.
# Pitches: notehead centres measured in 600-dpi pixels against locally fitted staff lines
# (the scan is skewed ~0.5 deg), each hand checked to be an exact octave apart in every bar,
# then every bar looked at in 600-dpi crops. Digits: read by eye from 600-dpi crops.
# Plain literals only (expanded from a helper-built draft).

E = []

# ------------------------------------------------------------ No. 1
E.append(dict(
    number=1,
    pdf=3,
    page=2,
    pdf_end=4,
    time='2/4',
    rhythm='8 sixteenths per bar in both hands (two beamed groups of four), closing bar a half note in each hand',
    bars_up=14,
    bars_down=15,
    up_rh='C3 E3 F3 G3 A3 G3 F3 E3',
    up_lh='C2 E2 F2 G2 A2 G2 F2 E2',
    down_rh='G5 E5 D5 C5 B4 C5 D5 E5',
    down_lh='G4 E4 D4 C4 B3 C4 D4 E4',
    starts_rh=['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'G5', 'F5', 'E5', 'D5', 'C5', 'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4', 'B3', 'A3', 'G3'],
    starts_lh=['C2', 'D2', 'E2', 'F2', 'G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'G4', 'F4', 'E4', 'D4', 'C4', 'B3', 'A3', 'G3', 'F3', 'E3', 'D3', 'C3', 'B2', 'A2', 'G2'],
    irregular={},
    close_rh='C3',
    close_lh='C2',
    close_rhythm='half note',
    repeat=('end-repeat sign (dots in both staves, thin-thick bar line) after bar 29, before the closing bar; '
            'closing bar ends with a thin-thick final bar line'),
    digits=[
        (1, 'RH', 0, 1), (1, 'RH', 1, 2), (1, 'RH', 2, 3), (1, 'RH', 3, 4), (1, 'RH', 4, 5),
        (1, 'LH', 0, 5), (1, 'LH', 1, 4), (1, 'LH', 2, 3), (1, 'LH', 3, 2), (1, 'LH', 4, 1),
        (2, 'RH', 0, 1), (2, 'RH', 1, 2), (2, 'RH', 2, 3), (2, 'RH', 3, 4), (2, 'RH', 4, 5),
        (2, 'LH', 0, 5), (2, 'LH', 1, 4), (2, 'LH', 2, 3), (2, 'LH', 3, 2), (2, 'LH', 4, 1),
        (3, 'RH', 0, 1), (3, 'RH', 1, 2),
        (3, 'LH', 0, 5), (3, 'LH', 1, 4),
        (4, 'RH', 0, 1), (4, 'RH', 1, 2),
        (4, 'LH', 0, 5), (4, 'LH', 1, 4),
        (5, 'RH', 0, 1), (5, 'RH', 1, 2),
        (5, 'LH', 0, 5), (5, 'LH', 1, 4),
        (6, 'RH', 0, 1), (6, 'RH', 1, 2),
        (6, 'LH', 0, 5), (6, 'LH', 1, 4),
        (7, 'RH', 0, 1), (7, 'RH', 1, 2),
        (7, 'LH', 0, 5), (7, 'LH', 1, 4),
        (8, 'RH', 0, 1), (8, 'RH', 1, 2),
        (8, 'LH', 0, 5), (8, 'LH', 1, 4),
        (9, 'RH', 0, 1), (9, 'RH', 1, 2),
        (9, 'LH', 0, 5), (9, 'LH', 1, 4),
        (10, 'RH', 0, 1), (10, 'RH', 1, 2),
        (10, 'LH', 0, 5), (10, 'LH', 1, 4),
        (11, 'RH', 0, 1), (11, 'RH', 1, 2),
        (11, 'LH', 0, 5), (11, 'LH', 1, 4),
        (15, 'RH', 0, 5), (15, 'RH', 1, 4), (15, 'RH', 2, 3), (15, 'RH', 3, 2), (15, 'RH', 4, 1),
        (15, 'LH', 0, 1), (15, 'LH', 1, 2), (15, 'LH', 2, 3), (15, 'LH', 3, 4), (15, 'LH', 4, 5),
        (16, 'RH', 0, 5), (16, 'RH', 1, 4),
        (16, 'LH', 0, 1), (16, 'LH', 1, 2),
        (17, 'RH', 0, 5), (17, 'RH', 1, 4),
        (17, 'LH', 0, 1), (17, 'LH', 1, 2),
        (18, 'RH', 0, 5), (18, 'RH', 1, 4),
        (18, 'LH', 0, 1), (18, 'LH', 1, 2),
        (19, 'RH', 0, 5), (19, 'RH', 1, 4),
        (19, 'LH', 0, 1), (19, 'LH', 1, 2),
        (20, 'RH', 0, 5), (20, 'RH', 1, 4),
        (20, 'LH', 0, 1), (20, 'LH', 1, 2),
        (21, 'RH', 0, 5), (21, 'RH', 1, 4),
        (21, 'LH', 0, 1), (21, 'LH', 1, 2),
        (22, 'RH', 0, 5), (22, 'RH', 1, 4),
        (22, 'LH', 0, 1), (22, 'LH', 1, 2),
        (23, 'RH', 0, 5), (23, 'RH', 1, 4),
        (23, 'LH', 0, 1), (23, 'LH', 1, 2),
        (24, 'RH', 0, 5), (24, 'RH', 1, 4),
        (24, 'LH', 0, 1), (24, 'LH', 1, 2),
        (25, 'RH', 0, 5), (25, 'RH', 1, 4),
        (25, 'LH', 0, 1), (25, 'LH', 1, 2),
        (26, 'RH', 0, 5), (26, 'RH', 1, 4),
        (26, 'LH', 0, 1), (26, 'LH', 1, 2),
        (27, 'RH', 0, 5), (27, 'RH', 1, 4),
        (27, 'LH', 0, 1), (27, 'LH', 1, 2),
        (28, 'RH', 0, 5), (28, 'RH', 1, 4),
        (28, 'LH', 0, 1), (28, 'LH', 1, 2),
        (29, 'RH', 0, 5), (29, 'RH', 1, 4),
        (29, 'LH', 0, 1), (29, 'LH', 1, 2),
    ],
    uncertain=['bar 17 RH idx 1: digit crossed by the treble top line; read 4 at 600 dpi (open diagonal and crossbar '
               'visible), bar 16 RH idx 1 "4" just touches the same line, also clearly 4',
               'footnote "(1) For brevity, we shall henceforward indicate only by their figures those fingers which '
               'are to be specially trained..." is printed at the foot of PDF p. 3, but no "(1)" reference mark is '
               'visible anywhere in the music of No. 1 (checked the whole first system at 600 dpi); the "1" right '
               'after "mf" in bar 1 is the RH digit 1 on the first note, not a footnote mark'],
    note=('Text above the music: "Stretch between the fifth and fourth fingers of the left hand in ascending, '
          'and the fifth and fourth fingers of the right hand in descending. / For studying the 20 exercises in '
          'this First Part, begin with the metronome set at 60, gradually increasing the speed up to 108; this '
          'is the meaning of the double metronome-mark at the head of each exercise. / Lift the fingers high '
          'and with precision, playing each note very distinctly." Tempo "(M.M. quarter = 60 to 108.)"; "mf" at '
          'bar 1; "ascending" printed under the RH (between the RH and LH notes) in bar 1; "descending" printed '
          'above the RH in bar 15. Double bar line (thin-thin) between bars 14 and 15. The RH is written in the '
          'bass staff in bars 1-5, crosses to the treble staff in bar 6 (notes 1-2 in the bass staff, 3-8 in '
          'the treble) and returns to the bass staff in bar 23 (notes 4-8) and bars 24-29; the LH stays in the '
          'bass staff throughout (ledger lines above it in the top bars). Digits are printed above the RH / '
          'below the LH when the RH is on the bass staff, and below the RH / above the LH when the RH is on the '
          'treble staff (bars 7-11, 18-23). The LH is always exactly one octave below the RH. No accidentals. '
          'The descending group is the exact interval mirror of the ascending group. The descending half has 15 '
          'bars (15-29), one more than the ascending half (14). Beside the closing bar: "As soon as Ex. 1 is '
          'mastered, go on to Ex. 2 without stopping on this note." No 8va lines.'),
))

# ------------------------------------------------------------ No. 2
E.append(dict(
    number=2,
    pdf=4,
    page=3,
    pdf_end=4,
    time='2/4',
    rhythm='8 sixteenths per bar in both hands (two beamed groups of four), closing bar a half note in each hand',
    bars_up=14,
    bars_down=14,
    up_rh='C3 E3 A3 G3 F3 G3 F3 E3',
    up_lh='C2 E2 A2 G2 F2 G2 F2 E2',
    down_rh='G5 D5 B4 C5 D5 C5 D5 E5',
    down_lh='G4 D4 B3 C4 D4 C4 D4 E4',
    starts_rh=['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'G5', 'F5', 'E5', 'D5', 'C5', 'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4', 'B3', 'A3'],
    starts_lh=['C2', 'D2', 'E2', 'F2', 'G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'G4', 'F4', 'E4', 'D4', 'C4', 'B3', 'A3', 'G3', 'F3', 'E3', 'D3', 'C3', 'B2', 'A2'],
    irregular={},
    close_rh='C3',
    close_lh='C2',
    close_rhythm='half note',
    repeat=('end-repeat sign (dots in both staves, thin-thick bar line) after bar 28, before the closing bar; '
            'closing bar ends with a thin-thick final bar line'),
    digits=[
        (1, 'RH', 0, 1), (1, 'RH', 1, 2), (1, 'RH', 2, 5), (1, 'RH', 3, 4), (1, 'RH', 4, 3), (1, 'RH', 5, 4), (1, 'RH', 6, 3), (1, 'RH', 7, 2),
        (1, 'LH', 0, 5), (1, 'LH', 1, 3), (1, 'LH', 2, 1), (1, 'LH', 3, 2), (1, 'LH', 4, 3), (1, 'LH', 5, 2), (1, 'LH', 6, 3), (1, 'LH', 7, 4),
        (2, 'RH', 0, 1), (2, 'RH', 1, 2), (2, 'RH', 2, 5),
        (2, 'LH', 0, 5), (2, 'LH', 1, 3), (2, 'LH', 2, 1),
        (3, 'RH', 0, 1), (3, 'RH', 1, 2), (3, 'RH', 2, 5),
        (3, 'LH', 0, 5), (3, 'LH', 1, 3), (3, 'LH', 2, 1),
        (4, 'RH', 0, 1), (4, 'RH', 1, 2),
        (4, 'LH', 0, 5), (4, 'LH', 1, 3), (4, 'LH', 2, 1),
        (5, 'RH', 0, 1), (5, 'RH', 1, 2),
        (5, 'LH', 0, 5), (5, 'LH', 1, 3),
        (6, 'RH', 0, 1), (6, 'RH', 1, 2),
        (6, 'LH', 0, 5), (6, 'LH', 1, 3),
        (7, 'RH', 0, 1), (7, 'RH', 1, 2),
        (7, 'LH', 0, 5), (7, 'LH', 1, 3),
        (8, 'RH', 0, 1), (8, 'RH', 1, 2),
        (8, 'LH', 0, 5), (8, 'LH', 1, 3),
        (9, 'RH', 0, 1), (9, 'RH', 1, 2),
        (9, 'LH', 0, 5), (9, 'LH', 1, 3),
        (10, 'RH', 0, 1), (10, 'RH', 1, 2),
        (10, 'LH', 0, 5), (10, 'LH', 1, 3),
        (11, 'RH', 0, 1), (11, 'RH', 1, 2),
        (11, 'LH', 0, 5), (11, 'LH', 1, 3),
        (12, 'RH', 0, 1), (12, 'RH', 1, 2),
        (12, 'LH', 0, 5), (12, 'LH', 1, 3),
        (13, 'RH', 0, 1), (13, 'RH', 1, 2),
        (13, 'LH', 0, 5), (13, 'LH', 1, 3),
        (14, 'RH', 0, 1), (14, 'RH', 1, 2),
        (14, 'LH', 0, 5), (14, 'LH', 1, 3),
        (15, 'RH', 0, 5), (15, 'RH', 1, 2), (15, 'RH', 2, 1), (15, 'RH', 3, 2), (15, 'RH', 4, 3), (15, 'RH', 5, 2), (15, 'RH', 6, 3), (15, 'RH', 7, 4),
        (15, 'LH', 0, 1), (15, 'LH', 1, 3), (15, 'LH', 2, 5), (15, 'LH', 3, 4), (15, 'LH', 4, 3), (15, 'LH', 5, 4), (15, 'LH', 6, 3), (15, 'LH', 7, 2),
        (16, 'RH', 0, 5), (16, 'RH', 1, 2), (16, 'RH', 2, 1),
        (16, 'LH', 0, 1), (16, 'LH', 1, 3), (16, 'LH', 2, 5),
        (17, 'RH', 0, 5), (17, 'RH', 1, 2), (17, 'RH', 2, 1),
        (17, 'LH', 0, 1), (17, 'LH', 1, 3), (17, 'LH', 2, 5),
        (18, 'RH', 0, 5), (18, 'RH', 1, 2), (18, 'RH', 2, 1),
        (18, 'LH', 0, 1), (18, 'LH', 1, 3), (18, 'LH', 2, 5),
        (19, 'RH', 0, 5), (19, 'RH', 1, 2), (19, 'RH', 2, 1),
        (19, 'LH', 0, 1), (19, 'LH', 1, 3), (19, 'LH', 2, 5),
        (20, 'RH', 0, 5), (20, 'RH', 1, 2), (20, 'RH', 2, 1),
        (20, 'LH', 0, 1), (20, 'LH', 1, 3), (20, 'LH', 2, 5),
        (21, 'RH', 0, 5), (21, 'RH', 1, 2), (21, 'RH', 2, 1),
        (21, 'LH', 0, 1), (21, 'LH', 1, 3), (21, 'LH', 2, 5),
        (22, 'RH', 0, 5), (22, 'RH', 1, 2), (22, 'RH', 2, 1),
        (22, 'LH', 0, 1), (22, 'LH', 1, 3), (22, 'LH', 2, 5),
        (23, 'RH', 0, 5), (23, 'RH', 1, 2), (23, 'RH', 2, 1),
        (23, 'LH', 0, 1), (23, 'LH', 1, 3), (23, 'LH', 2, 5),
        (24, 'RH', 0, 5), (24, 'RH', 1, 2),
        (24, 'LH', 0, 1), (24, 'LH', 1, 3),
        (25, 'RH', 0, 5), (25, 'RH', 1, 2),
        (25, 'LH', 0, 1), (25, 'LH', 1, 3),
        (26, 'RH', 0, 5), (26, 'RH', 1, 2),
        (26, 'LH', 0, 1), (26, 'LH', 1, 3),
        (27, 'RH', 0, 5), (27, 'RH', 1, 2),
        (27, 'LH', 0, 1), (27, 'LH', 1, 3),
        (28, 'RH', 0, 5), (28, 'RH', 1, 2),
        (28, 'LH', 0, 1), (28, 'LH', 1, 3),
    ],
    uncertain=['bar 23 RH idx 2: the digit 1 is printed above the beam (the note, A3, is written on the bass staff '
               'with its stem up to the treble-staff beam); attributed to idx 2 by its x position, read at 600 dpi'],
    note=('No metronome mark printed at the head of No. 2 (none visible). Text above the music: "(3-4) When '
          'this exercise is mastered, recommence the preceding one, and play both together four times without '
          'interruption; the fingers will gain considerably by practising these exercises, and those following, '
          'in this way." Footnote mark "(1)" above the treble staff at bar 1 and again above bar 15 (first '
          'descending bar); footnote at the foot of PDF p. 4: "(1) The fourth and fifth fingers being naturally '
          'weak, it should be observed that this exercise, and those following it up to No. 31, are intended to '
          'render them as strong and agile as the second and third." No dynamics, no "ascending"/"descending" '
          'words. Double bar line (thin-thin) between bars 14 and 15. The descending group is NOT the interval '
          'mirror of the ascending group: ascending C E A G F G F E (up a 3rd, up a 4th, then steps), '
          'descending G D B C D C D E (down a 4th, down a 3rd, then steps) -- note 2 of bar 15 measured on the '
          'D5 line (RH) and between the C4 and E4 ledgers, i.e. D4 (LH), at 600 dpi. RH in the bass staff bars '
          '1-5, crosses to the treble in bar 6 (notes 1-2 in the bass staff), returns to the bass staff in bar '
          '23 (notes 3-8) and bars 24-28. LH always exactly one octave below the RH. No accidentals. No 8va '
          'lines.'),
))

# ------------------------------------------------------------ No. 3
E.append(dict(
    number=3,
    pdf=5,
    page=4,
    pdf_end=5,
    time='2/4',
    rhythm='8 sixteenths per bar in both hands (two beamed groups of four), closing bar a half note in each hand',
    bars_up=14,
    bars_down=14,
    up_rh='C3 E3 A3 G3 F3 E3 F3 G3',
    up_lh='C2 E2 A2 G2 F2 E2 F2 G2',
    down_rh='G5 D5 B4 C5 D5 E5 D5 C5',
    down_lh='G4 D4 B3 C4 D4 E4 D4 C4',
    starts_rh=['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'G5', 'F5', 'E5', 'D5', 'C5', 'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4', 'B3', 'A3'],
    starts_lh=['C2', 'D2', 'E2', 'F2', 'G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'G4', 'F4', 'E4', 'D4', 'C4', 'B3', 'A3', 'G3', 'F3', 'E3', 'D3', 'C3', 'B2', 'A2'],
    irregular={},
    close_rh='C3',
    close_lh='C2',
    close_rhythm='half note',
    repeat=('end-repeat sign (dots in both staves, thick bar line) after bar 28, before the closing bar; closing '
            'bar ends with a thin-thick final bar line'),
    digits=[
        (1, 'RH', 0, 1), (1, 'RH', 1, 2), (1, 'RH', 2, 5), (1, 'RH', 3, 4), (1, 'RH', 4, 3), (1, 'RH', 5, 2), (1, 'RH', 6, 3), (1, 'RH', 7, 4),
        (1, 'LH', 0, 5), (1, 'LH', 1, 3), (1, 'LH', 2, 1), (1, 'LH', 3, 2), (1, 'LH', 4, 3), (1, 'LH', 5, 4), (1, 'LH', 6, 3), (1, 'LH', 7, 2),
        (2, 'RH', 0, 1), (2, 'RH', 1, 2), (2, 'RH', 2, 5), (2, 'RH', 3, 4), (2, 'RH', 4, 3), (2, 'RH', 5, 2),
        (2, 'LH', 0, 5), (2, 'LH', 1, 3), (2, 'LH', 2, 1), (2, 'LH', 3, 2), (2, 'LH', 4, 3), (2, 'LH', 5, 4),
        (3, 'RH', 0, 1), (3, 'RH', 1, 2), (3, 'RH', 2, 5),
        (3, 'LH', 0, 5), (3, 'LH', 1, 3), (3, 'LH', 2, 1),
        (4, 'RH', 0, 1), (4, 'RH', 1, 2), (4, 'RH', 2, 5),
        (4, 'LH', 0, 5), (4, 'LH', 1, 3), (4, 'LH', 2, 1),
        (5, 'RH', 0, 1), (5, 'RH', 1, 2), (5, 'RH', 2, 5),
        (5, 'LH', 0, 5), (5, 'LH', 1, 3), (5, 'LH', 2, 1),
        (6, 'RH', 0, 1), (6, 'RH', 1, 2), (6, 'RH', 2, 5),
        (6, 'LH', 0, 5), (6, 'LH', 1, 3), (6, 'LH', 2, 1),
        (7, 'RH', 0, 1), (7, 'RH', 1, 2), (7, 'RH', 2, 5),
        (7, 'LH', 0, 5), (7, 'LH', 1, 3), (7, 'LH', 2, 1),
        (8, 'RH', 0, 1), (8, 'RH', 1, 2), (8, 'RH', 2, 5),
        (8, 'LH', 0, 5), (8, 'LH', 1, 3), (8, 'LH', 2, 1),
        (9, 'RH', 0, 1), (9, 'RH', 1, 2),
        (9, 'LH', 0, 5), (9, 'LH', 1, 3),
        (10, 'RH', 0, 1), (10, 'RH', 1, 2),
        (10, 'LH', 0, 5), (10, 'LH', 1, 3),
        (11, 'RH', 0, 1), (11, 'RH', 1, 2),
        (11, 'LH', 0, 5), (11, 'LH', 1, 3),
        (12, 'RH', 0, 1), (12, 'RH', 1, 2),
        (12, 'LH', 0, 5), (12, 'LH', 1, 3),
        (13, 'RH', 0, 1), (13, 'RH', 1, 2),
        (13, 'LH', 0, 5), (13, 'LH', 1, 3),
        (14, 'RH', 0, 1), (14, 'RH', 1, 2),
        (14, 'LH', 0, 5), (14, 'LH', 1, 3),
        (15, 'RH', 0, 5), (15, 'RH', 1, 2), (15, 'RH', 2, 1), (15, 'RH', 3, 2), (15, 'RH', 4, 3), (15, 'RH', 5, 4), (15, 'RH', 6, 3), (15, 'RH', 7, 2),
        (15, 'LH', 0, 1), (15, 'LH', 1, 3), (15, 'LH', 2, 5), (15, 'LH', 3, 4), (15, 'LH', 4, 3), (15, 'LH', 5, 2), (15, 'LH', 6, 3), (15, 'LH', 7, 4),
        (16, 'RH', 0, 5), (16, 'RH', 1, 2), (16, 'RH', 2, 1),
        (16, 'LH', 0, 1), (16, 'LH', 1, 3), (16, 'LH', 2, 5),
        (17, 'RH', 0, 5), (17, 'RH', 1, 2), (17, 'RH', 2, 1),
        (17, 'LH', 0, 1), (17, 'LH', 1, 3), (17, 'LH', 2, 5),
        (18, 'RH', 0, 5), (18, 'RH', 1, 2), (18, 'RH', 2, 1),
        (18, 'LH', 0, 1), (18, 'LH', 1, 3), (18, 'LH', 2, 5),
        (19, 'RH', 0, 5), (19, 'RH', 1, 2), (19, 'RH', 2, 1),
        (19, 'LH', 0, 1), (19, 'LH', 1, 3), (19, 'LH', 2, 5),
        (20, 'RH', 0, 5), (20, 'RH', 1, 2), (20, 'RH', 2, 1),
        (20, 'LH', 0, 1), (20, 'LH', 1, 3),
        (21, 'RH', 0, 5), (21, 'RH', 1, 2),
        (21, 'LH', 0, 1), (21, 'LH', 1, 3),
        (22, 'RH', 0, 5), (22, 'RH', 1, 2),
        (22, 'LH', 0, 1), (22, 'LH', 1, 3),
        (23, 'RH', 0, 5), (23, 'RH', 1, 2),
        (23, 'LH', 0, 1), (23, 'LH', 1, 3),
        (24, 'RH', 0, 5), (24, 'RH', 1, 2),
        (24, 'LH', 0, 1), (24, 'LH', 1, 3),
        (25, 'RH', 0, 5), (25, 'RH', 1, 2),
        (25, 'LH', 0, 1), (25, 'LH', 1, 3),
        (26, 'RH', 0, 5), (26, 'RH', 1, 2),
        (26, 'LH', 0, 1), (26, 'LH', 1, 3),
        (27, 'RH', 0, 5), (27, 'RH', 1, 2),
        (27, 'LH', 0, 1), (27, 'LH', 1, 3),
        (28, 'RH', 0, 5), (28, 'RH', 1, 2),
        (28, 'LH', 0, 1), (28, 'LH', 1, 3),
    ],
    uncertain=['bar 17 RH idx 1: digit sits on the treble top line and prints as an "x"-like mark (upper curve '
               'broken by the line); read as 2 at 1200 dpi (diagonal stroke and flat foot of a 2 visible), same '
               'place as the clear 2 in bars 15-16',
               'bar 4 LH idx 0: the digit 5 is faintly/partially printed (top stroke broken), read 5 at 600 dpi',
               'bar 18 LH idx 0: notehead is smudged (irregular shape, pixel centre measured a little low, near C4); '
               'read as D4 by eye at 600 dpi (sits just above the C4 ledger), consistent with the RH D5 an octave '
               'above',
               'bar 17 LH: a small stray filled blot inside the bass staff under notes 6-7 (around the D3 line, with '
               'a short stroke down to the beam); not a note in the pattern, taken as a plate blemish'],
    note=('No metronome mark and no dynamic printed at the head of No. 3. Text above: "(2-3-4) Before beginning '
          'to practise No 3, play through the preceding exercises once or twice without stopping. When No 3 is '
          'mastered, practise No 4, and then No 5, and as soon as they are thoroughly learned play through all '
          'three at least four times without interruption, not stopping until the last note on page 6. The '
          'entire work should be practised in this manner. Therefore, when playing the numbers in the First '
          'Part, stop only on the last note on pp. 3, 6, 9, 12, 15, 18, and 21." No footnote marks. Double bar '
          'line (thin-thin) between bars 14 and 15. The descending group is NOT the interval mirror of the '
          'ascending group: ascending C E A G F E F G, descending G D B C D E D C (down a 4th, then a 3rd, then '
          'steps). RH in the bass staff bars 1-5, crosses to the treble in bar 6 (notes 1-2 in the bass staff), '
          'returns to the bass staff in bar 23 (notes 3-8) and bars 24-28. LH always exactly one octave below '
          'the RH. No accidentals. No 8va lines.'),
))

# ------------------------------------------------------------ No. 4
E.append(dict(
    number=4,
    pdf=6,
    page=5,
    pdf_end=6,
    time='2/4',
    rhythm='8 sixteenths per bar in both hands (two beamed groups of four), closing bar a half note in each hand',
    bars_up=14,
    bars_down=14,
    up_rh='C3 D3 C3 E3 A3 G3 F3 E3',
    up_lh='C2 D2 C2 E2 A2 G2 F2 E2',
    down_rh='G5 F5 G5 D5 B4 C5 D5 E5',
    down_lh='G4 F4 G4 D4 B3 C4 D4 E4',
    starts_rh=['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'G5', 'F5', 'E5', 'D5', 'C5', 'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4', 'B3', 'A3'],
    starts_lh=['C2', 'D2', 'E2', 'F2', 'G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'G4', 'F4', 'E4', 'D4', 'C4', 'B3', 'A3', 'G3', 'F3', 'E3', 'D3', 'C3', 'B2', 'A2'],
    irregular={},
    close_rh='C3',
    close_lh='C2',
    close_rhythm='half note',
    repeat=('end-repeat sign (dots in both staves, thick bar line) after bar 28, before the closing bar; closing '
            'bar ends with a thin-thick final bar line'),
    digits=[
        (1, 'RH', 0, 1), (1, 'RH', 1, 2), (1, 'RH', 2, 1), (1, 'RH', 3, 2), (1, 'RH', 4, 5),
        (1, 'LH', 0, 5), (1, 'LH', 1, 4), (1, 'LH', 2, 5), (1, 'LH', 3, 3), (1, 'LH', 4, 1),
        (2, 'RH', 0, 1), (2, 'RH', 1, 2), (2, 'RH', 3, 2), (2, 'RH', 4, 5),
        (2, 'LH', 0, 5), (2, 'LH', 1, 4), (2, 'LH', 2, 5), (2, 'LH', 3, 3), (2, 'LH', 4, 1),
        (3, 'RH', 0, 1),
        (3, 'LH', 0, 5),
        (4, 'RH', 0, 1),
        (4, 'LH', 0, 5),
        (5, 'RH', 0, 1),
        (5, 'LH', 0, 5),
        (6, 'RH', 0, 1),
        (6, 'LH', 0, 5),
        (7, 'RH', 0, 1),
        (7, 'LH', 0, 5),
        (8, 'RH', 0, 1),
        (8, 'LH', 0, 5),
        (9, 'RH', 0, 1),
        (9, 'LH', 0, 5),
        (10, 'RH', 0, 1),
        (10, 'LH', 0, 5),
        (11, 'RH', 0, 1),
        (11, 'LH', 0, 5),
        (12, 'RH', 0, 1),
        (12, 'LH', 0, 5),
        (13, 'RH', 0, 1),
        (13, 'LH', 0, 5),
        (14, 'RH', 0, 1),
        (14, 'LH', 0, 5),
        (15, 'RH', 0, 5), (15, 'RH', 1, 4), (15, 'RH', 2, 5), (15, 'RH', 3, 2), (15, 'RH', 4, 1),
        (15, 'LH', 0, 1), (15, 'LH', 1, 2), (15, 'LH', 2, 1), (15, 'LH', 3, 3), (15, 'LH', 4, 5),
        (16, 'RH', 0, 5), (16, 'RH', 1, 4), (16, 'RH', 2, 5), (16, 'RH', 3, 2), (16, 'RH', 4, 1),
        (16, 'LH', 0, 1), (16, 'LH', 1, 2), (16, 'LH', 2, 1), (16, 'LH', 3, 3), (16, 'LH', 4, 5),
        (17, 'RH', 0, 5),
        (17, 'LH', 0, 1),
        (18, 'RH', 0, 5),
        (18, 'LH', 0, 1),
        (19, 'RH', 0, 5),
        (19, 'LH', 0, 1),
        (20, 'RH', 0, 5),
        (20, 'LH', 0, 1),
        (21, 'RH', 0, 5),
        (21, 'LH', 0, 1),
        (22, 'RH', 0, 5),
        (22, 'LH', 0, 1),
        (23, 'RH', 0, 5),
        (23, 'LH', 0, 1),
        (24, 'RH', 0, 5),
        (24, 'LH', 0, 1),
        (25, 'RH', 0, 5),
        (25, 'LH', 0, 1),
        (26, 'RH', 0, 5),
        (26, 'LH', 0, 1),
        (27, 'RH', 0, 5),
        (27, 'LH', 0, 1),
        (28, 'RH', 0, 5),
        (28, 'LH', 0, 1),
    ],
    uncertain=['bar 2 RH: digits printed 1 2 _ 2 5 -- nothing over idx 2 (where bar 1 has 1); the second 2 stands '
               'over idx 3 and the 5 over idx 4 by x position (600 dpi). Recorded as printed.',
               'bar 6 LH idx 0: the 5 is printed to the LEFT of the first LH note (not below it), attributed to idx '
               '0'],
    note=('No metronome mark and no dynamic at the head of No. 4. Text above: "(3-4-5) (1) Special exercise for '
          'the 3rd, 4th and 5th fingers of the hand." Footnote-style mark "(1)" printed left of the first LH '
          'note of bar 1 and above the RH at bar 15 (first descending bar); the "(1)" in the heading line is '
          'its only explanation (no footnote at the foot of the page). Double bar line (thin-thin) between bars '
          '14 and 15. The descending group is NOT the interval mirror of the ascending group: ascending C D C E '
          'A G F E (0 +1 0 +2 +5 +4 +3 +2), descending G F G D B C D E (0 -1 0 -3 -5 -4 -3 -2): note 4 is a 4th '
          'below note 1, not a 3rd. RH in the bass staff bars 1-5, crosses to the treble in bar 6 (notes 1-4 in '
          'the bass staff), returns to the bass staff in bar 23 (notes 5-8) and bars 24-28. LH always exactly '
          'one octave below the RH. No accidentals. No 8va lines.'),
))

# ------------------------------------------------------------ No. 5
E.append(dict(
    number=5,
    pdf=7,
    page=6,
    pdf_end=7,
    time='2/4',
    rhythm='8 sixteenths per bar in both hands (two beamed groups of four), closing bar a half note in each hand',
    bars_up=14,
    bars_down=14,
    up_rh='C3 A3 G3 A3 F3 G3 E3 F3',
    up_lh='C2 A2 G2 A2 F2 G2 E2 F2',
    down_rh='C5 D5 C5 E5 D5 F5 E5 G5',
    down_lh='C4 D4 C4 E4 D4 F4 E4 G4',
    starts_rh=['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4', 'B3', 'A3', 'G3', 'F3', 'E3', 'D3'],
    starts_lh=['C2', 'D2', 'E2', 'F2', 'G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'B3', 'A3', 'G3', 'F3', 'E3', 'D3', 'C3', 'B2', 'A2', 'G2', 'F2', 'E2', 'D2'],
    irregular={},
    close_rh='C3',
    close_lh='C2',
    close_rhythm='half note',
    repeat=('end-repeat sign (dots in both staves, thick bar line) after bar 28, before the closing bar; closing '
            'bar ends with a thin-thick final bar line'),
    digits=[
        (1, 'RH', 0, 1), (1, 'RH', 1, 5), (1, 'RH', 2, 4), (1, 'RH', 3, 5), (1, 'RH', 4, 3), (1, 'RH', 5, 4), (1, 'RH', 6, 2), (1, 'RH', 7, 3),
        (1, 'LH', 0, 5), (1, 'LH', 1, 1), (1, 'LH', 2, 2), (1, 'LH', 3, 1), (1, 'LH', 4, 3), (1, 'LH', 5, 2), (1, 'LH', 6, 4), (1, 'LH', 7, 3),
        (2, 'RH', 0, 1), (2, 'RH', 1, 5), (2, 'RH', 2, 4), (2, 'RH', 3, 5), (2, 'RH', 4, 3), (2, 'RH', 5, 4), (2, 'RH', 6, 2), (2, 'RH', 7, 3),
        (2, 'LH', 0, 5), (2, 'LH', 1, 1), (2, 'LH', 2, 2), (2, 'LH', 3, 1), (2, 'LH', 4, 3), (2, 'LH', 5, 2), (2, 'LH', 6, 4), (2, 'LH', 7, 3),
        (3, 'RH', 0, 1),
        (3, 'LH', 0, 5),
        (4, 'RH', 0, 1),
        (4, 'LH', 0, 5),
        (5, 'RH', 0, 1),
        (5, 'LH', 0, 5),
        (6, 'RH', 0, 1),
        (6, 'LH', 0, 5),
        (7, 'RH', 0, 1),
        (7, 'LH', 0, 5),
        (8, 'RH', 0, 1),
        (8, 'LH', 0, 5),
        (9, 'RH', 0, 1),
        (9, 'LH', 0, 5),
        (10, 'RH', 0, 1),
        (10, 'LH', 0, 5),
        (11, 'RH', 0, 1),
        (11, 'LH', 0, 5),
        (12, 'RH', 0, 1),
        (12, 'LH', 0, 5),
        (13, 'RH', 0, 1),
        (13, 'LH', 0, 5),
        (14, 'RH', 0, 1),
        (14, 'LH', 0, 5),
        (15, 'RH', 0, 1), (15, 'RH', 1, 2), (15, 'RH', 2, 1), (15, 'RH', 3, 3), (15, 'RH', 4, 2), (15, 'RH', 5, 4), (15, 'RH', 6, 3), (15, 'RH', 7, 5),
        (15, 'LH', 0, 5), (15, 'LH', 1, 4), (15, 'LH', 2, 5), (15, 'LH', 3, 3), (15, 'LH', 4, 4), (15, 'LH', 5, 2), (15, 'LH', 6, 3), (15, 'LH', 7, 1),
        (16, 'RH', 0, 1), (16, 'RH', 1, 2), (16, 'RH', 2, 1), (16, 'RH', 3, 3), (16, 'RH', 4, 2), (16, 'RH', 5, 4), (16, 'RH', 6, 3), (16, 'RH', 7, 5),
        (16, 'LH', 0, 5), (16, 'LH', 1, 4), (16, 'LH', 2, 5), (16, 'LH', 3, 3), (16, 'LH', 4, 4), (16, 'LH', 5, 2), (16, 'LH', 6, 3), (16, 'LH', 7, 1),
        (17, 'RH', 0, 1),
        (17, 'LH', 0, 5),
        (18, 'RH', 0, 1),
        (18, 'LH', 0, 5),
        (19, 'RH', 0, 1),
        (19, 'LH', 0, 5),
        (20, 'RH', 0, 1),
        (20, 'LH', 0, 5),
        (21, 'RH', 0, 1),
        (21, 'LH', 0, 5),
        (22, 'RH', 0, 1),
        (22, 'LH', 0, 5),
        (23, 'RH', 0, 1),
        (23, 'LH', 0, 5),
        (24, 'RH', 0, 1),
        (24, 'LH', 0, 5),
        (25, 'RH', 0, 1),
        (25, 'LH', 0, 5),
        (26, 'RH', 0, 1),
        (26, 'LH', 0, 5),
        (27, 'RH', 0, 1),
        (27, 'LH', 0, 5),
        (28, 'RH', 0, 1),
        (28, 'LH', 0, 5),
    ],
    uncertain=[],
    note=('No metronome mark and no dynamic at the head of No. 5. Text above: "(1-2-3-4-5) We repeat, that the '
          'fingers should be lifted high, and with precision, until this entire volume is mastered." Footnote '
          'mark "(1)" to the left of the first RH note of bar 1 (above the bass staff); footnote at the foot of '
          'PDF p. 7: "(1) Preparation for the trill with the 4th and 5th fingers of the right hand." Double bar '
          'line (thin-thin) between bars 14 and 15. The shapes differ from Nos. 1-4: in the ascending half each '
          'bar leaps up a 6th and then falls (C A G A F G E F: 0 +5 +4 +5 +3 +4 +2 +3) while the sequence '
          'rises; in the descending half each bar RISES within the bar (C D C E D F E G: 0 +1 0 +2 +1 +3 +2 +4) '
          'while the sequence falls, and the descending half starts on C5 (bar 15), not on the top note of bar '
          '14 (bar 14 is B4 G5 F5 G5 E5 F5 D5 E5). The last descending bar (28) is D3 E3 D3 F3 E3 G3 F3 A3, '
          'closing on C3. RH in the bass staff bars 1-5, crosses to the treble in bar 6 (note 1 A3 in the bass '
          'staff, notes 2-8 in the treble), stays in the treble through bar 23 (B3/C4 on ledger lines) and is '
          'back in the bass staff for bars 24-28. LH always exactly one octave below the RH. No accidentals. No '
          '8va lines.'),
))
