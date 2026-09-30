X = []

X.append(dict(
    number=50,
    part='scale',
    pdf=84, page=83,
    time='C',
    unit='sixteenths',
    bars=[
        {'rh': 'C3+E3 D3+F3 E3+G3 F3+A3 G3+B3 A3+C4 B3+D4 C4+E4 '
               'D4+F4 E4+G4 F4+A4 G4+B4 A4+C5 B4+D5 C5+E5 D5+F5',
         'lh': 'C2+E2 D2+F2 E2+G2 F2+A2 G2+B2 A2+C3 B2+D3 C3+E3 '
               'D3+F3 E3+G3 F3+A3 G3+B3 A3+C4 B3+D4 C4+E4 D4+F4',
         'marks': 'half notes (held keys): RH G3 (step 2), C4 (5), F4 (8), B4 (11), E5 (14); '
                  'LH G2 (step 2), C3 (5), F3 (8), B3 (11), E4 (14). '
                  'RH steps 0-7 written on the bass staff (stems up); LH steps 14-15 written on the '
                  'treble staff (stems down). A "(1)" is printed above the RH digits of step 2 and '
                  'just above the LH half note G2 of step 2 (footnote reference to the text\'s '
                  '"half-notes.(1)", not recorded as a digit; see uncertain). M.M. quarter = 40 to 84 over bar 1.'},
        {'rh': 'E5+G5 F5+A5 G5+B5 A5+C6 B5+D6 C6+E6 D6+F6 E6+G6 '
               'D6+F6 C6+E6 B5+D6 A5+C6 G5+B5 F5+A5 E5+G5 D5+F5',
         'lh': 'E4+G4 F4+A4 G4+B4 A4+C5 B4+D5 C5+E5 D5+F5 E5+G5 '
               'D5+F5 C5+E5 B4+D5 A4+C5 G4+B4 F4+A4 E4+G4 D4+F4',
         'marks': 'half notes (held keys): RH A5 (step 1), D6 (4), C6 (9), G5 (12), D5 (15); '
                  'LH A4 (step 1), D5 (4), C5 (9), G4 (12), D4 (15). '
                  'Both hands on the treble staff for the whole bar (bass staff empty).'},
        {'rh': 'C5+E5 B4+D5 A4+C5 G4+B4 F4+A4 E4+G4 D4+F4 C4+E4 '
               'B3+D4 A3+C4 G3+B3 F3+A3 E3+G3 D3+F3 C3+E3 D3+F3',
         'lh': 'C4+E4 B3+D4 A3+C4 G3+B3 F3+A3 E3+G3 D3+F3 C3+E3 '
               'B2+D3 A2+C3 G2+B2 F2+A2 E2+G2 D2+F2 C2+E2 D2+F2',
         'marks': 'half notes (held keys): RH A4 (step 2), E4 (5), B3 (8), F3 (11); '
                  'LH A3 (step 2), E3 (5), B2 (8), F2 (11). '
                  'RH steps 8-15 written on the bass staff (stems up); LH steps 0-1 written on the '
                  'treble staff (stems down). End-repeat sign after the bar (no start-repeat: repeat '
                  'from bar 1). The bar ends by rising again to D+F (step 15).'},
    ],
    digits=[
        (1, 'RH', 0, '13'), (1, 'RH', 1, '24'), (1, 'RH', 2, '35'), (1, 'RH', 3, '13'),
        (1, 'RH', 6, '13'), (1, 'RH', 9, '13'), (1, 'RH', 12, '13'), (1, 'RH', 15, '13'),
        (1, 'LH', 0, '53'), (1, 'LH', 3, '53'), (1, 'LH', 6, '53'), (1, 'LH', 9, '53'),
        (1, 'LH', 12, '53'), (1, 'LH', 15, '53'),
        (2, 'RH', 2, '13'), (2, 'RH', 5, '13'), (2, 'RH', 10, '35'), (2, 'RH', 13, '35'),
        (2, 'LH', 2, '53'), (2, 'LH', 5, '53'), (2, 'LH', 10, '31'), (2, 'LH', 13, '31'),
        (3, 'RH', 0, '35'), (3, 'RH', 3, '35'), (3, 'RH', 6, '35'), (3, 'RH', 9, '35'),
        (3, 'RH', 12, '35'),
        (3, 'LH', 0, '31'), (3, 'LH', 3, '31'), (3, 'LH', 6, '31'), (3, 'LH', 9, '31'),
        (3, 'LH', 12, '31'), (3, 'LH', 13, '42'), (3, 'LH', 14, '53'),
    ],
    uncertain=[
        'bar 1 RH step 6: lower digit sits on a staff line and looks like "4" at 300 dpi; at 2400 dpi '
        'its flag is short like the "1" of step 3 and the enclosed white is the flag closed off by '
        'the staff line, so read "3 over 1" = \'13\' (a real 4 in this font, e.g. step 1, has a much '
        'wider triangle). Not certain.',
        'bar 1 step 2: the "(1)" printed above the RH digits 5/3 and above the LH half note G2 is taken '
        'as the footnote reference of the text ("Notes to be held are indicated by half-notes.(1)"), '
        'not as a fingering; no footnote text is printed on PDF 83, 84 or 85. If it is meant as a '
        'bracketed thumb it would be LH step 2 \'.1\' (and cannot be an RH finger: the RH step already '
        'has 3 and 5).',
    ],
    note='Printed with the part: "Scales in Legato Thirds. It is indispensable to practise scales in '
         'legato thirds. To obtain a smooth legato, keep the fifth finger of the right hand for an '
         'instant on its note while the thumb and 3d finger are passing over to the next third; in the '
         'left hand, the thumb is similarly held for an instant. Notes to be held are indicated by '
         'half-notes.(1) Proceed similarly in the chrormatic [sic] scale further on, and in all scales '
         'in Thirds." (M.M. quarter note = 40 to 84). Key of C, no signature. Every bar = 16 sixteenth '
         'steps per hand (4/4). The held keys are printed as half notes sharing the stem of the '
         'sixteenth third; they are struck with it (written here as ordinary steps). Hands an octave '
         'apart throughout. RH from C3+E3 up to E6+G6 (end of bar 2, first half) and back down to C3+E3 '
         '(bar 3 step 14); the last step goes back up to D3+F3 (LH D2+F2) before the repeat.',
))

