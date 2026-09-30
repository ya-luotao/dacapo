# Hanon, The Virtuoso Pianist, Nos. 42 and 43 -- read from the G. Schirmer [1900] scan (IMSLP #91547),
# PDF pages 70-72 (printed pages 69-71). Sounding pitches, middle C = C4.
#
# Accidentals: this edition prints an accidental once per staff position per bar; a later note on the same
# line/space of the same staff in the same bar -- even in the other hand -- is unmarked but inflected
# (e.g. No. 42 'C' bar 2: the LH's E3/F3 after the RH's printed Eb3/F#3 on the bass staff). They are
# resolved here as the carried accidental.

X = []

# ---------------------------------------------------------------- No. 42 (diminished sevenths)

X.append(dict(
    number=42, part='C', pdf=70, page=69, time='2/4', unit='sixteenths',
    bars=[
        {'rh': 'C3 Eb3 F#3 A3 C4 A3 F#3 Eb3', 'lh': 'C2 Eb2 F#2 A2 C3 A2 F#2 Eb2',
         'marks': '"Repeat this measure 4 times."; no start-repeat sign (first bar of the piece); end-repeat sign after it; both hands on the bass staff'},
        {'rh': 'C3 Eb3 F#3 A3 C4 Eb4 F#4 A4', 'lh': 'C2 Eb2 F#2 A2 C3 Eb3 F#3 A3',
         'marks': 'start-repeat sign'},
        {'rh': 'C5 Eb5 F#5 A5 C6 A5 F#5 Eb5', 'lh': 'C4 Eb4 F#4 A4 C5 A4 F#4 Eb4',
         'marks': 'both hands on the treble staff'},
        {'rh': 'C5 A4 F#4 Eb4 C4 A3 F#3 Eb3', 'lh': 'C4 A3 F#3 Eb3 C3 A2 F#2 Eb2',
         'marks': 'end-repeat sign'},
    ],
    digits=[
        (1, 'RH', 0, '1'), (1, 'RH', 1, '2'), (1, 'RH', 2, '3'), (1, 'RH', 3, '4'),
        (1, 'RH', 4, '5'), (1, 'RH', 5, '4'), (1, 'RH', 6, '3'), (1, 'RH', 7, '2'),
        (1, 'LH', 0, '5'), (1, 'LH', 1, '4'), (1, 'LH', 2, '3'), (1, 'LH', 3, '2'), (1, 'LH', 4, '1'),
        (2, 'RH', 0, '1'), (2, 'RH', 1, '2'), (2, 'RH', 2, '3'), (2, 'RH', 3, '4'),
        (2, 'LH', 0, '5'), (2, 'LH', 1, '4'), (2, 'LH', 2, '3'), (2, 'LH', 3, '2'), (2, 'LH', 4, '1'),
        (2, 'LH', 5, '4'),
        (3, 'RH', 0, '1'), (3, 'RH', 4, '5'),
        (3, 'LH', 1, '4'),
        (4, 'RH', 1, '4'), (4, 'RH', 5, '4'),
        (4, 'LH', 0, '1'), (4, 'LH', 4, '1'),
    ],
    uncertain=[],
    note='Heading: "Extension (stretching) of the fingers in chords of the diminished seventh, in arpeggios." '
         '"M.M. quarter = 60 to 120." "Repeat this measure 4 times." over bar 1. This first section alone has '
         'RH 1 2 3 4 printed in bar 2 and the full RH 1 2 3 4 5 4 3 2 in bar 1; bar 3 LH has only the 4 '
         '(no 1 on step 4). Accidentals are printed once per staff position per bar and carry to later notes '
         'on the same line/space of the same staff, even in the other hand; such unmarked notes are written with '
         'the carried accidental in every section of Nos. 42 and 43 (e.g. here bar 2 LH E3 F3 after the RH '
         'Eb3 F#3 -> Eb3 F#3; bar 4 RH A3 F3 E3 after the LH F#3 Eb3 -> F#3 Eb3). '
         'Every bar is 8 sixteenths = 2/4.',
))

