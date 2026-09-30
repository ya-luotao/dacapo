# Hanon, The Virtuoso Pianist, Part I, Nos. 11-15 -- pass B, reader w3.
# Source: G. Schirmer [1900], IMSLP #91547, read at 600 dpi (crops enlarged up to 3x).
# Pitches are sounding pitches, middle C = C4. No accidentals anywhere in Nos. 11-15.
# Bars numbered from 1 = first bar of the exercise; the closing half-note bar is not counted
# in bars_up/bars_down (it is bar 29 in every one of these five exercises).

E = []

# ---------------------------------------------------------------------------------------------
E.append(dict(
    number=11,
    pdf=13, page=12,
    pdf_end=13,
    time='2/4',
    rhythm='8 sixteenths per bar in both hands (two beamed groups of four), closing bar a half note '
           'in each hand',
    bars_up=14,
    bars_down=14,
    up_rh='C3 E3 A3 G3 A3 G3 F3 G3',
    up_lh='C2 E2 A2 G2 A2 G2 F2 G2',
    down_rh='G5 D5 B4 C5 B4 C5 D5 C5',
    down_lh='G4 D4 B3 C4 B3 C4 D4 C4',
    starts_rh=['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4',
               'G5', 'F5', 'E5', 'D5', 'C5', 'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4', 'B3', 'A3'],
    starts_lh=['C2', 'D2', 'E2', 'F2', 'G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3',
               'G4', 'F4', 'E4', 'D4', 'C4', 'B3', 'A3', 'G3', 'F3', 'E3', 'D3', 'C3', 'B2', 'A2'],
    irregular={},
    close_rh='C3', close_lh='C2',
    close_rhythm='half note',
    repeat='end-repeat sign (dots, thin-thick double bar) after bar 28, before the closing bar; '
           'no start-repeat; final thin-thick bar after the closing bar',
    digits=[
        # bar 1 full fingering
        (1, 'RH', 0, 1), (1, 'RH', 1, 2), (1, 'RH', 2, 5), (1, 'RH', 3, 4),
        (1, 'RH', 4, 5), (1, 'RH', 5, 4), (1, 'RH', 6, 3), (1, 'RH', 7, 4),
        (1, 'LH', 0, 5), (1, 'LH', 1, 3), (1, 'LH', 2, 1), (1, 'LH', 3, 2),
        (1, 'LH', 4, 1), (1, 'LH', 5, 2), (1, 'LH', 6, 3), (1, 'LH', 7, 2),
        # bars 2-5: RH 1 2 5, LH 5 3 1
        (2, 'RH', 0, 1), (2, 'RH', 1, 2), (2, 'RH', 2, 5), (2, 'LH', 0, 5), (2, 'LH', 1, 3), (2, 'LH', 2, 1),
        (3, 'RH', 0, 1), (3, 'RH', 1, 2), (3, 'RH', 2, 5), (3, 'LH', 0, 5), (3, 'LH', 1, 3), (3, 'LH', 2, 1),
        (4, 'RH', 0, 1), (4, 'RH', 1, 2), (4, 'RH', 2, 5), (4, 'LH', 0, 5), (4, 'LH', 1, 3), (4, 'LH', 2, 1),
        (5, 'RH', 0, 1), (5, 'RH', 1, 2), (5, 'RH', 2, 5), (5, 'LH', 0, 5), (5, 'LH', 1, 3), (5, 'LH', 2, 1),
        # bars 6-14: RH 1 2, LH 5 3
        (6, 'RH', 0, 1), (6, 'RH', 1, 2), (6, 'LH', 0, 5), (6, 'LH', 1, 3),
        (7, 'RH', 0, 1), (7, 'RH', 1, 2), (7, 'LH', 0, 5), (7, 'LH', 1, 3),
        (8, 'RH', 0, 1), (8, 'RH', 1, 2), (8, 'LH', 0, 5), (8, 'LH', 1, 3),
        (9, 'RH', 0, 1), (9, 'RH', 1, 2), (9, 'LH', 0, 5), (9, 'LH', 1, 3),
        (10, 'RH', 0, 1), (10, 'RH', 1, 2), (10, 'LH', 0, 5), (10, 'LH', 1, 3),
        (11, 'RH', 0, 1), (11, 'RH', 1, 2), (11, 'LH', 0, 5), (11, 'LH', 1, 3),
        (12, 'RH', 0, 1), (12, 'RH', 1, 2), (12, 'LH', 0, 5), (12, 'LH', 1, 3),
        (13, 'RH', 0, 1), (13, 'RH', 1, 2), (13, 'LH', 0, 5), (13, 'LH', 1, 3),
        (14, 'RH', 0, 1), (14, 'RH', 1, 2), (14, 'LH', 0, 5), (14, 'LH', 1, 3),
        # bar 15 full fingering
        (15, 'RH', 0, 5), (15, 'RH', 1, 2), (15, 'RH', 2, 1), (15, 'RH', 3, 2),
        (15, 'RH', 4, 1), (15, 'RH', 5, 2), (15, 'RH', 6, 3), (15, 'RH', 7, 2),
        (15, 'LH', 0, 1), (15, 'LH', 1, 3), (15, 'LH', 2, 5), (15, 'LH', 3, 4),
        (15, 'LH', 4, 5), (15, 'LH', 5, 4), (15, 'LH', 6, 3), (15, 'LH', 7, 4),
        # bars 16-19: RH 5 2 1, LH 1 3 5
        (16, 'RH', 0, 5), (16, 'RH', 1, 2), (16, 'RH', 2, 1), (16, 'LH', 0, 1), (16, 'LH', 1, 3), (16, 'LH', 2, 5),
        (17, 'RH', 0, 5), (17, 'RH', 1, 2), (17, 'RH', 2, 1), (17, 'LH', 0, 1), (17, 'LH', 1, 3), (17, 'LH', 2, 5),
        (18, 'RH', 0, 5), (18, 'RH', 1, 2), (18, 'RH', 2, 1), (18, 'LH', 0, 1), (18, 'LH', 1, 3), (18, 'LH', 2, 5),
        (19, 'RH', 0, 5), (19, 'RH', 1, 2), (19, 'RH', 2, 1), (19, 'LH', 0, 1), (19, 'LH', 1, 3), (19, 'LH', 2, 5),
        # bars 20-28: RH 5 2, LH 1 3
        (20, 'RH', 0, 5), (20, 'RH', 1, 2), (20, 'LH', 0, 1), (20, 'LH', 1, 3),
        (21, 'RH', 0, 5), (21, 'RH', 1, 2), (21, 'LH', 0, 1), (21, 'LH', 1, 3),
        (22, 'RH', 0, 5), (22, 'RH', 1, 2), (22, 'LH', 0, 1), (22, 'LH', 1, 3),
        (23, 'RH', 0, 5), (23, 'RH', 1, 2), (23, 'LH', 0, 1), (23, 'LH', 1, 3),
        (24, 'RH', 0, 5), (24, 'RH', 1, 2), (24, 'LH', 0, 1), (24, 'LH', 1, 3),
        (25, 'RH', 0, 5), (25, 'RH', 1, 2), (25, 'LH', 0, 1), (25, 'LH', 1, 3),
        (26, 'RH', 0, 5), (26, 'RH', 1, 2), (26, 'LH', 0, 1), (26, 'LH', 1, 3),
        (27, 'RH', 0, 5), (27, 'RH', 1, 2), (27, 'LH', 0, 1), (27, 'LH', 1, 3),
        (28, 'RH', 0, 5), (28, 'RH', 1, 2), (28, 'LH', 0, 1), (28, 'LH', 1, 3),
    ],
    uncertain=[
        'bar 5 RH idx 0: the 1 is crossed by the top treble line (RH notes are in the bass staff, the '
        'digit row sits on the treble staff); read 1 at 600 dpi enlarged 2x, no diagonal, not a 4',
        "bar 21 LH idx 0: the 1 is printed with its flag detached, looking like \"'1\"; read as a plain 1 "
        '(broken type), not an apostrophe or footnote sign (zoom at 600 dpi x3)',
        'bars 18-20 RH: the 5 is printed low-left of note 0 (D5/C5/B4) inside the treble staff and '
        'the 2 and 1 below notes 1 and 2; attributed to notes 0, 1, 2 by horizontal position',
        'bars 22-28 LH: the 1 3 are printed BELOW the LH beam (bars 16-21 have them above the notes); '
        'attributed to notes 0 and 1 by horizontal position',
        'second pass: bar 14 (B4 D5 G5 F5 G5 F5 E5 F5) and bar 28 (A3 E3 C3 D3 C3 D3 E3 D3) re-read at '
        '600 dpi -- regular; closing half notes C3 (bass staff, space below D3 line) and C2 (second '
        'ledger below) confirmed',
    ],
    note='No accidentals. Heading: "(3-4-5) Another preparation for the trill, for the 4th and 5th fingers." '
         'No dynamics, no 8va, no text instructions, no footnote marks. Both hands one octave apart '
         'throughout (RH an octave above LH). RH begins in the bass staff; bars 5-7 cross the staff '
         '(first notes in bass staff, rest in treble); from bar 8 RH is in the treble staff. In the '
         'descending half, LH starts above the bass staff on ledger lines (G4 in bar 15); RH returns '
         'to the bass staff in bars 23-24 (cross-staff: bar 23 F4 C4 in treble, bar 24 E4 in treble, '
         'rest in bass) and is wholly in the bass staff from bar 25. '
         'Double bar (thin-thin) between bar 14 and bar 15. Layout: systems of 5/6/6/6/5 bars + closing bar.',
))