X.append(dict(
    number=51,
    part='1-3',
    pdf=85, page=84,
    time='C',
    unit='sixteenths',
    bars=[
        {'rh': '(C4+C5)*8 (D4+D5)*8', 'lh': '(C2+C3)*8 (D2+D3)*8', 'marks': ''},
        {'rh': '(E4+E5)*8 (F4+F5)*8', 'lh': '(E2+E3)*8 (F2+F3)*8', 'marks': ''},
        {'rh': '(G4+G5)*8 (A4+A5)*8', 'lh': '(G2+G3)*8 (A2+A3)*8', 'marks': ''},
        {'rh': '(B4+B5)*8 (C5+C6)*8', 'lh': '(B2+B3)*8 (C3+C4)*8', 'marks': ''},
        {'rh': '(D5+D6)*8 (C5+C6)*8', 'lh': '(D3+D4)*8 (C3+C4)*8', 'marks': ''},
        {'rh': '(B4+B5)*8 (A4+A5)*8', 'lh': '(B2+B3)*8 (A2+A3)*8', 'marks': ''},
        {'rh': '(G4+G5)*8 (F4+F5)*8', 'lh': '(G2+G3)*8 (F2+F3)*8', 'marks': ''},
        {'rh': '(E4+E5)*8 (D4+D5)*8', 'lh': '(E2+E3)*8 (D2+D3)*8',
         'marks': 'end-repeat sign after the bar (end of the third system); no start-repeat before bar 1'},
    ],
    digits=[],
    uncertain=[],
    note='Heading: "Preparatory Exercise for Scales in Octaves." Text: "The wrists should be very '
         'supple, the fingers taking the octaves should be held firmly but without stiffness, and the '
         'unoccupied fingers should assume a slightly rounded position. At first repeat these three '
         'first lines slowly until a good wrist-movement is attained, and then accelerate the tempo, '
         'continuing the exercise without interruption. If the wrists become fatigued, play more slowly '
         'until the feeling of fatigue has disappeared, and then gradually accelerate up to the first '
         'tempo. See remarks to No 48." (M.M. quarter note = 40 to 84). No fingering printed. Three systems '
         'of 2, 3, 3 bars; each bar two groups of 8 repeated sixteenth octaves = 16 steps per hand (4/4). '
         'Up the C major scale C..D (bars 1-5, first half) and back down to D (bar 8); the repeat then '
         'returns to C. The next system opens with a start-repeat (not part of this reading).',
))