X.append(dict(
    number=42, part='D', pdf=70, page=69, time='2/4', unit='sixteenths',
    bars=[
        {'rh': 'D3 F3 Ab3 B3 D4 B3 Ab3 F3', 'lh': 'D2 F2 Ab2 B2 D3 B2 Ab2 F2',
         'marks': '"4 times."; start- and end-repeat signs around this bar; both hands on the bass staff'},
        {'rh': 'D3 F3 Ab3 B3 D4 F4 Ab4 B4', 'lh': 'D2 F2 Ab2 B2 D3 F3 Ab3 B3',
         'marks': 'start-repeat sign'},
        {'rh': 'D5 F5 Ab5 B5 D6 B5 Ab5 F5', 'lh': 'D4 F4 Ab4 B4 D5 B4 Ab4 F4',
         'marks': 'both hands on the treble staff'},
        {'rh': 'D5 B4 Ab4 F4 D4 B3 Ab3 F3', 'lh': 'D4 B3 Ab3 F3 D3 B2 Ab2 F2',
         'marks': 'end-repeat sign'},
    ],
    digits=[
        (1, 'RH', 0, '1'), (1, 'RH', 1, '2'), (1, 'RH', 2, '3'), (1, 'RH', 3, '4'), (1, 'RH', 4, '5'),
        (1, 'LH', 0, '5'), (1, 'LH', 1, '4'), (1, 'LH', 2, '3'), (1, 'LH', 3, '2'), (1, 'LH', 4, '1'),
        (2, 'RH', 0, '1'), (2, 'RH', 4, '1'),
        (2, 'LH', 0, '5'), (2, 'LH', 5, '4'),
        (3, 'RH', 0, '1'), (3, 'RH', 4, '5'),
        (3, 'LH', 1, '4'), (3, 'LH', 4, '1'),
        (4, 'RH', 1, '4'), (4, 'RH', 5, '4'),
        (4, 'LH', 0, '1'), (4, 'LH', 4, '1'),
    ],
    uncertain=[],
    note='Every bar is 8 sixteenths = 2/4.',
))

X.append(dict(
    number=42, part='E', pdf=70, page=69, time='2/4', unit='sixteenths',
    bars=[
        {'rh': 'E3 G3 Bb3 C#4 E4 C#4 Bb3 G3', 'lh': 'E2 G2 Bb2 C#3 E3 C#3 Bb2 G2',
         'marks': '"4 times."; start- and end-repeat signs around this bar; both hands on the bass staff'},
        {'rh': 'E3 G3 Bb3 C#4 E4 G4 Bb4 C#5', 'lh': 'E2 G2 Bb2 C#3 E3 G3 Bb3 C#4',
         'marks': 'start-repeat sign'},
        {'rh': 'E5 G5 Bb5 C#6 E6 C#6 Bb5 G5', 'lh': 'E4 G4 Bb4 C#5 E5 C#5 Bb4 G4',
         'marks': 'both hands on the treble staff'},
        {'rh': 'E5 C#5 Bb4 G4 E4 C#4 Bb3 G3', 'lh': 'E4 C#4 Bb3 G3 E3 C#3 Bb2 G2',
         'marks': 'end-repeat sign'},
    ],
    digits=[
        (1, 'RH', 0, '1'), (1, 'RH', 1, '2'), (1, 'RH', 2, '3'), (1, 'RH', 3, '4'), (1, 'RH', 4, '5'),
        (1, 'LH', 0, '5'), (1, 'LH', 1, '4'), (1, 'LH', 2, '3'), (1, 'LH', 3, '2'), (1, 'LH', 4, '1'),
        (2, 'RH', 0, '1'), (2, 'RH', 4, '1'),
        (2, 'LH', 0, '5'), (2, 'LH', 5, '4'),
        (3, 'RH', 0, '1'), (3, 'RH', 4, '5'),
        (3, 'LH', 1, '4'),
        (4, 'RH', 1, '4'), (4, 'RH', 5, '4'),
        (4, 'LH', 0, '1'), (4, 'LH', 4, '1'),
    ],
    uncertain=[],
    note='Bar 3 LH has only the 4 (no 1 on step 4). Every bar is 8 sixteenths = 2/4.',
))

X.append(dict(
    number=42, part='F', pdf=70, page=69, time='2/4', unit='sixteenths',
    bars=[
        {'rh': 'F3 Ab3 B3 D4 F4 D4 B3 Ab3', 'lh': 'F2 Ab2 B2 D3 F3 D3 B2 Ab2',
         'marks': '"4 times."; start- and end-repeat signs around this bar; both hands on the bass staff'},
        {'rh': 'F3 Ab3 B3 D4 F4 Ab4 B4 D5', 'lh': 'F2 Ab2 B2 D3 F3 Ab3 B3 D4',
         'marks': 'start-repeat sign'},
        {'rh': 'F5 Ab5 B5 D6 F6 D6 B5 Ab5', 'lh': 'F4 Ab4 B4 D5 F5 D5 B4 Ab4',
         'marks': 'both hands on the treble staff'},
        {'rh': 'F5 D5 B4 Ab4 F4 D4 B3 Ab3', 'lh': 'F4 D4 B3 Ab3 F3 D3 B2 Ab2',
         'marks': 'end-repeat sign'},
    ],
    digits=[
        (1, 'RH', 0, '1'), (1, 'RH', 1, '2'), (1, 'RH', 2, '3'), (1, 'RH', 3, '4'), (1, 'RH', 4, '5'),
        (1, 'LH', 0, '5'), (1, 'LH', 1, '4'), (1, 'LH', 2, '3'), (1, 'LH', 3, '2'), (1, 'LH', 4, '1'),
        (2, 'RH', 0, '1'), (2, 'RH', 4, '1'),
        (2, 'LH', 0, '5'), (2, 'LH', 5, '4'),
        (3, 'RH', 0, '1'), (3, 'RH', 4, '5'),
        (3, 'LH', 1, '4'), (3, 'LH', 4, '1'),
        (4, 'RH', 1, '4'), (4, 'RH', 5, '4'),
        (4, 'LH', 0, '1'), (4, 'LH', 4, '1'),
    ],
    uncertain=['bar 4 LH step 0: the digit is a damaged blot in IMSLP 91547; the second copy (IMSLP 00875, '
               'p. 48) prints a clear 1 there'],
    note='Bar 2 LH step 7 (D4) is written on the treble staff. Every bar is 8 sixteenths = 2/4.',
))

