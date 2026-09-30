# Hanon, The Virtuoso Pianist (G. Schirmer [1900], IMSLP #91547), No. 45 (all fingerings and the
# close) and No. 46 bars 1-6. Read from the 300/600/1200 dpi renders of PDF pages 75-77 only.

X = []

# ---------------------------------------------------------------------------------------------
# No. 45 -- the notes are the same in all six fingerings (checked system by system); only the
# digits, the number of printed accents/slurs and the placement of "simile" differ.
# ---------------------------------------------------------------------------------------------

_B45 = [
    ('C4 D4 D4 E4 E4 F4 F4 G4 G4 A4 A4 B4 B4 C5 C5 D5',
     'C3 D3 D3 E3 E3 F3 F3 G3 G3 A3 A3 B3 B3 C4 C4 D4'),
    ('D5 E5 E5 F5 F5 G5 G5 A5 A5 B5 B5 C6 C6 D6 D6 E6',
     'D4 E4 E4 F4 F4 G4 G4 A4 A4 B4 B4 C5 C5 D5 D5 E5'),
    ('E6 D6 D6 C6 C6 B5 B5 A5 A5 G5 G5 F5 F5 E5 E5 D5',
     'E5 D5 D5 C5 C5 B4 B4 A4 A4 G4 G4 F4 F4 E4 E4 D4'),
    ('D5 C5 C5 B4 B4 A4 A4 G4 G4 F4 F4 E4 E4 D4 D4 C4',
     'D4 C4 C4 B3 B3 A3 A3 G3 G3 F3 F3 E3 E3 D3 D3 C3'),
]

_N45_TEXT = ('Heading (PDF 75): "Notes repeated in groups of two, by all five fingers. Study the first '
             'fingering until it is thoroughly mastered; practise similarly each of the five following '
             'fingerings then play through the whole exercise without stopping." Over the first system: '
             '"Accent the first of each pair of slurred notes." (M.M. quarter = 60 to 108). ')

_COMMON45 = ('Both hands in 16ths in similar motion an octave apart, C major, no accidentals; each bar '
             '16 sixteenths = 4/4. Slurs join steps (0,1), (2,3), ... with an accent on the first of each '
             'pair. No start-repeat sign is printed; the end-repeat closes bar 4 of each fingering. '
             'Bars 2-3 (and the end of bar 1 in fingerings 2-6, and the start of bar 4) have the LH '
             'written on the treble staff; pitches above are sounding pitches.')


def _bars45(acc1, simile_bar2=False):
    m1 = ('slurred pairs with accent on the first note printed over steps 0-%d in both hands (RH '
          'slurs/accents above, LH below), then "simile"' % (acc1 - 1))
    m2 = '"simile" printed above the RH at the start of the bar' if simile_bar2 else ''
    m3 = 'slurred pairs with accent on the first printed over steps 0-7 in both hands'
    m4 = 'end-repeat sign (:||) at the end of the bar'
    return [dict(rh=r, lh=l, marks=m) for (r, l), m in zip(_B45, [m1, m2, m3, m4])]


def _dig(rh1, lh1, rh2, lh2, rh3, lh3, rh4, lh4):
    """rh1/lh1: digits on bar 1 steps 0..; rh2/lh2: digits on bar 2 steps 14,15 (or '');
    rh3/lh3: bar 3 steps 0..; rh4/lh4: bar 4 steps 14,15."""
    d = []
    for bar, hand, s, start in ((1, 'RH', rh1, 0), (1, 'LH', lh1, 0),
                                (2, 'RH', rh2, 14), (2, 'LH', lh2, 14),
                                (3, 'RH', rh3, 0), (3, 'LH', lh3, 0),
                                (4, 'RH', rh4, 14), (4, 'LH', lh4, 14)):
        for i, ch in enumerate(s):
            d.append((bar, hand, start + i, ch))
    d.sort(key=lambda t: (t[0], t[1] == 'LH', t[2]))
    return d


X.append(dict(
    number=45, part='1', pdf=75, page=74, time='C', unit='sixteenths',
    bars=_bars45(16, simile_bar2=True),
    digits=_dig('121212', '212121', '12', '21', '212121', '121212', '21', '12'),
    uncertain=['bar 1 LH step 3: digit crossed by the top line of the bass staff; read 1 at 1200 dpi '
               '(no crossbar or counter of a 4 visible)'],
    note=_N45_TEXT + 'Headed "1st fingering". ' + _COMMON45 +
         ' In this fingering the slur/accent pairs run through the whole of bar 1 (8 pairs per hand) '
         'and bar 3 has six digits per hand (three pairs); "simile" is printed twice: after RH step 5 '
         'in bar 1 (between the staves) and above the RH at the start of bar 2. Bar 1 LH ends on D4 '
         'written in the bass staff above a ledger line.',
))

X.append(dict(
    number=45, part='2', pdf=75, page=74, time='C', unit='sixteenths',
    bars=_bars45(8),
    digits=_dig('232323', '323232', '23', '32', '3232', '2323', '32', '23'),
    uncertain=[],
    note='Headed "2d fingering". ' + _COMMON45 +
         ' Bar 1: digits on steps 0-5 each hand, slurs/accents on steps 0-7, then "simile". Bar 3: '
         'only four digits per hand (steps 0-3), slurs/accents on steps 0-7.',
))

X.append(dict(
    number=45, part='3', pdf=75, page=74, time='C', unit='sixteenths',
    bars=_bars45(8),
    digits=_dig('343434', '434343', '34', '43', '4343', '3434', '43', '34'),
    uncertain=[],
    note='Headed "3d fingering". ' + _COMMON45 +
         ' Bar 1: digits on steps 0-5 each hand; bar 3: steps 0-3 each hand.',
))