# ---------------------------------------------------------------------------------------------
E.append(dict(
    number=12,
    pdf=14, page=13,
    pdf_end=14,
    time='2/4',
    rhythm='8 sixteenths per bar in both hands (two beamed groups of four), closing bar a half note '
           'in each hand',
    bars_up=14,
    bars_down=14,
    up_rh='G3 C3 E3 D3 C3 D3 E3 C3',
    up_lh='G2 C2 E2 D2 C2 D2 E2 C2',
    down_rh='B4 G5 E5 F5 G5 F5 E5 G5',
    down_lh='B3 G4 E4 F4 G4 F4 E4 G4',
    starts_rh=['G3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5',
               'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4', 'B3', 'A3', 'G3', 'F3', 'E3', 'D3', 'C3'],
    starts_lh=['G2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4',
               'B3', 'A3', 'G3', 'F3', 'E3', 'D3', 'C3', 'B2', 'A2', 'G2', 'F2', 'E2', 'D2', 'C2'],
    # Bar 1 opens with a FIFTH (G3 over C3); bars 2-13 all open with a SIXTH (B3 over D3, C4 over E3,
    # ...), so bar 1 is not the shape the rest of the ascending half follows: bars 2-13 are the
    # bar-2 shape moved by step and are written out here because they are not bar 1 moved by step.
    # Bar 14 differs from the bar-2 shape in its last note (E5/E4 instead of B4/B3).
    # Bar 28 differs from bar 15 moved by step: fifth instead of sixth at the start (C3 G3, not
    # C3 A3) and last note F3 instead of G3.
    irregular={
        2: {'rh': 'B3 D3 F3 E3 D3 E3 F3 D3', 'lh': 'B2 D2 F2 E2 D2 E2 F2 D2'},
        3: {'rh': 'C4 E3 G3 F3 E3 F3 G3 E3', 'lh': 'C3 E2 G2 F2 E2 F2 G2 E2'},
        4: {'rh': 'D4 F3 A3 G3 F3 G3 A3 F3', 'lh': 'D3 F2 A2 G2 F2 G2 A2 F2'},
        5: {'rh': 'E4 G3 B3 A3 G3 A3 B3 G3', 'lh': 'E3 G2 B2 A2 G2 A2 B2 G2'},
        6: {'rh': 'F4 A3 C4 B3 A3 B3 C4 A3', 'lh': 'F3 A2 C3 B2 A2 B2 C3 A2'},
        7: {'rh': 'G4 B3 D4 C4 B3 C4 D4 B3', 'lh': 'G3 B2 D3 C3 B2 C3 D3 B2'},
        8: {'rh': 'A4 C4 E4 D4 C4 D4 E4 C4', 'lh': 'A3 C3 E3 D3 C3 D3 E3 C3'},
        9: {'rh': 'B4 D4 F4 E4 D4 E4 F4 D4', 'lh': 'B3 D3 F3 E3 D3 E3 F3 D3'},
        10: {'rh': 'C5 E4 G4 F4 E4 F4 G4 E4', 'lh': 'C4 E3 G3 F3 E3 F3 G3 E3'},
        11: {'rh': 'D5 F4 A4 G4 F4 G4 A4 F4', 'lh': 'D4 F3 A3 G3 F3 G3 A3 F3'},
        12: {'rh': 'E5 G4 B4 A4 G4 A4 B4 G4', 'lh': 'E4 G3 B3 A3 G3 A3 B3 G3'},
        13: {'rh': 'F5 A4 C5 B4 A4 B4 C5 A4', 'lh': 'F4 A3 C4 B3 A3 B3 C4 A3'},
        14: {'rh': 'G5 B4 D5 C5 B4 C5 D5 E5', 'lh': 'G4 B3 D4 C4 B3 C4 D4 E4'},
        28: {'rh': 'C3 G3 E3 F3 G3 F3 E3 F3', 'lh': 'C2 G2 E2 F2 G2 F2 E2 F2'},
    },
    close_rh='C3', close_lh='C2',
    close_rhythm='half note',
    repeat='end-repeat sign (dots, thin-thick double bar) after bar 28, before the closing bar; '
           'no start-repeat; final thin-thick bar after the closing bar',
    digits=[
        # bar 1 full fingering
        (1, 'RH', 0, 5), (1, 'RH', 1, 1), (1, 'RH', 2, 3), (1, 'RH', 3, 2),
        (1, 'RH', 4, 1), (1, 'RH', 5, 2), (1, 'RH', 6, 3), (1, 'RH', 7, 1),
        (1, 'LH', 0, 1), (1, 'LH', 1, 5), (1, 'LH', 2, 3), (1, 'LH', 3, 4),
        (1, 'LH', 4, 5), (1, 'LH', 5, 4), (1, 'LH', 6, 3), (1, 'LH', 7, 5),
        # bar 2: RH 5 1 3 2 1, LH 1 5 3 4 5
        (2, 'RH', 0, 5), (2, 'RH', 1, 1), (2, 'RH', 2, 3), (2, 'RH', 3, 2), (2, 'RH', 4, 1),
        (2, 'LH', 0, 1), (2, 'LH', 1, 5), (2, 'LH', 2, 3), (2, 'LH', 3, 4), (2, 'LH', 4, 5),
        # bars 3-5: RH 5 1 3, LH 1 5 3
        (3, 'RH', 0, 5), (3, 'RH', 1, 1), (3, 'RH', 2, 3), (3, 'LH', 0, 1), (3, 'LH', 1, 5), (3, 'LH', 2, 3),
        (4, 'RH', 0, 5), (4, 'RH', 1, 1), (4, 'RH', 2, 3), (4, 'LH', 0, 1), (4, 'LH', 1, 5), (4, 'LH', 2, 3),
        (5, 'RH', 0, 5), (5, 'RH', 1, 1), (5, 'RH', 2, 3), (5, 'LH', 0, 1), (5, 'LH', 1, 5), (5, 'LH', 2, 3),
        # bars 6-14: RH 5 1, LH 1 5
        (6, 'RH', 0, 5), (6, 'RH', 1, 1), (6, 'LH', 0, 1), (6, 'LH', 1, 5),
        (7, 'RH', 0, 5), (7, 'RH', 1, 1), (7, 'LH', 0, 1), (7, 'LH', 1, 5),
        (8, 'RH', 0, 5), (8, 'RH', 1, 1), (8, 'LH', 0, 1), (8, 'LH', 1, 5),
        (9, 'RH', 0, 5), (9, 'RH', 1, 1), (9, 'LH', 0, 1), (9, 'LH', 1, 5),
        (10, 'RH', 0, 5), (10, 'RH', 1, 1), (10, 'LH', 0, 1), (10, 'LH', 1, 5),
        (11, 'RH', 0, 5), (11, 'RH', 1, 1), (11, 'LH', 0, 1), (11, 'LH', 1, 5),
        (12, 'RH', 0, 5), (12, 'RH', 1, 1), (12, 'LH', 0, 1), (12, 'LH', 1, 5),
        (13, 'RH', 0, 5), (13, 'RH', 1, 1), (13, 'LH', 0, 1), (13, 'LH', 1, 5),
        (14, 'RH', 0, 5), (14, 'RH', 1, 1), (14, 'LH', 0, 1), (14, 'LH', 1, 5),
        # bar 15 full fingering
        (15, 'RH', 0, 1), (15, 'RH', 1, 5), (15, 'RH', 2, 3), (15, 'RH', 3, 4),
        (15, 'RH', 4, 5), (15, 'RH', 5, 4), (15, 'RH', 6, 3), (15, 'RH', 7, 5),
        (15, 'LH', 0, 5), (15, 'LH', 1, 1), (15, 'LH', 2, 3), (15, 'LH', 3, 2),
        (15, 'LH', 4, 1), (15, 'LH', 5, 2), (15, 'LH', 6, 3), (15, 'LH', 7, 1),
        # bars 16-17: RH 1 5 3, LH 5 1 3
        (16, 'RH', 0, 1), (16, 'RH', 1, 5), (16, 'RH', 2, 3), (16, 'LH', 0, 5), (16, 'LH', 1, 1), (16, 'LH', 2, 3),
        (17, 'RH', 0, 1), (17, 'RH', 1, 5), (17, 'RH', 2, 3), (17, 'LH', 0, 5), (17, 'LH', 1, 1), (17, 'LH', 2, 3),
        # bars 18-19: RH 1 5, LH 5 1 3
        (18, 'RH', 0, 1), (18, 'RH', 1, 5), (18, 'LH', 0, 5), (18, 'LH', 1, 1), (18, 'LH', 2, 3),
        (19, 'RH', 0, 1), (19, 'RH', 1, 5), (19, 'LH', 0, 5), (19, 'LH', 1, 1), (19, 'LH', 2, 3),
        # bar 20: RH 1 5, LH 5 1
        (20, 'RH', 0, 1), (20, 'RH', 1, 5), (20, 'LH', 0, 5), (20, 'LH', 1, 1),
        # bar 21: RH 1 5, LH 5 1 3
        (21, 'RH', 0, 1), (21, 'RH', 1, 5), (21, 'LH', 0, 5), (21, 'LH', 1, 1), (21, 'LH', 2, 3),
        # bars 22-28: RH 1 5, LH 5 1
        (22, 'RH', 0, 1), (22, 'RH', 1, 5), (22, 'LH', 0, 5), (22, 'LH', 1, 1),
        (23, 'RH', 0, 1), (23, 'RH', 1, 5), (23, 'LH', 0, 5), (23, 'LH', 1, 1),
        (24, 'RH', 0, 1), (24, 'RH', 1, 5), (24, 'LH', 0, 5), (24, 'LH', 1, 1),
        (25, 'RH', 0, 1), (25, 'RH', 1, 5), (25, 'LH', 0, 5), (25, 'LH', 1, 1),
        (26, 'RH', 0, 1), (26, 'RH', 1, 5), (26, 'LH', 0, 5), (26, 'LH', 1, 1),
        (27, 'RH', 0, 1), (27, 'RH', 1, 5), (27, 'LH', 0, 5), (27, 'LH', 1, 1),
        (28, 'RH', 0, 1), (28, 'RH', 1, 5), (28, 'LH', 0, 5), (28, 'LH', 1, 1),
    ],
    uncertain=[
        'bar 1 vs bars 2-13: bar 1 opens G3-C3 (a fifth) where bars 2-13 open with a sixth; checked at '
        '600 dpi x2.5 against the staff lines in both hands (RH G3 in the space below the bass top '
        'line, LH G2 on the bottom line; bar 2 RH B3 in the space above the top line, LH B2 on the '
        'second line from the bottom; re-checked at 600 dpi x1.6) -- as printed, not a misreading',
        'bar 14 last note E5 (RH) / E4 (LH, on the second ledger line above the bass staff) instead of '
        'the B4/B3 the pattern gives; checked at 600 dpi x1.8',
        'bar 28 RH C3 G3 E3 F3 G3 F3 E3 F3 / LH C2 G2 E2 F2 G2 F2 E2 F2: second note a fifth (not a '
        'sixth) above the first and last note F (not G); checked at 600 dpi x2.2',
        'bars 7-11 and 18-23 RH: the 5 (bars 7-11) or 1 (bars 18-23) on note 0 and the other digit on '
        'note 1 are printed below the RH notes in/under the treble staff; in bars 18-23 the 5 sits '
        'low, just right of note 0, level with it, but horizontally under note 1 (the upper note) -- '
        'attributed to note 1',
        'bar 5 RH: an ink blob on the stem of note 1 (G3), not a digit or sign',
        'bar 20 LH: only 5 1 printed (no 3 on note 2), while bars 18, 19 and 21 have 5 1 3; '
        're-checked at 600 dpi -- recorded as printed',
    ],
    note='No accidentals. Heading: "Extension of 1-5, and exercise for 3-4-5." No dynamics, no 8va, no text '
         'instructions, no footnote marks. Both hands one octave apart throughout. RH in the bass '
         'staff for bars 1-5; bar 6 cross-staff (F4 in treble, rest in bass); treble from bar 7. '
         'Descending half: LH starts on ledger lines above the bass staff; RH back in the bass staff '
         'from bar 25 (bar 24 cross-staff: G3 in bass, rest in treble). Double bar between bars 14 and 15. '
         'Layout: systems of 5/6/6/6/5 bars + closing bar.',
))