X.append(dict(
    number=42, part='G', pdf=70, page=69, time='2/4', unit='sixteenths',
    bars=[
        {'rh': 'G3 Bb3 C#4 E4 G4 E4 C#4 Bb3', 'lh': 'G2 Bb2 C#3 E3 G3 E3 C#3 Bb2',
         'marks': '"4 times."; start- and end-repeat signs around this bar; RH steps 3-5 on the treble staff'},
        {'rh': 'G3 Bb3 C#4 E4 G4 Bb4 C#5 E5', 'lh': 'G2 Bb2 C#3 E3 G3 Bb3 C#4 E4',
         'marks': 'start-repeat sign'},
        {'rh': 'G5 Bb5 C#6 E6 G6 E6 C#6 Bb5', 'lh': 'G4 Bb4 C#5 E5 G5 E5 C#5 Bb4',
         'marks': 'both hands on the treble staff'},
        {'rh': 'G5 E5 C#5 Bb4 G4 E4 C#4 Bb3', 'lh': 'G4 E4 C#4 Bb3 G3 E3 C#3 Bb2',
         'marks': 'end-repeat sign'},
    ],
    digits=[
        (1, 'RH', 0, '1'), (1, 'RH', 1, '2'), (1, 'RH', 2, '3'), (1, 'RH', 3, '4'), (1, 'RH', 4, '5'),
        (1, 'LH', 0, '5'), (1, 'LH', 1, '4'), (1, 'LH', 2, '3'), (1, 'LH', 3, '2'), (1, 'LH', 4, '1'),
        (2, 'RH', 0, '1'), (2, 'RH', 4, '1'),
        (2, 'LH', 0, '5'), (2, 'LH', 5, '4'),
        (3, 'RH', 0, '1'), (3, 'RH', 4, '5'),
        (3, 'LH', 1, '4'), (3, 'LH', 4, '1'),
        (4, 'RH', 1, '4'), (4, 'RH', 5, '4'),
        (4, 'LH', 0, '1'), (4, 'LH', 4, '1'),
    ],
    uncertain=[],
    note='Every bar is 8 sixteenths = 2/4.',
))

X.append(dict(
    number=42, part='A', pdf=70, page=69, time='2/4', unit='sixteenths',
    bars=[
        {'rh': 'A3 C4 Eb4 F#4 A4 F#4 Eb4 C4', 'lh': 'A2 C3 Eb3 F#3 A3 F#3 Eb3 C3',
         'marks': '"4 times."; start- and end-repeat signs around this bar'},
        {'rh': 'A3 C4 Eb4 F#4 A4 C5 Eb5 F#5', 'lh': 'A2 C3 Eb3 F#3 A3 C4 Eb4 F#4',
         'marks': 'start-repeat sign; treble clef on the lower staff at the end of the bar'},
        {'rh': 'A5 C6 Eb6 F#6 A6 F#6 Eb6 C6', 'lh': 'A4 C5 Eb5 F#5 A5 F#5 Eb5 C5',
         'marks': '8va over RH steps 0-7 (written A4 C5 Eb5 F#5 A5 F#5 Eb5 C5); LH on the lower staff in treble clef'},
        {'rh': 'A5 F#5 Eb5 C5 A4 F#4 Eb4 C4', 'lh': 'A4 F#4 Eb4 C4 A3 F#3 Eb3 C3',
         'marks': 'end-repeat sign; lower staff back to bass clef before LH step 4'},
    ],
    digits=[
        (1, 'RH', 0, '1'), (1, 'RH', 1, '2'), (1, 'RH', 2, '3'), (1, 'RH', 3, '4'), (1, 'RH', 4, '5'),
        (1, 'LH', 0, '5'), (1, 'LH', 1, '4'), (1, 'LH', 2, '3'), (1, 'LH', 3, '2'), (1, 'LH', 4, '1'),
        (2, 'RH', 0, '1'), (2, 'RH', 4, '1'),
        (2, 'LH', 0, '5'), (2, 'LH', 5, '4'),
        (3, 'RH', 0, '1'), (3, 'RH', 4, '5'),
        (3, 'LH', 1, '4'),
        (4, 'RH', 1, '4'), (4, 'RH', 5, '4'),
        (4, 'LH', 0, '1'), (4, 'LH', 4, '1'),
    ],
    uncertain=['bar 2 RH: the two 1s are printed beside the noteheads, not above the beam (step 0: just above the '
               'A3 on the bass staff; step 4: just below the A4 inside the treble staff); read as RH digits by '
               'their notes and by the other sections'],
    note='Bar 3 LH has only the 4 (no 1 on step 4). Every bar is 8 sixteenths = 2/4.',
))

