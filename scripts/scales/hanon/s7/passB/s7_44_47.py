X = []

# ---------------------------------------------------------------- No. 44
_d44 = []
for _h in ('RH', 'LH'):
    _d44 += [(1, _h, i, '321'[i % 3]) for i in range(12)]
    _d44 += [(2, _h, 0, '3')]
    _d44 += [(5, _h, i, '321'[i % 3]) for i in range(9)]
    _d44 += [(17, _h, i, '321'[i % 3]) for i in range(12)]
    _d44 += [(38, _h, 0, '2')]

X.append(dict(
    number=44,
    part='',
    pdf=73, page=72,
    time='4/4',
    unit='triplet eighths',
    bars=[
        # PDF 73, system 1 (both hands on the bass staff; treble staff empty)
        {'rh': 'C3*12', 'lh': 'C2*12', 'marks': ''},                                   # 1
        {'rh': 'C3*12', 'lh': 'C2*12', 'marks': ''},                                   # 2
        {'rh': 'C3*12', 'lh': 'C2*12', 'marks': ''},                                   # 3
        {'rh': 'C3*12', 'lh': 'C2*12', 'marks': 'end repeat sign'},                    # 4
        # system 2
        {'rh': 'C3*3 D3*3 E3*3 F3*3', 'lh': 'C2*3 D2*3 E2*3 F2*3',
         'marks': 'start repeat sign; "simile" over RH steps 6-8'},                    # 5
        {'rh': 'G3*3 A3*3 B3*3 C4*3', 'lh': 'G2*3 A2*3 B2*3 C3*3', 'marks': ''},       # 6
        {'rh': 'D4*3 E4*3 F4*3 G4*3', 'lh': 'D3*3 E3*3 F3*3 G3*3',
         'marks': 'RH moves to the treble staff'},                                     # 7
        # system 3
        {'rh': 'A4*3 B4*3 C5*3 D5*3', 'lh': 'A3*3 B3*3 C4*3 D4*3',
         'marks': 'LH steps 9-11 written on the treble staff'},                        # 8
        {'rh': 'E5*3 F5*3 G5*3 A5*3', 'lh': 'E4*3 F4*3 G4*3 A4*3',
         'marks': 'LH on the treble staff'},                                           # 9
        {'rh': 'B5*3 C6*3 D6*3 E6*3', 'lh': 'B4*3 C5*3 D5*3 E5*3',
         'marks': 'LH on the treble staff; RH on ledger lines'},                       # 10
        # system 4
        {'rh': 'F6*3 E6*3 D6*3 C6*3', 'lh': 'F5*3 E5*3 D5*3 C5*3',
         'marks': 'LH on the treble staff'},                                           # 11
        {'rh': 'B5*3 A5*3 G5*3 F5*3', 'lh': 'B4*3 A4*3 G4*3 F4*3',
         'marks': 'LH on the treble staff'},                                           # 12
        {'rh': 'E5*3 D5*3 C5*3 B4*3', 'lh': 'E4*3 D4*3 C4*3 B3*3',
         'marks': 'LH steps 0-8 on the treble staff, steps 9-11 on the bass staff'},   # 13
        # system 5
        {'rh': 'A4*3 G4*3 F4*3 E4*3', 'lh': 'A3*3 G3*3 F3*3 E3*3', 'marks': ''},       # 14
        {'rh': 'D4*3 C4*3 B3*3 A3*3', 'lh': 'D3*3 C3*3 B2*3 A2*3',
         'marks': 'RH steps 6-11 on the bass staff'},                                  # 15
        {'rh': 'G3*3 F3*3 E3*3 D3*3', 'lh': 'G2*3 F2*3 E2*3 D2*3',
         'marks': 'end repeat sign'},                                                  # 16
        # PDF 74, system 1
        {'rh': 'C3*3 E3*3 A3*3 F3*3', 'lh': 'C2*3 E2*3 A2*3 F2*3',
         'marks': 'start repeat sign; "simile" over RH steps 9-11'},                   # 17
        {'rh': 'D3*3 F3*3 B3*3 G3*3', 'lh': 'D2*3 F2*3 B2*3 G2*3', 'marks': ''},       # 18
        {'rh': 'E3*3 G3*3 C4*3 A3*3', 'lh': 'E2*3 G2*3 C3*3 A2*3', 'marks': ''},       # 19
        # system 2
        {'rh': 'F3*3 A3*3 D4*3 B3*3', 'lh': 'F2*3 A2*3 D3*3 B2*3', 'marks': ''},       # 20
        {'rh': 'G3*3 B3*3 E4*3 C4*3', 'lh': 'G2*3 B2*3 E3*3 C3*3',
         'marks': 'RH steps 6-11 on the treble staff'},                                # 21
        {'rh': 'A3*3 C4*3 F4*3 D4*3', 'lh': 'A2*3 C3*3 F3*3 D3*3',
         'marks': 'RH steps 0-5 on the bass staff, 6-11 on the treble staff'},         # 22
        # system 3
        {'rh': 'B3*3 D4*3 G4*3 E4*3', 'lh': 'B2*3 D3*3 G3*3 E3*3',
         'marks': 'RH steps 0-2 on the bass staff, 3-11 on the treble staff'},         # 23
        {'rh': 'C4*3 E4*3 A4*3 F4*3', 'lh': 'C3*3 E3*3 A3*3 F3*3', 'marks': ''},       # 24
        {'rh': 'D4*3 F4*3 B4*3 G4*3', 'lh': 'D3*3 F3*3 B3*3 G3*3', 'marks': ''},       # 25
        {'rh': 'E4*3 G4*3 C5*3 A4*3', 'lh': 'E3*3 G3*3 C4*3 A3*3', 'marks': ''},       # 26
        # system 4
        {'rh': 'F4*3 A4*3 D5*3 B4*3', 'lh': 'F3*3 A3*3 D4*3 B3*3', 'marks': ''},       # 27
        {'rh': 'G4*3 B4*3 E5*3 C5*3', 'lh': 'G3*3 B3*3 E4*3 C4*3',
         'marks': 'LH steps 6-11 on the treble staff'},                                # 28
        {'rh': 'A4*3 C5*3 F5*3 D5*3', 'lh': 'A3*3 C4*3 F4*3 D4*3',
         'marks': 'LH steps 6-11 on the treble staff'},                                # 29
        {'rh': 'B4*3 D5*3 G5*3 E5*3', 'lh': 'B3*3 D4*3 G4*3 E4*3',
         'marks': 'LH on the treble staff'},                                           # 30
        # system 5
        {'rh': 'C5*6 E5*3 C5*3', 'lh': 'C4*6 E4*3 C4*3',
         'marks': 'LH on the treble staff'},                                           # 31
        {'rh': 'G4*6 C5*3 G4*3', 'lh': 'G3*6 C4*3 G3*3', 'marks': ''},                 # 32
        {'rh': 'E4*6 G4*3 E4*3', 'lh': 'E3*6 G3*3 E3*3', 'marks': ''},                 # 33
        {'rh': 'C4*6 E4*3 C4*3', 'lh': 'C3*6 E3*3 C3*3', 'marks': ''},                 # 34
        # system 6 (both hands on the bass staff)
        {'rh': 'G3*6 C4*3 G3*3', 'lh': 'G2*6 C3*3 G2*3', 'marks': ''},                 # 35
        {'rh': 'E3*6 G3*3 E3*3', 'lh': 'E2*6 G2*3 E2*3', 'marks': ''},                 # 36
        {'rh': 'C3*6 G2*6', 'lh': 'C2*6 G1*6', 'marks': 'end repeat sign'},            # 37
        {'rh': 'C2', 'lh': 'C1',
         'marks': 'closing bar: one whole note in each hand (both written on the bass '
                  'staff, ledger lines below); fermata above the RH note and below the '
                  'LH note; final double bar'},                                        # 38
    ],
    digits=_d44,
    uncertain=[
        'bar 20 RH step 3 (first A3 of the group): the notehead has a small white speck '
        '(print flaw); it sits on the top line like its two neighbours, read A3',
    ],
    note='Heading: "The Virtuoso-Pianist. Part III. Virtuoso Exercises, for Obtaining a '
         'Mastery over the Greatest Mechanical Difficulties." Title: "Notes repeated in '
         'groups of three." Text: "Lift the fingers high and with precision, without '
         'raising hand or wrist. As soon as the first four measures are well learned, take '
         'up the rest of the exercise." "C. L. HANON". Tempo: M.M. quarter = 60 to 120. '
         'Time signature C. Each bar of bars 1-37 is twelve eighth notes beamed in threes '
         'with no "3" triplet numeral printed anywhere; read as triplet eighths so that the '
         'bar fills 4/4. Bar 38 is a single whole note in each hand (does not count as '
         'twelve steps). No start repeat sign at bar 1; bars 1-4 end with an end repeat. '
         'Repeat sections: bars 5-16 and bars 17-37. Hands an octave apart throughout (RH '
         'stems up, LH stems down, both on the bass staff at the start). Bars 31-36 keep '
         'the four-group shape x x y x (C-C-E-C etc.); bar 37 breaks it: C3 C3 G2 G2 over '
         'C2 C2 G1 G1. Final bar RH C2 / LH C1, each with digit 2 printed to its left. '
         '"simile" printed in bar 5 (over the 3rd RH group) and bar 17 (over the 4th RH '
         'group); in bar 17 digits are still printed on all four groups.',
))

