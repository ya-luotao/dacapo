"""How the differences between the two readings of Nos. 42-53 were settled (python3 diff_s7.py
lists them; ../uncertain.md says how each was read). build_s7.py builds from passA with these
applied.

SOURCE: parts taken whole from the other reading, where passA misread the plate: (number, part).
FIXES: a part's reading changed where both passes erred, or completed where the reading's form
could not say what both passes saw: {'number', 'part', 'apply': function}.
"""

SOURCE = {}


def closing_rest(beats):
    """The part's last bar ends in a rest of `beats` quarters (the reading notes it in its marks)."""

    def apply(e):
        bars = [dict(b) for b in e['bars']]
        bars[-1]['rest'] = beats
        return {**e, 'bars': bars}

    return apply


def digit(bar, hand, step, was, now):
    """One printed digit read again: `was` in the reading, `now` on the plate."""

    def apply(e):
        found = [d for d in e['digits'] if d[:3] == (bar, hand, step)]
        assert found == [(bar, hand, step, was)], found
        return {**e, 'digits': [(bar, hand, step, now) if d[:3] == (bar, hand, step) else d
                                for d in e['digits']]}

    return apply


FIXES = [
    # No. 50's chromatic scale in minor thirds closes on a half-note chord and a quarter rest in
    # each hand (3/4); both passes say so in the bar's marks, which the steps cannot carry.
    {'number': 50, 'part': 'chromatic', 'apply': closing_rest(1)},
    # No. 45, 5th fingering, bar 1, LH step 3 (E3): both passes (and a verifier) read 4, "the closed
    # counter of a 4" above the bass staff's top line. Measured at 1200 dpi it is a 1 whose flag
    # tip touches the line, closing the gap under the flag into that counter: 88 px tall and 63
    # wide, as the page's clean 1s (82-90 by 54-62) and not its 4s (92-96 by 84-90), its upper
    # part 42 px wide as a 1's, and matched with the line masked, overlap 0.81-0.87 with the 1s
    # and at most 0.51 with the 4s. It is the 1 of the printed pattern 3 1 3 1 3 1.
    {'number': 45, 'part': '5', 'apply': digit(1, 'LH', 3, '4', '1')},
]

# No. 45, 1st fingering, bar 1, LH step 3: passA read 1, passB 4. The digit sits on the top line
# of the bass staff, which closes the long flag of a 1 into what looks like a 4's counter (as in
# Part I's Nos. 9 and 13). Matched at 1200 dpi against the clean digits of the same page with the
# line masked, it is a 1 (overlap 0.83 with the 1s, 0.48 with the 4s), the 1 of the printed
# 2 1 2 1 2 1: passA's reading stands.