X.append(dict(
    number=42, part='B', pdf=71, page=70, time='2/4', unit='sixteenths',
    bars=[
        {'rh': 'B3 D4 F4 Ab4 B4 Ab4 F4 D4', 'lh': 'B2 D3 F3 Ab3 B3 Ab3 F3 D3',
         'marks': '"4 times."; start- and end-repeat signs around this bar; RH on the treble staff, LH on the bass staff'},
        {'rh': 'B3 D4 F4 Ab4 B4 D5 F5 Ab5', 'lh': 'B2 D3 F3 Ab3 B3 D4 F4 Ab4',
         'marks': 'start-repeat sign; treble clef on the lower staff at the end of the bar'},
        {'rh': 'B5 D6 F6 Ab6 B6 Ab6 F6 D6', 'lh': 'B4 D5 F5 Ab5 B5 Ab5 F5 D5',
         'marks': '8va over RH steps 0-7 (written B4 D5 F5 Ab5 B5 Ab5 F5 D5); LH on the lower staff in treble clef'},
        {'rh': 'B5 Ab5 F5 D5 B4 Ab4 F4 D4', 'lh': 'B4 Ab4 F4 D4 B3 Ab3 F3 D3',
         'marks': 'end-repeat sign; first bar of the next system (PDF 71 system 2); lower staff back to bass clef before LH step 4'},
    ],
    digits=[
        (1, 'RH', 0, '1'), (1, 'RH', 1, '2'), (1, 'RH', 2, '3'), (1, 'RH', 3, '4'), (1, 'RH', 4, '5'),
        (1, 'LH', 0, '5'), (1, 'LH', 1, '4'), (1, 'LH', 2, '3'), (1, 'LH', 3, '2'), (1, 'LH', 4, '1'),
        (2, 'RH', 0, '1'), (2, 'RH', 4, '1'),
        (2, 'LH', 0, '5'), (2, 'LH', 5, '4'),
        (3, 'RH', 0, '1'), (3, 'RH', 4, '5'),
        (3, 'LH', 1, '4'), (3, 'LH', 4, '1'),
        (4, 'RH', 1, '4'), (4, 'RH', 5, '4'),
        (4, 'LH', 0, '1'), (4, 'LH', 4, '1'),
    ],
    uncertain=[],
    note='Bars 1-3 on PDF 71 system 1, bar 4 on system 2. Every bar is 8 sixteenths = 2/4.',
))

X.append(dict(
    number=42, part='close', pdf=71, page=70, time='2/4', unit='sixteenths',
    bars=[
        {'rh': 'B4 Ab4 F4 D4 B3 Ab3 F3 D3', 'lh': 'B3 Ab3 F3 D3 B2 Ab2 F2 D2',
         'marks': 'follows the end-repeat of section B; RH steps 4-7 on the bass staff; double bar after it'},
        {'rh': 'C3', 'lh': 'C2',
         'marks': 'one half note in each hand (whole bar); both on the bass staff, C3 stem up, C2 stem down; '
                  'treble staff empty (no rest printed); final bar line'},
    ],
    digits=[
        (1, 'RH', 1, '4'), (1, 'RH', 5, '4'),
        (1, 'LH', 0, '1'), (1, 'LH', 4, '1'),
    ],
    uncertain=['bar 2: which hand takes which half note is not printed; given by stem direction '
               '(stem up C3 = RH, stem down C2 = LH), as in the stretching bars'],
    note='Bar 1 is 8 sixteenths; bar 2 is a half note = 2/4.',
))

# ---------------------------------------------------------------- No. 43 (dominant sevenths)

