X = []

# ---------------------------------------------------------------------------
# No. 50, "Scales in Legato Thirds" (PDF 84, printed page 83, second system)
# ---------------------------------------------------------------------------
X.append(dict(
    number=50,
    part='scale',
    pdf=84, page=83,
    time='4/4',
    unit='sixteenths',
    bars=[
        {'rh': 'C3+E3 D3+F3 E3+G3 F3+A3 G3+B3 A3+C4 B3+D4 C4+E4 '
               'D4+F4 E4+G4 F4+A4 G4+B4 A4+C5 B4+D5 C5+E5 D5+F5',
         'lh': 'C2+E2 D2+F2 E2+G2 F2+A2 G2+B2 A2+C3 B2+D3 C3+E3 '
               'D3+F3 E3+G3 F3+A3 G3+B3 A3+C4 B3+D4 C4+E4 D4+F4',
         'marks': 'held as half notes (hollow heads on the sixteenth stems): RH step 2 G3, step 5 C4, '
                  'step 8 F4, step 11 B4, step 14 E5 (the upper key each time); LH step 2 G2, step 5 C3, '
                  'step 8 F3, step 11 B3, step 14 E4 (the upper key each time). RH steps 0-7 are written '
                  'on the bass staff (stems up), steps 8-15 on the treble staff; LH steps 14-15 are written '
                  'on the treble staff. Footnote marker "(1)" printed above RH step 2 (above its digits) '
                  'and above LH step 2.'},
        {'rh': 'E5+G5 F5+A5 G5+B5 A5+C6 B5+D6 C6+E6 D6+F6 E6+G6 '
               'D6+F6 C6+E6 B5+D6 A5+C6 G5+B5 F5+A5 E5+G5 D5+F5',
         'lh': 'E4+G4 F4+A4 G4+B4 A4+C5 B4+D5 C5+E5 D5+F5 E5+G5 '
               'D5+F5 C5+E5 B4+D5 A4+C5 G4+B4 F4+A4 E4+G4 D4+F4',
         'marks': 'both hands on the treble staff (RH stems up, LH stems down). Held as half notes: '
                  'RH step 1 A5, step 4 D6 (upper key), step 9 C6, step 12 G5, step 15 D5 (lower key); '
                  'LH step 1 A4, step 4 D5 (upper key), step 9 C5, step 12 G4, step 15 D4 (lower key). '
                  'The top step (step 7, E6+G6 / E5+G5) has no half note.'},
        {'rh': 'C5+E5 B4+D5 A4+C5 G4+B4 F4+A4 E4+G4 D4+F4 C4+E4 '
               'B3+D4 A3+C4 G3+B3 F3+A3 E3+G3 D3+F3 C3+E3 D3+F3',
         'lh': 'C4+E4 B3+D4 A3+C4 G3+B3 F3+A3 E3+G3 D3+F3 C3+E3 '
               'B2+D3 A2+C3 G2+B2 F2+A2 E2+G2 D2+F2 C2+E2 D2+F2',
         'marks': 'held as half notes (lower key each time): RH step 2 A4, step 5 E4, step 8 B3, '
                  'step 11 F3; LH step 2 A3, step 5 E3, step 8 B2, step 11 F2. RH steps 0-7 on the '
                  'treble staff, steps 8-15 on the bass staff; LH steps 0-1 on the treble staff. '
                  'End-repeat sign after the bar (no start-repeat is printed, so the repeat goes back '
                  'to bar 1).'},
    ],
    digits=[
        # bar 1
        (1, 'RH', 0, '13'), (1, 'RH', 1, '24'), (1, 'RH', 2, '35'), (1, 'RH', 3, '13'),
        (1, 'RH', 6, '13'), (1, 'RH', 9, '13'), (1, 'RH', 12, '13'), (1, 'RH', 15, '13'),
        (1, 'LH', 0, '53'), (1, 'LH', 3, '53'), (1, 'LH', 6, '53'), (1, 'LH', 9, '53'),
        (1, 'LH', 12, '53'), (1, 'LH', 15, '53'),
        # bar 2
        (2, 'RH', 2, '13'), (2, 'RH', 5, '13'), (2, 'RH', 10, '35'), (2, 'RH', 13, '35'),
        (2, 'LH', 2, '53'), (2, 'LH', 5, '53'), (2, 'LH', 10, '31'), (2, 'LH', 13, '31'),
        # bar 3
        (3, 'RH', 0, '35'), (3, 'RH', 3, '35'), (3, 'RH', 6, '35'), (3, 'RH', 9, '35'),
        (3, 'RH', 12, '35'),
        (3, 'LH', 0, '31'), (3, 'LH', 3, '31'), (3, 'LH', 6, '31'), (3, 'LH', 9, '31'),
        (3, 'LH', 12, '31'), (3, 'LH', 13, '42'), (3, 'LH', 14, '53'),
    ],
    uncertain=[
        'bar 1 RH step 6 (B3+D4): the lower digit sits on a staff line and the line forms what looks '
        'like the crossbar of a 4 (the glyph reads "4" at 600 and 1200 dpi); recorded as 1, which the '
        'fingering pattern (1-3 on every third step) requires and which fits a 1 whose flag touches '
        'the line. If read literally it would be "43".',
    ],
    note='(M.M. quarter note = 40 to 84). Heading text: "Scales in Legato Thirds. It is indispensable to '
         'practise scales in legato thirds. To obtain a smooth legato, keep the fifth finger of the '
         'right hand for an instant on its note while the thumb and 3d finger are passing over to the '
         'next third; in the left hand, the thumb is similarly held for an instant. Notes to be held '
         'are indicated by half-notes.(1) Proceed similarly in the chromatic scale further on, and in '
         'all scales in Thirds." The footnote (1) is referenced in the text and by "(1)" above RH step 2 '
         'and LH step 2 of bar 1, but no footnote text is printed on PDF 83, 84 or 85. C major, '
         'two octaves plus a third up (RH C3+E3 to E6+G6, LH an octave lower throughout) and back; '
         'the part does not end on the tonic: the last step of bar 3 is D3+F3 / D2+F2, leading back to '
         'bar 1 through the end-repeat. Every bar has 16 sixteenth steps per hand (4/4). A held '
         'half-note key is also struck as part of its sixteenth step.',
))

