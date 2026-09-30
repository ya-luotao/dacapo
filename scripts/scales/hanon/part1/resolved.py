"""How the differences between the two readings of Part I were settled (python3 diff_part1.py
lists them; uncertain.md says how each was read). build_part1.py builds from passA with these
applied.

SOURCE: exercises taken whole from passB, where passA misread the plate's structure.
DIGITS: digits as printed, where the readings differed: (number, bar, hand, note) -> digit.
CORRECTIONS: digits printed that dacapo does not use, and what it uses instead.
"""

SOURCE = {
    # passA counted 15 bars in the descending half, as in No. 1; the plates have 14 (five, six,
    # six, six and five bars to the systems, 28 bars and the closing bar), as passB read.
    2: 'passB',
    3: 'passB',
    4: 'passB',
    # The last bar before the closing bar is not the descending group moved by step (passB read
    # it in full; passA took it as regular): No. 6 ends on E3 where the group gives C3, No. 9 on
    # D3 E3 where it gives C3 D3.
    6: 'passB',
    9: 'passB',
}

DIGITS = {
    # A digit sitting on the top line of the treble staff, where the line closes the flag of a 1
    # into what looks like a 4's counter: in No. 9 passA read 4 and passB 1, in No. 13 the other
    # way round. Matched at 1200 dpi against the clean 1s and 4s of the same page, the staff line
    # masked, each is a 1: as tall as the 1s (86 px; the 4s are 92-96), and overlapping them by
    # 0.65-0.81 against 0.29-0.62 for the 4s (a template match, the staff rows masked). The thumb, as the
    # fingering printed in full and every other bar have it.
    (9, 6, 'RH', 0): 1,
    (13, 6, 'RH', 1): 1,
}

# Digits printed that dacapo does not use: none (the two doubtful ones above are 1s as printed).
CORRECTIONS = []