X.append(dict(
    number=43, part='C', pdf=71, page=70, time='2/4', unit='sixteenths',
    bars=[
        {'rh': 'C3 E3 G3 Bb3 C4 Bb3 G3 E3', 'lh': 'C2 E2 G2 Bb2 C3 Bb2 G2 E2',
         'marks': '"Repeat this measure 4 times."; no start-repeat sign (first bar of the piece); end-repeat sign after it; both hands on the bass staff'},
        {'rh': 'C3 E3 G3 Bb3 C4 E4 G4 Bb4', 'lh': 'C2 E2 G2 Bb2 C3 E3 G3 Bb3',
         'marks': 'start-repeat sign'},
        {'rh': 'C5 E5 G5 Bb5 C6 Bb5 G5 E5', 'lh': 'C4 E4 G4 Bb4 C5 Bb4 G4 E4',
         'marks': 'both hands on the treble staff'},
        {'rh': 'C5 Bb4 G4 E4 C4 Bb3 G3 E3', 'lh': 'C4 Bb3 G3 E3 C3 Bb2 G2 E2',
         'marks': 'end-repeat sign'},
    ],
    digits=[
        (1, 'RH', 0, '1'), (1, 'RH', 1, '2'), (1, 'RH', 2, '3'), (1, 'RH', 3, '4'), (1, 'RH', 4, '5'),
        (1, 'LH', 0, '5'), (1, 'LH', 1, '4'), (1, 'LH', 2, '3'), (1, 'LH', 3, '2'), (1, 'LH', 4, '1'),
        (2, 'RH', 0, '1'), (2, 'RH', 4, '1'),
        (2, 'LH', 0, '5'), (2, 'LH', 5, '4'),
        (3, 'RH', 0, '1'), (3, 'RH', 4, '5'),
        (3, 'LH', 1, '4'), (3, 'LH', 4, '1'),
        (4, 'RH', 1, '4'), (4, 'RH', 5, '4'),
        (4, 'LH', 0, '1'), (4, 'LH', 4, '1'),
    ],
    uncertain=[],
    note='Heading: "Extension of the fingers in chords of the dominant seventh, in arpeggios." '
         '"M.M. quarter = 60 to 120." "Repeat this measure 4 times." over bar 1 (the 4 is poorly printed). '
         'Accidentals are printed once per staff position per bar and carry to later notes on the same '
         'line/space of the same staff, even in the other hand; such unmarked notes are written with the carried '
         'accidental in every section (e.g. here bar 2 LH step 7 Bb3 after the RH Bb3; bar 4 RH step 5 Bb3 '
         'after the LH Bb3). Every bar is 8 sixteenths = 2/4.',
))

X.append(dict(
    number=43, part='D', pdf=71, page=70, time='2/4', unit='sixteenths',
    bars=[
        {'rh': 'D3 F#3 A3 C4 D4 C4 A3 F#3', 'lh': 'D2 F#2 A2 C3 D3 C3 A2 F#2',
         'marks': '"4 times."; start- and end-repeat signs around this bar; both hands on the bass staff'},
        {'rh': 'D3 F#3 A3 C4 D4 F#4 A4 C5', 'lh': 'D2 F#2 A2 C3 D3 F#3 A3 C4',
         'marks': 'start-repeat sign'},
        {'rh': 'D5 F#5 A5 C6 D6 C6 A5 F#5', 'lh': 'D4 F#4 A4 C5 D5 C5 A4 F#4',
         'marks': 'both hands on the treble staff'},
        {'rh': 'D5 C5 A4 F#4 D4 C4 A3 F#3', 'lh': 'D4 C4 A3 F#3 D3 C3 A2 F#2',
         'marks': 'end-repeat sign'},
    ],
    digits=[
        (1, 'RH', 0, '1'), (1, 'RH', 1, '2'), (1, 'RH', 2, '3'), (1, 'RH', 3, '4'), (1, 'RH', 4, '5'),
        (1, 'LH', 0, '5'), (1, 'LH', 1, '4'), (1, 'LH', 2, '3'), (1, 'LH', 3, '2'), (1, 'LH', 4, '1'),
        (2, 'RH', 0, '1'), (2, 'RH', 4, '1'),
        (2, 'LH', 0, '5'), (2, 'LH', 5, '4'),
        (3, 'RH', 0, '1'), (3, 'RH', 4, '5'),
        (3, 'LH', 1, '4'), (3, 'LH', 4, '1'),
        (4, 'RH', 1, '4'), (4, 'RH', 5, '4'),
        (4, 'LH', 0, '1'), (4, 'LH', 4, '1'),
    ],
    uncertain=[],
    note='Every bar is 8 sixteenths = 2/4.',
))