# ---------------------------------------------------------------------------------------------
E.append(dict(
    number=13,
    pdf=15, page=14,
    pdf_end=15,
    time='2/4',
    rhythm='8 sixteenths per bar in both hands (two beamed groups of four), closing bar a half note '
           'in each hand',
    bars_up=14,
    bars_down=14,
    up_rh='E3 C3 F3 D3 G3 E3 F3 G3',
    up_lh='E2 C2 F2 D2 G2 E2 F2 G2',
    down_rh='E5 G5 D5 F5 E5 C5 D5 E5',
    down_lh='E4 G4 D4 F4 E4 C4 D4 E4',
    starts_rh=['E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5',
               'E5', 'D5', 'C5', 'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4', 'B3', 'A3', 'G3', 'F3'],
    starts_lh=['E2', 'F2', 'G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4',
               'E4', 'D4', 'C4', 'B3', 'A3', 'G3', 'F3', 'E3', 'D3', 'C3', 'B2', 'A2', 'G2', 'F2'],
    irregular={},
    close_rh='C3', close_lh='C2',
    close_rhythm='half note',
    repeat='end-repeat sign (dots, thin-thick double bar) after bar 28, before the closing bar; '
           'no start-repeat; final thin-thick bar after the closing bar',
    digits=[
        # bars 1-2 full fingering
        (1, 'RH', 0, 3), (1, 'RH', 1, 1), (1, 'RH', 2, 4), (1, 'RH', 3, 2),
        (1, 'RH', 4, 5), (1, 'RH', 5, 3), (1, 'RH', 6, 4), (1, 'RH', 7, 5),
        (1, 'LH', 0, 3), (1, 'LH', 1, 5), (1, 'LH', 2, 2), (1, 'LH', 3, 4),
        (1, 'LH', 4, 1), (1, 'LH', 5, 3), (1, 'LH', 6, 2), (1, 'LH', 7, 1),
        (2, 'RH', 0, 3), (2, 'RH', 1, 1), (2, 'RH', 2, 4), (2, 'RH', 3, 2),
        (2, 'RH', 4, 5), (2, 'RH', 5, 3), (2, 'RH', 6, 4), (2, 'RH', 7, 5),
        (2, 'LH', 0, 3), (2, 'LH', 1, 5), (2, 'LH', 2, 2), (2, 'LH', 3, 4),
        (2, 'LH', 4, 1), (2, 'LH', 5, 3), (2, 'LH', 6, 2), (2, 'LH', 7, 1),
        # bar 3: RH 3 1 4 2 5, LH 3 5 2 4 1
        (3, 'RH', 0, 3), (3, 'RH', 1, 1), (3, 'RH', 2, 4), (3, 'RH', 3, 2), (3, 'RH', 4, 5),
        (3, 'LH', 0, 3), (3, 'LH', 1, 5), (3, 'LH', 2, 2), (3, 'LH', 3, 4), (3, 'LH', 4, 1),
        # bars 4-14: RH 3 1 (bar 6: 3 4 as printed), LH 3 5
        (4, 'RH', 0, 3), (4, 'RH', 1, 1), (4, 'LH', 0, 3), (4, 'LH', 1, 5),
        (5, 'RH', 0, 3), (5, 'RH', 1, 1), (5, 'LH', 0, 3), (5, 'LH', 1, 5),
        (6, 'RH', 0, 3), (6, 'RH', 1, 4), (6, 'LH', 0, 3), (6, 'LH', 1, 5),
        (7, 'RH', 0, 3), (7, 'RH', 1, 1), (7, 'LH', 0, 3), (7, 'LH', 1, 5),
        (8, 'RH', 0, 3), (8, 'RH', 1, 1), (8, 'LH', 0, 3), (8, 'LH', 1, 5),
        (9, 'RH', 0, 3), (9, 'RH', 1, 1), (9, 'LH', 0, 3), (9, 'LH', 1, 5),
        (10, 'RH', 0, 3), (10, 'RH', 1, 1), (10, 'LH', 0, 3), (10, 'LH', 1, 5),
        (11, 'RH', 0, 3), (11, 'RH', 1, 1), (11, 'LH', 0, 3), (11, 'LH', 1, 5),
        (12, 'RH', 0, 3), (12, 'RH', 1, 1), (12, 'LH', 0, 3), (12, 'LH', 1, 5),
        (13, 'RH', 0, 3), (13, 'RH', 1, 1), (13, 'LH', 0, 3), (13, 'LH', 1, 5),
        (14, 'RH', 0, 3), (14, 'RH', 1, 1), (14, 'LH', 0, 3), (14, 'LH', 1, 5),
        # bars 15-16 full fingering
        (15, 'RH', 0, 3), (15, 'RH', 1, 5), (15, 'RH', 2, 2), (15, 'RH', 3, 4),
        (15, 'RH', 4, 3), (15, 'RH', 5, 1), (15, 'RH', 6, 3), (15, 'RH', 7, 4),
        (15, 'LH', 0, 3), (15, 'LH', 1, 1), (15, 'LH', 2, 4), (15, 'LH', 3, 2),
        (15, 'LH', 4, 3), (15, 'LH', 5, 5), (15, 'LH', 6, 3), (15, 'LH', 7, 2),
        (16, 'RH', 0, 3), (16, 'RH', 1, 5), (16, 'RH', 2, 2), (16, 'RH', 3, 4),
        (16, 'RH', 4, 3), (16, 'RH', 5, 1), (16, 'RH', 6, 3), (16, 'RH', 7, 4),
        (16, 'LH', 0, 3), (16, 'LH', 1, 1), (16, 'LH', 2, 4), (16, 'LH', 3, 2),
        (16, 'LH', 4, 3), (16, 'LH', 5, 5), (16, 'LH', 6, 3), (16, 'LH', 7, 2),
        # bars 17-19: RH 3 5 ... 1 3 4, LH 3 1 ... 5 3 2
        (17, 'RH', 0, 3), (17, 'RH', 1, 5), (17, 'RH', 5, 1), (17, 'RH', 6, 3), (17, 'RH', 7, 4),
        (17, 'LH', 0, 3), (17, 'LH', 1, 1), (17, 'LH', 5, 5), (17, 'LH', 6, 3), (17, 'LH', 7, 2),
        (18, 'RH', 0, 3), (18, 'RH', 1, 5), (18, 'RH', 5, 1), (18, 'RH', 6, 3), (18, 'RH', 7, 4),
        (18, 'LH', 0, 3), (18, 'LH', 1, 1), (18, 'LH', 5, 5), (18, 'LH', 6, 3), (18, 'LH', 7, 2),
        (19, 'RH', 0, 3), (19, 'RH', 1, 5), (19, 'RH', 5, 1), (19, 'RH', 6, 3), (19, 'RH', 7, 4),
        (19, 'LH', 0, 3), (19, 'LH', 1, 1), (19, 'LH', 5, 5), (19, 'LH', 6, 3), (19, 'LH', 7, 2),
        # bars 20-28: RH 1 3 4 on notes 5-7, LH 5 3 2 on notes 5-7
        (20, 'RH', 5, 1), (20, 'RH', 6, 3), (20, 'RH', 7, 4), (20, 'LH', 5, 5), (20, 'LH', 6, 3), (20, 'LH', 7, 2),
        (21, 'RH', 5, 1), (21, 'RH', 6, 3), (21, 'RH', 7, 4), (21, 'LH', 5, 5), (21, 'LH', 6, 3), (21, 'LH', 7, 2),
        (22, 'RH', 5, 1), (22, 'RH', 6, 3), (22, 'RH', 7, 4), (22, 'LH', 5, 5), (22, 'LH', 6, 3), (22, 'LH', 7, 2),
        (23, 'RH', 5, 1), (23, 'RH', 6, 3), (23, 'RH', 7, 4), (23, 'LH', 5, 5), (23, 'LH', 6, 3), (23, 'LH', 7, 2),
        (24, 'RH', 5, 1), (24, 'RH', 6, 3), (24, 'RH', 7, 4), (24, 'LH', 5, 5), (24, 'LH', 6, 3), (24, 'LH', 7, 2),
        (25, 'RH', 5, 1), (25, 'RH', 6, 3), (25, 'RH', 7, 4), (25, 'LH', 5, 5), (25, 'LH', 6, 3), (25, 'LH', 7, 2),
        (26, 'RH', 5, 1), (26, 'RH', 6, 3), (26, 'RH', 7, 4), (26, 'LH', 5, 5), (26, 'LH', 6, 3), (26, 'LH', 7, 2),
        (27, 'RH', 5, 1), (27, 'RH', 6, 3), (27, 'RH', 7, 4), (27, 'LH', 5, 5), (27, 'LH', 6, 3), (27, 'LH', 7, 2),
        (28, 'RH', 5, 1), (28, 'RH', 6, 3), (28, 'RH', 7, 4), (28, 'LH', 5, 5), (28, 'LH', 6, 3), (28, 'LH', 7, 2),
    ],
    uncertain=[
        'bar 6 RH idx 1 (A3): digit printed on the top treble line, read 4 at 1200 dpi (a diagonal '
        'from the top of the stem down-left to the staff line and a small closed counter are '
        'visible, which a 1 in this font does not have); every other bar 4-14 has 3 1 here, so this '
        'may be a 1 damaged/merged with the staff line -- recorded as printed (4)',
        'bars 7-11 RH: digits 3 and 1 printed below the notes (inside/under the treble staff), not '
        'above; attributed to notes 0 and 1 by horizontal position',
        'bars 18-19 RH: the 3 on note 0 is printed below the treble staff and crossed by/touching the '
        'bottom line (bar 18); the 5 sits just below note 1; read 3 and 5 at 600 dpi',
    ],
    note='No accidentals. Heading: only "(3-4-5)" printed above the first treble staff (no sentence, unlike Nos. 11/12). No dynamics, no '
         '8va, no footnote marks. Both hands one octave apart throughout. RH in the bass staff for '
         'bars 1-5; bar 6 cross-staff (C4 A3 D4 B3 in bass, E4 C4 D4 E4 in treble); treble from bar 7. '
         'Descending half: LH starts on ledger lines above the bass staff; bar 24 cross-staff for RH '
         '(C4 E4 B3 D4 C4 in treble, A3 B3 C4 in bass); RH in the bass staff from bar 25. Double bar '
         'between bars 14 and 15. Layout: systems of 5/6/6/6/5 bars + closing bar.',
))