# ---------------------------------------------------------------------------
# No. 50, "Chromatic scales in minor thirds" (PDF 84, printed page 83, last three systems)
# ---------------------------------------------------------------------------
X.append(dict(
    number=50,
    part='chromatic',
    pdf=84, page=83,
    time='3/4',
    unit='sixteenths',
    bars=[
        {'rh': 'C3+Eb3 C#3+E3 D3+F3 D#3+F#3 E3+G3 E#3+G#3 F#3+A3 G3+Bb3 G#3+B3 A3+C4 A#3+C#4 B3+D4',
         'lh': 'C2+Eb2 C#2+E2 D2+F2 D#2+F#2 E2+G2 E#2+G#2 F#2+A2 G2+Bb2 G#2+B2 A2+C3 A#2+C#3 B2+D3',
         'marks': 'start-repeat sign at the beginning of the bar. Both hands on the bass staff (RH stems '
                  'up, LH stems down). Held as half notes (upper key): RH step 1 E3, step 4 G3, step 6 A3, '
                  'step 8 B3, step 11 D4; LH step 1 E2, step 4 G2, step 6 A2, step 8 B2, step 11 D3.'},
        {'rh': 'C4+Eb4 C#4+E4 D4+F4 D#4+F#4 E4+G4 E#4+G#4 F#4+A4 G4+Bb4 G#4+B4 A4+C5 A#4+C#5 B4+D5',
         'lh': 'C3+Eb3 C#3+E3 D3+F3 D#3+F#3 E3+G3 E#3+G#3 F#3+A3 G3+Bb3 G#3+B3 A3+C4 A#3+C#4 B3+D4',
         'marks': 'RH on the treble staff, LH on the bass staff (LH digits printed above the LH notes). '
                  'Held as half notes (upper key): RH step 1 E4, step 4 G4, step 6 A4, step 8 B4, '
                  'step 11 D5; LH step 1 E3, step 4 G3, step 6 A3, step 8 B3, step 11 D4.'},
        {'rh': 'C5+Eb5 C#5+E5 D5+F5 D#5+F#5 E5+G5 E#5+G#5 F#5+A5 G5+Bb5 G#5+B5 A5+C6 A#5+C#6 B5+D6',
         'lh': 'C4+Eb4 C#4+E4 D4+F4 D#4+F#4 E4+G4 E#4+G#4 F#4+A4 G4+Bb4 G#4+B4 A4+C5 A#4+C#5 B4+D5',
         'marks': 'both hands on the treble staff (LH digits printed below, in the empty bass staff). '
                  'Held as half notes (upper key): RH step 1 E5, step 4 G5, step 6 A5, step 8 B5, '
                  'step 11 D6; LH step 1 E4, step 4 G4, step 6 A4, step 8 B4, step 11 D5. '
                  'Step 7 in both hands has only a flat on the B; no natural is printed on the G.'},
        {'rh': 'C6+Eb6 B5+D6 Bb5+Db6 A5+C6 G#5+B5 G5+Bb5 F#5+A5 F5+Ab5 E5+G5 Eb5+Gb5 D5+F5 C#5+E5',
         'lh': 'C5+Eb5 B4+D5 Bb4+Db5 A4+C5 G#4+B4 G4+Bb4 F#4+A4 F4+Ab4 E4+G4 Eb4+Gb4 D4+F4 C#4+E4',
         'marks': 'descending; both hands on the treble staff. Held as half notes (lower key): RH step 0 '
                  'C6, step 3 A5, step 5 G5, step 7 F5, step 10 D5; LH step 0 C5, step 3 A4, step 5 G4, '
                  'step 7 F4, step 10 D4.'},
        {'rh': 'C5+Eb5 B4+D5 Bb4+Db5 A4+C5 G#4+B4 G4+Bb4 F#4+A4 F4+Ab4 E4+G4 Eb4+Gb4 D4+F4 C#4+E4',
         'lh': 'C4+Eb4 B3+D4 Bb3+Db4 A3+C4 G#3+B3 G3+Bb3 F#3+A3 F3+Ab3 E3+G3 Eb3+Gb3 D3+F3 C#3+E3',
         'marks': 'RH on the treble staff; LH step 0 on the treble staff, steps 1-11 on the bass staff '
                  '(LH digits above the LH notes). Held as half notes (lower key): RH step 0 C5, step 3 '
                  'A4, step 5 G4, step 7 F4, step 10 D4; LH step 0 C4, step 3 A3, step 5 G3, step 7 F3, '
                  'step 10 D3.'},
        {'rh': 'C4+Eb4 B3+D4 Bb3+Db4 A3+C4 G#3+B3 G3+Bb3 F#3+A3 F3+Ab3 E3+G3 Eb3+Gb3 D3+F3 C#3+E3',
         'lh': 'C3+Eb3 B2+D3 Bb2+Db3 A2+C3 G#2+B2 G2+Bb2 F#2+A2 F2+Ab2 E2+G2 Eb2+Gb2 D2+F2 C#2+E2',
         'marks': 'RH steps 0-2 on the treble staff, steps 3-11 on the bass staff; LH on the bass staff. '
                  'Held as half notes (lower key): RH step 0 C4, step 3 A3, step 5 G3, step 7 F3, step 10 '
                  'D3; LH step 0 C3, step 3 A2, step 5 G2, step 7 F2, step 10 D2. No natural is printed '
                  'on the E of RH step 8 (after LH step 0 Eb3 on the same staff) or of RH step 11 and LH '
                  'step 11 (after the Eb of step 9). End-repeat sign after the bar.'},
        {'rh': 'C3+Eb3',
         'lh': 'C2+Eb2',
         'marks': 'closing bar after the end-repeat: each hand one half-note chord (C3+Eb3 with natural '
                  'and flat, stem up, on the bass staff; C2+Eb2 with natural and flat, stem down) and a '
                  'quarter rest (RH rest on the treble staff, LH rest below the bass staff). Final double '
                  'bar.'},
    ],
    digits=[
        # bar 1
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
        # bar 4
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
        'bar 1 RH step 9 (A3+C4), bar 2 RH step 0 (C4+Eb4) and bar 3 LH step 1 (C#4+E4): in each the '
        '"1" of the pair sits on a staff line which completes a closed triangle under its flag, so the '
        'glyph looks like a 4 (literal readings "43", "43", "34"). Recorded as 1: a genuine 4 in this '
        'edition (e.g. bar 2 LH step 0) has its own crossbar below the line and projecting right of the '
        'stem, which these lack; the same effect occurs in the scale part.',
        'bar 1 RH step 1: the lower head (C#3) has a white blot inside; read as a filled head with a '
        'print defect, not a half note (it has no half-note outline; the upper head E3 is a clear '
        'half note).',
        'bar 3 step 7 (both hands): only the B carries a flat; no natural is printed on the G after '
        'G# at step 5, so read literally the step is G#5+Bb5 / G#4+Bb4. Written G5+Bb5 / G4+Bb4 (the '
        'minor third of the pattern; bars 1 and 2 print the natural at the same place).',
        'bar 6 RH step 8 (E3+G3): no natural printed although LH step 0 has Eb3 on the same (bass) '
        'staff; bar 6 RH step 11 (C#3+E3) and LH step 11 (C#2+E2): only the C has a sharp, no natural '
        'on the E after Eb3 / Eb2 at step 9. Read literally these Es would be flats; written E natural '
        '(the minor third of the pattern; bars 4 and 5 print the natural at the same places).',
    ],
    note='(M.M. quarter note = 40 to 84). '
         'Chromatic scale in minor thirds, both hands an octave apart, up three octaves from C3+Eb3 / '
         'C2+Eb2 (sharps ascending) and back down (flats descending), bars 1-6 between repeat signs, '
         'then a closing bar on C3+Eb3 / C2+Eb2 before the final double bar. Bars 1-6: 12 sixteenth '
         'steps per hand (3/4). Closing bar: one half-note chord plus a quarter rest per hand (3/4). '
         'A held half-note key is also struck as part of its sixteenth step. Ascending, the digits '
         'are printed only on some steps from bar 2 on (bar 1 has every step); descending, bar 4 has '
         'every step, bars 5-6 only some.',
))