X.append(dict(
    number=43, part='E', pdf=71, page=70, time='2/4', unit='sixteenths',
    bars=[
        {'rh': 'E3 G#3 B3 D4 E4 D4 B3 G#3', 'lh': 'E2 G#2 B2 D3 E3 D3 B2 G#2',
         'marks': '"4 times."; start- and end-repeat signs around this bar; both hands on the bass staff'},
        {'rh': 'E3 G#3 B3 D4 E4 G#4 B4 D5', 'lh': 'E2 G#2 B2 D3 E3 G#3 B3 D4',
         'marks': 'start-repeat sign'},
        {'rh': 'E5 G#5 B5 D6 E6 D6 B5 G#5', 'lh': 'E4 G#4 B4 D5 E5 D5 B4 G#4',
         'marks': 'both hands on the treble staff'},
        {'rh': 'E5 D5 B4 G#4 E4 D4 B3 G#3', 'lh': 'E4 D4 B3 G#3 E3 D3 B2 G#2',
         'marks': 'end-repeat sign'},
    ],
    digits=[
        (1, 'RH', 0, '1'), (1, 'RH', 1, '2'), (1, 'RH', 2, '3'), (1, 'RH', 3, '4'), (1, 'RH', 4, '5'),
        (1, 'LH', 0, '5'), (1, 'LH', 1, '4'), (1, 'LH', 2, '3'), (1, 'LH', 3, '2'), (1, 'LH', 4, '1'),
        (2, 'RH', 0, '1'), (2, 'RH', 4, '1'),
        (2, 'LH', 0, '5'), (2, 'LH', 5, '4'),
        (3, 'RH', 0, '1'), (3, 'RH', 4, '5'),
        (3, 'LH', 1, '4'), (3, 'LH', 4, '1'),
        (4, 'RH', 1, '4'), (4, 'RH', 5, '4'),
        (4, 'LH', 0, '1'), (4, 'LH', 4, '1'),
    ],
    uncertain=[],
    note='Every bar is 8 sixteenths = 2/4.',
))

X.append(dict(
    number=43, part='F', pdf=72, page=71, time='2/4', unit='sixteenths',
    bars=[
        {'rh': 'F3 A3 C4 Eb4 F4 Eb4 C4 A3', 'lh': 'F2 A2 C3 Eb3 F3 Eb3 C3 A2',
         'marks': '"4 times."; start- and end-repeat signs around this bar; both hands on the bass staff'},
        {'rh': 'F3 A3 C4 Eb4 F4 A4 C5 Eb5', 'lh': 'F2 A2 C3 Eb3 F3 A3 C4 Eb4',
         'marks': 'start-repeat sign'},
        {'rh': 'F5 A5 C6 Eb6 F6 Eb6 C6 A5', 'lh': 'F4 A4 C5 Eb5 F5 Eb5 C5 A4',
         'marks': 'both hands on the treble staff'},
        {'rh': 'F5 Eb5 C5 A4 F4 Eb4 C4 A3', 'lh': 'F4 Eb4 C4 A3 F3 Eb3 C3 A2',
         'marks': 'end-repeat sign'},
    ],
    digits=[
        (1, 'RH', 0, '1'), (1, 'RH', 1, '2'), (1, 'RH', 2, '3'), (1, 'RH', 3, '4'), (1, 'RH', 4, '5'),
        (1, 'LH', 0, '5'), (1, 'LH', 1, '4'), (1, 'LH', 2, '3'), (1, 'LH', 3, '2'), (1, 'LH', 4, '1'),
        (2, 'RH', 0, '1'), (2, 'RH', 4, '1'),
        (2, 'LH', 0, '5'), (2, 'LH', 5, '4'),
        (3, 'RH', 0, '1'), (3, 'RH', 4, '5'),
        (3, 'LH', 1, '4'), (3, 'LH', 4, '1'),
        (4, 'RH', 1, '4'), (4, 'RH', 5, '4'),
        (4, 'LH', 0, '1'), (4, 'LH', 4, '1'),
    ],
    uncertain=[],
    note='Bar 2 LH step 7 (Eb4, flat carried from the RH Eb4) is written on the treble staff. Every bar is 8 sixteenths = 2/4.',
))