# ---------------------------------------------------------------------------------------------
E.append(dict(
    number=14,
    pdf=16, page=15,
    pdf_end=16,
    time='2/4',
    rhythm='8 sixteenths per bar in both hands (two beamed groups of four), closing bar a half note '
           'in each hand',
    bars_up=14,
    bars_down=14,
    up_rh='C3 D3 F3 E3 F3 E3 G3 F3',
    up_lh='C2 D2 F2 E2 F2 E2 G2 F2',
    down_rh='G5 F5 D5 E5 D5 E5 C5 D5',
    down_lh='G4 F4 D4 E4 D4 E4 C4 D4',
    starts_rh=['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4',
               'G5', 'F5', 'E5', 'D5', 'C5', 'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4', 'B3', 'A3'],
    starts_lh=['C2', 'D2', 'E2', 'F2', 'G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3',
               'G4', 'F4', 'E4', 'D4', 'C4', 'B3', 'A3', 'G3', 'F3', 'E3', 'D3', 'C3', 'B2', 'A2'],
    irregular={},
    close_rh='C3', close_lh='C2',
    close_rhythm='half note',
    repeat='end-repeat sign (dots, thin-thick double bar) after bar 28, before the closing bar; '
           'no start-repeat; final thin-thick bar after the closing bar',
    digits=[
        # bars 1-2 full fingering
        (1, 'RH', 0, 1), (1, 'RH', 1, 2), (1, 'RH', 2, 4), (1, 'RH', 3, 3),
        (1, 'RH', 4, 4), (1, 'RH', 5, 3), (1, 'RH', 6, 5), (1, 'RH', 7, 4),
        (1, 'LH', 0, 5), (1, 'LH', 1, 4), (1, 'LH', 2, 2), (1, 'LH', 3, 3),
        (1, 'LH', 4, 2), (1, 'LH', 5, 3), (1, 'LH', 6, 1), (1, 'LH', 7, 3),
        (2, 'RH', 0, 1), (2, 'RH', 1, 2), (2, 'RH', 2, 4), (2, 'RH', 3, 3),
        (2, 'RH', 4, 4), (2, 'RH', 5, 3), (2, 'RH', 6, 5), (2, 'RH', 7, 4),
        (2, 'LH', 0, 5), (2, 'LH', 1, 4), (2, 'LH', 2, 2), (2, 'LH', 3, 3),
        (2, 'LH', 4, 2), (2, 'LH', 5, 3), (2, 'LH', 6, 1), (2, 'LH', 7, 3),
        # bar 3: RH 1 2 4 3 ... 5 4, LH 5 4 2 ... 1 3
        (3, 'RH', 0, 1), (3, 'RH', 1, 2), (3, 'RH', 2, 4), (3, 'RH', 3, 3), (3, 'RH', 6, 5), (3, 'RH', 7, 4),
        (3, 'LH', 0, 5), (3, 'LH', 1, 4), (3, 'LH', 2, 2), (3, 'LH', 6, 1), (3, 'LH', 7, 3),
        # bars 4-13: RH 1 ... 5 4, LH 5 ... 1 3
        (4, 'RH', 0, 1), (4, 'RH', 6, 5), (4, 'RH', 7, 4), (4, 'LH', 0, 5), (4, 'LH', 6, 1), (4, 'LH', 7, 3),
        (5, 'RH', 0, 1), (5, 'RH', 6, 5), (5, 'RH', 7, 4), (5, 'LH', 0, 5), (5, 'LH', 6, 1), (5, 'LH', 7, 3),
        (6, 'RH', 0, 1), (6, 'RH', 6, 5), (6, 'RH', 7, 4), (6, 'LH', 0, 5), (6, 'LH', 6, 1), (6, 'LH', 7, 3),
        (7, 'RH', 0, 1), (7, 'RH', 6, 5), (7, 'RH', 7, 4), (7, 'LH', 0, 5), (7, 'LH', 6, 1), (7, 'LH', 7, 3),
        (8, 'RH', 0, 1), (8, 'RH', 6, 5), (8, 'RH', 7, 4), (8, 'LH', 0, 5), (8, 'LH', 6, 1), (8, 'LH', 7, 3),
        (9, 'RH', 0, 1), (9, 'RH', 6, 5), (9, 'RH', 7, 4), (9, 'LH', 0, 5), (9, 'LH', 6, 1), (9, 'LH', 7, 3),
        (10, 'RH', 0, 1), (10, 'RH', 6, 5), (10, 'RH', 7, 4), (10, 'LH', 0, 5), (10, 'LH', 6, 1), (10, 'LH', 7, 3),
        (11, 'RH', 0, 1), (11, 'RH', 6, 5), (11, 'RH', 7, 4), (11, 'LH', 0, 5), (11, 'LH', 6, 1), (11, 'LH', 7, 3),
        (12, 'RH', 0, 1), (12, 'RH', 6, 5), (12, 'RH', 7, 4), (12, 'LH', 0, 5), (12, 'LH', 6, 1), (12, 'LH', 7, 3),
        (13, 'RH', 0, 1), (13, 'RH', 6, 5), (13, 'RH', 7, 4), (13, 'LH', 0, 5), (13, 'LH', 6, 1), (13, 'LH', 7, 3),
        # bar 14: RH 1 ... 5 3 (not 5 4), LH 5 ... 1 3
        (14, 'RH', 0, 1), (14, 'RH', 6, 5), (14, 'RH', 7, 3), (14, 'LH', 0, 5), (14, 'LH', 6, 1), (14, 'LH', 7, 3),
        # bar 15 full fingering
        (15, 'RH', 0, 5), (15, 'RH', 1, 4), (15, 'RH', 2, 2), (15, 'RH', 3, 3),
        (15, 'RH', 4, 2), (15, 'RH', 5, 3), (15, 'RH', 6, 1), (15, 'RH', 7, 3),
        (15, 'LH', 0, 1), (15, 'LH', 1, 2), (15, 'LH', 2, 4), (15, 'LH', 3, 3),
        (15, 'LH', 4, 4), (15, 'LH', 5, 3), (15, 'LH', 6, 5), (15, 'LH', 7, 4),
        # bar 16: RH 5 4 2 ... 1 3, LH 1 2 4 ... 5 4
        (16, 'RH', 0, 5), (16, 'RH', 1, 4), (16, 'RH', 2, 2), (16, 'RH', 6, 1), (16, 'RH', 7, 3),
        (16, 'LH', 0, 1), (16, 'LH', 1, 2), (16, 'LH', 2, 4), (16, 'LH', 6, 5), (16, 'LH', 7, 4),
        # bars 17-27: RH 5 ... 1 3, LH 1 ... 5 4
        (17, 'RH', 0, 5), (17, 'RH', 6, 1), (17, 'RH', 7, 3), (17, 'LH', 0, 1), (17, 'LH', 6, 5), (17, 'LH', 7, 4),
        (18, 'RH', 0, 5), (18, 'RH', 6, 1), (18, 'RH', 7, 3), (18, 'LH', 0, 1), (18, 'LH', 6, 5), (18, 'LH', 7, 4),
        (19, 'RH', 0, 5), (19, 'RH', 6, 1), (19, 'RH', 7, 3), (19, 'LH', 0, 1), (19, 'LH', 6, 5), (19, 'LH', 7, 4),
        (20, 'RH', 0, 5), (20, 'RH', 6, 1), (20, 'RH', 7, 3), (20, 'LH', 0, 1), (20, 'LH', 6, 5), (20, 'LH', 7, 4),
        (21, 'RH', 0, 5), (21, 'RH', 6, 1), (21, 'RH', 7, 3), (21, 'LH', 0, 1), (21, 'LH', 6, 5), (21, 'LH', 7, 4),
        (22, 'RH', 0, 5), (22, 'RH', 6, 1), (22, 'RH', 7, 3), (22, 'LH', 0, 1), (22, 'LH', 6, 5), (22, 'LH', 7, 4),
        (23, 'RH', 0, 5), (23, 'RH', 6, 1), (23, 'RH', 7, 3), (23, 'LH', 0, 1), (23, 'LH', 6, 5), (23, 'LH', 7, 4),
        (24, 'RH', 0, 5), (24, 'RH', 6, 1), (24, 'RH', 7, 3), (24, 'LH', 0, 1), (24, 'LH', 6, 5), (24, 'LH', 7, 4),
        (25, 'RH', 0, 5), (25, 'RH', 6, 1), (25, 'RH', 7, 3), (25, 'LH', 0, 1), (25, 'LH', 6, 5), (25, 'LH', 7, 4),
        (26, 'RH', 0, 5), (26, 'RH', 6, 1), (26, 'RH', 7, 3), (26, 'LH', 0, 1), (26, 'LH', 6, 5), (26, 'LH', 7, 4),
        (27, 'RH', 0, 5), (27, 'RH', 6, 1), (27, 'RH', 7, 3), (27, 'LH', 0, 1), (27, 'LH', 6, 5), (27, 'LH', 7, 4),
        # bar 28: RH 5 ... 1 3, LH 1 ... 5 3 (not 5 4)
        (28, 'RH', 0, 5), (28, 'RH', 6, 1), (28, 'RH', 7, 3), (28, 'LH', 0, 1), (28, 'LH', 6, 5), (28, 'LH', 7, 3),
    ],
    uncertain=[
        'bar 14 RH: last digit is 3 (not the 4 of bars 1-13) on E5, the bar before the double bar; '
        'clear at 600 dpi x1.8. Notes of bar 14 are regular (B4 C5 E5 D5 E5 D5 F5 E5)',
        'bar 28 LH: last digit is 3 (not the 4 of bars 16-27) on E2; clear at 600 dpi. Notes regular',
        'bars 8-11 and 17-23 RH: digits printed below the notes in/under the treble staff; attributed '
        'by horizontal position (1 on note 0, 5 4 on notes 6-7 ascending; 5 on note 0, 1 3 on '
        'notes 6-7 descending)',
    ],
    note='No accidentals. Heading: "(3-4) Another preparation for the trill, for the 3rd and 4th fingers." No '
         'dynamics, no 8va, no footnote marks. Both hands one octave apart throughout. RH in the bass '
         'staff for bars 1-6 (bars 5-6 on ledger lines above it); bar 7 cross-staff (B3 C4 in bass, '
         'rest in treble); treble from bar 8. Descending half: LH starts on ledger lines above the '
         'bass staff; bar 24 cross-staff for RH (E4 D4 B3 C4 B3 C4 in treble, A3 B3 in bass); RH in '
         'the bass staff from bar 25. Double bar between bars 14 and 15. The fingering changes at the '
         'turn: bar 14 ends 5 3 in RH, bar 28 ends 5 3 in LH (see uncertain). Layout: systems of '
         '5/6/6/6/5 bars + closing bar.',
))