# ---------------------------------------------------------------------------
# No. 51, Preparatory Exercise for Scales in Octaves, first three systems (PDF 85, printed page 84)
# ---------------------------------------------------------------------------
X.append(dict(
    number=51,
    part='1-3',
    pdf=85, page=84,
    time='4/4',
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
         'marks': 'end-repeat sign after the bar, closing the third system (no start-repeat is '
                  'printed at bar 1; the next system opens with a start-repeat).'},
    ],
    digits=[],
    uncertain=[],
    note='(M.M. quarter note = 40 to 84). Heading: "Preparatory Exercise for Scales in Octaves." '
         'Text: "The wrists should be very supple, the fingers taking the octaves should be held firmly '
         'but without stiffness, and the unoccupied fingers should assume a slightly rounded position. '
         'At first repeat these three first lines slowly until a good wrist-movement is attained, and '
         'then accelerate the tempo, continuing the exercise without interruption. If the wrists '
         'become fatigued, play more slowly until the feeling of fatigue has disappeared, and then '
         'gradually accelerate up to the first tempo. See remarks to No 48." No fingering digits are '
         'printed in these three systems. C major, one octave in each hand (LH two octaves below RH), '
         'each degree repeated 8 times: up from C to D (bar 5 first half) and back down to D, ending '
         'on D before the repeat (not on the tonic). 8 bars (systems of 2, 3 and 3 bars), every bar '
         '16 sixteenth steps per hand (4/4).',
))