# ---------------------------------------------------------------- No. 47
_d47 = []
for _h in ('RH', 'LH'):
    _d47 += [(1, _h, i, '4321'[i % 4]) for i in range(9)] + [(1, _h, 12, '4')]
    for _b in range(2, 25):
        _d47 += [(_b, _h, s, '4') for s in (0, 4, 8, 12)]
    _d47 += [(25, _h, 0, '2')]

X.append(dict(
    number=47,
    part='',
    pdf=79, page=78,
    time='4/4',
    unit='sixteenths',
    bars=[
        # system 1 (both hands on the bass staff; treble staff empty)
        {'rh': 'C3*16', 'lh': 'C2*16', 'marks': '"simile" over RH steps 8-12'},       # 1
        {'rh': 'C3*16', 'lh': 'C2*16', 'marks': ''},                                   # 2
        {'rh': 'C3*16', 'lh': 'C2*16', 'marks': ''},                                   # 3
        {'rh': 'C3*16', 'lh': 'C2*16', 'marks': 'end repeat sign'},                    # 4
        # system 2 (both hands on the bass staff)
        {'rh': 'C3*8 D3*8', 'lh': 'C2*8 D2*8', 'marks': 'start repeat sign'},          # 5
        {'rh': 'E3*8 F3*8', 'lh': 'E2*8 F2*8', 'marks': ''},                           # 6
        {'rh': 'G3*8 A3*8', 'lh': 'G2*8 A2*8', 'marks': ''},                           # 7
        {'rh': 'B3*8 C4*8', 'lh': 'B2*8 C3*8', 'marks': ''},                           # 8
        # system 3 (RH on the treble staff)
        {'rh': 'D4*8 E4*8', 'lh': 'D3*8 E3*8', 'marks': ''},                           # 9
        {'rh': 'F4*8 G4*8', 'lh': 'F3*8 G3*8', 'marks': ''},                           # 10
        {'rh': 'A4*8 B4*8', 'lh': 'A3*8 B3*8', 'marks': ''},                           # 11
        {'rh': 'C5*8 D5*8', 'lh': 'C4*8 D4*8', 'marks': 'LH on the treble staff'},     # 12
        # system 4 (both hands on the treble staff; bass staff empty)
        {'rh': 'E5*8 F5*8', 'lh': 'E4*8 F4*8', 'marks': 'LH on the treble staff'},     # 13
        {'rh': 'G5*8 A5*8', 'lh': 'G4*8 A4*8', 'marks': 'LH on the treble staff'},     # 14
        {'rh': 'B5*4 E6*4 D6*4 A5*4', 'lh': 'G4*8 F4*8',
         'marks': 'LH on the treble staff'},                                           # 15
        {'rh': 'G5*4 C6*4 B5*4 F5*4', 'lh': 'E4*8 D4*8',
         'marks': 'LH on the treble staff'},                                           # 16
        # system 5 (RH treble, LH bass)
        {'rh': 'E5*4 A5*4 G5*4 D5*4', 'lh': 'C4*8 B3*8', 'marks': ''},                 # 17
        {'rh': 'C5*4 F5*4 E5*4 B4*4', 'lh': 'A3*8 G3*8', 'marks': ''},                 # 18
        {'rh': 'A4*4 D5*4 C5*4 G4*4', 'lh': 'F3*8 E3*8', 'marks': ''},                 # 19
        {'rh': 'F4*4 B4*4 A4*4 E4*4', 'lh': 'D3*8 C3*8', 'marks': ''},                 # 20
        # system 6
        {'rh': 'D4*4 G4*4 F4*4 C4*4', 'lh': 'B2*8 A2*8', 'marks': ''},                 # 21
        {'rh': 'B3*4 E4*4 D4*4 A3*4', 'lh': 'G2*8 F2*8',
         'marks': 'RH steps 12-15 written on the bass staff (stems up to the treble beam)'},  # 22
        {'rh': 'G3*4 C4*4 B3*4 F3*4', 'lh': 'E2*8 D2*8',
         'marks': 'both hands on the bass staff'},                                     # 23
        {'rh': 'E3*4 A3*4 G3*4 E3*4', 'lh': 'C2*16',
         'marks': 'both hands on the bass staff; end repeat sign'},                    # 24
        {'rh': 'C3', 'lh': 'C2',
         'marks': 'closing bar: one whole note in each hand, both on the bass staff; no '
                  'fermata; final double bar'},                                        # 25
    ],
    digits=_d47,
    uncertain=[
        'bar 5 RH step 7 (last C3 of the first eight): small white speck in the notehead '
        '(print flaw); same line/space as its neighbours, read C3',
        'bar 14 RH steps 8-15 and bar 17 RH steps 4-7: an automatic notehead pass flagged '
        'these as between A5 and B5; row profile at 600 dpi puts the notehead centred on '
        'the first ledger (extends well below it), read A5',
    ],
    note='Title: "Notes repeated in groups of four." Text: "Lift the fingers high and with '
         'precision throughout this exercise, without raising hand or wrist. When the first '
         'line is mastered, and not before, take up the rest of the exercise." Tempo, in '
         'parentheses: (M.M. quarter = 60 to 120). Time signature C; bars 1-24 are sixteen '
         'sixteenths each; bar 25 is one whole note per hand. No start repeat sign at bar 1; '
         'bars 1-4 end with an end repeat. Repeat section bars 5-24. "simile" is printed in '
         'bar 1 but the digit 4 goes on being printed on the first note of every group of '
         'four in both hands through bar 24 (recorded as printed). Digit placement follows '
         'the stems: e.g. in bars 9-11 the RH digits are printed below the RH noteheads and '
         'the LH digits above the LH noteheads; digits are assigned by voice, not position. '
         'Bars 1-14 hands an octave apart, rising by step in pairs of 8. From bar 15 the RH '
         'plays four groups of four: up a 4th, down a 2nd, down a 5th (B5 E6 D6 A5, G5 C6 '
         'B5 F5, ...) '
         'over LH descending by step in eights (G4 F4, E4 D4, C4 B3 ... C2); bar 24 RH ends '
         'E3 A3 G3 E3 (last group E3, not D3), LH C2 throughout. Final bar RH C3 / LH C2, '
         'digit 2 above the RH note and below the LH note. Plate/scan marks with no musical '
         'meaning: bar 22 a thin double diagonal scratch across the RH beams and treble '
         'lines between RH groups 3 and 4, and short breaks in the bass-staff lines of bar '
         '22; a small slanted stroke inside the RH beam of bar 13 between steps 3 and 4; '
         'tiny stray ticks in bar 24 near the last RH digit and on the treble staff.',
))