# ---------------------------------------------------------------------------------------------
E.append(dict(
    number=15,
    pdf=17, page=16,
    pdf_end=17,
    time='2/4',
    rhythm='8 sixteenths per bar in both hands (two beamed groups of four), closing bar a half note '
           'in each hand',
    bars_up=14,
    bars_down=14,
    up_rh='C3 E3 D3 F3 E3 G3 F3 A3',
    up_lh='C2 E2 D2 F2 E2 G2 F2 A2',
    down_rh='G5 E5 F5 D5 E5 C5 D5 B4',
    down_lh='G4 E4 F4 D4 E4 C4 D4 B3',
    starts_rh=['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4',
               'G5', 'F5', 'E5', 'D5', 'C5', 'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4', 'B3', 'A3'],
    starts_lh=['C2', 'D2', 'E2', 'F2', 'G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3',
               'G4', 'F4', 'E4', 'D4', 'C4', 'B3', 'A3', 'G3', 'F3', 'E3', 'D3', 'C3', 'B2', 'A2'],
    # Bar 14: last note F (repeats note 5) instead of the G the pattern gives; bar 28 mirrors it:
    # last note D (repeats note 5) instead of C. Both hands. Fingering changes with them.
    irregular={
        14: {'rh': 'B4 D5 C5 E5 D5 F5 E5 F5', 'lh': 'B3 D4 C4 E4 D4 F4 E4 F4'},
        28: {'rh': 'A3 F3 G3 E3 F3 D3 E3 D3', 'lh': 'A2 F2 G2 E2 F2 D2 E2 D2'},
    },
    close_rh='C3', close_lh='C2',
    close_rhythm='half note',
    repeat='end-repeat sign (dots, thin-thick double bar) after bar 28, before the closing bar; '
           'no start-repeat; final thin-thick bar after the closing bar',
    digits=[
        # bars 1-2 full fingering
        (1, 'RH', 0, 1), (1, 'RH', 1, 2), (1, 'RH', 2, 1), (1, 'RH', 3, 3),
        (1, 'RH', 4, 2), (1, 'RH', 5, 4), (1, 'RH', 6, 3), (1, 'RH', 7, 5),
        (1, 'LH', 0, 5), (1, 'LH', 1, 3), (1, 'LH', 2, 4), (1, 'LH', 3, 2),
        (1, 'LH', 4, 3), (1, 'LH', 5, 1), (1, 'LH', 6, 2), (1, 'LH', 7, 1),
        (2, 'RH', 0, 1), (2, 'RH', 1, 2), (2, 'RH', 2, 1), (2, 'RH', 3, 3),
        (2, 'RH', 4, 2), (2, 'RH', 5, 4), (2, 'RH', 6, 3), (2, 'RH', 7, 5),
        (2, 'LH', 0, 5), (2, 'LH', 1, 3), (2, 'LH', 2, 4), (2, 'LH', 3, 2),
        (2, 'LH', 4, 3), (2, 'LH', 5, 1), (2, 'LH', 6, 2), (2, 'LH', 7, 1),
        # bar 3: RH 1 2 1 3 2 4, LH full
        (3, 'RH', 0, 1), (3, 'RH', 1, 2), (3, 'RH', 2, 1), (3, 'RH', 3, 3), (3, 'RH', 4, 2), (3, 'RH', 5, 4),
        (3, 'LH', 0, 5), (3, 'LH', 1, 3), (3, 'LH', 2, 4), (3, 'LH', 3, 2),
        (3, 'LH', 4, 3), (3, 'LH', 5, 1), (3, 'LH', 6, 2), (3, 'LH', 7, 1),
        # bar 4: RH 1 2 1 3 2, LH 5 ... 3 1 2 1
        (4, 'RH', 0, 1), (4, 'RH', 1, 2), (4, 'RH', 2, 1), (4, 'RH', 3, 3), (4, 'RH', 4, 2),
        (4, 'LH', 0, 5), (4, 'LH', 4, 3), (4, 'LH', 5, 1), (4, 'LH', 6, 2), (4, 'LH', 7, 1),
        # bars 5-6: RH 1 2 1 3, LH 5 ... 3 1 2 1
        (5, 'RH', 0, 1), (5, 'RH', 1, 2), (5, 'RH', 2, 1), (5, 'RH', 3, 3),
        (5, 'LH', 0, 5), (5, 'LH', 4, 3), (5, 'LH', 5, 1), (5, 'LH', 6, 2), (5, 'LH', 7, 1),
        (6, 'RH', 0, 1), (6, 'RH', 1, 2), (6, 'RH', 2, 1), (6, 'RH', 3, 3),
        (6, 'LH', 0, 5), (6, 'LH', 4, 3), (6, 'LH', 5, 1), (6, 'LH', 6, 2), (6, 'LH', 7, 1),
        # bars 7-13: RH 1 2 1 3, LH 3 1 2 1 on notes 4-7
        (7, 'RH', 0, 1), (7, 'RH', 1, 2), (7, 'RH', 2, 1), (7, 'RH', 3, 3),
        (7, 'LH', 4, 3), (7, 'LH', 5, 1), (7, 'LH', 6, 2), (7, 'LH', 7, 1),
        (8, 'RH', 0, 1), (8, 'RH', 1, 2), (8, 'RH', 2, 1), (8, 'RH', 3, 3),
        (8, 'LH', 4, 3), (8, 'LH', 5, 1), (8, 'LH', 6, 2), (8, 'LH', 7, 1),
        (9, 'RH', 0, 1), (9, 'RH', 1, 2), (9, 'RH', 2, 1), (9, 'RH', 3, 3),
        (9, 'LH', 4, 3), (9, 'LH', 5, 1), (9, 'LH', 6, 2), (9, 'LH', 7, 1),
        (10, 'RH', 0, 1), (10, 'RH', 1, 2), (10, 'RH', 2, 1), (10, 'RH', 3, 3),
        (10, 'LH', 4, 3), (10, 'LH', 5, 1), (10, 'LH', 6, 2), (10, 'LH', 7, 1),
        (11, 'RH', 0, 1), (11, 'RH', 1, 2), (11, 'RH', 2, 1), (11, 'RH', 3, 3),
        (11, 'LH', 4, 3), (11, 'LH', 5, 1), (11, 'LH', 6, 2), (11, 'LH', 7, 1),
        (12, 'RH', 0, 1), (12, 'RH', 1, 2), (12, 'RH', 2, 1), (12, 'RH', 3, 3),
        (12, 'LH', 4, 3), (12, 'LH', 5, 1), (12, 'LH', 6, 2), (12, 'LH', 7, 1),
        (13, 'RH', 0, 1), (13, 'RH', 1, 2), (13, 'RH', 2, 1), (13, 'RH', 3, 3),
        (13, 'LH', 4, 3), (13, 'LH', 5, 1), (13, 'LH', 6, 2), (13, 'LH', 7, 1),
        # bar 14 (irregular): RH 1 2 1 3 ... 3 4, LH 3 1 3 2 on notes 4-7
        (14, 'RH', 0, 1), (14, 'RH', 1, 2), (14, 'RH', 2, 1), (14, 'RH', 3, 3), (14, 'RH', 6, 3), (14, 'RH', 7, 4),
        (14, 'LH', 4, 3), (14, 'LH', 5, 1), (14, 'LH', 6, 3), (14, 'LH', 7, 2),
        # bars 15-16 full fingering
        (15, 'RH', 0, 5), (15, 'RH', 1, 3), (15, 'RH', 2, 4), (15, 'RH', 3, 2),
        (15, 'RH', 4, 3), (15, 'RH', 5, 1), (15, 'RH', 6, 2), (15, 'RH', 7, 1),
        (15, 'LH', 0, 1), (15, 'LH', 1, 2), (15, 'LH', 2, 1), (15, 'LH', 3, 3),
        (15, 'LH', 4, 2), (15, 'LH', 5, 4), (15, 'LH', 6, 3), (15, 'LH', 7, 5),
        (16, 'RH', 0, 5), (16, 'RH', 1, 3), (16, 'RH', 2, 4), (16, 'RH', 3, 2),
        (16, 'RH', 4, 3), (16, 'RH', 5, 1), (16, 'RH', 6, 2), (16, 'RH', 7, 1),
        (16, 'LH', 0, 1), (16, 'LH', 1, 2), (16, 'LH', 2, 1), (16, 'LH', 3, 3),
        (16, 'LH', 4, 2), (16, 'LH', 5, 4), (16, 'LH', 6, 3), (16, 'LH', 7, 5),
        # bar 17: RH 5 ... 3 1 2 1, LH 1 2 1 3 2
        (17, 'RH', 0, 5), (17, 'RH', 4, 3), (17, 'RH', 5, 1), (17, 'RH', 6, 2), (17, 'RH', 7, 1),
        (17, 'LH', 0, 1), (17, 'LH', 1, 2), (17, 'LH', 2, 1), (17, 'LH', 3, 3), (17, 'LH', 4, 2),
        # bars 18-27: RH 2 1 on notes 6-7, LH 1 2 1 3 on notes 0-3
        (18, 'RH', 6, 2), (18, 'RH', 7, 1), (18, 'LH', 0, 1), (18, 'LH', 1, 2), (18, 'LH', 2, 1), (18, 'LH', 3, 3),
        (19, 'RH', 6, 2), (19, 'RH', 7, 1), (19, 'LH', 0, 1), (19, 'LH', 1, 2), (19, 'LH', 2, 1), (19, 'LH', 3, 3),
        (20, 'RH', 6, 2), (20, 'RH', 7, 1), (20, 'LH', 0, 1), (20, 'LH', 1, 2), (20, 'LH', 2, 1), (20, 'LH', 3, 3),
        (21, 'RH', 6, 2), (21, 'RH', 7, 1), (21, 'LH', 0, 1), (21, 'LH', 1, 2), (21, 'LH', 2, 1), (21, 'LH', 3, 3),
        (22, 'RH', 6, 2), (22, 'RH', 7, 1), (22, 'LH', 0, 1), (22, 'LH', 1, 2), (22, 'LH', 2, 1), (22, 'LH', 3, 3),
        (23, 'RH', 6, 2), (23, 'RH', 7, 1), (23, 'LH', 0, 1), (23, 'LH', 1, 2), (23, 'LH', 2, 1), (23, 'LH', 3, 3),
        (24, 'RH', 6, 2), (24, 'RH', 7, 1), (24, 'LH', 0, 1), (24, 'LH', 1, 2), (24, 'LH', 2, 1), (24, 'LH', 3, 3),
        (25, 'RH', 6, 2), (25, 'RH', 7, 1), (25, 'LH', 0, 1), (25, 'LH', 1, 2), (25, 'LH', 2, 1), (25, 'LH', 3, 3),
        (26, 'RH', 6, 2), (26, 'RH', 7, 1), (26, 'LH', 0, 1), (26, 'LH', 1, 2), (26, 'LH', 2, 1), (26, 'LH', 3, 3),
        (27, 'RH', 6, 2), (27, 'RH', 7, 1), (27, 'LH', 0, 1), (27, 'LH', 1, 2), (27, 'LH', 2, 1), (27, 'LH', 3, 3),
        # bar 28 (irregular): RH 3 1 3 2 on notes 4-7; LH 1 2 1 3 ... 3 4
        (28, 'RH', 4, 3), (28, 'RH', 5, 1), (28, 'RH', 6, 3), (28, 'RH', 7, 2),
        (28, 'LH', 0, 1), (28, 'LH', 1, 2), (28, 'LH', 2, 1), (28, 'LH', 3, 3), (28, 'LH', 6, 3), (28, 'LH', 7, 4),
    ],
    uncertain=[
        'bar 14 notes: RH note 7 sits on the top treble line (F5), the same line as note 5, not above '
        'it (G5); LH note 7 likewise F4, same height as note 5. Checked at 600 dpi x3 (RH) and x1.4 (LH). '
        'Fingering (RH 3 4 on E5 F5, LH 3 1 3 2) fits the changed last note',
        'bar 28 notes: RH A3 F3 G3 E3 F3 D3 E3 D3 (note 7 on the D3 line, same as note 5); LH '
        'A2 F2 G2 E2 F2 D2 E2 D2 (note 7 below the E2 ledger, same as note 5). Checked at 600 dpi x2',
        'bar 28 RH: a small tick/fragment printed above the beam roughly over note 2 (G3), well above '
        'the digit row -- not read as a digit (600 dpi x2); possibly a broken-off piece of type',
        'bars 7-13 and 18-23 RH: digits printed below the RH notes in/under the treble staff; '
        'attributed by horizontal position',
    ],
    note='No accidentals. Heading: "Extension of 1-2, and exercise for all 5 fingers." No dynamics, no 8va, no footnote marks. Both '
         'hands one octave apart throughout. RH in the bass staff for bars 1-5; bar 6 cross-staff (A3 '
         'C4 B3 D4 C4 in bass, E4 D4 F4 in treble); treble from bar 7. Descending half: LH starts on '
         'ledger lines above the bass staff; bar 24 cross-staff for RH (E4 C4 D4 B3 C4 in treble, '
         'A3 B3 G3 in bass); RH in the bass staff from bar 25. Double bar between bars 14 and 15. '
         'Layout: systems of 5/6/6/6/5 bars + closing bar.',
))