X.append(dict(
    number=43, part='G', pdf=72, page=71, time='2/4', unit='sixteenths',
    bars=[
        {'rh': 'G3 B3 D4 F4 G4 F4 D4 B3', 'lh': 'G2 B2 D3 F3 G3 F3 D3 B2',
         'marks': '"4 times."; start- and end-repeat signs around this bar; RH steps 2-6 on the treble staff'},
        {'rh': 'G3 B3 D4 F4 G4 B4 D5 F5', 'lh': 'G2 B2 D3 F3 G3 B3 D4 F4',
         'marks': 'start-repeat sign'},
        {'rh': 'G5 B5 D6 F6 G6 F6 D6 B5', 'lh': 'G4 B4 D5 F5 G5 F5 D5 B4',
         'marks': 'both hands on the treble staff'},
        {'rh': 'G5 F5 D5 B4 G4 F4 D4 B3', 'lh': 'G4 F4 D4 B3 G3 F3 D3 B2',
         'marks': 'end-repeat sign'},
    ],
    digits=[
        (1, 'RH', 0, '1'), (1, 'RH', 1, '2'), (1, 'RH', 2, '3'), (1, 'RH', 3, '4'), (1, 'RH', 4, '5'),
        (1, 'LH', 0, '5'), (1, 'LH', 1, '4'), (1, 'LH', 2, '3'), (1, 'LH', 3, '2'), (1, 'LH', 4, '1'),
        (2, 'RH', 0, '1'), (2, 'RH', 4, '1'),
        (2, 'LH', 0, '5'), (2, 'LH', 5, '4'),
        (3, 'RH', 0, '1'), (3, 'RH', 4, '5'),
        (3, 'LH', 1, '4'),
        (4, 'RH', 0, '1'), (4, 'RH', 1, '4'), (4, 'RH', 5, '4'),
        (4, 'LH', 0, '1'), (4, 'LH', 4, '1'),
    ],
    uncertain=['bar 2 LH step 5: the 4 is printed just above the B3 notehead (between the staves), not below the '
               'LH beam; read as the LH digit of that note',
               'bar 4 RH: a 1 over step 0 (G5) as well as the 4 over step 1 (F5) -- only section with a digit on '
               'the first step of the descending bar; the same 1 4 is in the second copy (IMSLP 00875 p. 50)'],
    note='Bar 3 LH has only the 4 (no 1 on step 4). Every bar is 8 sixteenths = 2/4.',
))

X.append(dict(
    number=43, part='A', pdf=72, page=71, time='2/4', unit='sixteenths',
    bars=[
        {'rh': 'A3 C#4 E4 G4 A4 G4 E4 C#4', 'lh': 'A2 C#3 E3 G3 A3 G3 E3 C#3',
         'marks': '"4 times."; start- and end-repeat signs around this bar; RH on the treble staff, LH on the bass staff'},
        {'rh': 'A3 C#4 E4 G4 A4 C#5 E5 G5', 'lh': 'A2 C#3 E3 G3 A3 C#4 E4 G4',
         'marks': 'start-repeat sign; treble clef on the lower staff before LH step 6'},
        {'rh': 'A5 C#6 E6 G6 A6 G6 E6 C#6', 'lh': 'A4 C#5 E5 G5 A5 G5 E5 C#5',
         'marks': '8va over RH steps 0-7 (written A4 C#5 E5 G5 A5 G5 E5 C#5); LH on the lower staff in treble clef'},
        {'rh': 'A5 G5 E5 C#5 A4 G4 E4 C#4', 'lh': 'A4 G4 E4 C#4 A3 G3 E3 C#3',
         'marks': 'end-repeat sign; lower staff back to bass clef before LH step 4'},
    ],
    digits=[
        (1, 'RH', 0, '1'), (1, 'RH', 1, '2'), (1, 'RH', 2, '3'), (1, 'RH', 3, '4'), (1, 'RH', 4, '5'),
        (1, 'LH', 0, '5'), (1, 'LH', 1, '4'), (1, 'LH', 2, '3'), (1, 'LH', 3, '2'), (1, 'LH', 4, '1'),
        (2, 'RH', 0, '1'), (2, 'RH', 4, '1'),
        (2, 'LH', 0, '5'), (2, 'LH', 5, '4'),
        (3, 'RH', 0, '1'), (3, 'RH', 4, '5'),
        (3, 'LH', 1, '4'),
        (4, 'RH', 1, '4'), (4, 'RH', 5, '4'),
        (4, 'LH', 0, '1'), (4, 'LH', 4, '1'),
    ],
    uncertain=['bar 4 LH step 4: the 1 is printed just above the A3 notehead (after the bass clef), not below the beam'],
    note='Bar 3 LH has only the 4 (no 1 on step 4). Every bar is 8 sixteenths = 2/4.',
))