X.append(dict(
    number=50,
    part='chromatic',
    pdf=84, page=83,
    time='3/4',
    unit='sixteenths',
    bars=[
        {'rh': 'C3+Eb3 C#3+E3 D3+F3 D#3+F#3 E3+G3 E#3+G#3 F#3+A3 G3+Bb3 G#3+B3 A3+C4 A#3+C#4 B3+D4',
         'lh': 'C2+Eb2 C#2+E2 D2+F2 D#2+F#2 E2+G2 E#2+G#2 F#2+A2 G2+Bb2 G#2+B2 A2+C3 A#2+C#3 B2+D3',
         'marks': 'start-repeat sign at the beginning of the bar. Half notes (held keys): RH E3 (step 1), '
                  'G3 (4), A3 (6), B3 (8), D4 (11); LH E2 (1), G2 (4), A2 (6), B2 (8), D3 (11). '
                  'Both hands written on the bass staff (RH stems up, digits above; LH stems down, '
                  'digits below). M.M. quarter = 40 to 84.'},
        {'rh': 'C4+Eb4 C#4+E4 D4+F4 D#4+F#4 E4+G4 E#4+G#4 F#4+A4 G4+Bb4 G#4+B4 A4+C5 A#4+C#5 B4+D5',
         'lh': 'C3+Eb3 C#3+E3 D3+F3 D#3+F#3 E3+G3 E#3+G#3 F#3+A3 G3+Bb3 G#3+B3 A3+C4 A#3+C#4 B3+D4',
         'marks': 'Half notes: RH E4 (step 1), G4 (4), A4 (6), B4 (8), D5 (11); LH E3 (1), G3 (4), '
                  'A3 (6), B3 (8), D4 (11). RH on the treble staff, LH on the bass staff with its '
                  'digits printed above the notes.'},
        {'rh': 'C5+Eb5 C#5+E5 D5+F5 D#5+F#5 E5+G5 E#5+G#5 F#5+A5 G5+Bb5 G#5+B5 A5+C6 A#5+C#6 B5+D6',
         'lh': 'C4+Eb4 C#4+E4 D4+F4 D#4+F#4 E4+G4 E#4+G#4 F#4+A4 G4+Bb4 G#4+B4 A4+C5 A#4+C#5 B4+D5',
         'marks': 'Half notes: RH E5 (step 1), G5 (4), A5 (6), B5 (8), D6 (11); LH E4 (1), G4 (4), '
                  'A4 (6), B4 (8), D5 (11). Both hands on the treble staff (LH stems down, digits '
                  'below its beam). Step 7: only the flat is printed in each hand, no natural on the '
                  'G after the G# of step 5 (see uncertain).'},
        {'rh': 'C6+Eb6 B5+D6 Bb5+Db6 A5+C6 G#5+B5 G5+Bb5 F#5+A5 F5+Ab5 E5+G5 Eb5+Gb5 D5+F5 C#5+E5',
         'lh': 'C5+Eb5 B4+D5 Bb4+Db5 A4+C5 G#4+B4 G4+Bb4 F#4+A4 F4+Ab4 E4+G4 Eb4+Gb4 D4+F4 C#4+E4',
         'marks': 'Half notes (now the LOWER key of the third): RH C6 (step 0), A5 (3), G5 (5), F5 (7), '
                  'D5 (10); LH C5 (0), A4 (3), G4 (5), F4 (7), D4 (10). Both hands on the treble staff.'},
        {'rh': 'C5+Eb5 B4+D5 Bb4+Db5 A4+C5 G#4+B4 G4+Bb4 F#4+A4 F4+Ab4 E4+G4 Eb4+Gb4 D4+F4 C#4+E4',
         'lh': 'C4+Eb4 B3+D4 Bb3+Db4 A3+C4 G#3+B3 G3+Bb3 F#3+A3 F3+Ab3 E3+G3 Eb3+Gb3 D3+F3 C#3+E3',
         'marks': 'Half notes: RH C5 (step 0), A4 (3), G4 (5), F4 (7), D4 (10); LH C4 (0), A3 (3), '
                  'G3 (5), F3 (7), D3 (10). RH on the treble staff; LH step 0 on the treble staff, '
                  'steps 1-11 on the bass staff (digits printed above the LH notes).'},
        {'rh': 'C4+Eb4 B3+D4 Bb3+Db4 A3+C4 G#3+B3 G3+Bb3 F#3+A3 F3+Ab3 E3+G3 Eb3+Gb3 D3+F3 C#3+E3',
         'lh': 'C3+Eb3 B2+D3 Bb2+Db3 A2+C3 G#2+B2 G2+Bb2 F#2+A2 F2+Ab2 E2+G2 Eb2+Gb2 D2+F2 C#2+E2',
         'marks': 'Half notes: RH C4 (step 0), A3 (3), G3 (5), F3 (7), D3 (10); LH C3 (0), A2 (3), '
                  'G2 (5), F2 (7), D2 (10). RH steps 0-2 on the treble staff (below it, ledger lines), '
                  'steps 3-11 on the bass staff; LH on the bass staff. Step 11: only the sharp is printed '
                  'in each hand, no natural on the E after the Eb of step 9 (see uncertain). '
                  'End-repeat sign after the bar.'},
        {'rh': 'C3+Eb3', 'lh': 'C2+Eb2',
         'marks': 'closing bar after the end-repeat: the step is a half note in each hand (natural on C, '
                  'flat on E printed), then a quarter rest in each hand; final double bar. '
                  'RH on the bass staff (stem up), its quarter rest on the treble staff.'},
    ],
    digits=[
        # bar 1 (ascending)
        (1, 'RH', 0, '13'), (1, 'RH', 1, '24'), (1, 'RH', 2, '13'), (1, 'RH', 3, '24'),
        (1, 'RH', 4, '35'), (1, 'RH', 5, '13'), (1, 'RH', 6, '24'), (1, 'RH', 7, '13'),
        (1, 'RH', 8, '24'), (1, 'RH', 9, '13'), (1, 'RH', 10, '24'), (1, 'RH', 11, '35'),
        (1, 'LH', 0, '42'), (1, 'LH', 1, '31'), (1, 'LH', 2, '53'), (1, 'LH', 3, '42'),
        (1, 'LH', 4, '31'), (1, 'LH', 5, '42'), (1, 'LH', 6, '31'), (1, 'LH', 7, '42'),
        (1, 'LH', 8, '31'), (1, 'LH', 9, '53'), (1, 'LH', 10, '42'), (1, 'LH', 11, '31'),
        # bar 2
        (2, 'RH', 0, '13'), (2, 'RH', 2, '13'), (2, 'RH', 5, '13'), (2, 'RH', 7, '13'),
        (2, 'RH', 9, '13'),
        (2, 'LH', 0, '42'), (2, 'LH', 2, '53'), (2, 'LH', 5, '42'), (2, 'LH', 7, '42'),
        (2, 'LH', 9, '53'),
        # bar 3
        (3, 'RH', 0, '13'), (3, 'RH', 2, '13'), (3, 'RH', 5, '13'), (3, 'RH', 7, '13'),
        (3, 'RH', 9, '13'),
        (3, 'LH', 0, '42'), (3, 'LH', 1, '31'), (3, 'LH', 2, '53'), (3, 'LH', 4, '31'),
        (3, 'LH', 5, '42'), (3, 'LH', 7, '42'), (3, 'LH', 9, '53'),
        # bar 4 (descending)
        (4, 'RH', 0, '13'), (4, 'RH', 1, '35'), (4, 'RH', 2, '24'), (4, 'RH', 3, '13'),
        (4, 'RH', 4, '24'), (4, 'RH', 5, '13'), (4, 'RH', 6, '24'), (4, 'RH', 7, '13'),
        (4, 'RH', 8, '35'), (4, 'RH', 9, '24'), (4, 'RH', 10, '13'), (4, 'RH', 11, '24'),
        (4, 'LH', 0, '42'), (4, 'LH', 1, '31'), (4, 'LH', 2, '42'), (4, 'LH', 3, '53'),
        (4, 'LH', 4, '31'), (4, 'LH', 5, '42'), (4, 'LH', 6, '31'), (4, 'LH', 7, '42'),
        (4, 'LH', 8, '31'), (4, 'LH', 9, '42'), (4, 'LH', 10, '53'), (4, 'LH', 11, '31'),
        # bar 5
        (5, 'RH', 0, '13'), (5, 'RH', 1, '35'), (5, 'RH', 4, '24'), (5, 'RH', 6, '24'),
        (5, 'RH', 8, '35'), (5, 'RH', 11, '24'),
        (5, 'LH', 1, '31'), (5, 'LH', 3, '53'), (5, 'LH', 4, '31'), (5, 'LH', 6, '31'),
        (5, 'LH', 8, '31'), (5, 'LH', 11, '31'),
        # bar 6
        (6, 'RH', 1, '35'), (6, 'RH', 4, '24'), (6, 'RH', 6, '24'), (6, 'RH', 8, '35'),
        (6, 'RH', 11, '24'),
        (6, 'LH', 1, '31'), (6, 'LH', 3, '53'), (6, 'LH', 4, '31'), (6, 'LH', 6, '31'),
        (6, 'LH', 8, '31'), (6, 'LH', 11, '31'),
    ],
    uncertain=[
        'bar 3 step 7 (RH G5+Bb5, LH G4+Bb4): no natural is printed on the G (only the flat on B), '
        'although G#5/G#4 was printed at step 5; bars 1, 2, 4, 5, 6 print the natural at the same '
        'place. Written as G natural (the minor third the exercise is made of); by strict carry-over '
        'the printed page says G#5 / G#4.',
        'bar 6 step 11 (RH C#3+E3, LH C#2+E2): no natural on the E (only the sharp on C), although '
        'Eb3/Eb2 was printed at step 9 (bar 5 step 11 prints the natural). Written as E natural; by '
        'strict carry-over the page says Eb3 / Eb2.',
        'bar 6 step 8 (RH E3+G3): the LH printed Eb3 at step 0 on the same (bass) staff and no natural '
        'is printed on the RH E3; written E3 natural (bar 5 step 8 prints a natural in the same '
        'situation on the treble staff).',
        'digits printed with their lower digit on a staff line, where the flag of a "1" meets the '
        'line and looks like a "4" at 300-600 dpi: bar 1 RH step 9, bar 2 RH step 0, bar 3 LH step 1 '
        '(its upper digit). Read at 2400 dpi as "1" (short flag, no crossbar of its own; the real 4s of '
        'this font have a wider triangle and their own bar) -> \'13\', \'13\', \'31\'. Bar 1 RH step 9 '
        'is the least clear of these (its diagonal looks longer).',
        'bar 1 RH step 1: the lower head (C#3) is partly white from print damage; taken as a filled head, '
        'the upper (E3) as the half note, like the LH and every other bar.',
        'bar 6 RH step 1 digits "5 over 3" stand between the stems of steps 0 and 1; given to step 1 '
        '(centred over its head; bar 5 has the same 5/3 at step 1).',
    ],
    note='Heading: "Chromatic scales in minor thirds." (M.M. quarter = 40 to 84). 3/4; bars 1-6 between '
         'repeat signs (start-repeat after the time signature, end-repeat after bar 6), then the '
         'closing bar to the final double bar. Every bar 1-6 = 12 sixteenth steps per hand (3/4). The '
         'closing bar has one step (a half note) plus a quarter rest in each hand = 3/4, but only 1 '
         'step. Three octaves up (bars 1-3, RH C3+Eb3 to B5+D6) in sharps, three down (bars 4-6, RH C6+Eb6 to C#3+E3) mostly in flats; hands an '
         'octave apart; the held keys (half notes) are the upper key going up, the lower key going '
         'down. The introductory text of the scale part says to proceed in the chromatic scale in the '
         'same way (held notes as half notes).',
))