X.append(dict(
    number=45, part='4', pdf=76, page=75, time='C', unit='sixteenths',
    bars=_bars45(8),
    digits=_dig('45454545', '54545454', '45', '54', '5454', '4545', '54', '45'),
    uncertain=[],
    note='Headed "4th fingering". ' + _COMMON45 +
         ' Bar 1: digits on steps 0-7 each hand (eight, not six as in fingerings 1-3); bar 3: '
         'steps 0-3 each hand.',
))

X.append(dict(
    number=45, part='5', pdf=76, page=75, time='C', unit='sixteenths',
    bars=_bars45(8),
    digits=_dig('13131313', '313431', '', '', '3131', '1313', '31', '13'),
    uncertain=['bar 1 LH step 3: printed digit is 4 (at 1200 dpi the closed triangular counter of a 4 '
               'shows above the bass staff\'s top line, which hides the crossbar; the 1s beside it '
               'have no counter). Almost certainly a misprint for 1 (pattern 3 1 3 1 3 1), but '
               'recorded as printed.'],
    note='Headed "5th fingering". ' + _COMMON45 +
         ' Bar 1: RH digits on steps 0-7, LH digits on steps 0-5 only (six, against eight in the RH). '
         'Bar 2 has no digits at all (fingerings 1-4 print the last two). Bar 3: steps 0-3 each hand. '
         'IRREGULAR: bar 1 LH step 3 is printed 4 where the pattern needs 1 (see uncertain).',
))

X.append(dict(
    number=45, part='6', pdf=76, page=75, time='C', unit='sixteenths',
    bars=_bars45(8),
    digits=_dig('24242424', '42424242', '', '', '4242', '2424', '42', '24'),
    uncertain=[],
    note='Headed "6th fingering". ' + _COMMON45 +
         ' Bar 1: digits on steps 0-7 each hand. Bar 2 has no digits. Bar 3: steps 0-3 each hand. '
         'The end-repeat of bar 4 is followed by the closing bar (part "close").',
))

X.append(dict(
    number=45, part='close', pdf=76, page=75, time='C', unit='whole notes',
    bars=[dict(rh='C4', lh='C3',
               marks='one whole note in each hand (RH C4 on a ledger line below the treble staff, '
                     'LH C3 in the bass staff); final double bar')],
    digits=[(1, 'RH', 0, '3'), (1, 'LH', 0, '3')],
    uncertain=[],
    note='The closing bar after the 6th fingering\'s end-repeat, at the right end of the last system '
         'on PDF 76. A single whole-note bar (4/4).',
))

# ---------------------------------------------------------------------------------------------
# No. 46, bars 1-6
# ---------------------------------------------------------------------------------------------

X.append(dict(
    number=46, part='1-6', pdf=77, page=76, time='C', unit='sixteenths',
    bars=[
        dict(rh='(C3 D3)*8', lh='(C2 D2)*8', marks=''),
        dict(rh='(E3 D3)*8', lh='(E2 D2)*8', marks=''),
        dict(rh='(E3 F3)*8', lh='(E2 F2)*8', marks=''),
        dict(rh='(G3 F3)*8', lh='(G2 F2)*8', marks=''),
        dict(rh='(E3 F3)*8', lh='(E2 F2)*8', marks=''),
        dict(rh='(E3 D3)*8', lh='(E2 D2)*8',
             marks='end-repeat sign at the end of the bar (double bar with dots on both sides: the '
                   'next bar opens a new repeat and restates C)'),
    ],
    digits=[
        (1, 'RH', 0, '1'), (1, 'RH', 1, '2'), (1, 'LH', 0, '5'), (1, 'LH', 1, '4'),
        (2, 'RH', 0, '3'), (2, 'RH', 1, '2'), (2, 'LH', 0, '3'), (2, 'LH', 1, '4'),
        (3, 'RH', 0, '3'), (3, 'RH', 1, '4'), (3, 'LH', 0, '3'), (3, 'LH', 1, '2'),
        (4, 'RH', 0, '5'), (4, 'RH', 1, '4'), (4, 'LH', 0, '1'), (4, 'LH', 1, '2'),
        (5, 'RH', 0, '3'), (5, 'RH', 1, '4'), (5, 'LH', 0, '3'), (5, 'LH', 1, '2'),
        (6, 'RH', 0, '3'), (6, 'RH', 1, '2'), (6, 'LH', 0, '3'), (6, 'LH', 1, '4'),
    ],
    uncertain=['bar 4 RH step 0: the top of the digit merges into the bottom line of the (empty) '
               'treble staff; only a lower bowl with a ball terminal shows below it, no upper bowl. '
               'Read 5 (not 3).'],
    note='Heading (PDF 77): "The Trill for all five fingers. Practise the first 6 measures until they '
         'can be executed in quite a rapid tempo; then practise the rest of the trill. Where the '
         'fingering is changed (1), be careful that not the slightest unevenness is apparent." '
         '(M.M. quarter = 60 to 108). In bars 1-6 the treble staff is empty: the RH is written in '
         'the bass staff (stems up, digits above), the LH below the bass staff on ledger lines (stems '
         'down, digits below), the hands an octave apart. Each bar is 16 sixteenths (two beams, '
         'grouped 8+8) = 4/4; pitches checked by notehead detection against the staff lines. '
         'Digits are printed only on the first two steps of each bar in each hand. No start-repeat '
         'sign before bar 1.',
))