X.append(dict(
    number=43, part='B', pdf=72, page=71, time='2/4', unit='sixteenths',
    bars=[
        {'rh': 'B3 D#4 F#4 A4 B4 A4 F#4 D#4', 'lh': 'B2 D#3 F#3 A3 B3 A3 F#3 D#3',
         'marks': '"4 times."; start- and end-repeat signs around this bar; RH on the treble staff, LH on the bass staff'},
        {'rh': 'B3 D#4 F#4 A4 B4 D#5 F#5 A5', 'lh': 'B2 D#3 F#3 A3 B3 D#4 F#4 A4',
         'marks': 'start-repeat sign; treble clef on the lower staff before LH step 6'},
        {'rh': 'B5 D#6 F#6 A6 B6 A6 F#6 D#6', 'lh': 'B4 D#5 F#5 A5 B5 A5 F#5 D#5',
         'marks': '8va over RH steps 0-7 (written B4 D#5 F#5 A5 B5 A5 F#5 D#5); LH on the lower staff in treble clef'},
        {'rh': 'B5 A5 F#5 D#5 B4 A4 F#4 D#4', 'lh': 'B4 A4 F#4 D#4 B3 A3 F#3 D#3',
         'marks': 'end-repeat sign; lower staff back to bass clef before LH step 4'},
    ],
    digits=[
        (1, 'RH', 0, '1'), (1, 'RH', 1, '2'), (1, 'RH', 2, '3'), (1, 'RH', 3, '4'), (1, 'RH', 4, '5'),
        (1, 'LH', 0, '5'), (1, 'LH', 1, '4'), (1, 'LH', 2, '3'), (1, 'LH', 3, '2'), (1, 'LH', 4, '1'),
        (2, 'RH', 0, '1'), (2, 'RH', 4, '1'),
        (2, 'LH', 0, '5'), (2, 'LH', 5, '4'),
        (3, 'RH', 0, '1'), (3, 'RH', 4, '5'),
        (3, 'LH', 1, '4'),
        (4, 'RH', 1, '4'), (4, 'RH', 5, '4'),
        (4, 'LH', 0, '1'), (4, 'LH', 4, '1'),
    ],
    uncertain=[],
    note='Bar 3 LH has only the 4 (no 1 on step 4). Every bar is 8 sixteenths = 2/4.',
))

X.append(dict(
    number=43, part='close', pdf=72, page=71, time='2/4', unit='sixteenths',
    bars=[
        {'rh': 'C4 E4 G4 B4 C5 E5 G5 B5', 'lh': 'C3 E3 G3 B3 C4 E4 G4 B4',
         'marks': 'follows the end-repeat of section B; LH steps 4-7 on the treble staff'},
        {'rh': 'C6 B5 G5 E5 C5 B4 G4 E4', 'lh': 'C5 B4 G4 E4 C4 B3 G3 E3',
         'marks': 'LH steps 0-3 on the treble staff'},
        {'rh': 'C4 E4 G4 B4 C5 B4 G4 E4', 'lh': 'C3 E3 G3 B3 C4 B3 G3 E3', 'marks': ''},
        {'rh': 'C4 B3 G3 E3 C3 E3 G3 B3', 'lh': 'C3 B2 G2 E2 C2 E2 G2 B2',
         'marks': 'both hands on the bass staff (RH stems up, LH stems down); treble staff empty; double bar after it'},
        {'rh': 'E3+G3+C4', 'lh': 'C2+E2+G2+C3',
         'marks': 'half-note chords (whole bar) on the bass staff: stem up E3 G3 C4, stem down C2 E2 G2 C3; final bar line'},
    ],
    digits=[
        (1, 'RH', 0, '1'), (1, 'RH', 1, '2'), (1, 'RH', 2, '3'), (1, 'RH', 3, '4'), (1, 'RH', 4, '1'),
        (1, 'LH', 0, '5'), (1, 'LH', 1, '4'), (1, 'LH', 2, '3'), (1, 'LH', 3, '2'), (1, 'LH', 4, '1'),
        (1, 'LH', 5, '4'),
        (2, 'RH', 0, '5'), (2, 'RH', 5, '4'),
        (2, 'LH', 4, '1'),
        (3, 'RH', 0, '1'), (3, 'RH', 4, '5'),
        (3, 'LH', 0, '5'),
        (4, 'RH', 1, '4'),
        (4, 'LH', 0, '1'),
        (5, 'RH', 0, '125'),
    ],
    uncertain=['bars 1-4: the seventh is B natural throughout (no flat printed anywhere in the close; checked at '
               '600 dpi that these heads sit on B, not C): a C major-seventh arpeggio, as printed',
               'bar 5: the stacked half-note heads run into one another; read from the stems at 600 dpi -- the '
               'stem-up (RH) chord is E3 G3 C4 (C4 on a ledger line), the stem-down (LH) chord C3 G2 E2 C2 '
               '(E2 and C2 on ledger lines); C3 hangs from the down stem. Digits 5 2 1 printed to the left, '
               'level with C4, G3, E3',
               'bar 2 LH step 4: the 1 is printed above the C4 notehead, not below the beam'],
    note='Bars 1-4 are 8 sixteenths; bar 5 is a half note = 2/4. Printed after the final bar: "End of Part II." '
         'and "Parts I and II of this work being the key to the difficulties in Part III, it is evidently very '
         'important that they should be thoroughly mastered before commencing the virtuoso studies contained in '
         'Part III."',
))
